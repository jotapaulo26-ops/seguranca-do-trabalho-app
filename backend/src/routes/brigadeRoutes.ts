import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { db, Extinguisher, BrigadeMember, MeetingPoint, EvacuationDrill, ExtinguisherInspection } from '../db.js';
import { authenticateToken, requirePermission, logAudit } from '../auth.js';

export const brigadeRoutes = Router();

// Helper to calculate expiration status
function getExpiryStatus(expiryDateStr: string): 'valido' | 'prestes_a_vencer' | 'vencido' {
  const expiry = new Date(expiryDateStr);
  const now = new Date();
  if (expiry < now) return 'vencido';
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (expiry.getTime() - now.getTime() <= thirtyDaysMs) return 'prestes_a_vencer';
  return 'valido';
}

// 1. STATS / KPIs for Brigade Module
brigadeRoutes.get('/stats', authenticateToken, (req: Request, res: Response) => {
  const exts = db.extinguishers.find();
  const members = db.brigadeMembers.find();
  const points = db.meetingPoints.find();
  const drills = db.evacuationDrills.find();

  let extsExpired = 0;
  let extsExpiringSoon = 0;
  exts.forEach(e => {
    const st = getExpiryStatus(e.next_recharge_date);
    if (st === 'vencido') extsExpired++;
    if (st === 'prestes_a_vencer') extsExpiringSoon++;
  });

  const onDutyCount = members.filter(m => m.is_on_duty).length;
  const expiredCerts = members.filter(m => getExpiryStatus(m.training_expiry_date) === 'vencido').length;

  return res.json({
    totalExtinguishers: exts.length,
    extsExpired,
    extsExpiringSoon,
    totalBrigadeMembers: members.length,
    onDutyCount,
    totalMeetingPoints: points.length,
    totalDrills: drills.length,
    extinguishers: {
      total: exts.length,
      expired: extsExpired,
      warning: extsExpiringSoon,
      ok: Math.max(0, exts.length - (extsExpired + extsExpiringSoon))
    },
    members: {
      total: members.length,
      onDuty: onDutyCount,
      expiredCerts
    },
    meetingPoints: {
      total: points.length
    },
    drills: {
      total: drills.length,
      lastDate: drills.length > 0 ? drills[drills.length - 1].date : undefined
    }
  });
});

// 2. TACTICAL MAP ELEMENTS
brigadeRoutes.get('/map-elements', authenticateToken, (req: Request, res: Response) => {
  const exts = db.extinguishers.find();
  const members = db.brigadeMembers.find();
  const employees = db.employees.find();
  const points = db.meetingPoints.find();

  const extinguisherPins = exts.map(e => ({
    id: e.id,
    type: 'extinguisher',
    code: e.code,
    name: `${e.code} (${e.type} - ${e.capacity})`,
    location: e.location_name,
    lat: e.lat,
    lng: e.lng,
    agentType: e.type,
    rechargeStatus: getExpiryStatus(e.next_recharge_date),
    nextRecharge: e.next_recharge_date,
    status: e.status
  }));

  const meetingPointPins = points.map(p => ({
    id: p.id,
    type: 'meeting_point',
    code: p.code,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    capacity: p.capacity_people,
    sectors: p.evacuated_sectors,
    coordinatorId: p.coordinator_employee_id
  }));

  const brigadistPins = members
    .filter(m => m.lat && m.lng)
    .map(m => {
      const emp = employees.find(e => e.id === m.employee_id);
      return {
        id: m.id,
        type: 'brigadist',
        name: emp?.name || 'Brigadista',
        role: m.role_in_brigade,
        shift: m.shift,
        station: m.station_location,
        lat: m.lat!,
        lng: m.lng!,
        isOnDuty: m.is_on_duty,
        phone: emp?.phone
      };
    });

  return res.json({
    extinguishers: extinguisherPins,
    meetingPoints: meetingPointPins,
    brigadists: brigadistPins
  });
});

// 3. EXTINGUISHERS CRUD
brigadeRoutes.get('/extinguishers', authenticateToken, (req: Request, res: Response) => {
  const exts = db.extinguishers.find();
  const enriched = exts.map(e => ({
    ...e,
    rechargeStatus: getExpiryStatus(e.next_recharge_date),
    hydrostaticStatus: getExpiryStatus(e.hydrostatic_test_date),
    inspectionsCount: e.inspections ? e.inspections.length : 0
  }));
  return res.json(enriched);
});

brigadeRoutes.post('/extinguishers', authenticateToken, requirePermission('brigada', 'create'), (req: Request, res: Response) => {
  const {
    code,
    type,
    capacity,
    location_name,
    lat,
    lng,
    selo_inmetro,
    last_recharge_date,
    next_recharge_date,
    hydrostatic_test_date
  } = req.body;

  if (!code || !type || !capacity || !location_name || !next_recharge_date) {
    return res.status(400).json({ error: 'Código, tipo de agente, capacidade, local e data da próxima recarga são obrigatórios.' });
  }

  const existing = db.extinguishers.findByCode(code);
  if (existing) {
    return res.status(400).json({ error: 'Já existe um extintor cadastrado com este código/TAG.' });
  }

  const id = 'ext_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newExt: Extinguisher = {
    id,
    code: code.trim().toUpperCase(),
    type,
    capacity: capacity.trim(),
    location_name: location_name.trim(),
    lat: Number(lat || -21.4689),
    lng: Number(lng || -49.2217),
    selo_inmetro: selo_inmetro || '',
    last_recharge_date: last_recharge_date || new Date().toISOString().split('T')[0],
    next_recharge_date,
    hydrostatic_test_date: hydrostatic_test_date || '',
    status: 'operacional',
    qr_code_data: `EXT-${code}-${type}`,
    inspections: [],
    created_at: new Date().toISOString()
  };

  db.extinguishers.create(newExt);
  logAudit(req, 'CRIAR_EXTINTOR', 'BRIGADA', `Extintor cadastrado: ${newExt.code} (${newExt.type} - ${newExt.capacity})`);

  return res.status(201).json(newExt);
});

brigadeRoutes.put('/extinguishers/:id', authenticateToken, requirePermission('brigada', 'edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  const ext = db.extinguishers.findById(id);
  if (!ext) return res.status(404).json({ error: 'Extintor não encontrado.' });

  const updates = req.body;
  const updated = db.extinguishers.update(id, updates);
  logAudit(req, 'EDITAR_EXTINTOR', 'BRIGADA', `Dados do extintor ${ext.code} atualizados`);

  return res.json(updated);
});

brigadeRoutes.delete('/extinguishers/:id', authenticateToken, requirePermission('brigada', 'delete'), (req: Request, res: Response) => {
  const { id } = req.params;
  const ext = db.extinguishers.findById(id);
  if (!ext) return res.status(404).json({ error: 'Extintor não encontrado.' });

  db.extinguishers.delete(id);
  logAudit(req, 'EXCLUIR_EXTINTOR', 'BRIGADA', `Extintor ${ext.code} removido`);

  return res.json({ message: 'Extintor excluído com sucesso.' });
});

// 4. MONTHLY INSPECTION CHECKLIST FOR EXTINGUISHER
brigadeRoutes.post('/extinguishers/:id/inspect', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const ext = db.extinguishers.findById(id);
  if (!ext) return res.status(404).json({ error: 'Extintor não encontrado.' });

  const { pressureOk, sealIntact, hoseClear, signVisible, unobstructed, notes } = req.body;

  const isApproved = pressureOk && sealIntact && hoseClear && signVisible && unobstructed;

  const newInspection: ExtinguisherInspection = {
    id: 'insp_' + Date.now(),
    date: new Date().toISOString().split('T')[0],
    inspectorName: req.user?.name || 'Inspetor SST',
    pressureOk: !!pressureOk,
    sealIntact: !!sealIntact,
    hoseClear: !!hoseClear,
    signVisible: !!signVisible,
    unobstructed: !!unobstructed,
    notes: notes || '',
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
    'INSPECAO_EXTINTOR',
    'BRIGADA',
    `Inspeção mensal no extintor ${ext.code}: ${newInspection.status.toUpperCase()}`
  );

  return res.json({
    message: `Inspeção registrada com sucesso! Status: ${newInspection.status.toUpperCase()}`,
    inspection: newInspection,
    extinguisher: updated
  });
});

// QR Code for Extinguisher
brigadeRoutes.get('/extinguishers/:id/qrcode', authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const ext = db.extinguishers.findById(id);
  if (!ext) return res.status(404).json({ error: 'Extintor não encontrado.' });

  try {
    const payload = JSON.stringify({
      app: 'SegTrabalho',
      type: 'EXTINGUISHER',
      id: ext.id,
      code: ext.code,
      agent: ext.type,
      location: ext.location_name
    });

    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: 350,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' }
    });

    return res.json({ qrCodeDataUrl: qrDataUrl, payload });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar QR Code do extintor' });
  }
});

// 5. BRIGADE MEMBERS CRUD
brigadeRoutes.get('/members', authenticateToken, (req: Request, res: Response) => {
  const members = db.brigadeMembers.find();
  const employees = db.employees.find();

  const enriched = members.map(m => {
    const emp = employees.find(e => e.id === m.employee_id);
    return {
      ...m,
      employee_name: emp?.name || 'Funcionário Não Encontrado',
      employee_cpf: emp?.cpf || '',
      employee_role: emp?.role || '',
      employee_department: emp?.department || '',
      employee_phone: emp?.phone || '',
      trainingStatus: getExpiryStatus(m.training_expiry_date)
    };
  });

  return res.json(enriched);
});

brigadeRoutes.post('/members', authenticateToken, requirePermission('brigada', 'create'), (req: Request, res: Response) => {
  const {
    employee_id,
    role_in_brigade,
    shift,
    station_location,
    lat,
    lng,
    training_cert_code,
    training_date,
    training_expiry_date,
    is_on_duty,
    notes
  } = req.body;

  if (!employee_id || !role_in_brigade || !shift || !training_expiry_date) {
    return res.status(400).json({ error: 'Funcionário, função na brigada, turno e vencimento do curso são obrigatórios.' });
  }

  const existing = db.brigadeMembers.findByEmployeeId(employee_id);
  if (existing) {
    return res.status(400).json({ error: 'Este colaborador já está cadastrado no quadro de brigadistas.' });
  }

  const id = 'bm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newMember: BrigadeMember = {
    id,
    employee_id,
    role_in_brigade,
    shift,
    station_location: station_location || 'Planta Industrial',
    lat: lat ? Number(lat) : undefined,
    lng: lng ? Number(lng) : undefined,
    training_cert_code: training_cert_code || '',
    training_date: training_date || new Date().toISOString().split('T')[0],
    training_expiry_date,
    is_on_duty: is_on_duty !== undefined ? !!is_on_duty : true,
    notes: notes || '',
    created_at: new Date().toISOString()
  };

  db.brigadeMembers.create(newMember);
  logAudit(req, 'CRIAR_BRIGADISTA', 'BRIGADA', `Brigadista cadastrado: ${newMember.role_in_brigade} (${newMember.shift})`);

  return res.status(201).json(newMember);
});

brigadeRoutes.put('/members/:id', authenticateToken, requirePermission('brigada', 'edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  const bm = db.brigadeMembers.findById(id);
  if (!bm) return res.status(404).json({ error: 'Brigadista não encontrado.' });

  const updated = db.brigadeMembers.update(id, req.body);
  logAudit(req, 'EDITAR_BRIGADISTA', 'BRIGADA', `Dados do brigadista atualizados`);

  return res.json(updated);
});

brigadeRoutes.put('/members/:id/toggle-duty', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const bm = db.brigadeMembers.findById(id);
  if (!bm) return res.status(404).json({ error: 'Brigadista não encontrado.' });

  const updated = db.brigadeMembers.update(id, { is_on_duty: !bm.is_on_duty });
  return res.json(updated);
});

brigadeRoutes.delete('/members/:id', authenticateToken, requirePermission('brigada', 'delete'), (req: Request, res: Response) => {
  const { id } = req.params;
  const bm = db.brigadeMembers.findById(id);
  if (!bm) return res.status(404).json({ error: 'Brigadista não encontrado.' });

  db.brigadeMembers.delete(id);
  logAudit(req, 'EXCLUIR_BRIGADISTA', 'BRIGADA', `Brigadista removido do quadro`);

  return res.json({ message: 'Brigadista excluído com sucesso.' });
});

// 6. MEETING POINTS (PONTOS DE ENCONTRO) CRUD
brigadeRoutes.get('/meeting-points', authenticateToken, (req: Request, res: Response) => {
  const points = db.meetingPoints.find();
  const employees = db.employees.find();

  const enriched = points.map(p => {
    const coord = employees.find(e => e.id === p.coordinator_employee_id);
    return {
      ...p,
      coordinator_name: coord?.name || 'Não designado',
      coordinator_phone: coord?.phone || ''
    };
  });

  return res.json(enriched);
});

brigadeRoutes.post('/meeting-points', authenticateToken, requirePermission('brigada', 'create'), (req: Request, res: Response) => {
  const { code, name, lat, lng, capacity_people, evacuated_sectors, coordinator_employee_id, description } = req.body;

  if (!code || !name || !lat || !lng) {
    return res.status(400).json({ error: 'Código, nome e coordenadas do Ponto de Encontro são obrigatórios.' });
  }

  const id = 'mp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newPoint: MeetingPoint = {
    id,
    code: code.trim().toUpperCase(),
    name: name.trim(),
    lat: Number(lat),
    lng: Number(lng),
    capacity_people: Number(capacity_people || 50),
    evacuated_sectors: Array.isArray(evacuated_sectors) ? evacuated_sectors : [],
    coordinator_employee_id: coordinator_employee_id || undefined,
    description: description || '',
    created_at: new Date().toISOString()
  };

  db.meetingPoints.create(newPoint);
  logAudit(req, 'CRIAR_PONTO_ENCONTRO', 'BRIGADA', `Ponto de encontro criado: ${newPoint.code} - ${newPoint.name}`);

  return res.status(201).json(newPoint);
});

brigadeRoutes.delete('/meeting-points/:id', authenticateToken, requirePermission('brigada', 'delete'), (req: Request, res: Response) => {
  const { id } = req.params;
  const mp = db.meetingPoints.findById(id);
  if (!mp) return res.status(404).json({ error: 'Ponto de encontro não encontrado.' });

  db.meetingPoints.delete(id);
  logAudit(req, 'EXCLUIR_PONTO_ENCONTRO', 'BRIGADA', `Ponto de encontro ${mp.code} removido`);

  return res.json({ message: 'Ponto de encontro excluído com sucesso.' });
});

// 7. EVACUATION DRILLS (SIMULADOS DE ABANDONO)
brigadeRoutes.get('/drills', authenticateToken, (req: Request, res: Response) => {
  const drills = db.evacuationDrills.find();
  const points = db.meetingPoints.find();

  const enriched = drills.map(d => ({
    ...d,
    meeting_point_name: points.find(p => p.id === d.meeting_point_id)?.name || 'Ponto de Encontro Geral'
  }));

  return res.json(enriched);
});

brigadeRoutes.post('/drills', authenticateToken, requirePermission('brigada', 'create'), (req: Request, res: Response) => {
  const { title, date, evacuation_time_seconds, total_evacuated_people, meeting_point_id, drill_type, evaluation, observations } = req.body;

  if (!title || !date || !evacuation_time_seconds) {
    return res.status(400).json({ error: 'Título, data e tempo de evacuação são obrigatórios.' });
  }

  const id = 'drill_' + Date.now();
  const newDrill: EvacuationDrill = {
    id,
    title: title.trim(),
    date,
    evacuation_time_seconds: Number(evacuation_time_seconds),
    total_evacuated_people: Number(total_evacuated_people || 0),
    meeting_point_id: meeting_point_id || '',
    drill_type: drill_type || 'simulado_geral',
    evaluation: evaluation || 'bom',
    observations: observations || '',
    responsible_name: req.user?.name || 'Técnico SST',
    created_at: new Date().toISOString()
  };

  db.evacuationDrills.create(newDrill);
  logAudit(req, 'REGISTRAR_SIMULADO', 'BRIGADA', `Simulado de abandono registrado: ${newDrill.title} (${newDrill.evacuation_time_seconds}s)`);

  return res.status(201).json(newDrill);
});
