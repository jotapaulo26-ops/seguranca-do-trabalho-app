import { Router, Request, Response } from 'express';
import { db, DocumentRecord } from '../db.js';
import { authenticateToken, requirePermission, logAudit } from '../auth.js';

export const documentRoutes = Router();

// Helper to generate next document code
function getNextDocumentCode(prefix: string): string {
  const currentYear = new Date().getFullYear();
  const allDocs = db.documents.find();
  const yearDocs = allDocs.filter(d => d.code.startsWith(`${prefix}-${currentYear}-`));
  const nextNum = yearDocs.length + 1;
  return `${prefix}-${currentYear}-${String(nextNum).padStart(4, '0')}`;
}

// List all documents with filters
documentRoutes.get('/', authenticateToken, requirePermission('documents', 'view'), (req: Request, res: Response) => {
  const { type, status, locationId } = req.query;

  let docs = db.documents.find(type as string);

  if (status) {
    docs = docs.filter(d => d.status === status);
  }
  if (locationId) {
    docs = docs.filter(d => d.location_id === locationId);
  }

  // Enriched with location name
  const locations = db.riskLocations.find();
  const enriched = docs.map(d => ({
    ...d,
    location_name: locations.find(l => l.id === d.location_id)?.name || null
  }));

  return res.json(enriched);
});

// Get single document
documentRoutes.get('/:id', authenticateToken, requirePermission('documents', 'view'), (req: Request, res: Response) => {
  const { id } = req.params;
  const doc = db.documents.findById(id);
  if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

  const location = doc.location_id ? db.riskLocations.findById(doc.location_id) : null;

  return res.json({
    ...doc,
    location
  });
});

// Create new APR (Analysis Preliminar de Risco)
documentRoutes.post('/apr', authenticateToken, requirePermission('documents', 'create'), (req: Request, res: Response) => {
  const {
    aprType, // 'APR_GENERICA' | 'APR_ALTURA' | 'APR_ESPACO_CONFINADO'
    title,
    description,
    locationId,
    data,
    deviceId,
    deviceName
  } = req.body;

  if (!aprType || !title || !data) {
    return res.status(400).json({ error: 'Tipo da APR, título e dados da análise são obrigatórios.' });
  }

  const code = getNextDocumentCode('APR');
  const clientIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1';
  const effectiveDeviceId = deviceId || (req.headers['x-device-id'] as string) || 'NAV-' + Math.random().toString(36).substring(2, 10).toUpperCase();

  const newDoc: DocumentRecord = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    code,
    type: aprType,
    title: title.trim(),
    description: description || '',
    location_id: locationId || undefined,
    status: 'ativa',
    data: {
      ...data,
      createdDate: new Date().toISOString(),
      creatorName: req.user?.name,
      creatorRole: req.user?.roleName,
      deviceId: effectiveDeviceId,
      deviceName: deviceName || req.headers['user-agent'] || 'Dispositivo Web',
      ipAddress: clientIp,
      signatures: data.signatures || []
    },
    device_id: effectiveDeviceId,
    device_name: deviceName || req.headers['user-agent'] || 'Dispositivo Web',
    ip_address: clientIp,
    created_by_user_id: req.user!.id,
    created_by_name: req.user!.name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.documents.create(newDoc);
  logAudit(
    req,
    'EMISSAO_APR',
    'DOCUMENTOS',
    `APR ${code} emitida por ${req.user!.name} no dispositivo ${effectiveDeviceId}`
  );

  return res.status(201).json(newDoc);
});

// Create generic document (PT, Relatório de Inspeção, OSS, CIPA, etc.)
documentRoutes.post('/', authenticateToken, requirePermission('documents', 'create'), (req: Request, res: Response) => {
  const { type, title, description, locationId, data, file_url, deviceId, deviceName } = req.body;

  if (!type || !title) {
    return res.status(400).json({ error: 'Tipo e título são obrigatórios.' });
  }

  const prefixMap: Record<string, string> = {
    'PT': 'PT',
    'INSPECAO': 'INSP',
    'OSS': 'OSS',
    'CIPA': 'CIPA',
    'EXTERNO': 'DOC'
  };

  const prefix = prefixMap[type] || 'DOC';
  const code = getNextDocumentCode(prefix);
  const clientIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1';
  const effectiveDeviceId = deviceId || (req.headers['x-device-id'] as string) || 'NAV-WEB';

  const newDoc: DocumentRecord = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    code,
    type,
    title: title.trim(),
    description: description || '',
    location_id: locationId || undefined,
    status: 'ativa',
    data: data || {},
    device_id: effectiveDeviceId,
    device_name: deviceName || req.headers['user-agent'] || 'Web',
    ip_address: clientIp,
    created_by_user_id: req.user!.id,
    created_by_name: req.user!.name,
    file_url: file_url || undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.documents.create(newDoc);
  logAudit(req, 'CRIAR_DOCUMENTO', 'DOCUMENTOS', `Documento ${code} (${type}) criado: ${title}`);

  return res.status(201).json(newDoc);
});

// Add digital signature to document
documentRoutes.post('/:id/sign', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const { signerName, signerRole, signatureDataUrl, signerType } = req.body;

  if (!signerName || !signatureDataUrl) {
    return res.status(400).json({ error: 'Nome do signatário e assinatura digital são obrigatórios.' });
  }

  const doc = db.documents.findById(id);
  if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

  const clientIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1';
  const deviceId = (req.headers['x-device-id'] as string) || 'NAV-WEB';

  const newSignature = {
    id: 'sig_' + Date.now(),
    signerName,
    signerRole: signerRole || 'Operador',
    signerType: signerType || 'executante', // 'supervisor' | 'executante' | 'vigia'
    signatureDataUrl,
    signedAt: new Date().toISOString(),
    signedByUserId: req.user?.id,
    deviceId,
    ipAddress: clientIp
  };

  const updatedData = { ...doc.data };
  if (!Array.isArray(updatedData.signatures)) {
    updatedData.signatures = [];
  }
  updatedData.signatures.push(newSignature);

  const updated = db.documents.update(id, { data: updatedData });
  logAudit(req, 'ASSINATURA_DIGITAL', 'DOCUMENTOS', `Assinatura digital coletada para documento ${doc.code} por ${signerName}`);

  return res.json({
    message: 'Assinatura digital registrada com sucesso!',
    document: updated
  });
});

// Update document status or info
documentRoutes.put('/:id', authenticateToken, requirePermission('documents', 'edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  const doc = db.documents.findById(id);
  if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

  const { title, description, status, data } = req.body;

  const updates: Partial<DocumentRecord> = {};
  if (title) updates.title = title.trim();
  if (description !== undefined) updates.description = description;
  if (status) updates.status = status;
  if (data) updates.data = { ...doc.data, ...data };

  const updated = db.documents.update(id, updates);
  logAudit(req, 'EDITAR_DOCUMENTO', 'DOCUMENTOS', `Documento ${doc.code} atualizado (status: ${status || doc.status})`);

  return res.json(updated);
});

// Delete document
documentRoutes.delete('/:id', authenticateToken, requirePermission('documents', 'delete'), (req: Request, res: Response) => {
  const { id } = req.params;
  const doc = db.documents.findById(id);
  if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

  db.documents.delete(id);
  logAudit(req, 'EXCLUIR_DOCUMENTO', 'DOCUMENTOS', `Documento ${doc.code} excluído`);

  return res.json({ message: 'Documento excluído com sucesso.' });
});
