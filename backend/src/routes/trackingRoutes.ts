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
  hasActiveIntrusion?: boolean;
}

export interface ActiveIntrusionEvent {
  id: string; // `${userId}_${riskId}`
  userId: string;
  userName: string;
  userRole: string;
  userPhone?: string;
  userDepartment?: string;
  photo_url?: string;
  riskId: string;
  riskName: string;
  riskType: string;
  distance: number;
  radius: number;
  timestamp: number;
  timestampIso: string;
  userLat: number;
  userLng: number;
}

// In-memory registry of active online users (fast, high-frequency)
const activeUsersMap = new Map<string, ActiveUserLocation>();

// In-memory registry of active unauthorized geofence intrusions
const activeIntrusionsMap = new Map<string, ActiveIntrusionEvent>();

// In-memory queue of remote alarms triggered by supervisors targeting a specific user's phone
const remoteAlarmsMap = new Map<string, { triggeredAt: number; riskName: string }>();

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

  // Check if there are unauthorized intrusions in geofences
  const unauthorizedIntrusions = (nearbyRisks as any[]).filter(nr => nr && nr.isUnauthorizedIntrusion);

  if (unauthorizedIntrusions.length > 0) {
    locationEntry.hasActiveIntrusion = true;
    unauthorizedIntrusions.forEach(nr => {
      const intrusionId = `${req.user!.id}_${nr.id}`;
      const entry: ActiveIntrusionEvent = {
        id: intrusionId,
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.roleName,
        userPhone: matchedEmp?.phone || (db.users.findById(req.user!.id)?.phone),
        userDepartment: matchedEmp?.department || 'Usina Santa Isabel',
        photo_url: matchedEmp?.photo_url || (db.users.findById(req.user!.id)?.photo_url),
        riskId: nr.id,
        riskName: nr.name,
        riskType: nr.risk_type,
        distance: nr.distance,
        radius: nr.radius,
        timestamp: now,
        timestampIso: new Date().toISOString(),
        userLat: numLat,
        userLng: numLng
      };
      activeIntrusionsMap.set(intrusionId, entry);

      try {
        if (db.geofence_events) {
          db.geofence_events.insert({
            user_id: req.user!.id,
            user_name: req.user!.name,
            risk_id: nr.id,
            risk_name: nr.name,
            event_type: 'intrusao_nao_autorizada',
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {}
    });
  } else {
    locationEntry.hasActiveIntrusion = false;
    for (const [key, val] of activeIntrusionsMap.entries()) {
      if (val.userId === req.user!.id) {
        activeIntrusionsMap.delete(key);
      }
    }
  }

  // Check if supervisor triggered a remote alarm for this user's phone
  let remoteAlarm: { active: boolean; riskName?: string } | null = null;
  if (remoteAlarmsMap.has(req.user.id)) {
    const alarm = remoteAlarmsMap.get(req.user.id)!;
    if (now - alarm.triggeredAt < 60000) {
      remoteAlarm = { active: true, riskName: alarm.riskName };
    }
    remoteAlarmsMap.delete(req.user.id);
  }

  return res.json({
    success: true,
    activeUsersCount: activeUsersMap.size,
    nearbyRisks,
    remoteAlarm
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
    const isIntruding = !!userLoc.hasActiveIntrusion || Array.from(activeIntrusionsMap.values()).some(i => i.userId === userId);
    result.push({
      ...userLoc,
      hasActiveIntrusion: isIntruding,
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
    for (const [key, val] of activeIntrusionsMap.entries()) {
      if (val.userId === req.user.id) {
        activeIntrusionsMap.delete(key);
      }
    }
  }
  return res.json({ success: true, message: 'Usuário desconectado do rastreamento.' });
});

// 4. ACTIVE INTRUSIONS: Real-time list of unauthorized geofence breaches for Admin & SST
trackingRoutes.get('/active-intrusions', authenticateToken, (req: Request, res: Response) => {
  const now = Date.now();
  // Cleanup intrusions that haven't been refreshed in 45 seconds
  for (const [key, val] of activeIntrusionsMap.entries()) {
    if (now - val.timestamp > 45000) {
      activeIntrusionsMap.delete(key);
    }
  }
  const intrusions = Array.from(activeIntrusionsMap.values());
  return res.json(intrusions);
});

// 5. TRIGGER REMOTE ALARM: Supervisor commands user's phone to play siren and vibrate
trackingRoutes.post('/trigger-remote-alarm', authenticateToken, (req: Request, res: Response) => {
  const { userId, riskName } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId é obrigatório.' });
  }

  remoteAlarmsMap.set(userId, {
    triggeredAt: Date.now(),
    riskName: riskName || 'Área de Risco'
  });

  return res.json({
    success: true,
    message: 'Comando de sirene remota enviado com sucesso.'
  });
});

// 6. RESOLVE INTRUSION: Clear/acknowledge intrusion event
trackingRoutes.post('/resolve-intrusion', authenticateToken, (req: Request, res: Response) => {
  const { intrusionId, userId } = req.body;
  if (intrusionId) {
    activeIntrusionsMap.delete(intrusionId);
  } else if (userId) {
    for (const [key, val] of activeIntrusionsMap.entries()) {
      if (val.userId === userId) {
        activeIntrusionsMap.delete(key);
      }
    }
  }
  return res.json({ success: true, message: 'Intrusão resolvida.' });
});
