import { Router, Request, Response } from 'express';
import { db, DocumentRecord } from '../db.js';
import { authenticateToken, requirePermission, logAudit } from '../auth.js';

export const documentRoutes = Router();

// Helper to generate next document code
function getNextDocumentCode(prefix: string): string {
  const currentYear = new Date().getFullYear();
  const allDocs = db.documents.find();
  const yearDocs = allDocs.filter(d => d.code && d.code.startsWith(`${prefix}-${currentYear}-`));
  const nextNum = yearDocs.length + 1;
  return `${prefix}-${currentYear}-${String(nextNum).padStart(4, '0')}`;
}

// Helper to check training validity for workers
function validateWorkerTrainings(workerIds: string[], workTypes: string[]): { valid: boolean; errors: string[] } {
  if (!workerIds || workerIds.length === 0) return { valid: true, errors: [] };
  
  const employees = db.employees.find();
  const trainings = db.trainings.find();
  const now = new Date();
  const errors: string[] = [];

  for (const workerId of workerIds) {
    const emp = employees.find(e => e.id === workerId);
    if (!emp) continue;

    const empTrainings = trainings.filter(t => t.employee_id === workerId);

    // NR-35 check if altura
    if (workTypes.includes('altura') || workTypes.includes('APR_ALTURA')) {
      const nr35 = empTrainings.find(t => t.type.toUpperCase().includes('NR-35') || t.type.toUpperCase().includes('ALTURA'));
      if (!nr35) {
        errors.push(`${emp.name}: Não possui capacitação em NR-35 (Trabalho em Altura).`);
      } else if (new Date(nr35.expiry_date) < now) {
        errors.push(`${emp.name}: Certificado NR-35 VENCIDO em ${new Date(nr35.expiry_date).toLocaleDateString('pt-BR')}.`);
      }
    }

    // NR-33 check if espaco confinado
    if (workTypes.includes('espaco_confinado') || workTypes.includes('APR_ESPACO_CONFINADO')) {
      const nr33 = empTrainings.find(t => t.type.toUpperCase().includes('NR-33') || t.type.toUpperCase().includes('CONFINADO'));
      if (!nr33) {
        errors.push(`${emp.name}: Não possui capacitação em NR-33 (Espaço Confinado).`);
      } else if (new Date(nr33.expiry_date) < now) {
        errors.push(`${emp.name}: Certificado NR-33 VENCIDO em ${new Date(nr33.expiry_date).toLocaleDateString('pt-BR')}.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
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

  // Enriched with location name and employee name
  const locations = db.riskLocations.find();
  const employees = db.employees.find();
  const allDocs = db.documents.find();

  const enriched = docs.map(d => ({
    ...d,
    location_name: locations.find(l => l.id === d.location_id)?.name || null,
    employee_name: d.employee_id ? employees.find(e => e.id === d.employee_id)?.name : null,
    linked_apr_code: d.apr_id ? allDocs.find(a => a.id === d.apr_id)?.code : null
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

// 2. CREATE PT / PET (Permissão de Trabalho e Permissão de Entrada e Trabalho - NR-33/NR-35)
documentRoutes.post('/pt', authenticateToken, requirePermission('documents', 'create'), (req: Request, res: Response) => {
  const {
    title,
    description,
    locationId,
    aprId,
    isPet, // boolean, if true generates PET (NR-33)
    workTypes, // ['altura', 'espaco_confinado', 'quente', 'eletrica', 'loto', 'escavacao']
    validityStart,
    validityEnd,
    supervisorName,
    watchName, // vigia (obrigatório se espaço confinado / PET)
    workerIds, // array de employee_ids
    safetyMeasures, // checklist de medidas de controle aplicadas
    gasMeasurements, // [{ time, o2, lel, co, h2s, tester, status }]
    emergencyPlan,
    data,
    deviceId,
    deviceName
  } = req.body;

  if (!title || !workTypes || workTypes.length === 0) {
    return res.status(400).json({ error: 'Título da PT e tipos de trabalho autorizados são obrigatórios.' });
  }

  // Se for Espaço Confinado / PET, exige Vigia designado conforme NR-33
  if ((isPet || workTypes.includes('espaco_confinado')) && !watchName) {
    return res.status(400).json({ error: 'Para Espaço Confinado (PET), a designação de um Vigia é obrigatória pela NR-33.' });
  }

  // Validação de capacitação e treinamentos dos executantes
  const trainingValidation = validateWorkerTrainings(workerIds || [], workTypes);
  if (!trainingValidation.valid) {
    return res.status(400).json({
      error: 'Impedimento de Liberação da PT: Existem executantes com capacitação vencida ou inexistente.',
      details: trainingValidation.errors
    });
  }

  const prefix = isPet || workTypes.includes('espaco_confinado') ? 'PET' : 'PT';
  const code = getNextDocumentCode(prefix);
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const effectiveDeviceId = deviceId || (req.headers['x-device-id'] as string) || 'NAV-WEB';

  // Obter nomes dos trabalhadores autorizados
  const employees = db.employees.find();
  const authorizedWorkers = (workerIds || []).map((id: string) => {
    const emp = employees.find(e => e.id === id);
    return {
      id,
      name: emp?.name || 'Colaborador',
      cpf: emp?.cpf || '',
      role: emp?.role || ''
    };
  });

  const newDoc: DocumentRecord = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    code,
    type: isPet ? 'PET' : 'PT',
    title: title.trim(),
    description: description || '',
    location_id: locationId || undefined,
    apr_id: aprId || undefined,
    status: 'ativa',
    data: {
      ...(data || {}),
      isPet: !!isPet,
      workTypes,
      validityStart: validityStart || new Date().toISOString(),
      validityEnd: validityEnd || new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      supervisorName: supervisorName || req.user?.name || 'Supervisor SST',
      watchName: watchName || undefined,
      authorizedWorkers,
      safetyMeasures: safetyMeasures || [],
      gasMeasurements: gasMeasurements || [],
      emergencyPlan: emergencyPlan || 'Equipe de resgate interno / Corpo de Bombeiros (193)',
      deviceId: effectiveDeviceId,
      deviceName: deviceName || 'Terminal de Campo',
      ipAddress: clientIp,
      createdDate: new Date().toISOString(),
      signatures: data?.signatures || []
    },
    device_id: effectiveDeviceId,
    device_name: deviceName || 'Terminal de Campo',
    ip_address: clientIp,
    created_by_user_id: req.user!.id,
    created_by_name: req.user!.name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.documents.create(newDoc);
  logAudit(req, 'EMISSAO_PT', 'DOCUMENTOS', `${code} (${newDoc.type}) liberada para ${authorizedWorkers.length} executante(s)`);

  return res.status(201).json(newDoc);
});

// 3. CREATE OS (Ordem de Serviço de Segurança do Trabalho - NR-01)
documentRoutes.post('/os', authenticateToken, requirePermission('documents', 'create'), (req: Request, res: Response) => {
  const {
    employeeId,
    title,
    activitiesDescription,
    identifiedRisks, // { fisicos, quimicos, biologicos, ergonomicos, acidentes }
    mandatoryEpis,
    preventiveMeasures,
    employeeObligations,
    prohibitions,
    penaltiesNotice,
    data,
    deviceId,
    deviceName
  } = req.body;

  if (!employeeId) {
    return res.status(400).json({ error: 'Selecione o colaborador para emissão da Ordem de Serviço (NR-01).' });
  }

  const emp = db.employees.findById(employeeId);
  if (!emp) {
    return res.status(404).json({ error: 'Colaborador não encontrado.' });
  }

  const code = getNextDocumentCode('OS');
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const effectiveDeviceId = deviceId || (req.headers['x-device-id'] as string) || 'NAV-WEB';

  const defaultObligations = [
    'Cumprir as disposições legais e regulamentares sobre segurança e medicina do trabalho;',
    'Submeter-se aos exames médicos previstos no PCMSO;',
    'Usar o EPI fornecido pela empresa e comunicar qualquer alteração que o torne impróprio;',
    'Colaborar com a empresa na aplicação das Normas Regulamentadoras - NRs.'
  ];

  const defaultProhibitions = [
    'Executar qualquer atividade sem o uso dos EPIs indicados para a função;',
    'Ingerir bebidas alcoólicas ou substâncias tóxicas no horário de trabalho;',
    'Operar máquinas ou equipamentos para os quais não esteja formalmente autorizado e treinado;',
    'Desativar dispositivos de proteção ou sinalização de segurança.'
  ];

  const newDoc: DocumentRecord = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    code,
    type: 'OS',
    title: title ? title.trim() : `Ordem de Serviço NR-01 — ${emp.name} (${emp.role})`,
    description: `OS de Segurança individual do colaborador ${emp.name}`,
    employee_id: employeeId,
    status: 'ativa',
    data: {
      ...(data || {}),
      employee: {
        id: emp.id,
        name: emp.name,
        cpf: emp.cpf,
        registration_number: emp.registration_number,
        role: emp.role,
        department: emp.department,
        admission_date: emp.admission_date
      },
      activitiesDescription: activitiesDescription || `Execução de atividades rotineiras da função de ${emp.role}.`,
      identifiedRisks: identifiedRisks || {
        fisicos: ['Ruído contínuo', 'Calor moderado'],
        quimicos: ['Poeiras em suspensão'],
        biologicos: ['Ausentes'],
        ergonomicos: ['Postura inadequada', 'Levantamento manual de carga'],
        acidentes: ['Queda de mesmo nível', 'Impacto contra objetos', 'Cortes em membros superiores']
      },
      mandatoryEpis: mandatoryEpis || ['Capacete com jugular', 'Óculos de proteção', 'Protetor auditivo', 'Botina com bico composite'],
      preventiveMeasures: preventiveMeasures || ['Manter posto de trabalho limpo e organizado', 'Participar dos DDS e treinamentos de SST'],
      employeeObligations: employeeObligations || defaultObligations,
      prohibitions: prohibitions || defaultProhibitions,
      penaltiesNotice: penaltiesNotice || 'Constitui ato faltoso a recusa injustificada do empregado ao cumprimento destas normas (Art. 158 da CLT).',
      acknowledgementText: 'Declaro ter recebido treinamento, orientações de segurança e uma cópia da presente Ordem de Serviço, comprometendo-me a cumprir todas as instruções nela contidas.',
      deviceId: effectiveDeviceId,
      deviceName: deviceName || 'Web',
      ipAddress: clientIp,
      createdDate: new Date().toISOString(),
      signatures: data?.signatures || []
    },
    device_id: effectiveDeviceId,
    device_name: deviceName || 'Web',
    ip_address: clientIp,
    created_by_user_id: req.user!.id,
    created_by_name: req.user!.name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.documents.create(newDoc);
  logAudit(req, 'EMISSAO_OS', 'DOCUMENTOS', `Ordem de Serviço ${code} emitida para ${emp.name}`);

  return res.status(201).json(newDoc);
});

// 4. CREATE FICHA DE ENTREGA DE EPI (NR-06)
documentRoutes.post('/epi-receipt', authenticateToken, requirePermission('documents', 'create'), (req: Request, res: Response) => {
  const {
    employeeId,
    title,
    deliveredItems, // [{ name, caNumber, deliveryDate, quantity, condition }]
    termOfResponsibility,
    data,
    deviceId,
    deviceName
  } = req.body;

  if (!employeeId) {
    return res.status(400).json({ error: 'Selecione o colaborador para emissão da Ficha de EPI.' });
  }

  const emp = db.employees.findById(employeeId);
  if (!emp) {
    return res.status(404).json({ error: 'Colaborador não encontrado.' });
  }

  // Se não vier itens explícitos, puxa os EPIs cadastrados no banco para o funcionário
  let items = deliveredItems;
  if (!items || items.length === 0) {
    const employeeEpis = db.epis.findByEmployeeId(employeeId);
    items = employeeEpis.map(e => ({
      name: e.name,
      caNumber: e.ca_number,
      deliveryDate: e.delivery_date,
      quantity: 1,
      condition: 'Novo / Perfeito Estado'
    }));
  }

  const code = getNextDocumentCode('EPI');
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const effectiveDeviceId = deviceId || (req.headers['x-device-id'] as string) || 'NAV-WEB';

  const defaultTerm =
    'Recebi da empresa os Equipamentos de Proteção Individual (EPI) constantes nesta ficha, em perfeitas condições de uso e funcionamento, com os respectivos Certificados de Aprovação (CA) válidos. Comprometo-me a usá-los exclusivamente em serviço, zelar por sua guarda e conservação e comunicar imediatamente ao setor de SST qualquer dano ou extravio, nos termos da NR-06 da Portaria 3.214/78 do MTE.';

  const newDoc: DocumentRecord = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    code,
    type: 'EPI_FICHA',
    title: title ? title.trim() : `Ficha de Entrega de EPI (NR-06) — ${emp.name}`,
    description: `Termo de entrega e recibo de EPIs do colaborador ${emp.name}`,
    employee_id: employeeId,
    status: 'ativa',
    data: {
      ...(data || {}),
      employee: {
        id: emp.id,
        name: emp.name,
        cpf: emp.cpf,
        registration_number: emp.registration_number,
        role: emp.role,
        department: emp.department
      },
      deliveredItems: items,
      termOfResponsibility: termOfResponsibility || defaultTerm,
      deviceId: effectiveDeviceId,
      deviceName: deviceName || 'Web',
      ipAddress: clientIp,
      createdDate: new Date().toISOString(),
      signatures: data?.signatures || []
    },
    device_id: effectiveDeviceId,
    device_name: deviceName || 'Web',
    ip_address: clientIp,
    created_by_user_id: req.user!.id,
    created_by_name: req.user!.name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.documents.create(newDoc);
  logAudit(req, 'EMISSAO_FICHA_EPI', 'DOCUMENTOS', `Ficha de EPI ${code} emitida para ${emp.name} com ${items.length} item(ns)`);

  return res.status(201).json(newDoc);
});

// 5. CREATE CHECKLIST PRÉ-OPERACIONAL DE CAMPO (NR-12 / NR-18 / NR-35)
documentRoutes.post('/checklist', authenticateToken, requirePermission('documents', 'create'), (req: Request, res: Response) => {
  const {
    templateType, // 'andaimes' | 'cinto_altura' | 'escadas' | 'ferramenta_eletrica' | 'trabalho_quente' | 'outro'
    title,
    equipmentCode,
    equipmentDescription,
    locationId,
    items, // [{ text, status: 'C' | 'NC' | 'NA', notes }]
    isApproved, // boolean (Apto / Não Apto)
    observations,
    data,
    deviceId,
    deviceName
  } = req.body;

  if (!title || !items || items.length === 0) {
    return res.status(400).json({ error: 'Título do checklist e lista de itens inspecionados são obrigatórios.' });
  }

  const code = getNextDocumentCode('CHK');
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const effectiveDeviceId = deviceId || (req.headers['x-device-id'] as string) || 'NAV-WEB';

  const newDoc: DocumentRecord = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    code,
    type: 'CHECKLIST',
    title: title.trim(),
    description: `Checklist de inspeção pré-operacional de ${equipmentDescription || equipmentCode || templateType}`,
    location_id: locationId || undefined,
    status: isApproved !== false ? 'ativa' : 'encerrada',
    data: {
      ...(data || {}),
      templateType: templateType || 'geral',
      equipmentCode: equipmentCode || '',
      equipmentDescription: equipmentDescription || '',
      items,
      isApproved: isApproved !== false,
      evaluationResult: isApproved !== false ? 'APTO PARA USO' : 'INTERDITADO / NÃO APTO',
      observations: observations || '',
      inspectorName: req.user?.name || 'Inspetor SST',
      deviceId: effectiveDeviceId,
      deviceName: deviceName || 'Web',
      ipAddress: clientIp,
      createdDate: new Date().toISOString(),
      signatures: data?.signatures || []
    },
    device_id: effectiveDeviceId,
    device_name: deviceName || 'Web',
    ip_address: clientIp,
    created_by_user_id: req.user!.id,
    created_by_name: req.user!.name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.documents.create(newDoc);
  logAudit(req, 'EMISSAO_CHECKLIST', 'DOCUMENTOS', `Checklist ${code} registrado. Resultado: ${newDoc.data.evaluationResult}`);

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
    'PET': 'PET',
    'OS': 'OS',
    'EPI_FICHA': 'EPI',
    'CHECKLIST': 'CHK',
    'INSPECAO': 'INSP',
    'OSS': 'OS',
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
