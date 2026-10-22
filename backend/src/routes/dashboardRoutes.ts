import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { authenticateToken } from '../auth.js';
import { getTrainingStatus } from './employeeRoutes.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/stats', authenticateToken, (req: Request, res: Response) => {
  const employees = db.employees.find();
  const trainings = db.trainings.getAll();
  const epis = db.epis.getAll();
  const risks = db.riskLocations.find();
  const documents = db.documents.find();
  const auditLogs = db.auditLogs.find(10);

  // Stats
  const activeEmployees = employees.filter(e => e.status === 'ativo').length;
  
  let expiredTrainings = 0;
  let expiringSoonTrainings = 0;
  trainings.forEach(t => {
    const st = getTrainingStatus(t.expiry_date);
    if (st === 'vencido') expiredTrainings++;
    if (st === 'prestes_a_vencer') expiringSoonTrainings++;
  });

  const activeAprs = documents.filter(d => d.type.startsWith('APR_') && d.status === 'ativa').length;
  const totalAprs = documents.filter(d => d.type.startsWith('APR_')).length;
  const totalDocuments = documents.length;

  // Breakdown of risk locations
  const riskTypeBreakdown = {
    altura: risks.filter(r => r.risk_type === 'altura').length,
    espaco_confinado: risks.filter(r => r.risk_type === 'espaco_confinado').length,
    ambos: risks.filter(r => r.risk_type === 'ambos').length,
    outro: risks.filter(r => r.risk_type === 'outro').length
  };

  // Recent 5 APRs
  const recentAprs = documents
    .filter(d => d.type.startsWith('APR_'))
    .slice(0, 5)
    .map(d => ({
      id: d.id,
      code: d.code,
      title: d.title,
      type: d.type,
      status: d.status,
      created_by_name: d.created_by_name,
      created_at: d.created_at,
      device_name: d.device_name
    }));

  return res.json({
    kpis: {
      totalEmployees: employees.length,
      activeEmployees,
      totalRiskLocations: risks.length,
      activeAprs,
      totalAprs,
      totalDocuments,
      expiredTrainings,
      expiringSoonTrainings
    },
    riskTypeBreakdown,
    recentAprs,
    recentAuditLogs: auditLogs
  });
});
