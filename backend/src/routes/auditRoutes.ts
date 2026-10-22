import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { authenticateToken, requirePermission } from '../auth.js';

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
