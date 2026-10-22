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
  signerName: string;
  signerRole: string;
  signerType: 'supervisor' | 'executante' | 'vigia';
  signatureDataUrl: string;
  signedAt: string;
  signedByUserId?: string;
  deviceId?: string;
  ipAddress?: string;
}

export interface DocumentRecord {
  id: string;
  code: string;
  type: 'APR_GENERICA' | 'APR_ALTURA' | 'APR_ESPACO_CONFINADO' | 'PT' | 'INSPECAO' | 'OSS' | 'CIPA' | 'EXTERNO';
  title: string;
  description?: string;
  location_id?: string;
  location_name?: string;
  location?: RiskLocation;
  status: 'rascunho' | 'ativa' | 'encerrada' | 'cancelada';
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
