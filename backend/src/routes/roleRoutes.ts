import { Router, Request, Response } from 'express';
import { db, Role } from '../db.js';
import { authenticateToken, requirePermission, logAudit } from '../auth.js';

export const roleRoutes = Router();

// List all roles
roleRoutes.get('/', authenticateToken, requirePermission('roles', 'view'), (req: Request, res: Response) => {
  const roles = db.roles.find();
  return res.json(roles);
});

// Create new custom role
roleRoutes.post('/', authenticateToken, requirePermission('roles', 'manage'), (req: Request, res: Response) => {
  const { name, description, permissions } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O nome do perfil é obrigatório.' });
  }

  const existing = db.roles.findByName(name.trim());
  if (existing) {
    return res.status(400).json({ error: 'Já existe um perfil com este nome.' });
  }

  const newRole: Role = {
    id: 'role_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: name.trim(),
    description: description || '',
    permissions: permissions || {},
    is_system: 0,
    created_at: new Date().toISOString()
  };

  db.roles.create(newRole);
  logAudit(req, 'CRIAR_PERFIL', 'CONFIGURACOES', `Perfil customizado criado: ${newRole.name}`);

  return res.status(201).json(newRole);
});

// Update role permissions or details
roleRoutes.put('/:id', authenticateToken, requirePermission('roles', 'manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body;

  const role = db.roles.findById(id);
  if (!role) {
    return res.status(404).json({ error: 'Perfil não encontrado.' });
  }

  const updates: Partial<Role> = {};
  if (name && name.trim()) {
    // Check if name is taken by another role
    const existing = db.roles.findByName(name.trim());
    if (existing && existing.id !== id) {
      return res.status(400).json({ error: 'Já existe outro perfil com este nome.' });
    }
    updates.name = name.trim();
  }
  if (description !== undefined) updates.description = description;
  if (permissions !== undefined) updates.permissions = permissions;

  const updated = db.roles.update(id, updates);
  logAudit(req, 'EDITAR_PERFIL', 'CONFIGURACOES', `Permissões/dados do perfil ${role.name} atualizados`);

  return res.json(updated);
});

// Delete custom role
roleRoutes.delete('/:id', authenticateToken, requirePermission('roles', 'manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const role = db.roles.findById(id);
  if (!role) {
    return res.status(404).json({ error: 'Perfil não encontrado.' });
  }

  if (role.is_system === 1) {
    return res.status(400).json({ error: 'Perfis nativos do sistema não podem ser excluídos.' });
  }

  // Check if any user is assigned to this role
  const usersWithRole = db.users.find().filter(u => u.role_id === id);
  if (usersWithRole.length > 0) {
    return res.status(400).json({ 
      error: `Não é possível excluir: existem ${usersWithRole.length} usuário(s) vinculados a este perfil.` 
    });
  }

  db.roles.delete(id);
  logAudit(req, 'EXCLUIR_PERFIL', 'CONFIGURACOES', `Perfil ${role.name} excluído`);

  return res.json({ message: 'Perfil removido com sucesso.' });
});
