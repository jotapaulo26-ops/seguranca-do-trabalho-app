import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'segtrabalho_super_secret_jwt_key_2026';

export interface UserPayload {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: Record<string, string[]>;
  deviceId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      deviceId?: string;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // Capture device-id and client IP
  const deviceIdHeader = req.headers['x-device-id'] as string;
  if (deviceIdHeader) {
    req.deviceId = deviceIdHeader;
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    
    // Check if user is still active in database
    const user = db.users.findById(decoded.id);
    if (!user || user.active === 0) {
      return res.status(403).json({ error: 'Usuário inativo ou não encontrado.' });
    }

    // Refresh permissions from role in db in case admin changed them recently
    const role = db.roles.findById(user.role_id);
    if (role) {
      decoded.roleName = role.name;
      decoded.roleId = user.role_id;
      decoded.permissions = role.permissions;
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Sessão expirada ou token inválido. Faça login novamente.' });
  }
}

export function requirePermission(moduleName: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    // If role is system admin, grant all permissions
    if (req.user.roleId === 'role_admin' || req.user.roleName === 'Administrador') {
      return next();
    }

    const modulePermissions = req.user.permissions?.[moduleName] || [];
    if (modulePermissions.includes(action) || modulePermissions.includes('*') || modulePermissions.includes('manage')) {
      return next();
    }

    return res.status(403).json({ 
      error: `Acesso negado: seu perfil não possui permissão para '${action}' no módulo '${moduleName}'.` 
    });
  };
}

export function logAudit(req: Request, action: string, moduleName: string, details?: string) {
  try {
    const id = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const userId = req.user?.id || null;
    const userName = req.user?.name || 'Sistema / Convidado';
    const deviceId = (req.headers['x-device-id'] as string) || req.user?.deviceId || 'Desconhecido';
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1';

    db.auditLogs.create({
      id,
      user_id: userId,
      user_name: userName,
      action,
      module: moduleName,
      details: details || null,
      device_id: deviceId,
      ip_address: ip,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao gravar log de auditoria:', error);
  }
}
