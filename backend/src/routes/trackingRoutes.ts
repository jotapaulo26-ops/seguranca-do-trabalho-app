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

  // Check proximity to all registered risk locations in DB (< 25 meters = warning)
  const risks = db.riskLocations.find();
  const nearbyRisks = risks
    .map(r => {
      const distance = calculateDistanceMeters(numLat, numLng, r.lat, r.lng);
      return {
        id: r.id,
        name: r.name,
        risk_type: r.risk_type,
        distance,
        isInsideZone: distance <= 25,
        required_epis: r.required_epis || []
      };
    })
    .filter(r => r.isInsideZone);

  return res.json({
    success: true,
    activeUsersCount: activeUsersMap.size,
    nearbyRisks
  });
});

// 2. ACTIVE USERS: Fetch all online users updated in the last 30 seconds
trackingRoutes.get('/active-users', authenticateToken, (req: Request, res: Response) => {
  const currentUserId = req.user?.id;
  const now = Date.now();
  const STALE_TIMEOUT_MS = 30000; // 30 seconds cutoff

  const result: (ActiveUserLocation & { isCurrentUser: boolean })[] = [];

  // Cleanup stale sessions and populate active list
  for (const [userId, userLoc] of activeUsersMap.entries()) {
    if (now - userLoc.lastSeenTimestamp > STALE_TIMEOUT_MS) {
      activeUsersMap.delete(userId);
    } else {
      result.push({
        ...userLoc,
        isCurrentUser: userId === currentUserId
      });
    }
  }

  return res.json(result);
});

// 3. OFFLINE: Mark user as disconnected
trackingRoutes.post('/offline', authenticateToken, (req: Request, res: Response) => {
  if (req.user?.id) {
    activeUsersMap.delete(req.user.id);
  }
  return res.json({ success: true, message: 'Usuário desconectado do rastreamento.' });
});
