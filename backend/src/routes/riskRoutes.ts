import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { db, RiskLocation } from '../db.js';
import { authenticateToken, requirePermission, logAudit } from '../auth.js';

export const riskRoutes = Router();

// List all risk locations
riskRoutes.get('/', authenticateToken, requirePermission('map', 'view'), (req: Request, res: Response) => {
  const risks = db.riskLocations.find();
  const allDocs = db.documents.find();

  // Attach count of active APRs linked to each location
  const enriched = risks.map(r => {
    const linkedAprs = allDocs.filter(d => d.location_id === r.id && d.status === 'ativa');
    return {
      ...r,
      activeAprsCount: linkedAprs.length,
      linkedAprsSummary: linkedAprs.map(d => ({ id: d.id, code: d.code, title: d.title }))
    };
  });

  return res.json(enriched);
});

// Get single risk location with linked documents and employee details
riskRoutes.get('/:id', authenticateToken, requirePermission('map', 'view'), (req: Request, res: Response) => {
  const { id } = req.params;
  const risk = db.riskLocations.findById(id);
  if (!risk) {
    return res.status(404).json({ error: 'Ponto de risco não encontrado.' });
  }

  const allEmployees = db.employees.find();
  const authorizedEmployees = allEmployees.filter(e => risk.authorized_employee_ids.includes(e.id));
  const linkedDocs = db.documents.findByLocationId(id);

  return res.json({
    ...risk,
    authorizedEmployees,
    linkedDocuments: linkedDocs
  });
});

// Generate QR Code data URL for this risk spot
riskRoutes.get('/:id/qrcode', authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const risk = db.riskLocations.findById(id);
  if (!risk) return res.status(404).json({ error: 'Ponto de risco não encontrado.' });

  try {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host') || 'localhost:5000';
    const hostOrigin = (req.query.origin as string) || `${proto}://${host}`;
    const directUrl = `${hostOrigin}/qr?type=risk&id=${risk.id}`;

    const qrDataUrl = await QRCode.toDataURL(directUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    return res.json({ qrCodeDataUrl: qrDataUrl, directUrl, payload: directUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar QR Code' });
  }
});

// Create new risk location
riskRoutes.post('/', authenticateToken, requirePermission('map', 'create'), async (req: Request, res: Response) => {
  const { name, lat, lng, risk_type, description, required_epis, authorized_employee_ids, photo_url } = req.body;

  if (!name || lat === undefined || lng === undefined || !risk_type || !description) {
    return res.status(400).json({ error: 'Nome, coordenadas (latitude e longitude), tipo de risco e descrição são obrigatórios.' });
  }

  const id = 'risk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const qrCodeData = 'SEG-RISCO-' + id.toUpperCase();

  const newRisk: RiskLocation = {
    id,
    name: name.trim(),
    lat: Number(lat),
    lng: Number(lng),
    risk_type,
    description: description.trim(),
    required_epis: Array.isArray(required_epis) ? required_epis : [],
    authorized_employee_ids: Array.isArray(authorized_employee_ids) ? authorized_employee_ids : [],
    photo_url: photo_url || undefined,
    qr_code_data: qrCodeData,
    created_by: req.user?.id,
    created_at: new Date().toISOString()
  };

  db.riskLocations.create(newRisk);
  logAudit(req, 'CRIAR_PONTO_RISCO', 'MAPA', `Ponto de risco adicionado no mapa: ${newRisk.name} (${newRisk.risk_type})`);

  return res.status(201).json(newRisk);
});

// Update risk location
riskRoutes.put('/:id', authenticateToken, requirePermission('map', 'edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  const risk = db.riskLocations.findById(id);
  if (!risk) return res.status(404).json({ error: 'Ponto de risco não encontrado.' });

  const { name, lat, lng, risk_type, description, required_epis, authorized_employee_ids, photo_url } = req.body;

  const updates: Partial<RiskLocation> = {};
  if (name) updates.name = name.trim();
  if (lat !== undefined) updates.lat = Number(lat);
  if (lng !== undefined) updates.lng = Number(lng);
  if (risk_type) updates.risk_type = risk_type;
  if (description) updates.description = description.trim();
  if (required_epis !== undefined) updates.required_epis = required_epis;
  if (authorized_employee_ids !== undefined) updates.authorized_employee_ids = authorized_employee_ids;
  if (photo_url !== undefined) updates.photo_url = photo_url;

  const updated = db.riskLocations.update(id, updates);
  logAudit(req, 'EDITAR_PONTO_RISCO', 'MAPA', `Ponto de risco atualizado: ${risk.name}`);

  return res.json(updated);
});

// Delete risk location
riskRoutes.delete('/:id', authenticateToken, requirePermission('map', 'delete'), (req: Request, res: Response) => {
  const { id } = req.params;
  const risk = db.riskLocations.findById(id);
  if (!risk) return res.status(404).json({ error: 'Ponto de risco não encontrado.' });

  db.riskLocations.delete(id);
  logAudit(req, 'EXCLUIR_PONTO_RISCO', 'MAPA', `Ponto de risco removido: ${risk.name}`);

  return res.json({ message: 'Ponto de risco removido do mapa com sucesso.' });
});
