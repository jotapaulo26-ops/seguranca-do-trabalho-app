import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
const uploadsDir = path.resolve(__dirname, '../uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbFilePath = path.join(dataDir, 'db.json');

// Interfaces
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
  password_hash: string;
  role_id: string;
  device_id?: string;
  active: number;
  created_at: string;
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
  created_at: string;
}

export interface EPI {
  id: string;
  employee_id: string;
  name: string;
  ca_number: string;
  delivery_date: string;
  expiry_date?: string;
  status: 'entregue' | 'substituido' | 'recolhido';
  created_at: string;
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
  created_by?: string;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  code: string;
  type: 'APR_GENERICA' | 'APR_ALTURA' | 'APR_ESPACO_CONFINADO' | 'PT' | 'PET' | 'OS' | 'EPI_FICHA' | 'CHECKLIST' | 'INSPECAO' | 'OSS' | 'CIPA' | 'EXTERNO';
  title: string;
  description?: string;
  location_id?: string;
  employee_id?: string;
  apr_id?: string;
  status: 'rascunho' | 'ativa' | 'encerrada' | 'cancelada';
  data: any; // Dynamic JSON for APR/PT/OS/EPI/Checklist fields
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
  qr_code_data: string;
  inspections: ExtinguisherInspection[];
  created_at: string;
}

export interface BrigadeMember {
  id: string;
  employee_id: string;
  role_in_brigade: 'lider' | 'vice_lider' | 'chefe_setor' | 'brigadista_combate' | 'socorrista';
  shift: string;
  station_location: string;
  lat?: number;
  lng?: number;
  training_cert_code?: string;
  training_date: string;
  training_expiry_date: string;
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
  drill_type: 'simulado_geral' | 'simulado_parcial' | 'emergencia_real';
  evaluation: 'excelente' | 'bom' | 'regular' | 'insatisfatorio';
  observations: string;
  responsible_name: string;
  created_at: string;
}

export interface DatabaseSchema {
  roles: Role[];
  users: User[];
  employees: Employee[];
  trainings: Training[];
  epis: EPI[];
  risk_locations: RiskLocation[];
  documents: DocumentRecord[];
  audit_logs: AuditLog[];
  extinguishers: Extinguisher[];
  brigade_members: BrigadeMember[];
  meeting_points: MeetingPoint[];
  evacuation_drills: EvacuationDrill[];
  settings: Record<string, string>;
}

// In-memory cache + synchronized disk persistence
let memoryDb: DatabaseSchema;

function loadDatabase(): DatabaseSchema {
  if (fs.existsSync(dbFilePath)) {
    try {
      const raw = fs.readFileSync(dbFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        roles: parsed.roles || [],
        users: parsed.users || [],
        employees: parsed.employees || [],
        trainings: parsed.trainings || [],
        epis: parsed.epis || [],
        risk_locations: parsed.risk_locations || [],
        documents: parsed.documents || [],
        audit_logs: parsed.audit_logs || [],
        extinguishers: parsed.extinguishers || [],
        brigade_members: parsed.brigade_members || [],
        meeting_points: parsed.meeting_points || [],
        evacuation_drills: parsed.evacuation_drills || [],
        settings: parsed.settings || {
          companyName: 'Indústria & Usina Açucareira Novo Horizonte S.A.',
          companyCnpj: '12.345.678/0001-90',
          companyAddress: 'Rodovia SP-321, Km 42 - Distrito Industrial, Novo Horizonte - SP',
          safetyManager: 'Carlos Mendes - Reg. MTE 004128/SP',
          googleMapsApiKey: ''
        }
      };
    } catch (err) {
      console.error('Erro ao ler db.json, recriando...', err);
    }
  }

  // Initial structure
  return {
    roles: [],
    users: [],
    employees: [],
    trainings: [],
    epis: [],
    risk_locations: [],
    documents: [],
    audit_logs: [],
    extinguishers: [],
    brigade_members: [],
    meeting_points: [],
    evacuation_drills: [],
    settings: {
      companyName: 'Indústria & Usina Açucareira Novo Horizonte S.A.',
      companyCnpj: '12.345.678/0001-90',
      companyAddress: 'Rodovia SP-321, Km 42 - Distrito Industrial, Novo Horizonte - SP',
      safetyManager: 'Carlos Mendes - Reg. MTE 004128/SP',
      googleMapsApiKey: ''
    }
  };
}

export function saveDatabase(): void {
  try {
    const tempPath = dbFilePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(memoryDb, null, 2), 'utf-8');
    fs.renameSync(tempPath, dbFilePath);
  } catch (error) {
    console.error('Erro ao salvar db.json:', error);
  }
}

// Initialize database and seeds
export function initDatabase(): void {
  memoryDb = loadDatabase();

  // 1. Roles Seed
  if (memoryDb.roles.length === 0) {
    const adminPerms = {
      dashboard: ['view'],
      employees: ['view', 'create', 'edit', 'delete'],
      map: ['view', 'create', 'edit', 'delete'],
      documents: ['view', 'create', 'edit', 'delete', 'sign', 'approve'],
      brigada: ['view', 'create', 'edit', 'delete', 'inspect'],
      users: ['view', 'manage'],
      roles: ['view', 'manage'],
      audit: ['view'],
      settings: ['view', 'manage']
    };

    const tecPerms = {
      dashboard: ['view'],
      employees: ['view', 'create', 'edit'],
      map: ['view', 'create', 'edit'],
      documents: ['view', 'create', 'edit', 'delete', 'sign', 'approve'],
      brigada: ['view', 'create', 'edit', 'inspect'],
      users: ['view'],
      roles: ['view'],
      audit: ['view'],
      settings: ['view']
    };

    const encarregadoPerms = {
      dashboard: ['view'],
      employees: ['view'],
      map: ['view'],
      documents: ['view', 'create', 'sign'],
      users: [],
      roles: [],
      audit: [],
      settings: []
    };

    const funcionarioPerms = {
      dashboard: ['view'],
      employees: ['view'],
      map: ['view'],
      documents: ['view', 'sign'],
      users: [],
      roles: [],
      audit: [],
      settings: []
    };

    memoryDb.roles.push(
      {
        id: 'role_admin',
        name: 'Administrador',
        description: 'Acesso completo a todas as funções e configurações do sistema',
        permissions: adminPerms,
        is_system: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'role_tec_seg',
        name: 'Técnico de Segurança',
        description: 'Gestão operacional de SST, emissão de APRs, cadastro de funcionários e mapa de riscos',
        permissions: tecPerms,
        is_system: 0,
        created_at: new Date().toISOString()
      },
      {
        id: 'role_encarregado',
        name: 'Encarregado / Líder de Equipe',
        description: 'Emissão e assinatura de APRs e acompanhamento dos locais de risco',
        permissions: encarregadoPerms,
        is_system: 0,
        created_at: new Date().toISOString()
      },
      {
        id: 'role_operador',
        name: 'Funcionário / Operador',
        description: 'Visualização de documentos e assinatura digital de APRs em campo',
        permissions: funcionarioPerms,
        is_system: 0,
        created_at: new Date().toISOString()
      }
    );
  }

  // 2. Users Seed
  if (memoryDb.users.length === 0) {
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin123', salt);
    const techHash = bcrypt.hashSync('tec123', salt);

    memoryDb.users.push(
      {
        id: 'user_admin_01',
        name: 'Administrador SST',
        email: 'admin@segtrabalho.com.br',
        password_hash: adminHash,
        role_id: 'role_admin',
        active: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'user_tech_01',
        name: 'Carlos Mendes (Técnico SST)',
        email: 'carlos.mendes@segtrabalho.com.br',
        password_hash: techHash,
        role_id: 'role_tec_seg',
        active: 1,
        created_at: new Date().toISOString()
      }
    );
  }

  // 3. Employees Seed
  if (memoryDb.employees.length === 0) {
    memoryDb.employees.push(
      {
        id: 'emp_01',
        name: 'Marcos Aurélio Silveira',
        cpf: '123.456.789-01',
        registration_number: 'MAT-1042',
        role: 'Eletricista Industrial',
        department: 'Manutenção Elétrica',
        admission_date: '2023-03-15',
        phone: '(11) 98765-4321',
        email: 'marcos.silveira@empresa.com.br',
        status: 'ativo',
        created_at: new Date().toISOString()
      },
      {
        id: 'emp_02',
        name: 'Rafael Barbosa Lima',
        cpf: '234.567.890-12',
        registration_number: 'MAT-1055',
        role: 'Mecânico de Manutenção',
        department: 'Manutenção Mecânica',
        admission_date: '2022-08-10',
        phone: '(11) 97654-3210',
        email: 'rafael.lima@empresa.com.br',
        status: 'ativo',
        created_at: new Date().toISOString()
      },
      {
        id: 'emp_03',
        name: 'Antônio José dos Santos',
        cpf: '345.678.901-23',
        registration_number: 'MAT-1089',
        role: 'Soldador / Caldeireiro',
        department: 'Caldeiraria & Estruturas',
        admission_date: '2021-11-01',
        phone: '(11) 96543-2109',
        email: 'antonio.santos@empresa.com.br',
        status: 'ativo',
        created_at: new Date().toISOString()
      },
      {
        id: 'emp_04',
        name: 'Lucas Oliveira Ramos',
        cpf: '456.789.012-34',
        registration_number: 'MAT-1102',
        role: 'Operador de Utilidades',
        department: 'Operações Industriais',
        admission_date: '2024-01-20',
        phone: '(11) 95432-1098',
        email: 'lucas.ramos@empresa.com.br',
        status: 'ativo',
        created_at: new Date().toISOString()
      }
    );

    // Trainings
    memoryDb.trainings.push(
      {
        id: 'trn_01',
        employee_id: 'emp_01',
        type: 'NR-35 Trabalho em Altura',
        institution: 'SENAI Segurança',
        certificate_number: 'CERT-35-9821',
        completion_date: '2026-02-10',
        expiry_date: '2028-02-10',
        created_at: new Date().toISOString()
      },
      {
        id: 'trn_02',
        employee_id: 'emp_01',
        type: 'NR-10 Segurança em Instalações Elétricas',
        institution: 'Instituto Paulista SST',
        certificate_number: 'CERT-10-4412',
        completion_date: '2025-05-15',
        expiry_date: '2027-05-15',
        created_at: new Date().toISOString()
      },
      {
        id: 'trn_03',
        employee_id: 'emp_02',
        type: 'NR-33 Espaço Confinado (Trabalhador Autorizado e Vigia)',
        institution: 'Fundacentro',
        certificate_number: 'CERT-33-3110',
        completion_date: '2024-11-05',
        // Expiring in ~15 days for alert demonstration
        expiry_date: '2026-11-05',
        created_at: new Date().toISOString()
      },
      {
        id: 'trn_04',
        employee_id: 'emp_02',
        type: 'NR-35 Trabalho em Altura',
        institution: 'SENAI Segurança',
        certificate_number: 'CERT-35-7729',
        completion_date: '2025-08-20',
        expiry_date: '2027-08-20',
        created_at: new Date().toISOString()
      },
      {
        id: 'trn_05',
        employee_id: 'emp_03',
        type: 'NR-35 Trabalho em Altura',
        institution: 'SEST SENAT',
        certificate_number: 'CERT-35-1022',
        completion_date: '2024-01-10',
        // EXPIRED! Demonstrating red alert badge & validation
        expiry_date: '2026-01-10',
        created_at: new Date().toISOString()
      },
      {
        id: 'trn_06',
        employee_id: 'emp_04',
        type: 'NR-33 Espaço Confinado (Supervisor de Entrada)',
        institution: 'SESI SST',
        certificate_number: 'CERT-33-8822',
        completion_date: '2026-04-12',
        expiry_date: '2027-04-12',
        created_at: new Date().toISOString()
      }
    );

    // EPIs
    memoryDb.epis.push(
      {
        id: 'epi_01',
        employee_id: 'emp_01',
        name: 'Cinto de Segurança Tipo Paraquedista c/ Talabarte Duplo',
        ca_number: 'CA-36399',
        delivery_date: '2026-01-15',
        expiry_date: '2027-01-15',
        status: 'entregue',
        created_at: new Date().toISOString()
      },
      {
        id: 'epi_02',
        employee_id: 'emp_01',
        name: 'Capacete de Segurança com Jugular',
        ca_number: 'CA-14760',
        delivery_date: '2026-01-15',
        expiry_date: '2028-01-15',
        status: 'entregue',
        created_at: new Date().toISOString()
      },
      {
        id: 'epi_03',
        employee_id: 'emp_02',
        name: 'Cinto de Segurança Paraquedista e Espaço Confinado',
        ca_number: 'CA-42118',
        delivery_date: '2026-02-01',
        expiry_date: '2027-02-01',
        status: 'entregue',
        created_at: new Date().toISOString()
      },
      {
        id: 'epi_04',
        employee_id: 'emp_02',
        name: 'Máscara Facial Inteira c/ Filtro Multigases',
        ca_number: 'CA-20188',
        delivery_date: '2026-02-01',
        expiry_date: '2026-12-01',
        status: 'entregue',
        created_at: new Date().toISOString()
      }
    );
  }

  // 4. Risk Locations Seed
  if (memoryDb.risk_locations.length === 0) {
    memoryDb.risk_locations.push(
      {
        id: 'risk_01',
        name: 'Moenda & Desfibrador - Torre Elevadora de Bagaço (Usina Santa Isabel)',
        lat: -21.5084,
        lng: -49.2083,
        risk_type: 'altura',
        description: 'Estrutura metálica elevada na área industrial da Usina Santa Isabel (Novo Horizonte-SP). Risco de queda em altura superior a 22 metros, vibração mecânica e esteiras rolantes. Linha de vida e trava-quedas obrigatórios.',
        required_epis: ['Cinto Paraquedista', 'Talabarte Duplo', 'Trava-quedas para cabo de aço', 'Capacete c/ jugular', 'Botina de segurança'],
        authorized_employee_ids: ['emp_01', 'emp_02'],
        qr_code_data: 'RISCO_LOC_01',
        created_by: 'user_admin_01',
        created_at: new Date().toISOString()
      },
      {
        id: 'risk_02',
        name: 'Parque de Tanques e Cubas de Fermentação (Usina Santa Isabel)',
        lat: -21.5076,
        lng: -49.2092,
        risk_type: 'espaco_confinado',
        description: 'Espaço confinado interior em dornas e tanques de etanol/mosto na Usina Santa Isabel. Atmosfera com risco de vapores inflamáveis e deficiência de O2. Obrigatória PET NR-33, ventilação mecânica e detector multigases.',
        required_epis: ['Detector 4 Gases (O2, LEL, CO, H2S)', 'Tripé com Guincho Resgatador', 'Cinto de 4 Pontos', 'Exaustor Insuflador de Ar'],
        authorized_employee_ids: ['emp_02', 'emp_04'],
        qr_code_data: 'RISCO_LOC_02',
        created_by: 'user_admin_01',
        created_at: new Date().toISOString()
      },
      {
        id: 'risk_03',
        name: 'Caldeira a Vapor e Torre de Lavagem de Gases (Usina Santa Isabel)',
        lat: -21.5089,
        lng: -49.2075,
        risk_type: 'ambos',
        description: 'Boca de visita e tubulação superior de vapor a 18m de altura na Usina Santa Isabel. Combina trabalho em altura crítica (NR-35) e espaço confinado em tubulão da caldeira (NR-33) com risco térmico.',
        required_epis: ['Cinto Paraquedista e Espaço Confinado', 'Linha de Vida Vertical', 'Detector Multigases', 'Vigia dedicado', 'Tripé resgatador'],
        authorized_employee_ids: ['emp_01', 'emp_02', 'emp_04'],
        qr_code_data: 'RISCO_LOC_03',
        created_by: 'user_admin_01',
        created_at: new Date().toISOString()
      }
    );
  }

  // 5. Document Seed (APR)
  if (memoryDb.documents.length === 0) {
    const sampleAprData = {
      workType: 'Manutenção Preventiva no Motor do Exaustor da Torre',
      activityDetails: 'Substituição de correias e rolamentos do motor de exaustão instalado na plataforma superior da Torre a 22 metros de altura.',
      riskClassification: 'ALTO RISCO (NR-35)',
      heightMeters: 22,
      anchorPoints: 'Viga I-10 metálica inspecionada com olhal certificado e cabo de aço 8mm.',
      weatherConditions: 'Céu aberto, sem chuva, ventos a 12 km/h (dentro da faixa de segurança).',
      rescuePlan: 'Plano de resgate vertical pré-definido com equipe de brigada comunicada via rádio canal 04 e maca tipo envelope pronta.',
      hazards: [
        'Queda de pessoas com diferença de nível (> 2m)',
        'Queda de ferramentas manuais ou sobressalentes',
        'Acionamento acidental de maquinário rotativo',
        'Choque elétrico durante intervenção na fiação'
      ],
      preventiveMeasures: [
        'Uso 100% contínuo de cinto tipo paraquedista ancorado na linha de vida',
        'Isolamento e sinalização visual com cones e fita zebrada de toda a área térrea',
        'Amarração obrigatória de todas as ferramentas com alças de pulso/segurança',
        'Bloqueio elétrico e etiquetagem LOTO com cadeado individual do executante',
        'Comunicação direta via rádio transceptor com a central de segurança'
      ],
      requiredEpis: [
        'Capacete com jugular de 3 pontos',
        'Óculos de proteção contra impactos',
        'Luva de vaqueta mecânica mista',
        'Cinto paraquedista com ponto dorsal e peitoral',
        'Talabarte duplo Y com absorvedor de energia',
        'Botina de segurança com biqueira de composite'
      ],
      teamMembers: [
        { employeeId: 'emp_01', name: 'Marcos Aurélio Silveira', role: 'Eletricista Executante', status: 'NR-35 Válida' },
        { employeeId: 'emp_02', name: 'Rafael Barbosa Lima', role: 'Mecânico Auxiliar', status: 'NR-35 Válida' }
      ],
      supervisorName: 'Carlos Mendes',
      supervisorRole: 'Técnico de Segurança do Trabalho (MTE: 004128/SP)',
      supervisorSignatureDate: '2026-10-21 14:30:00',
      signed: true,
      deviceId: 'DEVICE-BRA-SP-W11-X892',
      deviceName: 'Chrome 131 on Windows 11 (Desktop Operacional)',
      ipAddress: '192.168.1.105'
    };

    memoryDb.documents.push({
      id: 'doc_apr_01',
      code: 'APR-2026-0001',
      type: 'APR_ALTURA',
      title: 'APR - Manutenção do Exaustor da Torre Superior',
      description: 'Trabalho em altura a 22 metros para troca de rolamentos e correias',
      location_id: 'risk_01',
      status: 'ativa',
      data: sampleAprData,
      device_id: 'DEVICE-BRA-SP-W11-X892',
      device_name: 'Chrome 131 on Windows 11 (Desktop Operacional)',
      ip_address: '192.168.1.105',
      created_by_user_id: 'user_tech_01',
      created_by_name: 'Carlos Mendes (Técnico SST)',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Sample PT (Permissão de Trabalho vinculada à APR-01)
    memoryDb.documents.push({
      id: 'doc_pt_01',
      code: 'PT-2026-0001',
      type: 'PT',
      title: 'PT - Liberação de Trabalho em Altura e Bloqueio Elétrico',
      description: 'Permissão para intervenção na Torre de Grãos vinculada à APR-2026-0001',
      location_id: 'risk_01',
      apr_id: 'doc_apr_01',
      status: 'ativa',
      data: {
        isPet: false,
        workTypes: ['altura', 'loto', 'eletrica'],
        validityStart: new Date().toISOString(),
        validityEnd: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
        supervisorName: 'Carlos Mendes (Técnico SST)',
        authorizedWorkers: [
          { id: 'emp_01', name: 'Marcos Aurélio Silveira', cpf: '123.456.789-00', role: 'Eletricista de Manutenção' },
          { id: 'emp_02', name: 'Rafael Barbosa Lima', cpf: '234.567.890-11', role: 'Mecânico Industrial' }
        ],
        safetyMeasures: [
          'Linha de vida vertical com trava-quedas inspecionada',
          'Chave geral bloqueada com cadeado LOTO individual',
          'Área térrea isolada em raio de 10 metros com cones e fita zebrada',
          'Condições meteorológicas favoráveis confirmadas'
        ],
        emergencyPlan: 'Acionamento da Brigada de Incêndio / Resgate no Canal 04 do Rádio. Bombeiros: 193.',
        deviceId: 'DEVICE-BRA-SP-W11-X892',
        deviceName: 'Chrome 131 on Windows 11',
        ipAddress: '192.168.1.105',
        createdDate: new Date().toISOString()
      },
      device_id: 'DEVICE-BRA-SP-W11-X892',
      device_name: 'Chrome 131 on Windows 11',
      ip_address: '192.168.1.105',
      created_by_user_id: 'user_tech_01',
      created_by_name: 'Carlos Mendes',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Sample OS (Ordem de Serviço NR-01 para Marcos Aurélio)
    memoryDb.documents.push({
      id: 'doc_os_01',
      code: 'OS-2026-0001',
      type: 'OS',
      title: 'Ordem de Serviço NR-01 — Marcos Aurélio Silveira (Eletricista)',
      description: 'OS de Segurança individual do colaborador Marcos Aurélio Silveira',
      employee_id: 'emp_01',
      status: 'ativa',
      data: {
        employee: {
          id: 'emp_01',
          name: 'Marcos Aurélio Silveira',
          cpf: '123.456.789-00',
          registration_number: 'REG-2024-001',
          role: 'Eletricista de Manutenção',
          department: 'Manutenção Elétrica',
          admission_date: '2024-02-15'
        },
        activitiesDescription: 'Instalação, manutenção preventiva e corretiva em quadros elétricos de baixa e média tensão, fiação, motores e transformadores.',
        identifiedRisks: {
          fisicos: ['Ruído intermitente', 'Radiação não ionizante (arco elétrico)'],
          quimicos: ['Produtos desengraxantes e solventes dielétricos'],
          biologicos: ['Ausentes'],
          ergonomicos: ['Postura inadequada durante fixação de painéis', 'Trabalho em pé prolongado'],
          acidentes: ['Choque elétrico', 'Arco elétrico / queimaduras', 'Queda de nível em altura', 'Impacto contra ferramentas']
        },
        mandatoryEpis: [
          'Capacete classe B para eletricista c/ jugular',
          'Viseira facial contra arco elétrico',
          'Vestimenta antichama NR-10 (Risco 2)',
          'Luvas isolantes de borracha c/ sobreluva de vaqueta',
          'Botina de segurança dielétrica sem componentes metálicos'
        ],
        preventiveMeasures: [
          'Desenergizar e testar ausência de tensão antes de qualquer intervenção (NR-10)',
          'Aplicar bloqueio e etiquetagem LOTO no painel principal',
          'Inspecionar diariamente as ferramentas manuais isoladas 1000V',
          'Utilizar cinto paraquedista ancorado quando trabalhar acima de 2 metros'
        ],
        employeeObligations: [
          'Cumprir rigorosamente os procedimentos da NR-10 e NR-35;',
          'Usar obrigatoriamente todos os EPIs fornecidos pela empresa;',
          'Submeter-se aos exames do PCMSO e treinamentos de reciclagem;',
          'Comunicar imediatamente qualquer anomalia ou risco grave ao SESMT.'
        ],
        prohibitions: [
          'Trabalhar em circuitos energizados sem ordem de serviço específica para linha viva;',
          'Utilizar adornos pessoais metálicos (alianças, anéis, relógios, correntes);',
          'Improvisar fusíveis ou ferramentas não isoladas;',
          'Operar equipamentos sem autorização expressa.'
        ],
        penaltiesNotice: 'O descumprimento das normas deste documento sujeita o empregado às penalidades disciplinares do Artigo 482 da CLT.',
        acknowledgementText: 'Declaro que recebi as orientações desta Ordem de Serviço, fui treinado e me comprometo a seguir todas as medidas de segurança.',
        deviceId: 'DEVICE-BRA-SP-W11-X892',
        createdDate: new Date().toISOString()
      },
      device_id: 'DEVICE-BRA-SP-W11-X892',
      device_name: 'Chrome 131 on Windows 11',
      ip_address: '192.168.1.105',
      created_by_user_id: 'user_admin_01',
      created_by_name: 'Administrador SST',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Sample Ficha de EPI (NR-06 para Marcos Aurélio)
    memoryDb.documents.push({
      id: 'doc_epi_01',
      code: 'EPI-2026-0001',
      type: 'EPI_FICHA',
      title: 'Ficha de Entrega de EPI (NR-06) — Marcos Aurélio Silveira',
      description: 'Termo de entrega e controle de EPIs com Certificado de Aprovação (CA)',
      employee_id: 'emp_01',
      status: 'ativa',
      data: {
        employee: {
          id: 'emp_01',
          name: 'Marcos Aurélio Silveira',
          cpf: '123.456.789-00',
          registration_number: 'REG-2024-001',
          role: 'Eletricista de Manutenção',
          department: 'Manutenção Elétrica'
        },
        deliveredItems: [
          { name: 'Cinto de Segurança Tipo Paraquedista c/ Talabarte Duplo', caNumber: 'CA-36399', deliveryDate: '2026-01-15', quantity: 1, condition: 'Novo' },
          { name: 'Capacete de Segurança Dielétrico com Jugular', caNumber: 'CA-14760', deliveryDate: '2026-01-15', quantity: 1, condition: 'Novo' },
          { name: 'Óculos de Proteção contra Impactos e UV', caNumber: 'CA-20188', deliveryDate: '2026-01-15', quantity: 1, condition: 'Novo' },
          { name: 'Botina de Segurança Dielétrica Bico Composite', caNumber: 'CA-42118', deliveryDate: '2026-01-15', quantity: 1, condition: 'Novo' }
        ],
        termOfResponsibility: 'Recebi da empresa os EPIs relacionados acima em perfeito estado de conservação e com CAs válidos. Comprometo-me a utilizá-los estritamente para o desempenho de minhas funções, responsabilizando-me por sua guarda e comunicando qualquer dano ao SESMT conforme estabelecido na NR-06.',
        deviceId: 'DEVICE-BRA-SP-W11-X892',
        createdDate: new Date().toISOString()
      },
      device_id: 'DEVICE-BRA-SP-W11-X892',
      device_name: 'Chrome 131 on Windows 11',
      ip_address: '192.168.1.105',
      created_by_user_id: 'user_admin_01',
      created_by_name: 'Administrador SST',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Sample Checklist de Campo (NR-35 Andaimes e Plataformas)
    memoryDb.documents.push({
      id: 'doc_chk_01',
      code: 'CHK-2026-0001',
      type: 'CHECKLIST',
      title: 'Checklist Pré-Operacional — Andaime Fachadeiro Torre 01',
      description: 'Inspeção diária de conformidade estrutural e segurança do andaime',
      location_id: 'risk_01',
      status: 'ativa',
      data: {
        templateType: 'andaimes',
        equipmentCode: 'AND-FACH-01',
        equipmentDescription: 'Andaime metálico tubular modular de 14 metros',
        inspectorName: 'Carlos Mendes (Técnico SST)',
        items: [
          { text: 'Sapatas apoiadas sobre pranchões nivelados e travadas', status: 'C', notes: 'Nivelamento conferido com nível bolha' },
          { text: 'Guarda-corpo duplo (1,20m e 0,70m) com rodapé de 20cm presente', status: 'C', notes: 'Presente em todos os níveis de trabalho' },
          { text: 'Piso de trabalho 100% completo, sem vãos, antiderrapante e fixado', status: 'C', notes: 'Pranchas metálicas encaixadas' },
          { text: 'Escada de acesso com corrimão e gaiola ou linha de vida vertical', status: 'C', notes: 'Cabo guia instalado' },
          { text: 'Ancoragem estrutural na fachada realizada a cada 4 metros', status: 'C', notes: 'Travessas fixadas com parabolt' },
          { text: 'Aterramento elétrico contra descargas atmosféricas conectado', status: 'C', notes: 'Cordoalha ligada à malha de terra' },
          { text: 'Placa de "ANDAIME LIBERADO" afixada na base de acesso', status: 'C', notes: 'Placa verde instalada' }
        ],
        isApproved: true,
        evaluationResult: 'APTO PARA USO',
        observations: 'Andaime em perfeitas condições normativas (NR-18 e NR-35). Liberação válida por 24 horas.',
        deviceId: 'DEVICE-BRA-SP-W11-X892',
        createdDate: new Date().toISOString()
      },
      device_id: 'DEVICE-BRA-SP-W11-X892',
      device_name: 'Chrome 131 on Windows 11',
      ip_address: '192.168.1.105',
      created_by_user_id: 'user_tech_01',
      created_by_name: 'Carlos Mendes',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    memoryDb.audit_logs.push({
      id: 'log_01',
      user_id: 'user_tech_01',
      user_name: 'Carlos Mendes (Técnico SST)',
      action: 'EMISSAO_APR',
      module: 'DOCUMENTOS',
      details: 'Emissão da APR-2026-0001 para trabalho em altura na Torre de Grãos',
      device_id: 'DEVICE-BRA-SP-W11-X892',
      ip_address: '192.168.1.105',
      created_at: new Date().toISOString()
    });
  }

  // 6. Extinguishers Seed
  if (!memoryDb.extinguishers || memoryDb.extinguishers.length === 0) {
    memoryDb.extinguishers = [
      {
        id: 'ext_01',
        code: 'EXT-01',
        type: 'PQS_ABC',
        capacity: '6 kg',
        location_name: 'Almoxarifado Central & Oficina Mecânica (Usina Santa Isabel)',
        lat: -21.5093,
        lng: -49.2070,
        selo_inmetro: 'INMETRO-781923',
        last_recharge_date: '2026-03-10',
        next_recharge_date: '2027-03-10',
        hydrostatic_test_date: '2029-03-10',
        status: 'operacional',
        qr_code_data: 'EXT-01-PQS-6KG',
        inspections: [
          {
            id: 'insp_ext_01',
            date: '2026-10-15',
            inspectorName: 'Carlos Mendes (Técnico SST)',
            pressureOk: true,
            sealIntact: true,
            hoseClear: true,
            signVisible: true,
            unobstructed: true,
            notes: 'Extintor em perfeitas condições operacionais.',
            status: 'aprovado'
          }
        ],
        created_at: new Date().toISOString()
      },
      {
        id: 'ext_02',
        code: 'EXT-02',
        type: 'CO2',
        capacity: '6 kg',
        location_name: 'Subestação Elétrica Principal (Usina Santa Isabel)',
        lat: -21.5081,
        lng: -49.2078,
        selo_inmetro: 'INMETRO-665201',
        last_recharge_date: '2026-01-20',
        next_recharge_date: '2027-01-20',
        hydrostatic_test_date: '2028-01-20',
        status: 'operacional',
        qr_code_data: 'EXT-02-CO2-6KG',
        inspections: [
          {
            id: 'insp_ext_02',
            date: '2026-10-15',
            inspectorName: 'Carlos Mendes (Técnico SST)',
            pressureOk: true,
            sealIntact: true,
            hoseClear: true,
            signVisible: true,
            unobstructed: true,
            notes: 'Cilindro pesado e lacre íntegro.',
            status: 'aprovado'
          }
        ],
        created_at: new Date().toISOString()
      },
      {
        id: 'ext_03',
        code: 'EXT-03',
        type: 'AGUA',
        capacity: '10 L',
        location_name: 'Pátio de Cavacos e Biomassa (Usina Santa Isabel)',
        lat: -21.5079,
        lng: -49.2065,
        selo_inmetro: 'INMETRO-993214',
        last_recharge_date: '2025-11-05',
        next_recharge_date: '2026-11-05',
        hydrostatic_test_date: '2027-11-05',
        status: 'operacional',
        qr_code_data: 'EXT-03-AP-10L',
        inspections: [],
        created_at: new Date().toISOString()
      },
      {
        id: 'ext_04',
        code: 'EXT-04',
        type: 'PQS_ABC',
        capacity: '12 kg (Carreta)',
        location_name: 'Tanques de Combustível / Abastecimento (Usina Santa Isabel)',
        lat: -21.5074,
        lng: -49.2090,
        selo_inmetro: 'INMETRO-442190',
        last_recharge_date: '2024-09-01',
        next_recharge_date: '2025-09-01',
        hydrostatic_test_date: '2026-09-01',
        status: 'vencido',
        qr_code_data: 'EXT-04-PQS-12KG',
        inspections: [],
        created_at: new Date().toISOString()
      }
    ];
  }

  // 7. Brigade Members Seed
  if (!memoryDb.brigade_members || memoryDb.brigade_members.length === 0) {
    memoryDb.brigade_members = [
      {
        id: 'bm_01',
        employee_id: 'emp_01',
        role_in_brigade: 'lider',
        shift: 'Turno A (Manhã)',
        station_location: 'Oficina Central / Sala Elétrica',
        lat: -21.5085,
        lng: -49.2080,
        training_cert_code: 'BRIG-2026-SP-901',
        training_date: '2026-04-10',
        training_expiry_date: '2027-04-10',
        is_on_duty: true,
        notes: 'Coordenador da equipe de combate direto no turno da manhã.',
        created_at: new Date().toISOString()
      },
      {
        id: 'bm_02',
        employee_id: 'emp_02',
        role_in_brigade: 'brigadista_combate',
        shift: 'Turno A (Manhã)',
        station_location: 'Moenda & Desfibrador',
        lat: -21.5084,
        lng: -49.2082,
        training_cert_code: 'BRIG-2026-SP-902',
        training_date: '2026-04-10',
        training_expiry_date: '2027-04-10',
        is_on_duty: true,
        notes: 'Operador de linha de mangueiras e hidrantes.',
        created_at: new Date().toISOString()
      },
      {
        id: 'bm_03',
        employee_id: 'emp_04',
        role_in_brigade: 'socorrista',
        shift: 'Turno B (Tarde)',
        station_location: 'Setor de Utilidades / Casa de Bombas',
        lat: -21.5065,
        lng: -49.2079,
        training_cert_code: 'BRIG-2026-SP-904',
        training_date: '2026-05-15',
        training_expiry_date: '2027-05-15',
        is_on_duty: false,
        notes: 'Treinamento avançado de Suporte Básico de Vida (SBV) e DEA.',
        created_at: new Date().toISOString()
      },
      {
        id: 'bm_04',
        employee_id: 'emp_03',
        role_in_brigade: 'chefe_setor',
        shift: 'Turno A (Manhã)',
        station_location: 'Caldeiraria & Caldeiras',
        lat: -21.5088,
        lng: -49.2076,
        training_cert_code: 'BRIG-2024-SP-710',
        training_date: '2024-02-10',
        training_expiry_date: '2025-02-10',
        is_on_duty: true,
        notes: 'Responsável pela evacuação do galpão de caldeiraria.',
        created_at: new Date().toISOString()
      }
    ];
  }

  // 8. Meeting Points Seed
  if (!memoryDb.meeting_points || memoryDb.meeting_points.length === 0) {
    memoryDb.meeting_points = [
      {
        id: 'mp_01',
        code: 'PE-01',
        name: 'Ponto de Encontro 01 - Pátio Principal Externo da Portaria (Usina Santa Isabel)',
        lat: -21.5065,
        lng: -49.2078,
        capacity_people: 150,
        evacuated_sectors: ['Administração', 'Refeitório', 'Portaria', 'Ambulatório', 'Almoxarifado'],
        coordinator_employee_id: 'emp_01',
        description: 'Área externa descampada pavimentada na portaria da Usina Santa Isabel, longe de linhas de alta tensão e fachadas envidraçadas.',
        created_at: new Date().toISOString()
      },
      {
        id: 'mp_02',
        code: 'PE-02',
        name: 'Ponto de Encontro 02 - Campo de Apoio Industrial Sul (Usina Santa Isabel)',
        lat: -21.5098,
        lng: -49.2062,
        capacity_people: 100,
        evacuated_sectors: ['Caldeiraria', 'Manutenção Mecânica', 'Utilidades', 'Moenda'],
        coordinator_employee_id: 'emp_02',
        description: 'Área livre externa ao lado dos galpões da Usina Santa Isabel com rota rápida de acesso de viaturas do Corpo de Bombeiros.',
        created_at: new Date().toISOString()
      }
    ];
  }

  // 9. Evacuation Drills Seed
  if (!memoryDb.evacuation_drills || memoryDb.evacuation_drills.length === 0) {
    memoryDb.evacuation_drills = [
      {
        id: 'drill_01',
        title: 'Simulado de Abandono Geral da Fábrica - 2º Semestre 2026',
        date: '2026-09-24',
        evacuation_time_seconds: 245,
        total_evacuated_people: 84,
        meeting_point_id: 'mp_01',
        drill_type: 'simulado_geral',
        evaluation: 'excelente',
        observations: 'Alarme sonoro acionado às 14:00. Todos os setores evacuaram ordenadamente pelas rotas sinalizadas. Cômputo no PE-01 finalizado em 4min 05s sem feridos.',
        responsible_name: 'Carlos Mendes (Técnico SST)',
        created_at: new Date().toISOString()
      }
    ];
  }

  // 10. Sincronização automática para coordenadas reais da Usina Santa Isabel (Novo Horizonte-SP)
  const usinaRisks: Record<string, { lat: number; lng: number; name: string; description: string }> = {
    risk_01: {
      lat: -21.5084,
      lng: -49.2083,
      name: 'Moenda & Desfibrador - Torre Elevadora de Bagaço (Usina Santa Isabel)',
      description: 'Estrutura metálica elevada na área industrial da Usina Santa Isabel (Novo Horizonte-SP). Risco de queda em altura superior a 22 metros, vibração mecânica e esteiras rolantes. Linha de vida e trava-quedas obrigatórios.'
    },
    risk_02: {
      lat: -21.5076,
      lng: -49.2092,
      name: 'Parque de Tanques e Cubas de Fermentação (Usina Santa Isabel)',
      description: 'Espaço confinado interior em dornas e tanques de etanol/mosto na Usina Santa Isabel. Atmosfera com risco de vapores inflamáveis e deficiência de O2. Obrigatória PET NR-33, ventilação mecânica e detector multigases.'
    },
    risk_03: {
      lat: -21.5089,
      lng: -49.2075,
      name: 'Caldeira a Vapor e Torre de Lavagem de Gases (Usina Santa Isabel)',
      description: 'Boca de visita e tubulação superior de vapor a 18m de altura na Usina Santa Isabel. Combina trabalho em altura crítica (NR-35) e espaço confinado em tubulão da caldeira (NR-33) com risco térmico.'
    }
  };

  (memoryDb.risk_locations || []).forEach(r => {
    if (usinaRisks[r.id]) {
      r.lat = usinaRisks[r.id].lat;
      r.lng = usinaRisks[r.id].lng;
      r.name = usinaRisks[r.id].name;
      r.description = usinaRisks[r.id].description;
    }
  });

  const usinaExts: Record<string, { lat: number; lng: number; location_name: string }> = {
    ext_01: { lat: -21.5093, lng: -49.2070, location_name: 'Almoxarifado Central & Oficina Mecânica (Usina Santa Isabel)' },
    ext_02: { lat: -21.5081, lng: -49.2078, location_name: 'Subestação Elétrica Principal (Usina Santa Isabel)' },
    ext_03: { lat: -21.5079, lng: -49.2065, location_name: 'Pátio de Cavacos e Biomassa (Usina Santa Isabel)' },
    ext_04: { lat: -21.5074, lng: -49.2090, location_name: 'Tanques de Combustível / Abastecimento (Usina Santa Isabel)' }
  };

  (memoryDb.extinguishers || []).forEach(e => {
    if (usinaExts[e.id]) {
      e.lat = usinaExts[e.id].lat;
      e.lng = usinaExts[e.id].lng;
      e.location_name = usinaExts[e.id].location_name;
    }
  });

  const usinaMembers: Record<string, { lat: number; lng: number }> = {
    bm_01: { lat: -21.5085, lng: -49.2080 },
    bm_02: { lat: -21.5084, lng: -49.2082 },
    bm_03: { lat: -21.5065, lng: -49.2079 },
    bm_04: { lat: -21.5088, lng: -49.2076 }
  };

  (memoryDb.brigade_members || []).forEach(m => {
    if (usinaMembers[m.id]) {
      m.lat = usinaMembers[m.id].lat;
      m.lng = usinaMembers[m.id].lng;
    }
  });

  const usinaMeetingPoints: Record<string, { lat: number; lng: number; name: string; description: string }> = {
    mp_01: {
      lat: -21.5065,
      lng: -49.2078,
      name: 'Ponto de Encontro 01 - Pátio Principal Externo da Portaria (Usina Santa Isabel)',
      description: 'Área externa descampada pavimentada na portaria da Usina Santa Isabel, longe de linhas de alta tensão e fachadas envidraçadas.'
    },
    mp_02: {
      lat: -21.5098,
      lng: -49.2062,
      name: 'Ponto de Encontro 02 - Campo de Apoio Industrial Sul (Usina Santa Isabel)',
      description: 'Área livre externa ao lado dos galpões da Usina Santa Isabel com rota rápida de acesso de viaturas do Corpo de Bombeiros.'
    }
  };

  (memoryDb.meeting_points || []).forEach(mp => {
    if (usinaMeetingPoints[mp.id]) {
      mp.lat = usinaMeetingPoints[mp.id].lat;
      mp.lng = usinaMeetingPoints[mp.id].lng;
      mp.name = usinaMeetingPoints[mp.id].name;
      mp.description = usinaMeetingPoints[mp.id].description;
    }
  });

  saveDatabase();
}

// Data Access Repositories
export const db = {
  roles: {
    find: () => memoryDb.roles,
    findById: (id: string) => memoryDb.roles.find(r => r.id === id),
    findByName: (name: string) => memoryDb.roles.find(r => r.name.toLowerCase() === name.toLowerCase()),
    create: (role: Role) => {
      memoryDb.roles.push(role);
      saveDatabase();
      return role;
    },
    update: (id: string, updates: Partial<Role>) => {
      const idx = memoryDb.roles.findIndex(r => r.id === id);
      if (idx !== -1) {
        memoryDb.roles[idx] = { ...memoryDb.roles[idx], ...updates };
        saveDatabase();
        return memoryDb.roles[idx];
      }
      return null;
    },
    delete: (id: string) => {
      const idx = memoryDb.roles.findIndex(r => r.id === id);
      if (idx !== -1) {
        const removed = memoryDb.roles.splice(idx, 1)[0];
        saveDatabase();
        return removed;
      }
      return null;
    }
  },

  users: {
    find: () => memoryDb.users.map(({ password_hash, ...u }) => u),
    findById: (id: string) => memoryDb.users.find(u => u.id === id),
    findByEmail: (email: string) => memoryDb.users.find(u => u.email.toLowerCase() === email.toLowerCase()),
    create: (user: User) => {
      memoryDb.users.push(user);
      saveDatabase();
      const { password_hash, ...safe } = user;
      return safe;
    },
    update: (id: string, updates: Partial<User>) => {
      const idx = memoryDb.users.findIndex(u => u.id === id);
      if (idx !== -1) {
        memoryDb.users[idx] = { ...memoryDb.users[idx], ...updates };
        saveDatabase();
        const { password_hash, ...safe } = memoryDb.users[idx];
        return safe;
      }
      return null;
    },
    delete: (id: string) => {
      const idx = memoryDb.users.findIndex(u => u.id === id);
      if (idx !== -1) {
        const removed = memoryDb.users.splice(idx, 1)[0];
        saveDatabase();
        return removed;
      }
      return null;
    }
  },

  employees: {
    find: () => memoryDb.employees,
    findById: (id: string) => memoryDb.employees.find(e => e.id === id),
    findByCpf: (cpf: string) => memoryDb.employees.find(e => e.cpf === cpf),
    create: (emp: Employee) => {
      memoryDb.employees.push(emp);
      saveDatabase();
      return emp;
    },
    update: (id: string, updates: Partial<Employee>) => {
      const idx = memoryDb.employees.findIndex(e => e.id === id);
      if (idx !== -1) {
        memoryDb.employees[idx] = { ...memoryDb.employees[idx], ...updates };
        saveDatabase();
        return memoryDb.employees[idx];
      }
      return null;
    },
    delete: (id: string) => {
      const idx = memoryDb.employees.findIndex(e => e.id === id);
      if (idx !== -1) {
        const removed = memoryDb.employees.splice(idx, 1)[0];
        // Also remove cascade trainings & epis
        memoryDb.trainings = memoryDb.trainings.filter(t => t.employee_id !== id);
        memoryDb.epis = memoryDb.epis.filter(epi => epi.employee_id !== id);
        saveDatabase();
        return removed;
      }
      return null;
    }
  },

  trainings: {
    find: () => memoryDb.trainings,
    findByEmployeeId: (empId: string) => memoryDb.trainings.filter(t => t.employee_id === empId),
    getAll: () => memoryDb.trainings,
    create: (trn: Training) => {
      memoryDb.trainings.push(trn);
      saveDatabase();
      return trn;
    },
    update: (id: string, updates: Partial<Training>) => {
      const idx = memoryDb.trainings.findIndex(t => t.id === id);
      if (idx !== -1) {
        memoryDb.trainings[idx] = { ...memoryDb.trainings[idx], ...updates };
        saveDatabase();
        return memoryDb.trainings[idx];
      }
      return null;
    },
    delete: (id: string) => {
      const idx = memoryDb.trainings.findIndex(t => t.id === id);
      if (idx !== -1) {
        const removed = memoryDb.trainings.splice(idx, 1)[0];
        saveDatabase();
        return removed;
      }
      return null;
    }
  },

  epis: {
    find: () => memoryDb.epis,
    findByEmployeeId: (empId: string) => memoryDb.epis.filter(e => e.employee_id === empId),
    getAll: () => memoryDb.epis,
    create: (epi: EPI) => {
      memoryDb.epis.push(epi);
      saveDatabase();
      return epi;
    },
    update: (id: string, updates: Partial<EPI>) => {
      const idx = memoryDb.epis.findIndex(e => e.id === id);
      if (idx !== -1) {
        memoryDb.epis[idx] = { ...memoryDb.epis[idx], ...updates };
        saveDatabase();
        return memoryDb.epis[idx];
      }
      return null;
    },
    delete: (id: string) => {
      const idx = memoryDb.epis.findIndex(e => e.id === id);
      if (idx !== -1) {
        const removed = memoryDb.epis.splice(idx, 1)[0];
        saveDatabase();
        return removed;
      }
      return null;
    }
  },

  riskLocations: {
    find: () => memoryDb.risk_locations,
    findById: (id: string) => memoryDb.risk_locations.find(r => r.id === id),
    create: (risk: RiskLocation) => {
      memoryDb.risk_locations.push(risk);
      saveDatabase();
      return risk;
    },
    update: (id: string, updates: Partial<RiskLocation>) => {
      const idx = memoryDb.risk_locations.findIndex(r => r.id === id);
      if (idx !== -1) {
        memoryDb.risk_locations[idx] = { ...memoryDb.risk_locations[idx], ...updates };
        saveDatabase();
        return memoryDb.risk_locations[idx];
      }
      return null;
    },
    delete: (id: string) => {
      const idx = memoryDb.risk_locations.findIndex(r => r.id === id);
      if (idx !== -1) {
        const removed = memoryDb.risk_locations.splice(idx, 1)[0];
        saveDatabase();
        return removed;
      }
      return null;
    }
  },

  documents: {
    find: (filterType?: string) => {
      if (filterType && filterType !== 'ALL') {
        return memoryDb.documents.filter(d => d.type === filterType || (filterType === 'APR' && d.type.startsWith('APR_')));
      }
      return memoryDb.documents;
    },
    findById: (id: string) => memoryDb.documents.find(d => d.id === id),
    findByCode: (code: string) => memoryDb.documents.find(d => d.code === code),
    findByLocationId: (locationId: string) => memoryDb.documents.filter(d => d.location_id === locationId),
    create: (doc: DocumentRecord) => {
      memoryDb.documents.unshift(doc);
      saveDatabase();
      return doc;
    },
    update: (id: string, updates: Partial<DocumentRecord>) => {
      const idx = memoryDb.documents.findIndex(d => d.id === id);
      if (idx !== -1) {
        memoryDb.documents[idx] = { 
          ...memoryDb.documents[idx], 
          ...updates, 
          updated_at: new Date().toISOString() 
        };
        saveDatabase();
        return memoryDb.documents[idx];
      }
      return null;
    },
    delete: (id: string) => {
      const idx = memoryDb.documents.findIndex(d => d.id === id);
      if (idx !== -1) {
        const removed = memoryDb.documents.splice(idx, 1)[0];
        saveDatabase();
        return removed;
      }
      return null;
    }
  },

  auditLogs: {
    find: (limit = 100) => memoryDb.audit_logs.slice(0, limit),
    create: (log: AuditLog) => {
      memoryDb.audit_logs.unshift(log);
      if (memoryDb.audit_logs.length > 1000) {
        memoryDb.audit_logs.pop(); // keep latest 1000 logs
      }
      saveDatabase();
      return log;
    }
  },

  settings: {
    getAll: () => memoryDb.settings,
    get: (key: string) => memoryDb.settings[key],
    set: (key: string, value: string) => {
      memoryDb.settings[key] = value;
      saveDatabase();
      return value;
    },
    updateMany: (newSettings: Record<string, string>) => {
      memoryDb.settings = { ...memoryDb.settings, ...newSettings };
      saveDatabase();
      return memoryDb.settings;
    }
  },

  extinguishers: {
    find: () => memoryDb.extinguishers || [],
    findById: (id: string) => (memoryDb.extinguishers || []).find(e => e.id === id),
    findByCode: (code: string) => (memoryDb.extinguishers || []).find(e => e.code.toLowerCase() === code.toLowerCase()),
    create: (ext: Extinguisher) => {
      if (!memoryDb.extinguishers) memoryDb.extinguishers = [];
      memoryDb.extinguishers.push(ext);
      saveDatabase();
      return ext;
    },
    update: (id: string, updates: Partial<Extinguisher>) => {
      if (!memoryDb.extinguishers) memoryDb.extinguishers = [];
      const idx = memoryDb.extinguishers.findIndex(e => e.id === id);
      if (idx !== -1) {
        memoryDb.extinguishers[idx] = { ...memoryDb.extinguishers[idx], ...updates };
        saveDatabase();
        return memoryDb.extinguishers[idx];
      }
      return null;
    },
    delete: (id: string) => {
      if (!memoryDb.extinguishers) memoryDb.extinguishers = [];
      const idx = memoryDb.extinguishers.findIndex(e => e.id === id);
      if (idx !== -1) {
        const removed = memoryDb.extinguishers.splice(idx, 1)[0];
        saveDatabase();
        return removed;
      }
      return null;
    }
  },

  brigadeMembers: {
    find: () => memoryDb.brigade_members || [],
    findById: (id: string) => (memoryDb.brigade_members || []).find(b => b.id === id),
    findByEmployeeId: (empId: string) => (memoryDb.brigade_members || []).find(b => b.employee_id === empId),
    create: (bm: BrigadeMember) => {
      if (!memoryDb.brigade_members) memoryDb.brigade_members = [];
      memoryDb.brigade_members.push(bm);
      saveDatabase();
      return bm;
    },
    update: (id: string, updates: Partial<BrigadeMember>) => {
      if (!memoryDb.brigade_members) memoryDb.brigade_members = [];
      const idx = memoryDb.brigade_members.findIndex(b => b.id === id);
      if (idx !== -1) {
        memoryDb.brigade_members[idx] = { ...memoryDb.brigade_members[idx], ...updates };
        saveDatabase();
        return memoryDb.brigade_members[idx];
      }
      return null;
    },
    delete: (id: string) => {
      if (!memoryDb.brigade_members) memoryDb.brigade_members = [];
      const idx = memoryDb.brigade_members.findIndex(b => b.id === id);
      if (idx !== -1) {
        const removed = memoryDb.brigade_members.splice(idx, 1)[0];
        saveDatabase();
        return removed;
      }
      return null;
    }
  },

  meetingPoints: {
    find: () => memoryDb.meeting_points || [],
    findById: (id: string) => (memoryDb.meeting_points || []).find(m => m.id === id),
    create: (mp: MeetingPoint) => {
      if (!memoryDb.meeting_points) memoryDb.meeting_points = [];
      memoryDb.meeting_points.push(mp);
      saveDatabase();
      return mp;
    },
    update: (id: string, updates: Partial<MeetingPoint>) => {
      if (!memoryDb.meeting_points) memoryDb.meeting_points = [];
      const idx = memoryDb.meeting_points.findIndex(m => m.id === id);
      if (idx !== -1) {
        memoryDb.meeting_points[idx] = { ...memoryDb.meeting_points[idx], ...updates };
        saveDatabase();
        return memoryDb.meeting_points[idx];
      }
      return null;
    },
    delete: (id: string) => {
      if (!memoryDb.meeting_points) memoryDb.meeting_points = [];
      const idx = memoryDb.meeting_points.findIndex(m => m.id === id);
      if (idx !== -1) {
        const removed = memoryDb.meeting_points.splice(idx, 1)[0];
        saveDatabase();
        return removed;
      }
      return null;
    }
  },

  evacuationDrills: {
    find: () => memoryDb.evacuation_drills || [],
    findById: (id: string) => (memoryDb.evacuation_drills || []).find(d => d.id === id),
    create: (drill: EvacuationDrill) => {
      if (!memoryDb.evacuation_drills) memoryDb.evacuation_drills = [];
      memoryDb.evacuation_drills.unshift(drill);
      saveDatabase();
      return drill;
    },
    delete: (id: string) => {
      if (!memoryDb.evacuation_drills) memoryDb.evacuation_drills = [];
      const idx = memoryDb.evacuation_drills.findIndex(d => d.id === id);
      if (idx !== -1) {
        const removed = memoryDb.evacuation_drills.splice(idx, 1)[0];
        saveDatabase();
        return removed;
      }
      return null;
    }
  }
};
