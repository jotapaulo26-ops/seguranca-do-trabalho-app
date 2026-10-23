import { Router, Request, Response } from 'express';
import { db, ExtinguisherInspection } from '../db.js';
import { logAudit } from '../auth.js';

export const publicRoutes = Router();

function getExpiryStatus(dateStr?: string): 'valido' | 'prestes_a_vencer' | 'vencido' {
  if (!dateStr) return 'valido';
  const target = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'vencido';
  if (diffDays <= 30) return 'prestes_a_vencer';
  return 'valido';
}

// 1. PUBLIC RISK SPOT DETAILS
publicRoutes.get('/risk-spot/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const spot = db.riskLocations.findById(id);
  if (!spot) {
    return res.status(404).json({ error: 'Ponto de risco não encontrado.' });
  }

  const allEmployees = db.employees.find();
  const authorizedEmployees = allEmployees
    .filter(e => (spot.authorized_employee_ids || []).includes(e.id))
    .map(e => ({ id: e.id, name: e.name, role: e.role, department: e.department }));

  const linkedDocs = db.documents.findByLocationId(id)
    .filter(d => d.status === 'ativa' || d.status === 'homologado')
    .map(d => ({
      id: d.id,
      code: d.code,
      title: d.title,
      type: d.type,
      status: d.status,
      created_at: d.created_at
    }));

  return res.json({
    id: spot.id,
    name: spot.name,
    risk_type: spot.risk_type,
    description: spot.description,
    required_epis: spot.required_epis || [],
    lat: spot.lat,
    lng: spot.lng,
    photo_url: spot.photo_url,
    authorizedEmployees,
    linkedDocuments: linkedDocs
  });
});

// 2. PUBLIC EXTINGUISHER DETAILS
publicRoutes.get('/extinguisher/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const ext = db.extinguishers.findById(id);
  if (!ext) {
    return res.status(404).json({ error: 'Extintor não encontrado.' });
  }

  const rechargeStatus = getExpiryStatus(ext.next_recharge_date);
  const hydrostaticStatus = getExpiryStatus(ext.hydrostatic_test_date);

  return res.json({
    id: ext.id,
    code: ext.code,
    type: ext.type,
    capacity: ext.capacity,
    location_name: ext.location_name,
    lat: ext.lat,
    lng: ext.lng,
    selo_inmetro: ext.selo_inmetro,
    last_recharge_date: ext.last_recharge_date,
    next_recharge_date: ext.next_recharge_date,
    hydrostatic_test_date: ext.hydrostatic_test_date,
    status: ext.status,
    rechargeStatus,
    hydrostaticStatus,
    inspections: (ext.inspections || []).slice(0, 10)
  });
});

// 2.1 PUBLIC QUICK INSPECTION FOR EXTINGUISHER (FROM FIELD QR CODE)
publicRoutes.post('/extinguisher/:id/inspect', (req: Request, res: Response) => {
  const { id } = req.params;
  const ext = db.extinguishers.findById(id);
  if (!ext) {
    return res.status(404).json({ error: 'Extintor não encontrado.' });
  }

  const { inspectorName, pressureOk, sealIntact, hoseClear, signVisible, unobstructed, notes } = req.body;

  const isApproved = !!pressureOk && !!sealIntact && !!hoseClear && !!signVisible && !!unobstructed;

  const newInspection: ExtinguisherInspection = {
    id: 'insp_pub_' + Date.now(),
    date: new Date().toISOString().split('T')[0],
    inspectorName: inspectorName?.trim() || 'Brigadista em Campo',
    pressureOk: !!pressureOk,
    sealIntact: !!sealIntact,
    hoseClear: !!hoseClear,
    signVisible: !!signVisible,
    unobstructed: !!unobstructed,
    notes: notes || 'Inspeção via QR Code de Campo',
    status: isApproved ? 'aprovado' : 'reprovado'
  };

  const updatedInspections = ext.inspections ? [newInspection, ...ext.inspections] : [newInspection];
  const newStatus = isApproved ? 'operacional' : 'em_manutencao';

  const updated = db.extinguishers.update(id, {
    inspections: updatedInspections,
    status: newStatus
  });

  logAudit(
    req,
    'INSPECAO_EXTINTOR_QR',
    'BRIGADA',
    `Inspeção via QR Code no extintor ${ext.code}: ${newInspection.status.toUpperCase()} por ${newInspection.inspectorName}`
  );

  return res.json({
    success: true,
    message: `Inspeção registrada com sucesso! Extintor: ${newInspection.status.toUpperCase()}`,
    inspection: newInspection,
    extinguisher: updated
  });
});

// 3. PUBLIC MEETING POINT
publicRoutes.get('/meeting-point/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const point = db.meetingPoints.findById(id);
  if (!point) {
    return res.status(404).json({ error: 'Ponto de encontro não encontrado.' });
  }

  const allMembers = db.brigadeMembers.find();
  const allEmployees = db.employees.find();

  const nearbyBrigadists = allMembers.map(m => {
    const emp = allEmployees.find(e => e.id === m.employee_id);
    return {
      id: m.id,
      name: emp?.name || 'Brigadista',
      role: m.role_in_brigade,
      shift: m.shift,
      station: m.station_location,
      phone: emp?.phone,
      isOnDuty: m.is_on_duty
    };
  });

  return res.json({
    id: point.id,
    code: point.code,
    name: point.name,
    lat: point.lat,
    lng: point.lng,
    capacity_people: point.capacity_people,
    description: point.description,
    brigadists: nearbyBrigadists
  });
});

// 4. PUBLIC EMPLOYEE BADGE (CRACHÁ DIGITAL SST)
publicRoutes.get('/employee/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const emp = db.employees.findById(id);
  if (!emp) {
    return res.status(404).json({ error: 'Colaborador não encontrado.' });
  }

  const trainings = (emp.trainings || []).map(t => ({
    type: t.type,
    institution: t.institution,
    completion_date: t.completion_date,
    expiry_date: t.expiry_date,
    status: getExpiryStatus(t.expiry_date)
  }));

  const epis = (emp.epis || []).map(e => ({
    name: e.name,
    ca_number: e.ca_number,
    delivery_date: e.delivery_date,
    status: e.status
  }));

  // Check if fully qualified for Height (NR-35) and Confined Space (NR-33)
  const hasNr35 = trainings.some(t => t.type.toLowerCase().includes('35') && t.status !== 'vencido');
  const hasNr33 = trainings.some(t => t.type.toLowerCase().includes('33') && t.status !== 'vencido');
  const hasNr10 = trainings.some(t => t.type.toLowerCase().includes('10') && t.status !== 'vencido');

  return res.json({
    id: emp.id,
    name: emp.name,
    role: emp.role,
    department: emp.department,
    cpfMasked: emp.cpf ? emp.cpf.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, '$1.***.***-$2') : undefined,
    admission_date: emp.admission_date,
    status: emp.status,
    hasNr35,
    hasNr33,
    hasNr10,
    trainings,
    epis
  });
});
