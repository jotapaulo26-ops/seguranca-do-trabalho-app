import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { authenticateToken, requirePermission, logAudit } from '../auth.js';

export const settingRoutes = Router();

settingRoutes.get('/', authenticateToken, (req: Request, res: Response) => {
  const settings = db.settings.getAll();
  return res.json(settings);
});

// Update settings (Admin only)
settingRoutes.put('/', authenticateToken, requirePermission('settings', 'manage'), (req: Request, res: Response) => {
  const newSettings = req.body;
  if (!newSettings || typeof newSettings !== 'object') {
    return res.status(400).json({ error: 'Configurações inválidas.' });
  }

  const updated = db.settings.updateMany(newSettings);
  logAudit(req, 'ATUALIZAR_CONFIGURACOES', 'CONFIGURACOES', 'Configurações da empresa/sistema atualizadas');

  return res.json(updated);
});
