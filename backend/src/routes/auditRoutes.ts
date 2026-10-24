import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { authenticateToken, requirePermission, logAudit } from '../auth.js';

export const auditRoutes = Router();

auditRoutes.get('/', authenticateToken, requirePermission('audit', 'view'), (req: Request, res: Response) => {
  const { limit, module: moduleFilter } = req.query;
  const max = limit ? parseInt(limit as string, 10) : 200;
  
  let logs = db.auditLogs.find(max);
  if (moduleFilter) {
    logs = logs.filter(l => l.module === moduleFilter);
  }

  return res.json(logs);
});

// Endpoint para registrar tentativa de divergência biométrica com Snapshot e GPS
auditRoutes.post('/divergence', (req: Request, res: Response) => {
  try {
    const {
      workerName,
      workerId,
      documentId,
      attemptNumber,
      snapshotPhotoUrl,
      lat,
      lng,
      reason,
      deviceId
    } = req.body;

    const detailsObj = {
      workerName: workerName || 'Desconhecido',
      workerId,
      documentId,
      attemptNumber: attemptNumber || 1,
      snapshotPhotoUrl: snapshotPhotoUrl ? snapshotPhotoUrl.slice(0, 100) + '...' : undefined,
      fullSnapshot: snapshotPhotoUrl, // Foto da tentativa não autorizada
      coordinates: lat && lng ? { lat, lng } : undefined,
      reason: reason || 'Rosto divergente do titular cadastrado',
      timestamp: new Date().toISOString()
    };

    const newLog = {
      id: 'aud_div_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      user_id: workerId || 'unknown',
      user_name: workerName || 'Tentativa Divergente',
      action: 'BIOMETRIC_DIVERGENCE_ALERT',
      module: 'biometrics',
      details: JSON.stringify(detailsObj),
      device_id: deviceId || (req.headers['x-device-id'] as string) || 'UNKNOWN',
      ip_address: req.ip || req.socket.remoteAddress,
      created_at: new Date().toISOString()
    };

    db.auditLogs.insert(newLog as any);
    db.save();

    console.warn(`[SegTrabalho] ⚠️ ALERTA DE DIVERGÊNCIA BIOMÉTRICA gravado: Colaborador ${workerName} (Tentativa ${attemptNumber})`);

    return res.status(201).json({ success: true, logId: newLog.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao registrar alerta de divergência.' });
  }
});

// Endpoint para listar apenas alertas de divergência biométrica para o Administrador
auditRoutes.get('/divergence', authenticateToken, (req: Request, res: Response) => {
  try {
    const allLogs = db.auditLogs.find(300);
    const divergenceLogs = allLogs.filter(l => l.action === 'BIOMETRIC_DIVERGENCE_ALERT');
    return res.json(divergenceLogs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao listar alertas.' });
  }
});
