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

// List pending registration requests
userRoutes.get('/pending', authenticateToken, requirePermission('users', 'manage'), (req: Request, res: Response) => {
  const pending = db.users.findPending();
  return res.json(pending);
});

// Approve user registration and assign role
userRoutes.put('/:id/approve', authenticateToken, requirePermission('users', 'manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { role_id } = req.body;

  if (!role_id) {
    return res.status(400).json({ error: 'Selecione um Perfil de Acesso para o usuário.' });
  }

  const user = db.users.findById(id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const role = db.roles.findById(role_id);
  if (!role) {
    return res.status(400).json({ error: 'Perfil de Acesso inválido ou inexistente.' });
  }

  const updated = db.users.update(id, {
    approval_status: 'aprovado',
    active: 1,
    role_id: role.id
  });

  // Sincronização automática com db.employees
  const allEmployees = db.employees.find();
  const existingEmp = allEmployees.find(
    e => e.id === user.id || e.email.toLowerCase() === user.email.toLowerCase()
  );

  if (existingEmp) {
    db.employees.update(existingEmp.id, {
      name: user.name,
      role: role.name,
      department: user.department || existingEmp.department,
      photo_url: user.photo_url || existingEmp.photo_url,
      phone: user.phone || existingEmp.phone,
      status: 'ativo'
    });
  } else {
    db.employees.create({
      id: user.id,
      name: user.name,
      cpf: '',
      registration_number: `REG-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      role: role.name,
      department: user.department || 'Geral',
      admission_date: new Date().toISOString().split('T')[0],
      phone: user.phone || '',
      email: user.email,
      photo_url: user.photo_url,
      status: 'ativo',
      created_at: new Date().toISOString()
    });
  }

  logAudit(
    req,
    'APROVAR_CADASTRO',
    'USUARIOS',
    `Cadastro aprovado: ${user.name} (${user.email}) com perfil atribuído: ${role.name}`
  );

  return res.json({
    message: `Cadastro de ${user.name} aprovado com sucesso!`,
    user: updated
  });
});

// Update facial biometrics for user and corresponding employee
userRoutes.put('/:id/biometrics', authenticateToken, requirePermission('users', 'manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { photo_url } = req.body;

  if (!photo_url || typeof photo_url !== 'string') {
    return res.status(400).json({ error: 'Foto facial em formato base64/dataURL é obrigatória.' });
  }

  const user = db.users.findById(id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  db.users.update(id, { photo_url });

  // Sincroniza com funcionário correspondente
  const emp = db.employees.findById(id) || db.employees.find().find(e => e.email.toLowerCase() === user.email.toLowerCase());
  if (emp) {
    db.employees.update(emp.id, { photo_url });
  }

  logAudit(req, 'ATUALIZAR_BIOMETRIA', 'USUARIOS', `Nova biometria facial registrada para ${user.name}`);

  return res.json({ success: true, message: `Biometria facial de ${user.name} atualizada com sucesso!` });
});

// Reject user registration
userRoutes.put('/:id/reject', authenticateToken, requirePermission('users', 'manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const user = db.users.findById(id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  db.users.update(id, {
    approval_status: 'rejeitado',
    active: 0
  });

  logAudit(
    req,
    'REJEITAR_CADASTRO',
    'USUARIOS',
    `Cadastro de ${user.name} (${user.email}) foi rejeitado pelo administrador. Motivo: ${reason || 'Não especificado'}`
  );

  return res.json({ message: `Cadastro de ${user.name} foi recusado.` });
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

// Update user (change role, status, name, department, phone, or reset password)
userRoutes.put('/:id', authenticateToken, requirePermission('users', 'manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, role_id, active, department, phone, photo_url, newPassword } = req.body;

  const user = db.users.findById(id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const updates: Partial<User> = {};
  if (name) updates.name = name.trim();
  if (department !== undefined) updates.department = department.trim();
  if (phone !== undefined) updates.phone = phone.trim();
  if (photo_url) updates.photo_url = photo_url;
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

  // Sync updates with employee record
  const emp = db.employees.findById(id) || db.employees.find().find(e => e.email.toLowerCase() === user.email.toLowerCase());
  if (emp) {
    const roleName = updates.role_id ? db.roles.findById(updates.role_id)?.name : undefined;
    db.employees.update(emp.id, {
      ...(updates.name ? { name: updates.name } : {}),
      ...(roleName ? { role: roleName } : {}),
      ...(updates.department ? { department: updates.department } : {}),
      ...(updates.phone ? { phone: updates.phone } : {}),
      ...(updates.photo_url ? { photo_url: updates.photo_url } : {}),
      ...(updates.active !== undefined ? { status: updates.active === 1 ? 'ativo' : 'desligado' } : {})
    });
  }

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
