import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RiskLocation, Employee, DocumentRecord } from '../types';
import { getDeviceId, getDeviceDescription } from '../services/deviceId';
import { generateDocumentPdf } from '../services/documentPdfGenerator';
import { SignaturePad } from '../components/SignaturePad';
import {
  FileText,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  HardHat,
  Users,
  Check,
  Download,
  MapPin,
  Zap,
  Flame,
  Key,
  ShieldCheck,
  ClipboardCheck,
  Plus,
  Trash2,
  Calendar,
  Clock,
  PenTool,
  X
} from 'lucide-react';

export const DocumentCreatePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Core Document Mode: 'APR' | 'PT' | 'OS' | 'EPI_FICHA' | 'CHECKLIST'
  const initialType = (searchParams.get('type') as any) || (searchParams.get('aprId') ? 'PT' : 'APR');
  const [docCategory, setDocCategory] = useState<'APR' | 'PT' | 'OS' | 'EPI_FICHA' | 'CHECKLIST'>(initialType);

  const [step, setStep] = useState<number>(1);
  const [locations, setLocations] = useState<RiskLocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [existingAprs, setExistingAprs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const deviceId = getDeviceId();
  const deviceDesc = getDeviceDescription();

  // General fields
  const [title, setTitle] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedAprId, setSelectedAprId] = useState<string>(searchParams.get('aprId') || '');

  // 1. APR SPECIFIC STATE
  const [aprType, setAprType] = useState<'APR_GENERICA' | 'APR_ALTURA' | 'APR_ESPACO_CONFINADO'>('APR_ALTURA');
  const [aprDetails, setAprDetails] = useState('');
  const [aprHeightMeters, setAprHeightMeters] = useState(12);
  const [aprAnchorPoints, setAnchorPoints] = useState('Linha de vida inspecionada com cabo de aço e absorvedor de impacto');
  const [aprRescuePlan, setRescuePlan] = useState('Plano de resgate vertical pré-definido com equipe de brigada e maca envelope');
  const [aprHazards, setAprHazards] = useState<string[]>([
    'Queda de pessoas com diferença de nível (> 2m)',
    'Queda de ferramentas manuais ou peças',
    'Contato com partes móveis ou energizadas'
  ]);
  const [aprMeasures, setAprMeasures] = useState<string[]>([
    'Uso contínuo de cinto tipo paraquedista com talabarte duplo ancorado',
    'Isolamento e sinalização da área térrea sob a projeção do serviço',
    'Amarração de todas as ferramentas manuais',
    'Bloqueio elétrico LOTO com cadeado individual'
  ]);
  const [aprWorkerIds, setAprWorkerIds] = useState<string[]>([]);

  // 2. PT / PET SPECIFIC STATE
  const [isPet, setIsPet] = useState<boolean>(false);
  const [ptWorkTypes, setPtWorkTypes] = useState<string[]>(['altura']);
  const [ptSupervisorName, setPtSupervisorName] = useState(user?.name || '');
  const [ptWatchName, setPtWatchName] = useState('');
  const [ptValidityStart, setPtValidityStart] = useState(new Date().toISOString().substring(0, 16));
  const [ptValidityEnd, setPtValidityEnd] = useState(
    new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 16)
  );
  const [ptWorkerIds, setPtWorkerIds] = useState<string[]>([]);
  const [ptMeasures, setPtMeasures] = useState<string[]>([
    'Área isolada e sinalizada com cones e fita zebrada',
    'Bloqueio mecânico/elétrico LOTO testado e aprovado',
    'EPIs específicos de alto risco inspecionados antes do uso',
    'Comunicação direta com o setor de SST e Brigada estabelecida'
  ]);
  const [ptGasMeasurements, setPtGasMeasurements] = useState([
    { time: '08:00', o2: '20.9%', lel: '0%', co: '0 ppm', h2s: '0 ppm', tester: user?.name || 'Inspetor SST', status: 'ok' as const }
  ]);
  const [ptEmergencyPlan, setPtEmergencyPlan] = useState('Equipe de brigada em prontidão, maca rígida disponível e rota de fuga desobstruída.');

  // 3. OS (NR-01) SPECIFIC STATE
  const [osActivities, setOsActivities] = useState('');
  const [osRisks, setOsRisks] = useState({
    fisicos: ['Ruído contínuo proveniente de máquinas', 'Calor moderado'],
    quimicos: ['Poeiras em suspensão e vapores de desengraxante'],
    biologicos: ['Ausentes na rotina'],
    ergonomicos: ['Postura em pé prolongada', 'Levantamento manual eventual de cargas'],
    acidentes: ['Queda de mesmo nível', 'Cortes em membros superiores', 'Impacto contra estruturas']
  });
  const [osEpis, setOsEpis] = useState<string[]>([
    'Capacete de segurança com jugular',
    'Óculos de proteção contra impactos',
    'Protetor auditivo plug/concha',
    'Botina de segurança com bico composite',
    'Luva de vaqueta mecânica mista'
  ]);
  const [osMeasures, setOsMeasures] = useState<string[]>([
    'Inspecionar ferramentas antes de iniciar a jornada',
    'Não operar equipamentos sem proteção coletiva ou autorização expressa',
    'Manter área de trabalho limpa e desobstruída',
    'Participar dos Diálogos Diários de Segurança (DDS)'
  ]);

  // 4. FICHA DE EPI (NR-06) SPECIFIC STATE
  const [epiItems, setEpiItems] = useState<{ name: string; caNumber: string; deliveryDate: string; quantity: number; condition: string }[]>([]);

  // 5. CHECKLIST PRÉ-OPERACIONAL SPECIFIC STATE
  const [chkTemplate, setChkTemplate] = useState<'andaimes' | 'cinto_altura' | 'escadas' | 'ferramenta_eletrica' | 'trabalho_quente' | 'geral'>('andaimes');
  const [chkEquipCode, setChkEquipCode] = useState('EQP-01');
  const [chkEquipDesc, setChkEquipDesc] = useState('Andaime Fachadeiro Metálico');
  const [chkItems, setChkItems] = useState<{ text: string; status: 'C' | 'NC' | 'NA'; notes: string }[]>([
    { text: 'Sapatas apoiadas sobre pranchões nivelados e travadas', status: 'C', notes: 'Conferido com nível bolha' },
    { text: 'Guarda-corpo duplo (1,20m e 0,70m) com rodapé de 20cm instalado', status: 'C', notes: 'Presente em todos os níveis' },
    { text: 'Piso 100% completo, sem frestas, antiderrapante e fixado', status: 'C', notes: 'Pranchas metálicas travadas' },
    { text: 'Escada de acesso com linha de vida vertical instalada', status: 'C', notes: 'Cabo guia testado' },
    { text: 'Ancoragem estrutural na fachada realizada com tirantes', status: 'C', notes: 'Pontos de ancoragem firmes' },
    { text: 'Aterramento elétrico contra descargas atmosféricas conectado', status: 'C', notes: 'Cordoalha ligada à malha' },
    { text: 'Placa de "ANDAIME LIBERADO" afixada na base de acesso', status: 'C', notes: 'Placa verde visível' }
  ]);
  const [chkIsApproved, setChkIsApproved] = useState<boolean>(true);
  const [chkObservations, setChkObservations] = useState('');

  // Signature and Result State
  const [capturedSignature, setCapturedSignature] = useState<string | null>(null);
  const [showSigModal, setShowSigModal] = useState<boolean>(false);
  const [createdDoc, setCreatedDoc] = useState<DocumentRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load baseline locations, employees and APRs
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const [locsRes, empsRes, docsRes] = await Promise.all([
          api.get<RiskLocation[]>('/risks'),
          api.get<Employee[]>('/employees'),
          api.get<DocumentRecord[]>('/documents?type=APR')
        ]);
        setLocations(locsRes);
        setEmployees(empsRes);
        setExistingAprs(docsRes);

        // Pre-fill location if query param
        const locParam = searchParams.get('locationId');
        if (locParam) setSelectedLocationId(locParam);

        // Pre-fill APR if query param
        const aprParam = searchParams.get('aprId');
        if (aprParam) {
          setSelectedAprId(aprParam);
          const foundApr = docsRes.find(d => d.id === aprParam);
          if (foundApr) {
            setTitle(`PT para ${foundApr.title}`);
            if (foundApr.location_id) setSelectedLocationId(foundApr.location_id);
            if (foundApr.data?.teamMembers) {
              setPtWorkerIds(foundApr.data.teamMembers.map((m: any) => m.employeeId));
            }
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [searchParams]);

  // When employee is selected in OS or Ficha EPI, load employee details
  useEffect(() => {
    if (!selectedEmployeeId) return;
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    if (docCategory === 'OS') {
      setTitle(`Ordem de Serviço NR-01 — ${emp.name} (${emp.role})`);
      setOsActivities(`Execução de atividades rotineiras da função de ${emp.role} no setor de ${emp.department}.`);
    } else if (docCategory === 'EPI_FICHA') {
      setTitle(`Ficha de Entrega de EPI (NR-06) — ${emp.name}`);
      // Load employee EPIs from db
      if (emp.epis && emp.epis.length > 0) {
        setEpiItems(
          emp.epis.map(e => ({
            name: e.name,
            caNumber: e.ca_number,
            deliveryDate: e.delivery_date || new Date().toISOString().split('T')[0],
            quantity: 1,
            condition: 'Novo / Perfeito Estado'
          }))
        );
      } else {
        // Fallback standard EPIs
        setEpiItems([
          { name: 'Capacete de Segurança com Jugular', caNumber: 'CA-14760', deliveryDate: new Date().toISOString().split('T')[0], quantity: 1, condition: 'Novo' },
          { name: 'Óculos de Proteção contra Impactos', caNumber: 'CA-20188', deliveryDate: new Date().toISOString().split('T')[0], quantity: 1, condition: 'Novo' },
          { name: 'Botina de Segurança com Biqueira de Composite', caNumber: 'CA-42118', deliveryDate: new Date().toISOString().split('T')[0], quantity: 1, condition: 'Novo' },
          { name: 'Protetor Auditivo Tipo Plug de Silicone', caNumber: 'CA-36399', deliveryDate: new Date().toISOString().split('T')[0], quantity: 2, condition: 'Novo' }
        ]);
      }
    }
  }, [selectedEmployeeId, docCategory, employees]);

  // When Checklist Template changes, load pre-defined items
  const handleTemplateChange = (tmpl: any) => {
    setChkTemplate(tmpl);
    if (tmpl === 'andaimes') {
      setChkEquipCode('AND-01');
      setChkEquipDesc('Andaime Fachadeiro Tubular');
      setChkItems([
        { text: 'Sapatas apoiadas sobre pranchões nivelados e travadas', status: 'C', notes: 'Nivelado com bolha' },
        { text: 'Guarda-corpo duplo (1,20m e 0,70m) com rodapé instalado', status: 'C', notes: 'Presente em todos os níveis' },
        { text: 'Piso 100% completo, sem frestas e antiderrapante', status: 'C', notes: 'Travessas encaixadas' },
        { text: 'Escada de acesso com linha de vida vertical instalada', status: 'C', notes: 'Cabo guia firme' },
        { text: 'Ancoragem estrutural na fachada realizada com tirantes', status: 'C', notes: 'Pontos fixos' },
        { text: 'Aterramento elétrico contra descargas atmosféricas conectado', status: 'C', notes: 'Cordoalha ligada' }
      ]);
    } else if (tmpl === 'cinto_altura') {
      setChkEquipCode('EPI-CINTO-01');
      setChkEquipDesc('Cinto Paraquedista e Talabarte Duplo Y');
      setChkItems([
        { text: 'Fitas têxteis sem cortes, desfiamento ou queimaduras', status: 'C', notes: 'Inspeção visual OK' },
        { text: 'Costuras estruturais intactas sem linhas rompidas', status: 'C', notes: 'Firme' },
        { text: 'Argolas e fivelas metálicas sem trincas, amassados ou corrosão', status: 'C', notes: 'Aço bicromatizado OK' },
        { text: 'Talabarte duplo Y com absorvedor de energia fechado e lacrado', status: 'C', notes: 'Pacote intacto' },
        { text: 'Mosquetões com trava de segurança automática funcionando', status: 'C', notes: 'Dupla trava OK' },
        { text: 'Etiqueta de rastreabilidade e Selo INMETRO legíveis', status: 'C', notes: 'CA legível' }
      ]);
    } else if (tmpl === 'escadas') {
      setChkEquipCode('ESC-01');
      setChkEquipDesc('Escada Portátil Extensível em Fibra de Vidro');
      setChkItems([
        { text: 'Montantes em fibra de vidro sem trincas ou lascas', status: 'C', notes: 'Isolante OK' },
        { text: 'Degraus com ranhuras antiderrapantes firmes e sem folgas', status: 'C', notes: 'Fixações firmes' },
        { text: 'Sapatas de borracha antiderrapantes em bom estado', status: 'C', notes: 'Borracha intacta' },
        { text: 'Corda e roldana de extensão sem desfiamentos ou travamentos', status: 'C', notes: 'Operando livremente' },
        { text: 'Travas de segurança dos degraus (catracas) engatando com firmeza', status: 'C', notes: 'Trava testada' }
      ]);
    } else if (tmpl === 'ferramenta_eletrica') {
      setChkEquipCode('FERR-01');
      setChkEquipDesc('Esmerilhadeira Angular 7" / Furadeira de Impacto');
      setChkItems([
        { text: 'Cabo elétrico de alimentação com dupla isolação sem emendas ou cortes', status: 'C', notes: 'Cabo íntegro' },
        { text: 'Plugue industrial de conexão sem pinos soltos ou queimados', status: 'C', notes: 'Plugue OK' },
        { text: 'Coifa / carcaça de proteção do disco instalada e regulada', status: 'C', notes: 'Proteção presente' },
        { text: 'Empunhadura lateral para pega bimanual instalada', status: 'C', notes: 'Instalada' },
        { text: 'Gatilho liga/desliga retornando automaticamente ao ser solto', status: 'C', notes: 'Segurança OK' },
        { text: 'Disco abrasivo ou broca adequado à rotação do equipamento (RPM)', status: 'C', notes: 'Compatível' }
      ]);
    } else if (tmpl === 'trabalho_quente') {
      setChkEquipCode('MAQ-SOLDA-01');
      setChkEquipDesc('Máquina Inversora de Solda / Conjunto Oxi-acetileno');
      setChkItems([
        { text: 'Extintor de incêndio PQS ou CO2 posicionado ao lado do posto', status: 'C', notes: 'Extintor presente' },
        { text: 'Área livre de materiais combustíveis e inflamáveis em raio de 10m', status: 'C', notes: 'Área limpa' },
        { text: 'Válvulas contra retrocesso de chama instaladas no maçarico e regulador', status: 'C', notes: 'Válvula OK' },
        { text: 'Cabos de solda e alicate de aterramento firmes e sem aquecimento', status: 'C', notes: 'Aterrado' },
        { text: 'Biombo ou cortina de proteção contra radiação ultravioleta posicionado', status: 'C', notes: 'Biombo OK' }
      ]);
    }
  };

  // Helper to toggle worker selection with certification warning
  const toggleWorker = (empId: string, currentList: string[], setList: (l: string[]) => void) => {
    if (currentList.includes(empId)) {
      setList(currentList.filter(id => id !== empId));
    } else {
      setList([...currentList, empId]);
    }
  };

  // Check if a worker has expired training
  const getWorkerCompliance = (empId: string, type: 'altura' | 'confinado') => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return { ok: false, label: 'Não encontrado' };

    const status = type === 'altura' ? emp.nr35Status : emp.nr33Status;
    if (status === 'valido') return { ok: true, label: 'Certificado Válido' };
    if (status === 'prestes_a_vencer') return { ok: true, label: 'Prestes a Vencer' };
    if (status === 'vencido') return { ok: false, label: 'VENCIDO (Bloqueado)' };
    return { ok: false, label: 'Não possui curso' };
  };

  // SUBMIT HANDLER
  const handleSubmitDocument = async () => {
    setValidationError(null);
    setIsSubmitting(true);

    try {
      let endpoint = '/documents';
      let payload: any = {};

      if (docCategory === 'APR') {
        endpoint = '/documents/apr';
        payload = {
          aprType,
          title: title || `APR - Trabalho em ${aprType.replace('APR_', '')}`,
          description: aprDetails,
          locationId: selectedLocationId || undefined,
          deviceId,
          deviceName: deviceDesc,
          data: {
            activityDetails: aprDetails,
            heightMeters: aprHeightMeters,
            anchorPoints: aprAnchorPoints,
            rescuePlan: aprRescuePlan,
            hazards: aprHazards,
            preventiveMeasures: aprMeasures,
            teamMembers: aprWorkerIds.map(id => {
              const emp = employees.find(e => e.id === id);
              return { employeeId: id, name: emp?.name, role: emp?.role };
            }),
            supervisorName: user?.name,
            supervisorRole: user?.roleName,
            signatures: capturedSignature
              ? [
                  {
                    id: 'sig_' + Date.now(),
                    signerName: user?.name,
                    signerRole: user?.roleName,
                    signerType: 'supervisor',
                    signatureDataUrl: capturedSignature,
                    signedAt: new Date().toISOString(),
                    deviceId
                  }
                ]
              : []
          }
        };
      } else if (docCategory === 'PT') {
        endpoint = '/documents/pt';
        payload = {
          title: title || `${isPet ? 'PET' : 'PT'} - Permissão de Trabalho`,
          isPet,
          workTypes: ptWorkTypes,
          locationId: selectedLocationId || undefined,
          aprId: selectedAprId || undefined,
          supervisorName: ptSupervisorName || user?.name,
          watchName: ptWatchName || undefined,
          workerIds: ptWorkerIds,
          validityStart: ptValidityStart,
          validityEnd: ptValidityEnd,
          safetyMeasures: ptMeasures,
          gasMeasurements: isPet ? ptGasMeasurements : undefined,
          emergencyPlan: ptEmergencyPlan,
          deviceId,
          deviceName: deviceDesc,
          data: {
            signatures: capturedSignature
              ? [
                  {
                    id: 'sig_' + Date.now(),
                    signerName: ptSupervisorName || user?.name,
                    signerRole: user?.roleName,
                    signerType: 'supervisor',
                    signatureDataUrl: capturedSignature,
                    signedAt: new Date().toISOString(),
                    deviceId
                  }
                ]
              : []
          }
        };
      } else if (docCategory === 'OS') {
        endpoint = '/documents/os';
        payload = {
          employeeId: selectedEmployeeId,
          title: title || 'Ordem de Serviço de Segurança do Trabalho (NR-01)',
          activitiesDescription: osActivities,
          identifiedRisks: osRisks,
          mandatoryEpis: osEpis,
          preventiveMeasures: osMeasures,
          deviceId,
          deviceName: deviceDesc,
          data: {
            signatures: capturedSignature
              ? [
                  {
                    id: 'sig_' + Date.now(),
                    signerName: user?.name,
                    signerRole: 'Emitente SST',
                    signerType: 'supervisor',
                    signatureDataUrl: capturedSignature,
                    signedAt: new Date().toISOString(),
                    deviceId
                  }
                ]
              : []
          }
        };
      } else if (docCategory === 'EPI_FICHA') {
        endpoint = '/documents/epi-receipt';
        payload = {
          employeeId: selectedEmployeeId,
          title: title || 'Ficha de Entrega de EPI (NR-06)',
          deliveredItems: epiItems,
          deviceId,
          deviceName: deviceDesc,
          data: {
            signatures: capturedSignature
              ? [
                  {
                    id: 'sig_' + Date.now(),
                    signerName: user?.name,
                    signerRole: 'Responsável Almoxarifado / SST',
                    signerType: 'supervisor',
                    signatureDataUrl: capturedSignature,
                    signedAt: new Date().toISOString(),
                    deviceId
                  }
                ]
              : []
          }
        };
      } else if (docCategory === 'CHECKLIST') {
        endpoint = '/documents/checklist';
        payload = {
          templateType: chkTemplate,
          title: title || `Checklist de Inspeção - ${chkEquipDesc}`,
          equipmentCode: chkEquipCode,
          equipmentDescription: chkEquipDesc,
          locationId: selectedLocationId || undefined,
          items: chkItems,
          isApproved: chkIsApproved,
          observations: chkObservations,
          deviceId,
          deviceName: deviceDesc,
          data: {
            signatures: capturedSignature
              ? [
                  {
                    id: 'sig_' + Date.now(),
                    signerName: user?.name,
                    signerRole: 'Inspetor de Segurança',
                    signerType: 'supervisor',
                    signatureDataUrl: capturedSignature,
                    signedAt: new Date().toISOString(),
                    deviceId
                  }
                ]
              : []
          }
        };
      }

      const res = await api.post<DocumentRecord>(endpoint, payload);
      setCreatedDoc(res);
      setStep(4); // Success step
    } catch (err: any) {
      console.error('Erro ao emitir documento:', err);
      setValidationError(err.message || 'Falha ao emitir documento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* 1. TOP HEADER & DOCUMENT TYPE SWITCHER */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-amber-500" />
              Central de Emissão de Documentos SST
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Emissão de APRs, Permissões de Trabalho (PT/PET), Ordens de Serviço (NR-01) e Checklists com assinatura digital.
            </p>
          </div>

          <button
            onClick={() => navigate('/documentos')}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 p-2 rounded-xl hover:bg-slate-100 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>

        {/* Category Selector Tabs */}
        {step < 4 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setDocCategory('APR');
                setTitle('');
              }}
              className={`p-3 rounded-2xl border text-left transition-all ${
                docCategory === 'APR'
                  ? 'bg-amber-500/10 border-amber-500 text-slate-950 font-black shadow-sm ring-2 ring-amber-500/20'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg block mb-1">🦺</span>
              <span className="text-xs font-bold block">APR</span>
              <span className="text-[10px] text-slate-400 block font-normal">Análise de Risco</span>
            </button>

            <button
              onClick={() => {
                setDocCategory('PT');
                setTitle('');
              }}
              className={`p-3 rounded-2xl border text-left transition-all ${
                docCategory === 'PT'
                  ? 'bg-red-500/10 border-red-500 text-slate-950 font-black shadow-sm ring-2 ring-red-500/20'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg block mb-1">⚡</span>
              <span className="text-xs font-bold block">PT / PET</span>
              <span className="text-[10px] text-slate-400 block font-normal">Permissão Trab.</span>
            </button>

            <button
              onClick={() => {
                setDocCategory('OS');
                setTitle('');
              }}
              className={`p-3 rounded-2xl border text-left transition-all ${
                docCategory === 'OS'
                  ? 'bg-blue-500/10 border-blue-500 text-slate-950 font-black shadow-sm ring-2 ring-blue-500/20'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg block mb-1">📋</span>
              <span className="text-xs font-bold block">OS (NR-01)</span>
              <span className="text-[10px] text-slate-400 block font-normal">Ordem de Serviço</span>
            </button>

            <button
              onClick={() => {
                setDocCategory('EPI_FICHA');
                setTitle('');
              }}
              className={`p-3 rounded-2xl border text-left transition-all ${
                docCategory === 'EPI_FICHA'
                  ? 'bg-emerald-500/10 border-emerald-500 text-slate-950 font-black shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg block mb-1">🥾</span>
              <span className="text-xs font-bold block">Ficha EPI</span>
              <span className="text-[10px] text-slate-400 block font-normal">Recibo NR-06</span>
            </button>

            <button
              onClick={() => {
                setDocCategory('CHECKLIST');
                setTitle('');
              }}
              className={`p-3 rounded-2xl border text-left transition-all ${
                docCategory === 'CHECKLIST'
                  ? 'bg-purple-500/10 border-purple-500 text-slate-950 font-black shadow-sm ring-2 ring-purple-500/20'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg block mb-1">✅</span>
              <span className="text-xs font-bold block">Checklist</span>
              <span className="text-[10px] text-slate-400 block font-normal">Vistoria Campo</span>
            </button>
          </div>
        )}
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-2xl text-xs flex items-start gap-2.5 shadow-sm animate-in shake">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">Atenção ao preenchimento:</strong>
            <p>{validationError}</p>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FORM: PT / PET (PERMISSÃO DE TRABALHO & ENTRADA CONFINADO) */}
      {/* ======================================================== */}
      {docCategory === 'PT' && step < 4 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-red-500" />
                Permissão de Trabalho (PT / PET)
              </h2>
              <p className="text-xs text-slate-500">Autorização formal e verificação de condições para início de atividades críticas.</p>
            </div>

            {/* Toggle PT vs PET */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setIsPet(false)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  !isPet ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                PT Geral
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPet(true);
                  if (!ptWorkTypes.includes('espaco_confinado')) {
                    setPtWorkTypes([...ptWorkTypes, 'espaco_confinado']);
                  }
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  isPet ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                PET (Espaço Confinado NR-33)
              </button>
            </div>
          </div>

          {/* Title & Link to existing APR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Título da Permissão de Trabalho *</label>
              <input
                type="text"
                required
                placeholder="Ex: PT - Manutenção de Tubulação Elevada"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vincular a uma APR Existente (Opcional)</label>
              <select
                value={selectedAprId}
                onChange={e => {
                  const id = e.target.value;
                  setSelectedAprId(id);
                  const apr = existingAprs.find(a => a.id === id);
                  if (apr) {
                    setTitle(`PT - ${apr.title}`);
                    if (apr.location_id) setSelectedLocationId(apr.location_id);
                  }
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
              >
                <option value="">Nenhuma APR vinculada (Emissão direta)</option>
                {existingAprs.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location & Validity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Local / Ponto de Risco</label>
              <select
                value={selectedLocationId}
                onChange={e => setSelectedLocationId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
              >
                <option value="">Selecione o local...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Início da Validade</label>
              <input
                type="datetime-local"
                value={ptValidityStart}
                onChange={e => setPtValidityStart(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Término da Validade (Máx. 8h)</label>
              <input
                type="datetime-local"
                value={ptValidityEnd}
                onChange={e => setPtValidityEnd(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Work Types */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Tipos de Trabalho Autorizados na PT:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'altura', label: '🧗 Trabalho em Altura (NR-35)' },
                { id: 'espaco_confinado', label: '🕳️ Espaço Confinado (NR-33)' },
                { id: 'quente', label: '🔥 Trabalho a Quente (Solda/Corte)' },
                { id: 'eletrica', label: '⚡ Eletricidade / Alta Tensão (NR-10)' },
                { id: 'loto', label: '🔒 Bloqueio de Energias (LOTO)' },
                { id: 'escavacao', label: '🚜 Escavação / Valas' }
              ].map(item => (
                <label
                  key={item.id}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    ptWorkTypes.includes(item.id)
                      ? 'bg-red-50 border-red-300 font-bold text-red-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={ptWorkTypes.includes(item.id)}
                    onChange={e => {
                      if (e.target.checked) setPtWorkTypes([...ptWorkTypes, item.id]);
                      else setPtWorkTypes(ptWorkTypes.filter(x => x !== item.id));
                    }}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Supervisors & Watch */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Supervisor de Entrada / Responsável SST *</label>
              <input
                type="text"
                required
                value={ptSupervisorName}
                onChange={e => setPtSupervisorName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isPet ? 'Vigia de Espaço Confinado (Obrigatório NR-33) *' : 'Vigia / Observador de Frente'}
              </label>
              <input
                type="text"
                placeholder="Nome do vigia posicionado no exterior"
                value={ptWatchName}
                onChange={e => setPtWatchName(e.target.value)}
                className={`w-full p-2.5 bg-slate-50 border rounded-xl text-xs ${
                  isPet && !ptWatchName ? 'border-red-300 ring-2 ring-red-500/20' : 'border-slate-200'
                }`}
              />
            </div>
          </div>

          {/* Worker Selection with Certification Validation */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
              <span>Executantes Autorizados na PT:</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {ptWorkerIds.length} selecionado(s)
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
              {employees.map(emp => {
                const selected = ptWorkerIds.includes(emp.id);
                const compliance = ptWorkTypes.includes('altura')
                  ? getWorkerCompliance(emp.id, 'altura')
                  : ptWorkTypes.includes('espaco_confinado')
                  ? getWorkerCompliance(emp.id, 'confinado')
                  : { ok: true, label: 'Apto' };

                return (
                  <div
                    key={emp.id}
                    onClick={() => {
                      if (!compliance.ok) {
                        alert(`Bloqueio de Segurança: ${emp.name} não pode ser incluído na PT pois está com ${compliance.label}.`);
                        return;
                      }
                      toggleWorker(emp.id, ptWorkerIds, setPtWorkerIds);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      selected
                        ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400'
                        : !compliance.ok
                        ? 'bg-rose-50 border-rose-200 opacity-60'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{emp.name}</p>
                      <p className="text-[10px] text-slate-500">{emp.role}</p>
                    </div>

                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                        compliance.ok
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {compliance.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gas Measurements (if PET) */}
          {isPet && (
            <div className="p-4 bg-red-50/60 rounded-2xl border border-red-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-xs text-red-950 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-red-600" />
                    Avaliação Contínua da Atmosfera (Medição de Gases)
                  </h3>
                  <p className="text-[10px] text-red-700">Valores normativos: O₂ entre 19.5% e 23%, LEL &lt; 10%, CO &lt; 25ppm, H₂S &lt; 8ppm.</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPtGasMeasurements([
                      ...ptGasMeasurements,
                      {
                        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        o2: '20.9%',
                        lel: '0%',
                        co: '0 ppm',
                        h2s: '0 ppm',
                        tester: user?.name || 'Inspetor',
                        status: 'ok'
                      }
                    ]);
                  }}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova Medição
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-red-100/60 text-red-900 font-bold uppercase text-[9px]">
                    <tr>
                      <th className="p-1.5">Hora</th>
                      <th className="p-1.5">Oxigênio (O₂)</th>
                      <th className="p-1.5">Inflamabilidade (LEL)</th>
                      <th className="p-1.5">CO</th>
                      <th className="p-1.5">H₂S</th>
                      <th className="p-1.5">Aferidor</th>
                      <th className="p-1.5">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ptGasMeasurements.map((m, idx) => (
                      <tr key={idx} className="border-b border-red-100 font-mono">
                        <td className="p-1.5">{m.time}</td>
                        <td className="p-1.5 text-emerald-700 font-bold">{m.o2}</td>
                        <td className="p-1.5 text-emerald-700 font-bold">{m.lel}</td>
                        <td className="p-1.5">{m.co}</td>
                        <td className="p-1.5">{m.h2s}</td>
                        <td className="p-1.5 font-sans">{m.tester}</td>
                        <td className="p-1.5">
                          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-sans font-bold text-[9px]">
                            LIBERADO
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Aparelho atual registrado: <strong className="font-mono text-slate-600">{deviceId}</strong>
            </span>

            <button
              type="button"
              onClick={() => setShowSigModal(true)}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-red-600/20"
            >
              <PenTool className="w-4 h-4" />
              {capturedSignature ? 'Assinatura Coletada (Reassinar)' : 'Coletar Assinatura e Liberar PT'}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FORM: OS (ORDEM DE SERVIÇO NR-01) */}
      {/* ======================================================== */}
      {docCategory === 'OS' && step < 4 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Ordem de Serviço de Segurança do Trabalho (NR-01)
            </h2>
            <p className="text-xs text-slate-500">Documento individual de orientações, obrigações e riscos ocupacionais por colaborador.</p>
          </div>

          {/* Select Employee */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Selecionar Colaborador *</label>
              <select
                required
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
              >
                <option value="">Selecione um funcionário...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.role} ({emp.department})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Título do Documento</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Ordem de Serviço NR-01"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              />
            </div>
          </div>

          {/* Activities */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Descrição das Atividades da Função</label>
            <textarea
              rows={2}
              value={osActivities}
              onChange={e => setOsActivities(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Risks Recognition Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Riscos Ocupacionais Identificados:</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800 block mb-1">🔥 Riscos Físicos & Químicos:</span>
                <p className="text-[11px] text-slate-600">
                  {osRisks.fisicos.join(', ')} • {osRisks.quimicos.join(', ')}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800 block mb-1">⚠️ Riscos Ergonômicos & de Acidentes:</span>
                <p className="text-[11px] text-slate-600">
                  {osRisks.ergonomicos.join(', ')} • {osRisks.acidentes.join(', ')}
                </p>
              </div>
            </div>
          </div>

          {/* Mandatory EPIs & Preventive Measures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">EPIs de Uso Obrigatório na Função:</label>
              <textarea
                rows={3}
                value={osEpis.join('\n')}
                onChange={e => setOsEpis(e.target.value.split('\n').filter(Boolean))}
                placeholder="Um EPI por linha..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Medidas Preventivas e Procedimentos:</label>
              <textarea
                rows={3}
                value={osMeasures.join('\n')}
                onChange={e => setOsMeasures(e.target.value.split('\n').filter(Boolean))}
                placeholder="Uma medida preventiva por linha..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Conformidade garantida conforme <strong>NR-01 e Art. 158 da CLT</strong>.
            </span>

            <button
              type="button"
              disabled={!selectedEmployeeId}
              onClick={() => setShowSigModal(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              <PenTool className="w-4 h-4" />
              {capturedSignature ? 'Assinatura Coletada (Reassinar)' : 'Coletar Ciência do Colaborador'}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FORM: FICHA DE ENTREGA DE EPI (NR-06) */}
      {/* ======================================================== */}
      {docCategory === 'EPI_FICHA' && step < 4 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <HardHat className="w-5 h-5 text-emerald-500" />
              Ficha de Controle e Entrega de EPI (NR-06)
            </h2>
            <p className="text-xs text-slate-500">Recibo legal de fornecimento de EPIs com Certificado de Aprovação (CA) e termo de responsabilidade.</p>
          </div>

          {/* Select Employee */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Selecionar Colaborador *</label>
              <select
                required
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
              >
                <option value="">Selecione um funcionário...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.role} ({emp.department})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Título do Documento</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Ficha de Entrega de EPI (NR-06)"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              />
            </div>
          </div>

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">Relação de EPIs Entregues ao Colaborador:</label>
              <button
                type="button"
                onClick={() => {
                  setEpiItems([
                    ...epiItems,
                    {
                      name: 'Novo Equipamento de Proteção',
                      caNumber: 'CA-00000',
                      deliveryDate: new Date().toISOString().split('T')[0],
                      quantity: 1,
                      condition: 'Novo'
                    }
                  ]);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar EPI
              </button>
            </div>

            <div className="space-y-2">
              {epiItems.map((item, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => {
                      const updated = [...epiItems];
                      updated[idx].name = e.target.value;
                      setEpiItems(updated);
                    }}
                    placeholder="Descrição do EPI"
                    className="flex-1 min-w-[200px] p-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                  />
                  <input
                    type="text"
                    value={item.caNumber}
                    onChange={e => {
                      const updated = [...epiItems];
                      updated[idx].caNumber = e.target.value;
                      setEpiItems(updated);
                    }}
                    placeholder="Nº do CA"
                    className="w-28 p-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800"
                  />
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => {
                      const updated = [...epiItems];
                      updated[idx].quantity = parseInt(e.target.value) || 1;
                      setEpiItems(updated);
                    }}
                    className="w-16 p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEpiItems(epiItems.filter((_, i) => i !== idx));
                    }}
                    className="p-1.5 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Legal Responsibility Term */}
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
            <strong className="block mb-1 font-bold">Termo de Guarda e Responsabilidade (NR-06):</strong>
            Declaro ter recebido os EPIs acima relacionados em perfeito estado de conservação e com CAs válidos. Comprometo-me a usá-los exclusivamente em serviço, zelar por sua integridade e comunicar qualquer dano ou perda ao SESMT.
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {epiItems.length} EPI(s) com Certificado de Aprovação (CA) registrados.
            </span>

            <button
              type="button"
              disabled={!selectedEmployeeId || epiItems.length === 0}
              onClick={() => setShowSigModal(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              <PenTool className="w-4 h-4" />
              {capturedSignature ? 'Assinatura Coletada (Reassinar)' : 'Coletar Recibo Assinado'}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FORM: CHECKLIST PRÉ-OPERACIONAL DE CAMPO */}
      {/* ======================================================== */}
      {docCategory === 'CHECKLIST' && step < 4 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-purple-500" />
                Checklist Pré-Operacional de Campo
              </h2>
              <p className="text-xs text-slate-500">Vistoria e liberação de equipamentos, ferramentas e andaimes antes do trabalho.</p>
            </div>

            {/* Template selector */}
            <select
              value={chkTemplate}
              onChange={e => handleTemplateChange(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
            >
              <option value="andaimes">Modelos: Andaimes e Plataformas</option>
              <option value="cinto_altura">Modelos: Cinto de Segurança e Talabarte</option>
              <option value="escadas">Modelos: Escadas Portáteis</option>
              <option value="ferramenta_eletrica">Modelos: Ferramentas Elétricas Manuais</option>
              <option value="trabalho_quente">Modelos: Trabalho a Quente / Solda</option>
            </select>
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">TAG / Código do Equipamento</label>
              <input
                type="text"
                value={chkEquipCode}
                onChange={e => setChkEquipCode(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Descrição do Equipamento *</label>
              <input
                type="text"
                value={chkEquipDesc}
                onChange={e => setChkEquipDesc(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Local / Ponto de Risco</label>
              <select
                value={selectedLocationId}
                onChange={e => setSelectedLocationId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              >
                <option value="">Selecione o local...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Checklist items verification */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Itens Inspecionados (C = Conforme | NC = Não Conforme | NA = Não se Aplica):
            </label>

            {chkItems.map((item, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  item.status === 'NC'
                    ? 'bg-rose-50 border-rose-200'
                    : item.status === 'C'
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">{item.text}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...chkItems];
                        updated[idx].status = 'C';
                        setChkItems(updated);
                      }}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                        item.status === 'C' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      C
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...chkItems];
                        updated[idx].status = 'NC';
                        setChkItems(updated);
                        setChkIsApproved(false);
                      }}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                        item.status === 'NC' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      NC
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...chkItems];
                        updated[idx].status = 'NA';
                        setChkItems(updated);
                      }}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                        item.status === 'NA' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      NA
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Final evaluation */}
          <div className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border-slate-200">
            <div>
              <span className="font-bold text-xs text-slate-800 block">Parecer Final da Inspeção:</span>
              <span className="text-[11px] text-slate-500">Se houver algum item "Não Conforme" crítico, o equipamento deve ser interditado.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setChkIsApproved(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  chkIsApproved ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 text-slate-600'
                }`}
              >
                APTO PARA USO
              </button>
              <button
                type="button"
                onClick={() => setChkIsApproved(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  !chkIsApproved ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-200 text-slate-600'
                }`}
              >
                INTERDITADO
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Resultado: <strong>{chkIsApproved ? 'Liberado para Operação' : 'Bloqueado'}</strong>
            </span>

            <button
              type="button"
              onClick={() => setShowSigModal(true)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-purple-600/20"
            >
              <PenTool className="w-4 h-4" />
              {capturedSignature ? 'Assinatura Coletada (Reassinar)' : 'Coletar Assinatura do Inspetor'}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FORM: APR (ANÁLISE PRELIMINAR DE RISCO - FALLBACK & TAB) */}
      {/* ======================================================== */}
      {docCategory === 'APR' && step < 4 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Análise Preliminar de Risco (APR)
            </h2>
            <p className="text-xs text-slate-500">Avaliação antecipada de perigos, medidas preventivas e equipe autorizada.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Título da Atividade *</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: APR - Manutenção de Painel Elétrico Superior"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de APR</label>
              <select
                value={aprType}
                onChange={e => setAprType(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              >
                <option value="APR_ALTURA">Trabalho em Altura (NR-35)</option>
                <option value="APR_ESPACO_CONFINADO">Espaço Confinado (NR-33)</option>
                <option value="APR_GENERICA">Geral / Eletricidade / Mecânica</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Local / Ponto de Risco</label>
            <select
              value={selectedLocationId}
              onChange={e => setSelectedLocationId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
            >
              <option value="">Selecione o local...</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Detalhamento da Tarefa</label>
            <textarea
              rows={2}
              value={aprDetails}
              onChange={e => setAprDetails(e.target.value)}
              placeholder="Descreva a sequência de trabalho e ferramentas utilizadas..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          {/* Workers */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Equipe Executante Autorizada:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {employees.map(emp => {
                const selected = aprWorkerIds.includes(emp.id);
                const compliance = aprType === 'APR_ALTURA'
                  ? getWorkerCompliance(emp.id, 'altura')
                  : aprType === 'APR_ESPACO_CONFINADO'
                  ? getWorkerCompliance(emp.id, 'confinado')
                  : { ok: true, label: 'Apto' };

                return (
                  <div
                    key={emp.id}
                    onClick={() => {
                      if (!compliance.ok) {
                        alert(`${emp.name} não pode ser adicionado à APR pois está com capacitação inválida: ${compliance.label}.`);
                        return;
                      }
                      toggleWorker(emp.id, aprWorkerIds, setAprWorkerIds);
                    }}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer ${
                      selected ? 'bg-amber-50 border-amber-400 font-bold' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <span>{emp.name}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white text-slate-700 border">
                      {compliance.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Emissor: <strong>{user?.name}</strong> | ID: <span className="font-mono">{deviceId}</span>
            </span>

            <button
              type="button"
              onClick={() => setShowSigModal(true)}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <PenTool className="w-4 h-4" />
              {capturedSignature ? 'Assinatura Coletada (Reassinar)' : 'Assinar Digitalmente e Emitir APR'}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 4: RESULT / SUCCESS CARD WITH INSTANT PDF DOWNLOAD */}
      {/* ======================================================== */}
      {step === 4 && createdDoc && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-5 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="font-mono text-sm font-black px-3 py-1 rounded-full bg-slate-100 text-slate-800 border">
              {createdDoc.code}
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-2">Documento Emitido com Sucesso!</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {createdDoc.title} foi gravado no sistema com assinatura digital, rastreabilidade do ID do aparelho e registro de auditoria.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl max-w-sm mx-auto text-left text-xs space-y-1.5 border border-slate-100 font-mono text-slate-600">
            <p><strong>Código:</strong> {createdDoc.code}</p>
            <p><strong>Tipo:</strong> {createdDoc.type}</p>
            <p><strong>ID do Aparelho:</strong> {createdDoc.device_id}</p>
            <p><strong>Emitido Por:</strong> {createdDoc.created_by_name}</p>
            <p><strong>Data/Hora:</strong> {new Date(createdDoc.created_at).toLocaleString('pt-BR')}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => generateDocumentPdf(createdDoc)}
              className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <Download className="w-4 h-4" />
              Baixar PDF Oficial Formatado
            </button>

            {createdDoc.type.startsWith('APR_') && (
              <button
                onClick={() => {
                  setDocCategory('PT');
                  setSelectedAprId(createdDoc.id);
                  setTitle(`PT vinculada a ${createdDoc.code}`);
                  setStep(1);
                  setCreatedDoc(null);
                  setCapturedSignature(null);
                }}
                className="w-full sm:w-auto px-5 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md"
              >
                <Zap className="w-4 h-4" />
                Emitir PT a partir desta APR
              </button>
            )}

            <button
              onClick={() => navigate('/documentos')}
              className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs"
            >
              Ver na Central de Documentos
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SIGNATURE PAD MODAL (z-[99999]) */}
      {/* ======================================================== */}
      {showSigModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="font-bold text-sm">Assinatura Digital de Liberação</h3>
                  <p className="text-[10px] text-slate-400">Assine com o dedo ou mouse na tela</p>
                </div>
              </div>
              <button
                onClick={() => setShowSigModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <SignaturePad
                onSave={dataUrl => {
                  setCapturedSignature(dataUrl);
                  setShowSigModal(false);
                  handleSubmitDocument();
                }}
                onCancel={() => setShowSigModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DocumentCreatePage;
