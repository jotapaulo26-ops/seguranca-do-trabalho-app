import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, User } from '../db.js';
import { authenticateToken, requirePermission, logAudit } from '../auth.js';

export const userRoutes = Router();

// List all users
userRoutes.get('/', authenticateToken, requirePermission('users', 'view'), (req: Request, res: Response) => {
  const users = db.users.find();
  const roles = db.roles.find();
  
  // Attach role name to each user
  const usersWithRole = users.map(u => ({
    ...u,
    role_name: roles.find(r => r.id === u.role_id)?.name || 'Desconhecido'
  }));

  return res.json(usersWithRole);
});

// Create user
userRoutes.post('/', authenticateToken, requirePermission('users', 'manage'), (req: Request, res: Response) => {
  const { name, email, password, role_id } = req.body;

  if (!name || !email || !password || !role_id) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios (nome, e-mail, senha e perfil).' });
  }

  const existing = db.users.findByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
  }

  const role = db.roles.findById(role_id);
  if (!role) {
    return res.status(400).json({ error: 'Perfil selecionado não existe.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(password, salt);

  const newUser: User = {
    id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password_hash,
    role_id,
    active: 1,
    created_at: new Date().toISOString()
  };

  const safeUser = db.users.create(newUser);
  logAudit(req, 'CRIAR_USUARIO', 'USUARIOS', `Novo usuário cadastrado: ${newUser.name} (${newUser.email}) com perfil ${role.name}`);

  return res.status(201).json(safeUser);
});

// Update user (change role, status, name, or reset password)
userRoutes.put('/:id', authenticateToken, requirePermission('users', 'manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, role_id, active, newPassword } = req.body;

  const user = db.users.findById(id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const updates: Partial<User> = {};
  if (name) updates.name = name.trim();
  if (role_id) {
    const role = db.roles.findById(role_id);
    if (!role) return res.status(400).json({ error: 'Perfil inválido.' });
    updates.role_id = role_id;
  }
  if (active !== undefined) {
    updates.active = active ? 1 : 0;
  }
  if (newPassword && newPassword.trim()) {
    const salt = bcrypt.genSaltSync(10);
    updates.password_hash = bcrypt.hashSync(newPassword.trim(), salt);
  }

  const updated = db.users.update(id, updates);
  logAudit(req, 'EDITAR_USUARIO', 'USUARIOS', `Dados do usuário ${user.name} atualizados pelo admin`);

  return res.json(updated);
});

// Delete user
userRoutes.delete('/:id', authenticateToken, requirePermission('users', 'manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const user = db.users.findById(id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  if (user.id === req.user?.id) {
    return res.status(400).json({ error: 'Você não pode excluir sua própria conta logada.' });
  }

  db.users.delete(id);
  logAudit(req, 'EXCLUIR_USUARIO', 'USUARIOS', `Usuário ${user.name} excluído`);

  return res.json({ message: 'Usuário excluído com sucesso.' });
});
