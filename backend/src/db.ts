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
  type: 'APR_GENERICA' | 'APR_ALTURA' | 'APR_ESPACO_CONFINADO' | 'PT' | 'INSPECAO' | 'OSS' | 'CIPA' | 'EXTERNO';
  title: string;
  description?: string;
  location_id?: string;
  status: 'rascunho' | 'ativa' | 'encerrada' | 'cancelada';
  data: any; // Dynamic JSON for APR/PT fields
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

export interface DatabaseSchema {
  roles: Role[];
  users: User[];
  employees: Employee[];
  trainings: Training[];
  epis: EPI[];
  risk_locations: RiskLocation[];
  documents: DocumentRecord[];
  audit_logs: AuditLog[];
  settings: Record<string, string>;
}

// In-memory cache + synchronized disk persistence
let memoryDb: DatabaseSchema;

function loadDatabase(): DatabaseSchema {
  if (fs.existsSync(dbFilePath)) {
    try {
      const raw = fs.readFileSync(dbFilePath, 'utf-8');
      return JSON.parse(raw);
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
        name: 'Silos de Grãos e Moenda - Torre Elevadora Superior (Novo Horizonte)',
        lat: -21.4689,
        lng: -49.2217,
        risk_type: 'altura',
        description: 'Estrutura metálica com 28 metros de altura na unidade de Novo Horizonte-SP. Risco de queda com diferença de nível e intempéries climáticas. Linha de vida obrigatória.',
        required_epis: ['Cinto Paraquedista', 'Talabarte Duplo', 'Trava-quedas para cabo de aço', 'Capacete c/ jugular', 'Botina de segurança'],
        authorized_employee_ids: ['emp_01', 'emp_02'],
        qr_code_data: 'RISCO_LOC_01',
        created_by: 'user_admin_01',
        created_at: new Date().toISOString()
      },
      {
        id: 'risk_02',
        name: 'Galeria Subterrânea de Efluentes e Utilidades (Novo Horizonte)',
        lat: -21.4720,
        lng: -49.2205,
        risk_type: 'espaco_confinado',
        description: 'Profundidade de 4,5m com atmosfera potencialmente deficiente de O2 ou presença de H2S. Obrigatória ventilação mecânica forçada contínua e vigia.',
        required_epis: ['Detector 4 Gases (O2, LEL, CO, H2S)', 'Tripé com Guincho Resgatador', 'Cinto de 4 Pontos', 'Exaustor Insuflador de Ar'],
        authorized_employee_ids: ['emp_02', 'emp_04'],
        qr_code_data: 'RISCO_LOC_02',
        created_by: 'user_admin_01',
        created_at: new Date().toISOString()
      },
      {
        id: 'risk_03',
        name: 'Tanque de Decantação e Reator Químico R-02 (Novo Horizonte)',
        lat: -21.4655,
        lng: -49.2245,
        risk_type: 'ambos',
        description: 'Boca de visita elevada localizada a 6m de altura com acesso ao interior de vaso confinado. Combina risco de queda e atmosfera inflamável.',
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
  }
};
