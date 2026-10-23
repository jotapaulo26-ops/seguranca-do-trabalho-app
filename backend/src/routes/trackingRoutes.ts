import { Router, Request, Response } from 'express';
import { authenticateToken } from '../auth.js';
import { db } from '../db.js';

export const trackingRoutes = Router();

export interface ActiveUserLocation {
  userId: string;
  name: string;
  roleName: string;
  roleType: 'brigadista' | 'sst' | 'executante' | 'admin';
  phone?: string;
  department?: string;
  photo_url?: string;
  isOnline?: boolean;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  lastSeenAt: string;
  lastSeenTimestamp: number;
  deviceId?: string;
}

// In-memory registry of active online users (fast, high-frequency)
const activeUsersMap = new Map<string, ActiveUserLocation>();

// Haversine distance calculator in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// 1. HEARTBEAT: Transmit user's GPS coords every 3-5 seconds
trackingRoutes.post('/heartbeat', authenticateToken, (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Não autorizado.' });

  const { lat, lng, accuracy, heading, speed } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Coordenadas lat e lng são obrigatórias.' });
  }

  const numLat = Number(lat);
  const numLng = Number(lng);

  if (isNaN(numLat) || isNaN(numLng)) {
    return res.status(400).json({ error: 'Coordenadas inválidas.' });
  }

  // Determine role type for map styling
  let roleType: 'brigadista' | 'sst' | 'executante' | 'admin' = 'executante';
  const roleLower = (req.user.roleName || '').toLowerCase();
  if (roleLower.includes('brigad') || roleLower.includes('socorr') || roleLower.includes('incêndio')) {
    roleType = 'brigadista';
  } else if (roleLower.includes('técnico') || roleLower.includes('engenh') || roleLower.includes('sst')) {
    roleType = 'sst';
  } else if (roleLower.includes('admin')) {
    roleType = 'admin';
  }

  // Cross-reference with employees db to fetch phone and department
  const allEmployees = db.employees.find();
  const matchedEmp = allEmployees.find(e =>
    e.email?.toLowerCase() === req.user!.email?.toLowerCase() ||
    e.name.toLowerCase() === req.user!.name.toLowerCase()
  );

  // Check if user is registered in brigade members
  if (matchedEmp) {
    const isBrigadist = db.brigadeMembers.find().some(b => b.employee_id === matchedEmp.id);
    if (isBrigadist) roleType = 'brigadista';
  }

  const now = Date.now();
  const locationEntry: ActiveUserLocation = {
    userId: req.user.id,
    name: req.user.name,
    roleName: req.user.roleName,
    roleType,
    phone: matchedEmp?.phone,
    department: matchedEmp?.department,
    photo_url: matchedEmp?.photo_url || db.users.findById(req.user.id)?.photo_url,
    isOnline: true,
    lat: numLat,
    lng: numLng,
    accuracy: accuracy !== undefined ? Number(accuracy) : undefined,
    heading: heading !== undefined ? Number(heading) : undefined,
    speed: speed !== undefined ? Number(speed) : undefined,
    lastSeenAt: new Date().toISOString(),
    lastSeenTimestamp: now,
    deviceId: req.deviceId || req.user.deviceId
  };

  activeUsersMap.set(req.user.id, locationEntry);

  // Check proximity to all registered risk locations in DB using custom geofence_radius and PT authorization check
  const risks = db.riskLocations.find();
  const allDocs = db.documents.find();

  const nearbyRisks = risks
    .map(r => {
      const radius = r.geofence_radius || 25;
      const distance = calculateDistanceMeters(numLat, numLng, r.lat, r.lng);
      const isInsideZone = distance <= radius;

      if (!isInsideZone) return null;

      // Check if user is a supervisor/technician or has an active authorized PT/APR
      const isSupervisor =
        roleType === 'sst' ||
        roleType === 'admin' ||
        roleType === 'brigadista' ||
        (req.user?.roleName || '').toLowerCase().includes('supervisor');

      const isExplicitlyAuthorized = (r.authorized_employee_ids || []).includes(matchedEmp?.id || '');

      const activePts = allDocs.filter(
        d =>
          (d.type === 'PT' || d.type === 'PET' || d.type.startsWith('APR_')) &&
          d.status === 'ativa' &&
          d.location_id === r.id
      );

      const isWorkerInActivePt = activePts.some(pt => {
        const workers = pt.data?.authorizedWorkers || [];
        const isListed = workers.some((w: any) => (typeof w === 'string' ? w : w.id) === matchedEmp?.id);
        const isEmissor = pt.created_by_user_id === req.user?.id;
        return isListed || isEmissor;
      });

      const isAuthorized = isSupervisor || isExplicitlyAuthorized || isWorkerInActivePt;

      return {
        id: r.id,
        name: r.name,
        risk_type: r.risk_type,
        distance,
        radius,
        isInsideZone: true,
        isUnauthorizedIntrusion: !isAuthorized,
        required_epis: r.required_epis || []
      };
    })
    .filter(Boolean);

  return res.json({
    success: true,
    activeUsersCount: activeUsersMap.size,
    nearbyRisks
  });
});

// 2. ACTIVE & REGISTERED USERS: Fetch all users (Live GPS when online + Usina coordinates when offline)
trackingRoutes.get('/active-users', authenticateToken, (req: Request, res: Response) => {
  const currentUserId = req.user?.id;
  const now = Date.now();
  const STALE_TIMEOUT_MS = 30000; // 30 seconds cutoff

  // 1. Cleanup stale sessions
  for (const [userId, userLoc] of activeUsersMap.entries()) {
    if (now - userLoc.lastSeenTimestamp > STALE_TIMEOUT_MS) {
      activeUsersMap.delete(userId);
    }
  }

  const result: (ActiveUserLocation & { isCurrentUser: boolean })[] = [];
  const processedUserIds = new Set<string>();

  // 2. Add all live online users first
  for (const [userId, userLoc] of activeUsersMap.entries()) {
    processedUserIds.add(userId);
    result.push({
      ...userLoc,
      isOnline: true,
      isCurrentUser: userId === currentUserId
    });
  }

  // 3. Add all remaining registered & approved users as offline workers positioned in Usina Santa Isabel
  const allUsers = db.users.find().filter(u => u.active === 1 || u.approval_status === 'aprovado');
  const allRoles = db.roles.find();
  const allEmployees = db.employees.find();

  const baseLat = -21.5083;
  const baseLng = -49.2081;

  allUsers.forEach((u, idx) => {
    if (processedUserIds.has(u.id)) return;

    const matchedEmp = allEmployees.find(e => e.id === u.id || e.email.toLowerCase() === u.email.toLowerCase());
    const role = allRoles.find(r => r.id === u.role_id);
    const roleName = role ? role.name : u.role_id || 'Colaborador';

    let roleType: 'brigadista' | 'sst' | 'executante' | 'admin' = 'executante';
    const roleLower = roleName.toLowerCase();
    if (roleLower.includes('brigad') || roleLower.includes('socorr')) {
      roleType = 'brigadista';
    } else if (roleLower.includes('técnico') || roleLower.includes('engenh') || roleLower.includes('sst')) {
      roleType = 'sst';
    } else if (roleLower.includes('admin')) {
      roleType = 'admin';
    }

    // Distribute offline markers in the Usina perimeter
    const angle = (idx * 2 * Math.PI) / Math.max(1, allUsers.length);
    const offsetLat = Math.sin(angle) * 0.00040;
    const offsetLng = Math.cos(angle) * 0.00045;

    result.push({
      userId: u.id,
      name: u.name,
      roleName,
      roleType,
      phone: u.phone || matchedEmp?.phone,
      department: u.department || matchedEmp?.department || 'Usina Santa Isabel',
      photo_url: u.photo_url || matchedEmp?.photo_url,
      isOnline: false,
      lat: Number((baseLat + offsetLat).toFixed(6)),
      lng: Number((baseLng + offsetLng).toFixed(6)),
      accuracy: 50,
      lastSeenAt: u.created_at || new Date().toISOString(),
      lastSeenTimestamp: 0,
      isCurrentUser: u.id === currentUserId
    });
  });

  return res.json(result);
});

// 3. OFFLINE: Mark user as disconnected
trackingRoutes.post('/offline', authenticateToken, (req: Request, res: Response) => {
  if (req.user?.id) {
    activeUsersMap.delete(req.user.id);
  }
  return res.json({ success: true, message: 'Usuário desconectado do rastreamento.' });
});
