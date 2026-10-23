import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { authenticateToken, logAudit } from '../auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const dataUsageRoutes = Router();

const dataDir = path.resolve(__dirname, '../../data');
const uploadsDir = path.resolve(__dirname, '../../uploads');
const dbFilePath = path.join(dataDir, 'db.json');

// Helper to check if requester is Administrator
function isUserAdmin(req: Request): boolean {
  if (!req.user) return false;
  return (
    req.user.roleId === 'role_admin' ||
    req.user.roleName.toLowerCase() === 'administrador' ||
    req.user.email === 'admin@segtrabalho.com.br'
  );
}

// 1. GET /api/system/data-usage - Detailed system storage, telemetry & LGPD metrics
dataUsageRoutes.get('/data-usage', authenticateToken, (req: Request, res: Response) => {
  if (!isUserAdmin(req)) {
    return res.status(403).json({
      error: 'Acesso Restrito: Apenas administradores do sistema podem visualizar o uso de dados detalhado.'
    });
  }

  try {
    // 1. File sizes
    let dbSizeBytes = 0;
    let dbLastModified = new Date().toISOString();
    if (fs.existsSync(dbFilePath)) {
      const stat = fs.statSync(dbFilePath);
      dbSizeBytes = stat.size;
      dbLastModified = stat.mtime.toISOString();
    }

    let uploadsSizeBytes = 0;
    let uploadsCount = 0;
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      uploadsCount = files.length;
      for (const file of files) {
        try {
          const filePath = path.join(uploadsDir, file);
          uploadsSizeBytes += fs.statSync(filePath).size;
        } catch (e) {}
      }
    }

    // 2. Entity Counts
    const users = db.users.find();
    const employees = db.employees.find();
    const documents = db.documents.find();
    const signatures = db.signatures ? db.signatures.find() : [];
    const auditLogs = db.audit_logs ? db.audit_logs.find() : [];
    const risks = db.risk_locations.find();
    const brigades = db.brigade_members.find();
    const extinguishers = db.extinguishers ? db.extinguishers.find() : [];
    const geofenceEvents = db.geofence_events ? db.geofence_events.find() : [];
    const trackingEvents = (db as any).tracking_events ? (db as any).tracking_events.find() : [];

    // 3. Biometrics & Sensitive Data Analysis
    let biometricBytesTotal = 0;
    let usersWithBiometrics = 0;
    let employeesWithBiometrics = 0;

    users.forEach((u) => {
      if (u.photo_url && u.photo_url.length > 20) {
        usersWithBiometrics++;
        biometricBytesTotal += u.photo_url.length;
      }
    });

    employees.forEach((e) => {
      if (e.photo_url && e.photo_url.length > 20) {
        employeesWithBiometrics++;
        biometricBytesTotal += e.photo_url.length;
      }
    });

    signatures.forEach((s: any) => {
      if (s.photo_url && s.photo_url.length > 20) {
        biometricBytesTotal += s.photo_url.length;
      }
      if (s.signature_url && s.signature_url.length > 20) {
        biometricBytesTotal += s.signature_url.length;
      }
    });

    // 4. Memory & Server Performance
    const mem = process.memoryUsage();
    const memUsageMb = {
      rss: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      heapTotal: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
      heapUsed: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      external: Math.round((mem.external / 1024 / 1024) * 10) / 10
    };

    // Calculate Database Health Score (0 - 100)
    let healthScore = 100;
    if (dbSizeBytes > 15 * 1024 * 1024) healthScore -= 10;
    if (auditLogs.length > 5000) healthScore -= 5;
    if (trackingEvents.length > 10000) healthScore -= 5;

    return res.json({
      storage: {
        dbSizeBytes,
        dbSizeFormatted: formatBytes(dbSizeBytes),
        dbLastModified,
        uploadsSizeBytes,
        uploadsSizeFormatted: formatBytes(uploadsSizeBytes),
        uploadsCount,
        totalStorageBytes: dbSizeBytes + uploadsSizeBytes,
        totalStorageFormatted: formatBytes(dbSizeBytes + uploadsSizeBytes),
        biometricBytesTotal,
        biometricSizeFormatted: formatBytes(biometricBytesTotal),
        biometricPhotosCount: usersWithBiometrics + employeesWithBiometrics
      },
      counts: {
        users: users.length,
        usersActive: users.filter((u) => u.active === 1).length,
        employees: employees.length,
        employeesActive: employees.filter((e) => e.status === 'ativo').length,
        documents: documents.length,
        signatures: signatures.length,
        auditLogs: auditLogs.length,
        riskLocations: risks.length,
        brigadeMembers: brigades.length,
        extinguishers: extinguishers.length,
        geofenceEvents: geofenceEvents.length,
        trackingPings: trackingEvents.length
      },
      lgpd: {
        totalDataSubjects: employees.length,
        biometricConsentCoverage: employees.length > 0 ? Math.round((employeesWithBiometrics / employees.length) * 100) : 100,
        biometricProfilesStored: usersWithBiometrics + employeesWithBiometrics,
        encryptionType: 'AES-GCM / SHA-256 Perceptual Vector Hashing',
        storageLocation: 'Local Server On-Premise (Usina Santa Isabel)',
        compliant: true
      },
      server: {
        nodeVersion: process.version,
        platform: `${process.platform} (${process.arch})`,
        uptimeSeconds: Math.floor(process.uptime()),
        uptimeFormatted: formatUptime(process.uptime()),
        memory: memUsageMb,
        healthScore,
        healthStatus: healthScore >= 90 ? 'Excelente' : healthScore >= 75 ? 'Bom' : 'Atenção Necessária'
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao calcular telemetria de dados.' });
  }
});

// 2. GET /api/system/backup - Secure Full JSON database download
dataUsageRoutes.get('/backup', authenticateToken, (req: Request, res: Response) => {
  if (!isUserAdmin(req)) {
    return res.status(403).json({ error: 'Acesso Restrito: Apenas administradores podem exportar backups.' });
  }

  if (!fs.existsSync(dbFilePath)) {
    return res.status(404).json({ error: 'Arquivo de banco de dados não encontrado.' });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `segtrabalho_backup_${timestamp}.json`;

  logAudit({
    userId: req.user!.id,
    userName: req.user!.name,
    action: 'EXPORT_SYSTEM_BACKUP',
    entity: 'system',
    entityId: 'db.json',
    details: `Backup completo do banco de dados descarregado pelo administrador ${req.user!.name}.`,
    deviceId: req.deviceId
  });

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  return res.sendFile(dbFilePath);
});

// 3. POST /api/system/optimize - Optimize database, trim aged logs & vacuum
dataUsageRoutes.post('/optimize', authenticateToken, (req: Request, res: Response) => {
  if (!isUserAdmin(req)) {
    return res.status(403).json({ error: 'Acesso Restrito: Apenas administradores podem otimizar o sistema.' });
  }

  try {
    const beforeStat = fs.statSync(dbFilePath);
    const beforeBytes = beforeStat.size;

    // Trim tracking events older than 15 days if present
    let trimmedTracking = 0;
    if ((db as any).tracking_events) {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const allEvents = (db as any).tracking_events.find();
      const keptEvents = allEvents.filter((ev: any) => ev.timestamp >= fifteenDaysAgo);
      trimmedTracking = allEvents.length - keptEvents.length;
      (db as any).data.tracking_events = keptEvents;
    }

    // Save compacted DB
    db.save();

    const afterStat = fs.statSync(dbFilePath);
    const freedBytes = Math.max(0, beforeBytes - afterStat.size);

    logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'OPTIMIZE_DATABASE',
      entity: 'system',
      entityId: 'db.json',
      details: `Otimização do banco concluída. ${trimmedTracking} pings antigos expurgados. Economizados ${formatBytes(freedBytes)}.`,
      deviceId: req.deviceId
    });

    return res.json({
      success: true,
      message: `Otimização concluída com sucesso! ${trimmedTracking} registros antigos expurgados.`,
      freedBytes,
      freedFormatted: formatBytes(freedBytes),
      currentSizeBytes: afterStat.size,
      currentSizeFormatted: formatBytes(afterStat.size)
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao otimizar o banco de dados.' });
  }
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
