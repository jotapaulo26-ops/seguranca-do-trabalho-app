import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { authenticateToken, logAudit, JWT_SECRET } from '../auth.js';

export const authRoutes = Router();

authRoutes.post('/login', (req: Request, res: Response) => {
  const { email, password, deviceId, deviceName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  const user = db.users.findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
  }

  if (user.active === 0) {
    return res.status(403).json({ error: 'Esta conta está inativa. Contate o administrador.' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
  }

  // Update last device ID
  if (deviceId) {
    db.users.update(user.id, { device_id: deviceId });
  }

  const role = db.roles.findById(user.role_id);
  const permissions = role ? role.permissions : {};

  const tokenPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.role_id,
    roleName: role ? role.name : 'Sem Perfil',
    permissions,
    deviceId: deviceId || 'Desconhecido'
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

  // Log successful login with Device ID
  req.user = tokenPayload;
  logAudit(req, 'LOGIN', 'AUTENTICACAO', `Login realizado com sucesso pelo dispositivo: ${deviceName || deviceId || 'Web'}`);

  return res.json({
    message: 'Login realizado com sucesso!',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.role_id,
      roleName: role ? role.name : 'Sem Perfil',
      permissions
    }
  });
});

authRoutes.get('/me', authenticateToken, (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  const user = db.users.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const role = db.roles.findById(user.role_id);

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.role_id,
      roleName: role ? role.name : 'Sem Perfil',
      permissions: role ? role.permissions : {}
    }
  });
});

authRoutes.put('/profile', authenticateToken, (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });

  const { name, currentPassword, newPassword } = req.body;
  const user = db.users.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

  const updates: any = {};
  if (name && name.trim()) {
    updates.name = name.trim();
  }

  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Informe a senha atual para alterá-la.' });
    }
    const match = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }
    const salt = bcrypt.genSaltSync(10);
    updates.password_hash = bcrypt.hashSync(newPassword, salt);
  }

  db.users.update(user.id, updates);
  logAudit(req, 'ATUALIZAR_PERFIL', 'USUARIOS', 'Usuário atualizou dados do perfil');

  return res.json({ message: 'Perfil atualizado com sucesso!' });
});
