import React, { useState, useEffect } from 'react';
import {
  Database,
  HardDrive,
  Camera,
  FileText,
  ShieldCheck,
  Server,
  Activity,
  Download,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Lock,
  Layers,
  MapPin,
  Flame,
  FileCheck,
  Radio
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

interface DataUsageResponse {
  storage: {
    dbSizeBytes: number;
    dbSizeFormatted: string;
    dbLastModified: string;
    uploadsSizeBytes: number;
    uploadsSizeFormatted: string;
    uploadsCount: number;
    totalStorageBytes: number;
    totalStorageFormatted: string;
    biometricBytesTotal: number;
    biometricSizeFormatted: string;
    biometricPhotosCount: number;
  };
  counts: {
    users: number;
    usersActive: number;
    employees: number;
    employeesActive: number;
    documents: number;
    signatures: number;
    auditLogs: number;
    riskLocations: number;
    brigadeMembers: number;
    extinguishers: number;
    geofenceEvents: number;
    trackingPings: number;
  };
  lgpd: {
    totalDataSubjects: number;
    biometricConsentCoverage: number;
    biometricProfilesStored: number;
    encryptionType: string;
    storageLocation: string;
    compliant: boolean;
  };
  server: {
    nodeVersion: string;
    platform: string;
    uptimeSeconds: number;
    uptimeFormatted: string;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    healthScore: number;
    healthStatus: string;
  };
}

export const DataUsagePage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin =
    user?.roleId === 'role_admin' ||
    user?.roleName?.toLowerCase() === 'administrador' ||
    user?.email === 'admin@segtrabalho.com.br';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DataUsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<string | null>(null);
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<DataUsageResponse>('/system/data-usage');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar telemetria de dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchMetrics();
    }
  }, [isAdmin]);

  // Download complete DB backup
  const handleDownloadBackup = async () => {
    try {
      setDownloadingBackup(true);
      const token = localStorage.getItem('segtrabalho_token');
      const response = await fetch('/api/system/backup', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Falha ao baixar backup.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `segtrabalho_backup_${today}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Erro ao baixar backup.');
    } finally {
      setDownloadingBackup(false);
    }
  };

  // Run Database optimization routine
  const handleOptimize = async () => {
    if (!confirm('Deseja iniciar a otimização do banco de dados? Isso removerá registros de rastreamento antigos (> 15 dias) e desfragmentará o arquivo de dados.')) {
      return;
    }

    try {
      setOptimizing(true);
      setOptimizeResult(null);
      const res = await api.post<{ success: boolean; message: string; freedFormatted: string }>('/system/optimize');
      setOptimizeResult(res.message);
      await fetchMetrics();
    } catch (err: any) {
      alert(err.message || 'Erro ao otimizar banco de dados.');
    } finally {
      setOptimizing(false);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 p-6 rounded-3xl border border-slate-800 text-white shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight">Telemetria & Uso de Dados</h1>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                Acesso Exclusivo Admin
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Monitoramento em tempo real de armazenamento em disco, volume biométrico, tráfego e conformidade LGPD.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50"
            title="Atualizar Métricas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <button
            onClick={handleDownloadBackup}
            disabled={downloadingBackup}
            className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloadingBackup ? 'Gerando Backup...' : 'Baixar Backup (.json)'}
          </button>

          <button
            onClick={handleOptimize}
            disabled={optimizing}
            className="py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            {optimizing ? 'Otimizando...' : 'Otimizar Banco'}
          </button>
        </div>
      </div>

      {/* Success / Alert Banner */}
      {optimizeResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{optimizeResult}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-xs animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-xs font-semibold">Calculando métricas e telemetria de disco...</p>
        </div>
      )}

      {data && (
        <>
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Armazenamento Total */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Espaço em Disco</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <HardDrive className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{data.storage.totalStorageFormatted}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Banco JSON: <strong>{data.storage.dbSizeFormatted}</strong> • Uploads: <strong>{data.storage.uploadsSizeFormatted}</strong>
                </p>
              </div>
            </div>

            {/* 2. Biometria Facial */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Volume Biométrico</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Camera className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{data.storage.biometricSizeFormatted}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  <strong>{data.storage.biometricPhotosCount}</strong> fotos faciais cadastradas
                </p>
              </div>
            </div>

            {/* 3. Documentos e Assinaturas */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Docs & Assinaturas</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{data.counts.documents} Docs</div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  <strong>{data.counts.signatures}</strong> assinaturas e homologações
                </p>
              </div>
            </div>

            {/* 4. Saúde do Sistema */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saúde do Banco</span>
                <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{data.server.healthScore}%</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {data.server.healthStatus}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Uptime: <strong>{data.server.uptimeFormatted}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Sections Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna 1 & 2: Estrutura do Banco & Registros */}
            <div className="lg:col-span-2 space-y-6">
              {/* Entidades Cadastradas no Banco */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-sm font-black text-slate-900">Inventário de Dados Armazenados</h2>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Modificado em: {new Date(data.storage.dbLastModified).toLocaleString('pt-BR')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-semibold block">Usuários do Sistema</span>
                    <span className="text-lg font-black text-slate-900">{data.counts.users}</span>
                    <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                      {data.counts.usersActive} ativos
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-semibold block">Funcionários</span>
                    <span className="text-lg font-black text-slate-900">{data.counts.employees}</span>
                    <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                      {data.counts.employeesActive} em atividade
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-semibold block">Documentos & APRs</span>
                    <span className="text-lg font-black text-slate-900">{data.counts.documents}</span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Emitidos</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-semibold block">Assinaturas Coletadas</span>
                    <span className="text-lg font-black text-slate-900">{data.counts.signatures}</span>
                    <span className="text-[10px] text-indigo-600 font-bold block mt-0.5">100% com Face ID</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-semibold block">Pontos de Risco (Mapa)</span>
                    <span className="text-lg font-black text-slate-900">{data.counts.riskLocations}</span>
                    <span className="text-[10px] text-amber-600 font-bold block mt-0.5">Cercas Virtuais</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-semibold block">Brigadistas Ativos</span>
                    <span className="text-lg font-black text-slate-900">{data.counts.brigadeMembers}</span>
                    <span className="text-[10px] text-red-600 font-bold block mt-0.5">Prontidão 24/7</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-semibold block">Extintores Mapeados</span>
                    <span className="text-lg font-black text-slate-900">{data.counts.extinguishers}</span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Com QR Code</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-semibold block">Eventos de Cerca</span>
                    <span className="text-lg font-black text-slate-900">{data.counts.geofenceEvents}</span>
                    <span className="text-[10px] text-amber-600 font-bold block mt-0.5">Entradas em perigo</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-semibold block">Logs de Auditoria</span>
                    <span className="text-lg font-black text-slate-900">{data.counts.auditLogs}</span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Rastreamento SST</span>
                  </div>
                </div>
              </div>

              {/* Servidor e Ambiente Node.js */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Server className="w-5 h-5 text-slate-700" />
                  <h2 className="text-sm font-black text-slate-900">Telemetria do Servidor & Recursos</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                    <span className="text-slate-500 font-semibold block">Versão do Ambiente</span>
                    <span className="text-sm font-bold text-slate-800 mt-1 block">Node.js {data.server.nodeVersion}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{data.server.platform}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                    <span className="text-slate-500 font-semibold block">Memória Alocada (RSS)</span>
                    <span className="text-sm font-bold text-slate-800 mt-1 block">{data.server.memory.rss} MB</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Heap Used: {data.server.memory.heapUsed} MB</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                    <span className="text-slate-500 font-semibold block">Status Operacional</span>
                    <span className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Online & Ativo
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Uptime: {data.server.uptimeFormatted}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna 3: Governança LGPD & Segurança */}
            <div className="space-y-6">
              {/* Cartão LGPD */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-6 rounded-3xl border border-slate-800 text-white shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-sm font-black tracking-tight">Governança LGPD & Biometria</h2>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Conformidade com o <strong>Art. 11 da Lei Geral de Proteção de Dados (LGPD)</strong> para tratamento de dados biométricos sensíveis de SST.
                  </p>

                  <div className="mt-5 space-y-3 text-xs">
                    <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-slate-300">Cobertura de Consentimento:</span>
                      <span className="font-bold text-emerald-400">{data.lgpd.biometricConsentCoverage}%</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-slate-300">Local de Armazenamento:</span>
                      <span className="font-bold text-indigo-300 text-[11px]">{data.lgpd.storageLocation}</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-slate-300">Criptografia:</span>
                      <span className="font-bold text-amber-300 text-[11px]">SHA-256 + Vector dHash</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-slate-300">Conformidade Ativa:</span>
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 100% Regular
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-slate-400">
                  Os dados faciais são armazenados localmente e comparados de forma soberana sem envio para servidores de terceiros.
                </div>
              </div>

              {/* Cartão de Ações Rápidas de Manutenção */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Ações Administrativas</h3>

                <button
                  onClick={handleDownloadBackup}
                  disabled={downloadingBackup}
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-indigo-400" />
                  {downloadingBackup ? 'Processando...' : 'Exportar Dump Completo (.json)'}
                </button>

                <button
                  onClick={handleOptimize}
                  disabled={optimizing}
                  className="w-full py-3 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  {optimizing ? 'Executando...' : 'Otimizar Armazenamento'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
