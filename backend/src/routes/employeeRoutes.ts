import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { db, Employee, Training, EPI } from '../db.js';
import { authenticateToken, requirePermission, logAudit } from '../auth.js';

export const employeeRoutes = Router();

// Helper to calculate training status
export function getTrainingStatus(expiryDateStr: string): 'valido' | 'prestes_a_vencer' | 'vencido' {
  const expiry = new Date(expiryDateStr);
  const now = new Date();
  
  if (expiry < now) {
    return 'vencido';
  }

  // 30 days in ms
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (expiry.getTime() - now.getTime() <= thirtyDaysMs) {
    return 'prestes_a_vencer';
  }

  return 'valido';
}

// List all employees with summary training badges
employeeRoutes.get('/', authenticateToken, requirePermission('employees', 'view'), (req: Request, res: Response) => {
  const employees = db.employees.find();
  const allTrainings = db.trainings.getAll();
  const allEpis = db.epis.getAll();

  const enriched = employees.map(emp => {
    const empTrainings = allTrainings.filter(t => t.employee_id === emp.id);
    const empEpis = allEpis.filter(e => e.employee_id === emp.id);

    const hasExpired = empTrainings.some(t => getTrainingStatus(t.expiry_date) === 'vencido');
    const hasExpiringSoon = empTrainings.some(t => getTrainingStatus(t.expiry_date) === 'prestes_a_vencer');

    let overallStatus: 'valido' | 'alerta' | 'critico' = 'valido';
    if (hasExpired) overallStatus = 'critico';
    else if (hasExpiringSoon) overallStatus = 'alerta';

    return {
      ...emp,
      trainingsCount: empTrainings.length,
      episCount: empEpis.length,
      complianceStatus: overallStatus,
      nr35Status: empTrainings.find(t => t.type.includes('NR-35')) ? getTrainingStatus(empTrainings.find(t => t.type.includes('NR-35'))!.expiry_date) : 'nao_possui',
      nr33Status: empTrainings.find(t => t.type.includes('NR-33')) ? getTrainingStatus(empTrainings.find(t => t.type.includes('NR-33'))!.expiry_date) : 'nao_possui',
    };
  });

  return res.json(enriched);
});

// Get global alerts for expiring or expired trainings & EPIs
employeeRoutes.get('/alerts/summary', authenticateToken, (req: Request, res: Response) => {
  const allTrainings = db.trainings.getAll();
  const allEmployees = db.employees.find();

  const expiredList: any[] = [];
  const expiringSoonList: any[] = [];

  allTrainings.forEach(t => {
    const status = getTrainingStatus(t.expiry_date);
    const emp = allEmployees.find(e => e.id === t.employee_id);
    if (!emp) return;

    const item = {
      ...t,
      employee_name: emp.name,
      employee_role: emp.role,
      employee_department: emp.department,
      status
    };

    if (status === 'vencido') {
      expiredList.push(item);
    } else if (status === 'prestes_a_vencer') {
      expiringSoonList.push(item);
    }
  });

  return res.json({
    totalExpired: expiredList.length,
    totalExpiringSoon: expiringSoonList.length,
    expired: expiredList,
    expiringSoon: expiringSoonList
  });
});

// Employee Detail
employeeRoutes.get('/:id', authenticateToken, requirePermission('employees', 'view'), (req: Request, res: Response) => {
  const { id } = req.params;
  const emp = db.employees.findById(id);
  if (!emp) {
    return res.status(404).json({ error: 'Funcionário não encontrado.' });
  }

  const trainings = db.trainings.findByEmployeeId(id).map(t => ({
    ...t,
    status: getTrainingStatus(t.expiry_date)
  }));

  const epis = db.epis.findByEmployeeId(id);
  const linkedDocs = db.documents.find().filter(d => {
    if (d.data?.teamMembers) {
      return d.data.teamMembers.some((m: any) => m.employeeId === id);
    }
    return false;
  });

  return res.json({
    ...emp,
    trainings,
    epis,
    linkedDocuments: linkedDocs
  });
});

// Create Employee
employeeRoutes.post('/', authenticateToken, requirePermission('employees', 'create'), (req: Request, res: Response) => {
  const { name, cpf, registration_number, role, department, admission_date, phone, email, photo_url } = req.body;

  if (!name || !cpf || !role || !department || !admission_date) {
    return res.status(400).json({ error: 'Nome, CPF, Cargo, Setor e Data de Admissão são campos obrigatórios.' });
  }

  const existing = db.employees.findByCpf(cpf);
  if (existing) {
    return res.status(400).json({ error: 'Já existe um funcionário cadastrado com este CPF.' });
  }

  const newEmp: Employee = {
    id: 'emp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: name.trim(),
    cpf: cpf.trim(),
    registration_number: registration_number || '',
    role: role.trim(),
    department: department.trim(),
    admission_date,
    phone: phone || '',
    email: email || '',
    photo_url: photo_url || '',
    status: 'ativo',
    created_at: new Date().toISOString()
  };

  db.employees.create(newEmp);
  logAudit(req, 'CRIAR_FUNCIONARIO', 'FUNCIONARIOS', `Funcionário cadastrado: ${newEmp.name} (${newEmp.role} - ${newEmp.department})`);

  return res.status(201).json(newEmp);
});

// Update Employee
employeeRoutes.put('/:id', authenticateToken, requirePermission('employees', 'edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  const emp = db.employees.findById(id);
  if (!emp) return res.status(404).json({ error: 'Funcionário não encontrado.' });

  const { name, cpf, registration_number, role, department, admission_date, phone, email, photo_url, status } = req.body;

  if (cpf && cpf !== emp.cpf) {
    const existing = db.employees.findByCpf(cpf);
    if (existing) {
      return res.status(400).json({ error: 'Já existe outro funcionário com este CPF.' });
    }
  }

  const updates: Partial<Employee> = {};
  if (name) updates.name = name.trim();
  if (cpf) updates.cpf = cpf.trim();
  if (registration_number !== undefined) updates.registration_number = registration_number;
  if (role) updates.role = role.trim();
  if (department) updates.department = department.trim();
  if (admission_date) updates.admission_date = admission_date;
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (photo_url !== undefined) updates.photo_url = photo_url;
  if (status) updates.status = status;

  const updated = db.employees.update(id, updates);

  // Sincroniza dados com usuário correspondente
  const matchedUser = db.users.findById(id) || db.users.find().find(u => u.email?.toLowerCase() === emp.email?.toLowerCase());
  if (matchedUser) {
    db.users.update(matchedUser.id, {
      ...(updates.name ? { name: updates.name } : {}),
      ...(updates.department ? { department: updates.department } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
      ...(updates.photo_url !== undefined ? { photo_url: updates.photo_url } : {}),
      ...(updates.status ? { active: updates.status === 'ativo' ? 1 : 0 } : {})
    });
  }

  logAudit(req, 'EDITAR_FUNCIONARIO', 'FUNCIONARIOS', `Dados do funcionário ${emp.name} atualizados`);

  return res.json(updated);
});

// Update or Register Facial Biometrics
employeeRoutes.post('/:id/biometrics', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const { photo_url } = req.body;

  if (!photo_url) {
    return res.status(400).json({ error: 'A foto facial é obrigatória para o cadastro biométrico.' });
  }

  const emp = db.employees.findById(id);
  if (!emp) return res.status(404).json({ error: 'Funcionário não encontrado.' });

  const updated = db.employees.update(id, {
    photo_url,
    has_facial_biometrics: true
  } as any);

  // Sincroniza foto biométrica com o usuário do sistema
  const user = db.users.findById(id) || db.users.find().find(u => u.email?.toLowerCase() === emp.email?.toLowerCase());
  if (user) {
    db.users.update(user.id, { photo_url });
  }

  logAudit(req, 'CADASTRO_BIOMETRICO', 'FUNCIONARIOS', `Biometria facial registrada para o colaborador ${emp.name}`);
  return res.json({ message: 'Biometria facial cadastrada com sucesso!', employee: updated });
});

// Delete Employee
employeeRoutes.delete('/:id', authenticateToken, requirePermission('employees', 'delete'), (req: Request, res: Response) => {
  const { id } = req.params;
  const emp = db.employees.findById(id);
  if (!emp) return res.status(404).json({ error: 'Funcionário não encontrado.' });

  db.employees.delete(id);
  logAudit(req, 'EXCLUIR_FUNCIONARIO', 'FUNCIONARIOS', `Funcionário excluído: ${emp.name}`);

  return res.json({ message: 'Funcionário e registros vinculados excluídos com sucesso.' });
});

// --- SUB-RESOURCES: TRAININGS ---
employeeRoutes.post('/:id/trainings', authenticateToken, requirePermission('employees', 'edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  const emp = db.employees.findById(id);
  if (!emp) return res.status(404).json({ error: 'Funcionário não encontrado.' });

  const { type, institution, certificate_number, completion_date, expiry_date } = req.body;
  if (!type || !completion_date || !expiry_date) {
    return res.status(400).json({ error: 'Tipo de treinamento, data de conclusão e data de vencimento são obrigatórios.' });
  }

  const newTraining: Training = {
    id: 'trn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    employee_id: id,
    type: type.trim(),
    institution: institution || '',
    certificate_number: certificate_number || '',
    completion_date,
    expiry_date,
    created_at: new Date().toISOString()
  };

  db.trainings.create(newTraining);
  logAudit(req, 'ADICIONAR_TREINAMENTO', 'FUNCIONARIOS', `Treinamento ${newTraining.type} adicionado para ${emp.name}`);

  return res.status(201).json({
    ...newTraining,
    status: getTrainingStatus(newTraining.expiry_date)
  });
});

employeeRoutes.delete('/:id/trainings/:trainingId', authenticateToken, requirePermission('employees', 'edit'), (req: Request, res: Response) => {
  const { trainingId } = req.params;
  const removed = db.trainings.delete(trainingId);
  if (!removed) return res.status(404).json({ error: 'Treinamento não encontrado.' });

  return res.json({ message: 'Treinamento removido.' });
});

// --- SUB-RESOURCES: EPIS ---
employeeRoutes.post('/:id/epis', authenticateToken, requirePermission('employees', 'edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  const emp = db.employees.findById(id);
  if (!emp) return res.status(404).json({ error: 'Funcionário não encontrado.' });

  const { name, ca_number, delivery_date, expiry_date, status } = req.body;
  if (!name || !ca_number || !delivery_date) {
    return res.status(400).json({ error: 'Nome do EPI, número do C.A. e data de entrega são obrigatórios.' });
  }

  const newEPI: EPI = {
    id: 'epi_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    employee_id: id,
    name: name.trim(),
    ca_number: ca_number.trim(),
    delivery_date,
    expiry_date: expiry_date || undefined,
    status: status || 'entregue',
    created_at: new Date().toISOString()
  };

  db.epis.create(newEPI);
  logAudit(req, 'ENTREGAR_EPI', 'FUNCIONARIOS', `EPI ${newEPI.name} (CA ${newEPI.ca_number}) atribuído a ${emp.name}`);

  return res.status(201).json(newEPI);
});

employeeRoutes.delete('/:id/epis/:epiId', authenticateToken, requirePermission('employees', 'edit'), (req: Request, res: Response) => {
  const { epiId } = req.params;
  const removed = db.epis.delete(epiId);
  if (!removed) return res.status(404).json({ error: 'EPI não encontrado.' });

  return res.json({ message: 'EPI removido.' });
});

// QR Code for Employee Badge (Crachá Digital)
employeeRoutes.get('/:id/qrcode', authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const emp = db.employees.findById(id);
  if (!emp) return res.status(404).json({ error: 'Funcionário não encontrado.' });

  try {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host') || 'localhost:5000';
    const hostOrigin = (req.query.origin as string) || `${proto}://${host}`;
    const directUrl = `${hostOrigin}/qr?type=employee&id=${emp.id}`;

    const qrDataUrl = await QRCode.toDataURL(directUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' }
    });

    return res.json({ qrCodeDataUrl: qrDataUrl, directUrl, payload: directUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar QR Code do funcionário' });
  }
});
