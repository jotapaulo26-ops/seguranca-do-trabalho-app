import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle,
  Flame,
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  FileText,
  Phone,
  HardHat,
  ArrowRight,
  Printer,
  ChevronRight,
  LogIn,
  Check,
  Sparkles,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../services/api';

export const QRDispatcherPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const type = searchParams.get('type') || '';
  const id = searchParams.get('id') || '';
  const docId = searchParams.get('docId') || '';
  const workerId = searchParams.get('workerId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  // Inspection state for Extinguisher quick inspection
  const [inspecting, setInspecting] = useState(false);
  const [inspectorName, setInspectorName] = useState(user?.name || '');
  const [checkPressure, setCheckPressure] = useState(true);
  const [checkSeal, setCheckSeal] = useState(true);
  const [checkHose, setCheckHose] = useState(true);
  const [checkSign, setCheckSign] = useState(true);
  const [checkAccess, setCheckAccess] = useState(true);
  const [inspectNotes, setInspectNotes] = useState('');
  const [inspectSuccess, setInspectSuccess] = useState<string | null>(null);

  useEffect(() => {
    // 1. Direct redirect for document signature
    if (type === 'sign') {
      const targetDoc = docId || id;
      navigate(`/assinar-documento?docId=${targetDoc}&workerId=${workerId}`, { replace: true });
      return;
    }

    if (!type || !id) {
      setError('Código QR incompleto ou parâmetros ausentes.');
      setLoading(false);
      return;
    }

    loadEntityData();
  }, [type, id]);

  const loadEntityData = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = '';
      if (type === 'risk') endpoint = `${API_BASE_URL}/public/risk-spot/${id}`;
      else if (type === 'extinguisher') endpoint = `${API_BASE_URL}/public/extinguisher/${id}`;
      else if (type === 'meeting_point') endpoint = `${API_BASE_URL}/public/meeting-point/${id}`;
      else if (type === 'employee') endpoint = `${API_BASE_URL}/public/employee/${id}`;
      else {
        throw new Error(`Tipo de QR Code desconhecido: "${type}"`);
      }

      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(`Não foi possível carregar as informações (Erro ${res.status}).`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Erro ao consultar dados da etiqueta.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setInspecting(true);
    setInspectSuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}/public/extinguisher/${id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectorName: inspectorName || user?.name || 'Brigadista em Campo',
          pressureOk: checkPressure,
          sealIntact: checkSeal,
          hoseClear: checkHose,
          signVisible: checkSign,
          unobstructed: checkAccess,
          notes: inspectNotes
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Falha ao registrar inspeção.');

      setInspectSuccess(result.message);
      // Reload extinguisher data
      loadEntityData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInspecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold">Identificando QR Code...</h2>
        <p className="text-sm text-slate-400 mt-1">Carregando dados de segurança em tempo real</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-red-400">QR Code Inválido ou Inativo</h2>
        <p className="text-sm text-slate-300 max-w-sm mt-2">{error || 'Etiqueta não encontrada na base do sistema.'}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors"
        >
          Ir para o Início
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header / Brand */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center font-black text-white shadow-md">
            🛡️
          </div>
          <div>
            <h1 className="font-black text-sm tracking-wide text-white uppercase">SegTrabalho SST</h1>
            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Usina Santa Isabel - Novo Horizonte</p>
          </div>
        </div>

        {user ? (
          <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold">
            {user.name.split(' ')[0]}
          </span>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-lg shadow-sm transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            Entrar
          </Link>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 md:p-6 space-y-6">

        {/* ----------------- 1. LOCAL DE RISCO ----------------- */}
        {type === 'risk' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Alert Banner */}
            <div className={`p-5 rounded-3xl border shadow-xl relative overflow-hidden ${
              data.risk_type === 'ambos' || data.risk_type === 'espaco_confinado'
                ? 'bg-gradient-to-br from-red-950/80 via-slate-900 to-slate-900 border-red-700/50'
                : 'bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-900 border-amber-600/50'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
                    <AlertTriangle className="w-6 h-6 animate-pulse" />
                  </span>
                  <div>
                    <span className="text-[11px] font-black tracking-wider uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                      Sinalização de Campo (NR-01 / NR-26)
                    </span>
                    <h2 className="text-2xl font-black text-white mt-1 leading-tight">{data.name}</h2>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-slate-800 text-slate-200 border border-slate-700">
                  Classificação: <strong className="text-amber-400">{data.risk_type?.toUpperCase()}</strong>
                </span>
                {data.linkedDocuments?.length > 0 && (
                  <span className="px-3 py-1 rounded-lg text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {data.linkedDocuments.length} APR / PT Ativa no Momento
                  </span>
                )}
              </div>

              <p className="mt-4 text-sm text-slate-300 leading-relaxed bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80">
                {data.description}
              </p>
            </div>

            {/* Required EPIs */}
            <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-lg">
              <h3 className="font-black text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-3">
                <HardHat className="w-4 h-4 text-amber-400" />
                EPIs Obrigatórios para Acessar esta Área
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {data.required_epis && data.required_epis.length > 0 ? (
                  data.required_epis.map((epi: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm font-semibold"
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span>{epi}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">Nenhum EPI específico configurado para este ponto.</p>
                )}
              </div>
            </div>

            {/* Active Linked Documents */}
            {data.linkedDocuments && data.linkedDocuments.length > 0 && (
              <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-lg">
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Documentos de Liberação Ativos nesta Área
                </h3>
                <div className="space-y-2">
                  {data.linkedDocuments.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                            {doc.code}
                          </span>
                          <span className="text-xs font-bold text-slate-400">{doc.type}</span>
                        </div>
                        <h4 className="font-bold text-sm text-white mt-1">{doc.title}</h4>
                      </div>
                      <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => navigate(`/mapa?spotId=${data.id}`)}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 text-sm"
              >
                <MapPin className="w-4 h-4" />
                Localizar no Mapa da Usina
              </button>

              <button
                onClick={() => navigate(`/documentos?action=new_apr&locationId=${data.id}`)}
                className="flex-1 py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 border border-slate-700 transition-colors text-sm"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                Emitir APR para este Ponto
              </button>
            </div>
          </div>
        )}

        {/* ----------------- 2. EXTINTOR DE INCÊNDIO ----------------- */}
        {type === 'extinguisher' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Header Badge */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-red-950/80 via-slate-900 to-slate-900 border border-red-700/60 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  Equipamento de Combate a Incêndio (NR-23)
                </span>
                <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${
                  data.rechargeStatus === 'valido'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : data.rechargeStatus === 'prestes_a_vencer'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                }`}>
                  {data.rechargeStatus === 'valido' ? 'Carga Válida' : data.rechargeStatus === 'prestes_a_vencer' ? 'Vence em Breve' : 'Carga Vencida'}
                </span>
              </div>

              <h2 className="text-3xl font-black text-white mt-3 font-mono">{data.code}</h2>
              <p className="text-base text-slate-300 font-bold mt-1">
                {data.type} • {data.capacity}
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-2">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                {data.location_name}
              </p>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800">
                <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Próxima Recarga</span>
                  <p className="text-sm font-black text-white mt-0.5">{data.next_recharge_date || 'Não informada'}</p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Teste Hidrostático</span>
                  <p className="text-sm font-black text-white mt-0.5">{data.hydrostatic_test_date || 'Não informado'}</p>
                </div>
              </div>
            </div>

            {/* Quick Field Inspection Form */}
            <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Inspeção Mensal Rápida de Campo
                </h3>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                  Checklist NBR 12962
                </span>
              </div>

              {inspectSuccess && (
                <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  {inspectSuccess}
                </div>
              )}

              <form onSubmit={handleQuickInspection} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Nome do Inspetor / Brigadista:</label>
                  <input
                    type="text"
                    required
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkPressure}
                      onChange={(e) => setCheckPressure(e.target.checked)}
                      className="w-4 h-4 text-emerald-500 rounded bg-slate-900 border-slate-600 focus:ring-0"
                    />
                    <span className="text-xs font-bold text-slate-200">Manômetro na faixa verde (pressão correta)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkSeal}
                      onChange={(e) => setCheckSeal(e.target.checked)}
                      className="w-4 h-4 text-emerald-500 rounded bg-slate-900 border-slate-600 focus:ring-0"
                    />
                    <span className="text-xs font-bold text-slate-200">Lacre e pino de segurança intactos</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkHose}
                      onChange={(e) => setCheckHose(e.target.checked)}
                      className="w-4 h-4 text-emerald-500 rounded bg-slate-900 border-slate-600 focus:ring-0"
                    />
                    <span className="text-xs font-bold text-slate-200">Mangueira e difusor limpos e sem rachaduras</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkSign}
                      onChange={(e) => setCheckSign(e.target.checked)}
                      className="w-4 h-4 text-emerald-500 rounded bg-slate-900 border-slate-600 focus:ring-0"
                    />
                    <span className="text-xs font-bold text-slate-200">Placa de sinalização visível e demarcada</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkAccess}
                      onChange={(e) => setCheckAccess(e.target.checked)}
                      className="w-4 h-4 text-emerald-500 rounded bg-slate-900 border-slate-600 focus:ring-0"
                    />
                    <span className="text-xs font-bold text-slate-200">Acesso totalmente livre e desobstruído</span>
                  </label>
                </div>

                <div>
                  <input
                    type="text"
                    value={inspectNotes}
                    onChange={(e) => setInspectNotes(e.target.value)}
                    placeholder="Observações complementares (opcional)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={inspecting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-sm shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  {inspecting ? (
                    'Registrando...'
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Gravar Inspeção de Campo
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Recent Inspections History */}
            {data.inspections && data.inspections.length > 0 && (
              <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800">
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Histórico Recente de Inspeções
                </h4>
                <div className="space-y-2">
                  {data.inspections.map((insp: any) => (
                    <div
                      key={insp.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{insp.date}</span>
                        <span className="text-slate-400 ml-2">por {insp.inspectorName}</span>
                      </div>
                      <span className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                        insp.status === 'aprovado'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}>
                        {insp.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- 3. PONTO DE ENCONTRO ----------------- */}
        {type === 'meeting_point' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-600/60 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Plano de Abandono (NR-23)
                </span>
                <span className="text-xs font-mono font-black text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                  {data.code}
                </span>
              </div>

              <h2 className="text-2xl font-black text-white mt-3 leading-tight">{data.name}</h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                {data.description || 'Ponto seguro designado para concentração de pessoas em caso de alarme de evacuação.'}
              </p>

              <div className="mt-4 flex items-center gap-3">
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Capacidade Estimada</span>
                  <p className="text-base font-black text-emerald-400 mt-0.5">{data.capacity_people || '100'} Pessoas</p>
                </div>
              </div>
            </div>

            {/* Emergency Instructions */}
            <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-lg">
              <h3 className="font-black text-sm uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Instruções de Emergência
              </h3>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">1</span>
                  <span>Mantenha a calma, não corra e siga as rotas de fuga sinalizadas no piso.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">2</span>
                  <span>Não retorne ao local de trabalho sob nenhuma hipótese para pegar pertences.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">3</span>
                  <span>Aguarde a chamada nominal pelo Brigadista ou Chefe do Setor no Ponto de Encontro.</span>
                </li>
              </ul>
            </div>

            {/* Stationed Brigadists */}
            {data.brigadists && data.brigadists.length > 0 && (
              <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800">
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-red-400" />
                  Brigadistas Escalados na Região
                </h4>
                <div className="space-y-2">
                  {data.brigadists.slice(0, 4).map((b: any) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <h5 className="font-bold text-xs text-white">{b.name}</h5>
                        <p className="text-[10px] text-slate-400">{b.role} • Turno {b.shift}</p>
                      </div>
                      {b.phone && (
                        <a
                          href={`tel:${b.phone}`}
                          className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors flex items-center gap-1 text-[11px] font-bold"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Ligar
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- 4. CRACHÁ DIGITAL DO COLABORADOR ----------------- */}
        {type === 'employee' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* ID Badge Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-700 shadow-2xl relative">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center text-2xl font-black text-white shadow-lg flex-shrink-0">
                  {data.name?.charAt(0)}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                    Crachá Digital SST
                  </span>
                  <h2 className="text-xl font-black text-white mt-1">{data.name}</h2>
                  <p className="text-xs text-slate-300 font-bold">{data.role}</p>
                  <p className="text-[11px] text-slate-400">{data.department} • CPF: {data.cpfMasked || '***'}</p>
                </div>
              </div>

              {/* Badges NR-35 / NR-33 */}
              <div className="grid grid-cols-2 gap-2 mt-5">
                <div className={`p-3 rounded-2xl border flex items-center gap-2 ${
                  data.hasNr35
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500'
                }`}>
                  <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold block uppercase">NR-35 Altura</span>
                    <strong className="text-xs font-black">{data.hasNr35 ? 'Apto / Válido' : 'Pendente'}</strong>
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border flex items-center gap-2 ${
                  data.hasNr33
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500'
                }`}>
                  <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold block uppercase">NR-33 Confinado</span>
                    <strong className="text-xs font-black">{data.hasNr33 ? 'Apto / Válido' : 'Pendente'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Trainings Table */}
            <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-lg">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Treinamentos e Certificações Registrados
              </h3>
              <div className="space-y-2">
                {data.trainings && data.trainings.length > 0 ? (
                  data.trainings.map((t: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <strong className="text-white font-bold block">{t.type}</strong>
                        <span className="text-slate-400 text-[11px]">Vence em: {t.expiry_date}</span>
                      </div>
                      <span className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                        t.status === 'valido'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : t.status === 'prestes_a_vencer'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">Nenhum treinamento registrado.</p>
                )}
              </div>
            </div>

            {/* EPIs Delivered */}
            <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-lg">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <HardHat className="w-3.5 h-3.5 text-cyan-400" />
                EPIs com C.A. Entregues ao Trabalhador
              </h3>
              <div className="space-y-2">
                {data.epis && data.epis.length > 0 ? (
                  data.epis.map((e: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <strong className="text-white font-bold">{e.name}</strong>
                        <span className="text-amber-400 font-mono ml-2 font-bold">C.A. {e.ca_number}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Entregue: {e.delivery_date}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">Nenhum EPI registrado.</p>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto py-4 text-center text-[11px] text-slate-500 border-t border-slate-900">
        Plataforma SegTrabalho SST • Leitura Segura de QR Code Operacional
      </footer>
    </div>
  );
};
