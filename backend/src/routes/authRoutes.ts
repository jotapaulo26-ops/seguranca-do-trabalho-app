import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, User } from '../db.js';
import { authenticateToken, logAudit, JWT_SECRET } from '../auth.js';

export const authRoutes = Router();

// 1. AUTO-CADASTRO PÚBLICO COM BIOMETRIA FACIAL OBRIGATÓRIA
authRoutes.post('/register', (req: Request, res: Response) => {
  const { name, email, password, department, phone, photo_url } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome completo, e-mail e senha são obrigatórios.' });
  }

  if (!photo_url || typeof photo_url !== 'string' || !photo_url.startsWith('data:image/')) {
    return res.status(400).json({ error: 'A foto facial frontal é obrigatória para o cadastro biométrico.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.users.findByEmail(cleanEmail);
  if (existing) {
    return res.status(400).json({ error: 'Já existe um usuário cadastrado com este e-mail corporativo.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(password, salt);

  const newUser: User = {
    id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: name.trim(),
    email: cleanEmail,
    password_hash,
    role_id: 'pending',
    department: department ? department.trim() : 'Geral',
    phone: phone ? phone.trim() : undefined,
    photo_url: photo_url,
    active: 0,
    approval_status: 'pendente',
    created_at: new Date().toISOString()
  };

  db.users.create(newUser);
  logAudit(
    req,
    'SOLICITACAO_CADASTRO',
    'AUTENTICACAO',
    `Novo colaborador solicitou cadastro: ${newUser.name} (${newUser.email}) - Depto: ${newUser.department}. Aguardando aprovação do Administrador.`
  );

  return res.status(201).json({
    success: true,
    message: 'Cadastro realizado com sucesso! Aguarde a aprovação e definição de permissões pelo Administrador.',
    pending: true
  });
});

// 2. PRÉ-LOGIN (ETAPA 1: E-mail e Senha)
authRoutes.post('/pre-login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db.users.findByEmail(cleanEmail);
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
  }

  // Verifica se está com cadastro pendente de aprovação
  if (user.approval_status === 'pendente') {
    return res.status(403).json({
      error: 'Seu cadastro está aguardando aprovação e configuração de permissões pelo Administrador.',
      pendingApproval: true
    });
  }

  if (user.approval_status === 'rejeitado') {
    return res.status(403).json({
      error: 'Seu cadastro foi recusado pela administração de SST. Contate seu gestor.'
    });
  }

  if (user.active === 0) {
    return res.status(403).json({
      error: 'Esta conta está inativa no sistema. Contate o administrador.'
    });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
  }

  // ACESSO DIRETO PARA O ADMINISTRADOR (Sem exigência de biometria facial)
  const isAdmin = user.role_id === 'role_admin' || user.email === 'admin@segtrabalho.com.br';
  if (isAdmin) {
    const role = db.roles.findById(user.role_id);
    const permissions = role ? role.permissions : {};

    const tokenPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.role_id,
      roleName: role ? role.name : 'Administrador',
      permissions,
      deviceId: req.body.deviceId || 'Desconhecido'
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
    req.user = tokenPayload;
    logAudit(
      req,
      'LOGIN_ADMIN_DIRETO',
      'AUTENTICACAO',
      `Login de Administrador autorizado diretamente sem biometria facial para gestão e aprovação de usuários.`
    );

    return res.json({
      success: true,
      directLogin: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.role_id,
        roleName: role ? role.name : 'Administrador',
        permissions
      }
    });
  }

  // Se o usuário ainda não tem foto biométrica cadastrada
  if (!user.photo_url) {
    const preToken = jwt.sign(
      { id: user.id, email: user.email, purpose: 'facial-enrollment' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    return res.json({
      success: true,
      requireFacialEnrollment: true,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      preToken
    });
  }

  // Usuário possui foto biométrica cadastrada -> abrir câmera frontal para conferência
  const preToken = jwt.sign(
    { id: user.id, email: user.email, purpose: 'facial-login' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  return res.json({
    success: true,
    requireFacialValidation: true,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    referencePhotoUrl: user.photo_url,
    preToken
  });
});

// 3. PRIMEIRO CADASTRO DE BIOMETRIA NO LOGIN (Para contas existentes sem biometria prévia)
authRoutes.post('/enroll-facial', (req: Request, res: Response) => {
  const { preToken, photo_url, deviceId, deviceName } = req.body;

  if (!preToken || !photo_url) {
    return res.status(400).json({ error: 'Token de pré-login e foto facial são obrigatórios.' });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(preToken, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Sessão de pré-login expirada ou inválida. Tente novamente.' });
  }

  if (decoded.purpose !== 'facial-enrollment') {
    return res.status(403).json({ error: 'Token inválido para cadastro de face.' });
  }

  const user = db.users.findById(decoded.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  // Atualiza foto facial de referência
  db.users.update(user.id, {
    photo_url,
    device_id: deviceId || user.device_id
  });

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

  const finalToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

  req.user = tokenPayload;
  logAudit(
    req,
    'PRIMEIRO_CADASTRO_FACIAL',
    'AUTENTICACAO',
    `Usuário ${user.name} cadastrou sua biometria facial frontal no primeiro acesso.`
  );

  return res.json({
    message: 'Biometria facial registrada com sucesso!',
    token: finalToken,
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

// 4. LOGIN BIOMÉTRICO (ETAPA 2: Conferência Facial Aprovada)
authRoutes.post('/biometric-login', (req: Request, res: Response) => {
  const { preToken, biometricScore, deviceId, deviceName } = req.body;

  if (!preToken) {
    return res.status(400).json({ error: 'Token de validação biométrica é obrigatório.' });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(preToken, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Tempo limite de reconhecimento facial expirou. Faça login novamente.' });
  }

  if (decoded.purpose !== 'facial-login') {
    return res.status(403).json({ error: 'Token inválido para login biométrico.' });
  }

  if (typeof biometricScore === 'number' && biometricScore < 60) {
    return res.status(401).json({ error: 'Rosto divergente do titular cadastrado. Acesso bloqueado!' });
  }

  const user = db.users.findById(decoded.id);
  if (!user || user.active === 0) {
    return res.status(403).json({ error: 'Usuário inativo ou inexistente.' });
  }

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

  const finalToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

  req.user = tokenPayload;
  logAudit(
    req,
    'LOGIN_BIOMETRICO',
    'AUTENTICACAO',
    `Login biométrico facial autorizado (Índice de similaridade: ${Math.round(biometricScore || 100)}%) no dispositivo: ${deviceName || deviceId || 'Web'}`
  );

  return res.json({
    message: 'Acesso biométrico autorizado com sucesso!',
    token: finalToken,
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

// 5. LEGACY LOGIN COMPATIBILITY (Com verificação estrita de aprovação)
authRoutes.post('/login', (req: Request, res: Response) => {
  const { email, password, deviceId, deviceName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  const user = db.users.findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
  }

  if (user.approval_status === 'pendente') {
    return res.status(403).json({ error: 'Seu cadastro está aguardando aprovação pelo Administrador.' });
  }

  if (user.active === 0) {
    return res.status(403).json({ error: 'Esta conta está inativa. Contate o administrador.' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
  }

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
