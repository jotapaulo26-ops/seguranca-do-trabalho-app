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

export interface RequiredSigner {
  id: string;
  name: string;
  role: string;
  cpf?: string;
  type: 'supervisor' | 'executante' | 'vigia' | 'encarregado';
  isSupervisor?: boolean;
}

export interface DocumentSignatureStatus {
  totalRequired: number;
  totalSigned: number;
  percentage: number;
  status: 'pendente' | 'parcial' | 'homologado';
  isFullySigned: boolean;
  pendingWorkers: RequiredSigner[];
  signedWorkers: {
    id: string;
    name: string;
    role: string;
    cpf?: string;
    type: string;
    isSupervisor?: boolean;
    signedAt: string;
    signatureDataUrl: string;
    photoDataUrl?: string;
    deviceId?: string;
    ipAddress?: string;
  }[];
  requiredWorkers: RequiredSigner[];
}

// Helper to calculate exact signature progress and status
export function calculateSignatureStatus(doc: DocumentRecord): DocumentSignatureStatus {
  const required: RequiredSigner[] = [];
  const signatures = Array.isArray(doc.data?.signatures) ? doc.data.signatures : [];

  // 1. Supervisor / Emissor is always required
  const supervisorName = doc.created_by_name || 'Supervisor SST';
  required.push({
    id: `supervisor_${doc.created_by_user_id || 'admin'}`,
    name: supervisorName,
    role: 'Supervisor / Responsável Emissor',
    type: 'supervisor',
    isSupervisor: true
  });

  // 2. Add specific workers depending on document type
  if (doc.type.startsWith('APR_') || doc.type === 'PT' || doc.type === 'PET') {
    if (Array.isArray(doc.data?.authorizedWorkers) && doc.data.authorizedWorkers.length > 0) {
      const allEmployees = db.employees.find();
      doc.data.authorizedWorkers.forEach((w: any) => {
        let workerId = typeof w === 'string' ? w : w?.id;
        let workerName = typeof w === 'string' ? '' : w?.name;
        let workerRole = typeof w === 'string' ? '' : w?.role;
        let workerCpf = typeof w === 'string' ? '' : w?.cpf;

        if (workerId) {
          const emp = allEmployees.find(e => e.id === workerId);
          if (emp) {
            workerName = workerName || emp.name;
            workerRole = workerRole || emp.role;
            workerCpf = workerCpf || emp.cpf;
          }
        }

        if (workerName && workerName !== 'System.Collections.Hashtable') {
          required.push({
            id: workerId || `worker_${workerName}`,
            name: workerName,
            role: workerRole || 'Executante Autorizado',
            cpf: workerCpf,
            type: 'executante',
            isSupervisor: false
          });
        }
      });
    }

    if (doc.data?.watchName) {
      required.push({
        id: `watch_${doc.id}`,
        name: doc.data.watchName,
        role: 'Vigia de Espaço Confinado (NR-33)',
        type: 'vigia',
        isSupervisor: false
      });
    }
  } else if (doc.type === 'OS' || doc.type === 'OSS') {
    const empName = doc.data?.employee?.name || doc.employee_name || 'Colaborador';
    const empId = doc.data?.employee?.id || doc.employee_id || `emp_${doc.id}`;
    const empRole = doc.data?.employee?.role || 'Trabalhador Designado';
    required.push({
      id: empId,
      name: empName,
      role: empRole,
      cpf: doc.data?.employee?.cpf,
      type: 'executante',
      isSupervisor: false
    });
  } else if (doc.type === 'EPI_FICHA') {
    const empName = doc.data?.employee?.name || doc.employee_name || 'Colaborador';
    const empId = doc.data?.employee?.id || doc.employee_id || `emp_${doc.id}`;
    const empRole = doc.data?.employee?.role || 'Recebedor do EPI';
    required.push({
      id: empId,
      name: empName,
      role: empRole,
      cpf: doc.data?.employee?.cpf,
      type: 'executante',
      isSupervisor: false
    });
  } else if (doc.type === 'CHECKLIST' || doc.type === 'INSPECAO') {
    const inspectorName = doc.data?.inspectorName || 'Inspetor de Campo';
    required.push({
      id: `inspector_${doc.id}`,
      name: inspectorName,
      role: 'Inspetor de Campo',
      type: 'executante',
      isSupervisor: false
    });
  }

  // Deduplicate required signers if any duplicate id
  const uniqueRequired: RequiredSigner[] = [];
  const seenIds = new Set<string>();
  for (const r of required) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      uniqueRequired.push(r);
    }
  }

  // Match signatures against required signers
  const signedWorkers: any[] = [];
  const pendingWorkers: RequiredSigner[] = [];

  for (const reqSigner of uniqueRequired) {
    const foundSig = signatures.find((sig: any) => {
      if (reqSigner.isSupervisor && (sig.signerType === 'supervisor' || sig.signerName?.toLowerCase() === reqSigner.name.toLowerCase())) {
        return true;
      }
      if (sig.employeeId && sig.employeeId === reqSigner.id) {
        return true;
      }
      if (sig.signerName && reqSigner.name && sig.signerName.trim().toLowerCase() === reqSigner.name.trim().toLowerCase()) {
        return true;
      }
      return false;
    });

    if (foundSig) {
      signedWorkers.push({
        id: reqSigner.id,
        name: reqSigner.name,
        role: reqSigner.role,
        cpf: reqSigner.cpf,
        type: reqSigner.type,
        isSupervisor: reqSigner.isSupervisor,
        signedAt: foundSig.signedAt,
        signatureDataUrl: foundSig.signatureDataUrl,
        photoDataUrl: foundSig.photoDataUrl,
        deviceId: foundSig.deviceId,
        ipAddress: foundSig.ipAddress
      });
    } else {
      pendingWorkers.push(reqSigner);
    }
  }

  const totalRequired = uniqueRequired.length;
  const totalSigned = signedWorkers.length;
  const percentage = totalRequired > 0 ? Math.round((totalSigned / totalRequired) * 100) : 100;

  let status: 'pendente' | 'parcial' | 'homologado' = 'pendente';
  if (totalSigned >= totalRequired && totalRequired > 0) {
    status = 'homologado';
  } else if (totalSigned > 0) {
    status = 'parcial';
  }

  return {
    totalRequired,
    totalSigned,
    percentage,
    status,
    isFullySigned: status === 'homologado',
    pendingWorkers,
    signedWorkers,
    requiredWorkers: uniqueRequired
  };
}

// List all documents with filters
documentRoutes.get('/', authenticateToken, requirePermission('documents', 'view'), (req: Request, res: Response) => {
  const { type, status, signatureStatus, locationId } = req.query;

  let docs = db.documents.find(type as string);

  if (status) {
    docs = docs.filter(d => d.status === status);
  }
  if (locationId) {
    docs = docs.filter(d => d.location_id === locationId);
  }

  // Enriched with location name, employee name and signatureStatus
  const locations = db.riskLocations.find();
  const employees = db.employees.find();
  const allDocs = db.documents.find();

  let enriched = docs.map(d => {
    const sigStatus = calculateSignatureStatus(d);
    const includeImages = req.query.includeImages === 'true';

    const lightSigStatus = includeImages ? sigStatus : {
      ...sigStatus,
      signedWorkers: sigStatus.signedWorkers.map(w => ({
        id: w.id,
        name: w.name,
        role: w.role,
        cpf: w.cpf,
        type: w.type,
        isSupervisor: w.isSupervisor,
        signedAt: w.signedAt,
        hasSignature: !!w.signatureDataUrl,
        hasPhoto: !!w.photoDataUrl
      }))
    };

    return {
      ...d,
      data: includeImages ? d.data : {
        ...d.data,
        signatures: (d.data?.signatures || []).map((s: any) => ({
          id: s.id,
          signerName: s.signerName,
          signerRole: s.signerRole,
          signerType: s.signerType,
          signedAt: s.signedAt,
          isSupervisor: s.isSupervisor,
          hasSignature: !!s.signatureDataUrl,
          hasPhoto: !!s.photoDataUrl
        }))
      },
      location_name: locations.find(l => l.id === d.location_id)?.name || null,
      employee_name: d.employee_id ? employees.find(e => e.id === d.employee_id)?.name : null,
      linked_apr_code: d.apr_id ? allDocs.find(a => a.id === d.apr_id)?.code : null,
      signatureStatus: lightSigStatus
    };
  });

  if (signatureStatus) {
    enriched = enriched.filter(d => d.signatureStatus.status === signatureStatus);
  }

  return res.json(enriched);
});

// Get single document
documentRoutes.get('/:id', authenticateToken, requirePermission('documents', 'view'), (req: Request, res: Response) => {
  const { id } = req.params;
  const doc = db.documents.findById(id);
  if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

  const location = doc.location_id ? db.riskLocations.findById(doc.location_id) : null;
  const sigStatus = calculateSignatureStatus(doc);

  return res.json({
    ...doc,
    location,
    signatureStatus: sigStatus
  });
});

// Public info for QR code signing (No auth required)
documentRoutes.get('/:id/public-info', (req: Request, res: Response) => {
  const { id } = req.params;
  const doc = db.documents.findById(id);
  if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

  const location = doc.location_id ? db.riskLocations.findById(doc.location_id) : null;
  const sigStatus = calculateSignatureStatus(doc);

  return res.json({
    id: doc.id,
    code: doc.code,
    title: doc.title,
    type: doc.type,
    location_name: location?.name || 'Usina Santa Isabel - Novo Horizonte',
    created_at: doc.created_at,
    created_by_name: doc.created_by_name,
    signatureStatus: sigStatus
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

  if (req.body.id) {
    const existing = db.documents.findById(req.body.id);
    if (existing) return res.status(200).json(existing);
  }

  const code = getNextDocumentCode('APR');
  const clientIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1';
  const effectiveDeviceId = deviceId || (req.headers['x-device-id'] as string) || 'NAV-' + Math.random().toString(36).substring(2, 10).toUpperCase();

  const newDoc: DocumentRecord = {
    id: req.body.id || ('doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
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

  if (req.body.id) {
    const existing = db.documents.findById(req.body.id);
    if (existing) return res.status(200).json(existing);
  }

  // TRAVA DE SEGURANÇA OPERACIONAL SST:
  // Se a PT for vinculada a uma APR, a APR DEVE estar 100% homologada com todas as assinaturas!
  if (aprId) {
    const linkedApr = db.documents.findById(aprId);
    if (linkedApr) {
      const aprSigStatus = calculateSignatureStatus(linkedApr);
      if (aprSigStatus.status !== 'homologado') {
        const pendingNames = aprSigStatus.pendingWorkers.map(w => w.name).join(', ');
        return res.status(400).json({
          error: `Bloqueio de Segurança SST: A APR vinculada (${linkedApr.code}) ainda não está 100% homologada. É obrigatório que todos os executantes e o supervisor assinem a APR antes da liberação da PT.`,
          details: [`Assinatura(s) pendente(s): ${pendingNames}`]
        });
      }
    }
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
    id: req.body.id || ('doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
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

  if (req.body.id) {
    const existing = db.documents.findById(req.body.id);
    if (existing) return res.status(200).json(existing);
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
    id: req.body.id || ('doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
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

  if (req.body.id) {
    const existing = db.documents.findById(req.body.id);
    if (existing) return res.status(200).json(existing);
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
    id: req.body.id || ('doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
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

  if (req.body.id) {
    const existing = db.documents.findById(req.body.id);
    if (existing) return res.status(200).json(existing);
  }

  const code = getNextDocumentCode('CHK');
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const effectiveDeviceId = deviceId || (req.headers['x-device-id'] as string) || 'NAV-WEB';

  const newDoc: DocumentRecord = {
    id: req.body.id || ('doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
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

  if (req.body.id) {
    const existing = db.documents.findById(req.body.id);
    if (existing) return res.status(200).json(existing);
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
    id: req.body.id || ('doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
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

// Add or update digital signature of specific collaborator
documentRoutes.post('/:id/sign', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const { employeeId, signerName, signerRole, signerCpf, signatureDataUrl, photoDataUrl, signerType, biometricType, biometricScore } = req.body;

  if (!signerName || !signatureDataUrl || !photoDataUrl) {
    return res.status(400).json({
      error: 'Bloqueio de Segurança SST: Tanto a rubrica digital quanto a validação biométrica são estritamente obrigatórias para homologação.'
    });
  }

  const doc = db.documents.findById(id);
  if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const deviceId = (req.headers['x-device-id'] as string) || 'NAV-WEB';

  const newSignature = {
    id: 'sig_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    employeeId: employeeId || undefined,
    signerName: signerName.trim(),
    signerRole: signerRole || 'Executante',
    signerCpf: signerCpf || undefined,
    signerType: signerType || 'executante',
    signatureDataUrl,
    photoDataUrl: photoDataUrl || undefined,
    biometricType: biometricType || 'face',
    biometricScore: biometricScore || 100,
    signedAt: new Date().toISOString(),
    signedByUserId: req.user?.id,
    deviceId,
    ipAddress: clientIp
  };

  const updatedData = { ...doc.data };
  if (!Array.isArray(updatedData.signatures)) {
    updatedData.signatures = [];
  }

  // If a signature for this employeeId or signerName already exists, replace it cleanly
  const existingIdx = updatedData.signatures.findIndex((s: any) =>
    (employeeId && s.employeeId === employeeId) ||
    (s.signerName && s.signerName.toLowerCase() === signerName.toLowerCase() && s.signerType === newSignature.signerType)
  );

  if (existingIdx !== -1) {
    updatedData.signatures[existingIdx] = newSignature;
  } else {
    updatedData.signatures.push(newSignature);
  }

  // Calculate new signature status
  const tempDoc = { ...doc, data: updatedData };
  const sigStatus = calculateSignatureStatus(tempDoc);
  let newDocStatus = doc.status;

  if (sigStatus.status === 'homologado') {
    newDocStatus = 'homologado';
    updatedData.isFullySigned = true;
  }

  const updated = db.documents.update(id, {
    data: updatedData,
    status: newDocStatus
  });

  logAudit(
    req,
    'ASSINATURA_DIGITAL_COLABORADOR',
    'DOCUMENTOS',
    `Assinatura de ${signerName} (${signerRole || 'Colaborador'}) registrada no documento ${doc.code}. Progresso: ${sigStatus.totalSigned}/${sigStatus.totalRequired} (${sigStatus.percentage}%)`
  );

  return res.json({
    message: sigStatus.isFullySigned
      ? 'Documento 100% assinado e homologado com sucesso!'
      : `Assinatura de ${signerName} registrada com sucesso! (${sigStatus.totalSigned}/${sigStatus.totalRequired})`,
    document: {
      ...updated,
      signatureStatus: sigStatus
    },
    signatureStatus: sigStatus
  });
});

// Public sign endpoint for QR code on smartphone (No Bearer token required)
documentRoutes.post('/:id/sign-public', (req: Request, res: Response) => {
  const { id } = req.params;
  const { employeeId, signerName, signerRole, signerCpf, signatureDataUrl, photoDataUrl, signerType, biometricType, biometricScore } = req.body;

  if (!signerName || !signatureDataUrl || !photoDataUrl) {
    return res.status(400).json({
      error: 'Bloqueio de Segurança SST: Tanto a rubrica digital quanto a validação biométrica são estritamente obrigatórias para homologação.'
    });
  }

  const doc = db.documents.findById(id);
  if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const deviceId = (req.headers['x-device-id'] as string) || 'QR-SMARTPHONE';

  const newSignature = {
    id: 'sig_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    employeeId: employeeId || undefined,
    signerName: signerName.trim(),
    signerRole: signerRole || 'Executante',
    signerCpf: signerCpf || undefined,
    signerType: signerType || 'executante',
    signatureDataUrl,
    photoDataUrl: photoDataUrl || undefined,
    biometricType: biometricType || 'face',
    biometricScore: biometricScore || 100,
    signedAt: new Date().toISOString(),
    deviceId,
    ipAddress: clientIp
  };

  const updatedData = { ...doc.data };
  if (!Array.isArray(updatedData.signatures)) {
    updatedData.signatures = [];
  }

  const existingIdx = updatedData.signatures.findIndex((s: any) =>
    (employeeId && s.employeeId === employeeId) ||
    (s.signerName && s.signerName.toLowerCase() === signerName.toLowerCase() && s.signerType === newSignature.signerType)
  );

  if (existingIdx !== -1) {
    updatedData.signatures[existingIdx] = newSignature;
  } else {
    updatedData.signatures.push(newSignature);
  }

  const tempDoc = { ...doc, data: updatedData };
  const sigStatus = calculateSignatureStatus(tempDoc);
  let newDocStatus = doc.status;

  if (sigStatus.status === 'homologado') {
    newDocStatus = 'homologado';
    updatedData.isFullySigned = true;
  }

  const updated = db.documents.update(id, {
    data: updatedData,
    status: newDocStatus
  });

  return res.json({
    message: sigStatus.isFullySigned
      ? 'Documento 100% assinado e homologado com sucesso via QR Code!'
      : `Assinatura de ${signerName} registrada com sucesso via QR Code! (${sigStatus.totalSigned}/${sigStatus.totalRequired})`,
    document: {
      ...updated,
      signatureStatus: sigStatus
    },
    signatureStatus: sigStatus
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
