export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, string[]>;
  is_system: number;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role_id: string;
  role_name?: string;
  device_id?: string;
  active: number;
  created_at: string;
}

export interface Training {
  id: string;
  employee_id: string;
  type: string;
  institution?: string;
  certificate_number?: string;
  completion_date: string;
  expiry_date: string;
  status?: 'valido' | 'prestes_a_vencer' | 'vencido';
  created_at?: string;
}

export interface EPI {
  id: string;
  employee_id: string;
  name: string;
  ca_number: string;
  delivery_date: string;
  expiry_date?: string;
  status: 'entregue' | 'substituido' | 'recolhido';
  created_at?: string;
}

export interface Employee {
  id: string;
  name: string;
  cpf: string;
  registration_number: string;
  role: string;
  department: string;
  admission_date: string;
  phone: string;
  email: string;
  photo_url?: string;
  status: 'ativo' | 'afastado' | 'desligado';
  trainingsCount?: number;
  episCount?: number;
  complianceStatus?: 'valido' | 'alerta' | 'critico';
  nr35Status?: 'valido' | 'prestes_a_vencer' | 'vencido' | 'nao_possui';
  nr33Status?: 'valido' | 'prestes_a_vencer' | 'vencido' | 'nao_possui';
  trainings?: Training[];
  epis?: EPI[];
  linkedDocuments?: any[];
  created_at?: string;
}

export interface RiskLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  risk_type: 'altura' | 'espaco_confinado' | 'ambos' | 'outro';
  description: string;
  required_epis: string[];
  authorized_employee_ids: string[];
  photo_url?: string;
  qr_code_data: string;
  activeAprsCount?: number;
  linkedAprsSummary?: { id: string; code: string; title: string }[];
  authorizedEmployees?: Employee[];
  linkedDocuments?: DocumentRecord[];
  created_by?: string;
  created_at: string;
}

export interface DigitalSignature {
  id: string;
  employeeId?: string;
  signerName: string;
  signerRole: string;
  signerCpf?: string;
  signerType: 'supervisor' | 'executante' | 'vigia' | 'encarregado';
  signatureDataUrl: string;
  photoDataUrl?: string;
  signedAt: string;
  signedByUserId?: string;
  deviceId?: string;
  deviceName?: string;
  ipAddress?: string;
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

export interface DocumentRecord {
  id: string;
  code: string;
  type: 'APR_GENERICA' | 'APR_ALTURA' | 'APR_ESPACO_CONFINADO' | 'PT' | 'PET' | 'OS' | 'EPI_FICHA' | 'CHECKLIST' | 'INSPECAO' | 'OSS' | 'CIPA' | 'EXTERNO';
  title: string;
  description?: string;
  location_id?: string;
  location_name?: string;
  location?: RiskLocation;
  employee_id?: string;
  employee_name?: string;
  apr_id?: string;
  linked_apr_code?: string;
  status: 'rascunho' | 'ativa' | 'encerrada' | 'cancelada' | 'homologado';
  signatureStatus?: DocumentSignatureStatus;
  data: any;
  device_id?: string;
  device_name?: string;
  ip_address?: string;
  created_by_user_id: string;
  created_by_name: string;
  file_url?: string;
  created_at: string;
  updated_at: string;
}

export interface PTData {
  isPet?: boolean;
  workTypes: ('altura' | 'espaco_confinado' | 'quente' | 'eletrica' | 'loto' | 'escavacao')[];
  validityStart: string;
  validityEnd: string;
  supervisorName: string;
  watchName?: string;
  authorizedWorkers: { id: string; name: string; cpf?: string; role?: string }[];
  safetyMeasures: string[];
  gasMeasurements?: { time: string; o2: string; lel: string; co: string; h2s: string; tester: string; status: 'ok' | 'alerta' | 'perigo' }[];
  emergencyPlan?: string;
  signatures?: DigitalSignature[];
}

export interface OSData {
  employee: {
    id: string;
    name: string;
    cpf: string;
    registration_number: string;
    role: string;
    department: string;
    admission_date?: string;
  };
  activitiesDescription: string;
  identifiedRisks: {
    fisicos: string[];
    quimicos: string[];
    biologicos: string[];
    ergonomicos: string[];
    acidentes: string[];
  };
  mandatoryEpis: string[];
  preventiveMeasures: string[];
  employeeObligations: string[];
  prohibitions: string[];
  penaltiesNotice: string;
  acknowledgementText: string;
  signatures?: DigitalSignature[];
}

export interface EpiFichaData {
  employee: {
    id: string;
    name: string;
    cpf: string;
    registration_number: string;
    role: string;
    department: string;
  };
  deliveredItems: {
    name: string;
    caNumber: string;
    deliveryDate: string;
    quantity: number;
    condition: string;
  }[];
  termOfResponsibility: string;
  signatures?: DigitalSignature[];
}

export interface ChecklistData {
  templateType: 'andaimes' | 'cinto_altura' | 'escadas' | 'ferramenta_eletrica' | 'trabalho_quente' | 'confinado' | 'geral';
  equipmentCode: string;
  equipmentDescription: string;
  inspectorName: string;
  items: { text: string; status: 'C' | 'NC' | 'NA'; notes?: string }[];
  isApproved: boolean;
  evaluationResult: string;
  observations?: string;
  signatures?: DigitalSignature[];
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  user_name: string;
  action: string;
  module: string;
  details?: string | null;
  device_id?: string;
  ip_address?: string;
  created_at: string;
}

export interface CompanySettings {
  companyName: string;
  companyCnpj: string;
  companyAddress: string;
  safetyManager: string;
  googleMapsApiKey?: string;
}

export interface ExtinguisherInspection {
  id: string;
  date: string;
  inspectorName: string;
  pressureOk: boolean;
  sealIntact: boolean;
  hoseClear: boolean;
  signVisible: boolean;
  unobstructed: boolean;
  notes?: string;
  status: 'aprovado' | 'reprovado';
}

export interface Extinguisher {
  id: string;
  code: string;
  type: 'AGUA' | 'PQS_ABC' | 'PQS_BC' | 'CO2' | 'ESPUMA';
  capacity: string;
  location_name: string;
  lat: number;
  lng: number;
  selo_inmetro: string;
  last_recharge_date: string;
  next_recharge_date: string;
  hydrostatic_test_date: string;
  status: 'operacional' | 'em_manutencao' | 'descarregado' | 'vencido';
  calculatedStatus?: 'valido' | 'prestes_a_vencer' | 'vencido';
  qr_code_data: string;
  inspections: ExtinguisherInspection[];
  created_at: string;
}

export interface BrigadeMember {
  id: string;
  employee_id: string;
  employee?: Employee;
  role_in_brigade: 'lider' | 'vice_lider' | 'chefe_setor' | 'brigadista_combate' | 'socorrista';
  shift: string;
  station_location: string;
  lat?: number;
  lng?: number;
  training_cert_code?: string;
  training_date: string;
  training_expiry_date: string;
  trainingStatus?: 'valido' | 'prestes_a_vencer' | 'vencido';
  is_on_duty: boolean;
  notes?: string;
  created_at: string;
}

export interface MeetingPoint {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  capacity_people: number;
  evacuated_sectors: string[];
  coordinator_employee_id?: string;
  coordinator?: Employee;
  description: string;
  photo_url?: string;
  created_at: string;
}

export interface EvacuationDrill {
  id: string;
  title: string;
  date: string;
  evacuation_time_seconds: number;
  total_evacuated_people: number;
  meeting_point_id: string;
  meetingPoint?: MeetingPoint;
  drill_type: 'simulado_geral' | 'simulado_parcial' | 'emergencia_real';
  evaluation: 'excelente' | 'bom' | 'regular' | 'insatisfatorio';
  observations: string;
  responsible_name: string;
  created_at: string;
}

export interface BrigadeStats {
  extinguishers: {
    total: number;
    expired: number;
    warning: number;
    ok: number;
  };
  members: {
    total: number;
    onDuty: number;
    expiredCerts: number;
  };
  meetingPoints: {
    total: number;
  };
  drills: {
    total: number;
    lastDate?: string;
  };
}
