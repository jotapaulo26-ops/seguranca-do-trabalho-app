import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RiskLocation, Employee, DocumentRecord } from '../types';
import { getDeviceId, getDeviceDescription } from '../services/deviceId';
import { generateAprPdf } from '../services/aprPdfGenerator';
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
  MapPin
} from 'lucide-react';

export const AprCreatePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<number>(1);
  const [locations, setLocations] = useState<RiskLocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const deviceId = getDeviceId();
  const deviceDesc = getDeviceDescription();

  // APR Form State
  const [aprType, setAprType] = useState<'APR_GENERICA' | 'APR_ALTURA' | 'APR_ESPACO_CONFINADO'>('APR_ALTURA');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [riskClassification, setRiskClassification] = useState('ALTO RISCO');

  // Height / Confined Space specific fields
  const [heightMeters, setHeightMeters] = useState<number>(12);
  const [anchorPoints, setAnchorPoints] = useState('Linha de vida inspecionada com cabo de aço 8mm e absorvedor');
  const [weatherConditions, setWeatherConditions] = useState('Céu aberto, ventos < 15km/h, sem chuva');
  const [rescuePlan, setRescuePlan] = useState('Plano de resgate vertical pré-definido, brigada a postos e maca envelope pronta');
  const [vigiaName, setVigiaName] = useState('');

  // Hazards & Controls
  const [selectedHazards, setSelectedHazards] = useState<string[]>([
    'Queda de pessoas com diferença de nível (> 2m)',
    'Queda de ferramentas manuais ou sobressalentes',
    'Contato com partes móveis ou energizadas'
  ]);

  const [selectedMeasures, setSelectedMeasures] = useState<string[]>([
    'Uso contínuo de cinto paraquedista com talabarte duplo ancorado',
    'Isolamento e sinalização da área térrea sob a projeção do serviço',
    'Amarração obrigatória de todas as ferramentas com alça de segurança',
    'Bloqueio elétrico e etiquetagem (LOTO) com cadeado do executante'
  ]);

  // Selected Executing Workers
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  // Signatures
  const [supervisorSignature, setSupervisorSignature] = useState<string | null>(null);
  const [showSigPad, setShowSigPad] = useState(false);

  // Result Document
  const [createdDoc, setCreatedDoc] = useState<DocumentRecord | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [locs, emps] = await Promise.all([
          api.get<RiskLocation[]>('/risks'),
          api.get<Employee[]>('/employees')
        ]);
        setLocations(locs);
        setEmployees(emps);

        // Pre-fill from query params if clicked from Map
        const paramLocId = searchParams.get('locationId');
        if (paramLocId) {
          setSelectedLocationId(paramLocId);
          const foundLoc = locs.find(l => l.id === paramLocId);
          if (foundLoc) {
            setTitle(`APR - Manutenção em ${foundLoc.name}`);
            if (foundLoc.risk_type === 'espaco_confinado') {
              setAprType('APR_ESPACO_CONFINADO');
            } else if (foundLoc.risk_type === 'altura') {
              setAprType('APR_ALTURA');
            }
          }
        } else {
          setTitle('APR - Manutenção em Altura');
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [searchParams]);

  // When location changes, update defaults
  const handleLocationChange = (locId: string) => {
    setSelectedLocationId(locId);
    const loc = locations.find(l => l.id === locId);
    if (loc) {
      setTitle(`APR - Trabalho em ${loc.name}`);
      if (loc.risk_type === 'espaco_confinado') setAprType('APR_ESPACO_CONFINADO');
      else if (loc.risk_type === 'altura') setAprType('APR_ALTURA');
    }
  };

  const handleToggleWorker = (empId: string) => {
    if (selectedWorkerIds.includes(empId)) {
      setSelectedWorkerIds(selectedWorkerIds.filter(id => id !== empId));
    } else {
      setSelectedWorkerIds([...selectedWorkerIds, empId]);
    }
  };

  const handleCreateApr = async () => {
    if (!title.trim()) {
      alert('Informe o título da atividade.');
      return;
    }

    const selectedWorkers = employees
      .filter(e => selectedWorkerIds.includes(e.id))
      .map(e => ({
        employeeId: e.id,
        name: e.name,
        role: e.role,
        status:
          aprType === 'APR_ALTURA'
            ? e.nr35Status === 'valido'
              ? 'NR-35 Em Dia'
              : 'NR-35 ' + (e.nr35Status || 'Pendente').toUpperCase()
            : aprType === 'APR_ESPACO_CONFINADO'
            ? e.nr33Status === 'valido'
              ? 'NR-33 Em Dia'
              : 'NR-33 ' + (e.nr33Status || 'Pendente').toUpperCase()
            : 'Apto'
      }));

    const signatures = [];
    if (supervisorSignature) {
      signatures.push({
        signerName: user?.name || 'Responsável Técnico',
        signerRole: user?.roleName || 'Técnico SST',
        signerType: 'supervisor',
        signatureDataUrl: supervisorSignature,
        signedAt: new Date().toISOString(),
        deviceId
      });
    }

    const aprPayload = {
      aprType,
      title: title.trim(),
      description,
      locationId: selectedLocationId || undefined,
      deviceId,
      deviceName: deviceDesc,
      data: {
        workType: title.trim(),
        activityDetails: description || 'Execução do serviço sob supervisão e cumprimento de normas regulamentadoras.',
        riskClassification,
        heightMeters: aprType === 'APR_ALTURA' ? heightMeters : undefined,
        anchorPoints: aprType === 'APR_ALTURA' ? anchorPoints : undefined,
        weatherConditions: aprType === 'APR_ALTURA' ? weatherConditions : undefined,
        rescuePlan: aprType === 'APR_ALTURA' ? rescuePlan : undefined,
        vigiaName: aprType === 'APR_ESPACO_CONFINADO' ? vigiaName : undefined,
        hazards: selectedHazards,
        preventiveMeasures: selectedMeasures,
        teamMembers: selectedWorkers,
        signatures,
        requiredEpis: [
          'Capacete com Jugular',
          'Cinto de Segurança Tipo Paraquedista',
          'Talabarte Duplo Y com Absorvedor',
          'Botina de Segurança com Biqueira'
        ]
      }
    };

    try {
      const res = await api.post<DocumentRecord>('/documents/apr', aprPayload);
      setCreatedDoc(res);
      setStep(4); // Final step
    } catch (err: any) {
      alert(err.message || 'Erro ao emitir APR.');
    }
  };

  const handleDownloadPdf = async () => {
    if (!createdDoc) return;
    await generateAprPdf(createdDoc);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/documentos')}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              Emissor de APR Digital
            </h2>
            <p className="text-xs text-slate-500">
              Passo {step} de 4 — Rastreabilidade por Aparelho & Assinatura Digital
            </p>
          </div>
        </div>

        {/* Device ID pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-mono">
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span>{deviceId}</span>
        </div>
      </div>

      {/* Wizard Progress Bar */}
      <div className="grid grid-cols-4 gap-2">
        {['1. Modelo & Local', '2. Perigos & Controles', '3. Equipe & Assinatura', '4. PDF Concluído'].map((label, idx) => (
          <div
            key={label}
            className={`py-2 px-3 rounded-xl text-center text-xs font-bold transition-all ${
              step === idx + 1
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : step > idx + 1
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-white text-slate-400 border border-slate-200'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* STEP 1: MODELO & LOCAL */}
      {step === 1 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-5 animate-in fade-in duration-150">
          <h3 className="font-extrabold text-slate-900 text-base">Passo 1: Selecione o Modelo de APR e o Local</h3>

          {/* Model selection cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              onClick={() => setAprType('APR_ALTURA')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                aprType === 'APR_ALTURA'
                  ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-2xl mb-1 block">🧗</span>
              <h4 className="font-bold text-xs text-slate-900">Trabalho em Altura (NR-35)</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Serviços com desnível &gt; 2m, ancoragem, linhas de vida e plano de resgate.
              </p>
            </div>

            <div
              onClick={() => setAprType('APR_ESPACO_CONFINADO')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                aprType === 'APR_ESPACO_CONFINADO'
                  ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-2xl mb-1 block">🕳️</span>
              <h4 className="font-bold text-xs text-slate-900">Espaço Confinado (NR-33)</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Silos, galerias, reatores, vigia obrigatório e teste de gases.
              </p>
            </div>

            <div
              onClick={() => setAprType('APR_GENERICA')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                aprType === 'APR_GENERICA'
                  ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-2xl mb-1 block">🛡️</span>
              <h4 className="font-bold text-xs text-slate-900">APR Geral Operacional</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Manutenções mecânicas, corte, solda e intervenções industriais padrão.
              </p>
            </div>
          </div>

          {/* Form details */}
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vincular a um Ponto de Risco do Mapa (Opcional):
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => handleLocationChange(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white"
              >
                <option value="">Nenhum (Local Não Mapeado / Avulso)</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    📍 {loc.name} ({loc.risk_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Título da Atividade *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Troca de Motor do Exaustor Superior"
                className="w-full p-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição Detalhada do Trabalho</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o passo a passo da tarefa, ferramentas utilizadas e objetivos..."
                rows={3}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(2)}
              className="py-2.5 px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition-all"
            >
              Avançar para Perigos & Controles
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PERIGOS & CONTROLES */}
      {step === 2 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-5 animate-in fade-in duration-150">
          <h3 className="font-extrabold text-slate-900 text-base">Passo 2: Análise de Perigos e Parâmetros Técnicos</h3>

          {/* If NR-35 Altura */}
          {aprType === 'APR_ALTURA' && (
            <div className="p-4 bg-red-50 rounded-2xl border border-red-200 space-y-3 text-xs">
              <span className="font-bold text-red-900 block flex items-center gap-1.5">
                🧗 Parâmetros Obrigatórios NR-35:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-red-800 mb-1">Altura Estimada (metros):</label>
                  <input
                    type="number"
                    value={heightMeters}
                    onChange={(e) => setHeightMeters(Number(e.target.value))}
                    className="w-full p-2 border border-red-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-800 mb-1">Pontos de Ancoragem:</label>
                  <input
                    type="text"
                    value={anchorPoints}
                    onChange={(e) => setAnchorPoints(e.target.value)}
                    className="w-full p-2 border border-red-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-800 mb-1">Condições Climáticas:</label>
                  <input
                    type="text"
                    value={weatherConditions}
                    onChange={(e) => setWeatherConditions(e.target.value)}
                    className="w-full p-2 border border-red-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-800 mb-1">Plano de Resgate:</label>
                  <input
                    type="text"
                    value={rescuePlan}
                    onChange={(e) => setRescuePlan(e.target.value)}
                    className="w-full p-2 border border-red-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* If NR-33 Espaço Confinado */}
          {aprType === 'APR_ESPACO_CONFINADO' && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3 text-xs">
              <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                🕳️ Parâmetros Obrigatórios NR-33:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-amber-800 mb-1">Vigia Designado:</label>
                  <input
                    type="text"
                    value={vigiaName}
                    onChange={(e) => setVigiaName(e.target.value)}
                    placeholder="Nome do Vigia presente na boca de visita"
                    className="w-full p-2 border border-amber-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-amber-800 mb-1">Teste de Gases (Multi-detector):</label>
                  <input
                    type="text"
                    defaultValue="O2: 20.9% | CO: 0ppm | H2S: 0ppm | LEL: 0%"
                    className="w-full p-2 border border-amber-300 rounded-lg bg-white font-mono text-[10px]"
                    readOnly
                  />
                </div>
              </div>
            </div>
          )}

          {/* Perigos Identificados Checklist */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              ⚠️ Perigos Identificados na Operação:
            </label>
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
              {[
                'Queda de pessoas com diferença de nível (> 2m)',
                'Queda de ferramentas manuais ou peças',
                'Contato com partes móveis ou acionamento acidental',
                'Choque elétrico durante intervenção',
                'Atmosfera asfixiante ou presença de vapores perigosos',
                'Superfícies aquecidas / Risco térmico',
                'Ruído excessivo e vibrações mecânicas'
              ].map(hazard => (
                <label key={hazard} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-white rounded-lg">
                  <input
                    type="checkbox"
                    checked={selectedHazards.includes(hazard)}
                    onChange={() => {
                      if (selectedHazards.includes(hazard)) {
                        setSelectedHazards(selectedHazards.filter(h => h !== hazard));
                      } else {
                        setSelectedHazards([...selectedHazards, hazard]);
                      }
                    }}
                    className="rounded text-amber-500 focus:ring-amber-500"
                  />
                  <span>{hazard}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Medidas Preventivas Checklist */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              🛡️ Medidas Preventivas e Controles Obrigatórios:
            </label>
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
              {[
                'Uso contínuo de cinto paraquedista com talabarte duplo ancorado',
                'Isolamento e sinalização da área térrea sob a projeção do serviço',
                'Amarração obrigatória de todas as ferramentas com alça de segurança',
                'Bloqueio elétrico e etiquetagem (LOTO) com cadeado do executante',
                'Comunicação direta via rádio transceptor com o técnico de plantão',
                'Ventilação forçada contínua através de insuflador/exaustor',
                'Inspeção prévia e diária de todos os EPIs antes da subida'
              ].map(measure => (
                <label key={measure} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-white rounded-lg">
                  <input
                    type="checkbox"
                    checked={selectedMeasures.includes(measure)}
                    onChange={() => {
                      if (selectedMeasures.includes(measure)) {
                        setSelectedMeasures(selectedMeasures.filter(m => m !== measure));
                      } else {
                        setSelectedMeasures([...selectedMeasures, measure]);
                      }
                    }}
                    className="rounded text-amber-500 focus:ring-amber-500"
                  />
                  <span>{measure}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(1)}
              className="py-2.5 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              className="py-2.5 px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition-all"
            >
              Avançar para Equipe & Assinatura
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: EQUIPE EXECUTANTE & ASSINATURA DIGITAL */}
      {step === 3 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-5 animate-in fade-in duration-150">
          <h3 className="font-extrabold text-slate-900 text-base">Passo 3: Equipe Executante e Assinatura Digital</h3>

          {/* Workers selection with training compliance check */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Selecione os Funcionários que Irão Executar a Tarefa:
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              O sistema verifica automaticamente se o trabalhador possui treinamento válido para o tipo de risco.
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
              {employees.map(emp => {
                const isSelected = selectedWorkerIds.includes(emp.id);
                const isHeightExpired = aprType === 'APR_ALTURA' && emp.nr35Status === 'vencido';
                const isConfinedExpired = aprType === 'APR_ESPACO_CONFINADO' && emp.nr33Status === 'vencido';
                const hasBlocker = isHeightExpired || isConfinedExpired;

                return (
                  <label
                    key={emp.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleWorker(emp.id)}
                        className="rounded text-amber-500 focus:ring-amber-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900">{emp.name}</span>
                        <p className="text-[10px] text-slate-500">{emp.role} • {emp.department}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasBlocker && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {isHeightExpired ? 'NR-35 VENCIDO' : 'NR-33 VENCIDO'}
                        </span>
                      )}
                      {!hasBlocker && (
                        <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                          Treinamento em dia
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Digital Signature of Supervisor */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Assinatura Digital do Responsável Técnico SST:
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              Assinatura vinculada ao usuário <strong>{user?.name}</strong> e gravada com o ID do aparelho atual: <span className="font-mono text-amber-600">{deviceId}</span>.
            </p>

            {supervisorSignature ? (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-emerald-950">Assinatura Digital Coletada</h5>
                    <p className="text-[10px] text-emerald-700">Pronta para inserção no PDF oficial</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSigPad(true)}
                  className="text-xs text-emerald-800 underline font-semibold"
                >
                  Refazer Assinatura
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSigPad(true)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                Desenhar Assinatura na Tela
              </button>
            )}
          </div>

          {showSigPad && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
              <SignaturePad
                title="Assinatura do Técnico / Supervisor SST"
                signerNameDefault={user?.name}
                onSave={(dataUrl) => {
                  setSupervisorSignature(dataUrl);
                  setShowSigPad(false);
                }}
                onCancel={() => setShowSigPad(false)}
              />
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(2)}
              className="py-2.5 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button
              onClick={handleCreateApr}
              className="py-3 px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finalizar & Emitir APR Oficial
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: SUCESSO & PDF GENERATION */}
      {step === 4 && createdDoc && (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 text-center space-y-5 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              Documento Registrado com Rastreabilidade
            </span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              APR {createdDoc.code} Emitida com Sucesso!
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Gravada no banco de dados com auditoria de dispositivo e assinaturas digitais.
            </p>
          </div>

          {/* Document summary box */}
          <div className="max-w-md mx-auto p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Código do Documento:</span>
              <strong className="text-slate-900 font-mono">{createdDoc.code}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ID do Aparelho Emissor:</span>
              <span className="text-amber-700 font-mono font-bold">{createdDoc.device_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Emitido por:</span>
              <span className="text-slate-800 font-medium">{createdDoc.created_by_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Data e Hora:</span>
              <span className="text-slate-800">{new Date(createdDoc.created_at).toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              onClick={handleDownloadPdf}
              className="py-3 px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <Download className="w-5 h-5" />
              Baixar APR em PDF Completo
            </button>

            <button
              onClick={() => navigate('/documentos')}
              className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
            >
              Ver na Lista de Documentos
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
