import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  MapPin,
  FileText,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, can } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await api.get('/dashboard/stats');
        setStats(data);
      } catch (err) {
        console.error('Erro ao carregar métricas:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const kpis = stats?.kpis || {};
  const breakdown = stats?.riskTypeBreakdown || {};

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Painel Geral de SST
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bem-vindo(a), <span className="font-semibold text-slate-700">{user?.name}</span> ({user?.roleName})
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {can('documents', 'create') && (
            <button
              onClick={() => navigate('/documentos/nova-apr')}
              className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              Emitir Nova APR
            </button>
          )}
          {can('map', 'create') && (
            <button
              onClick={() => navigate('/mapa')}
              className="py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              Mapear Risco
            </button>
          )}
          {can('employees', 'create') && (
            <button
              onClick={() => navigate('/funcionarios')}
              className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Funcionário
            </button>
          )}
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {/* Active APRs */}
        <div
          onClick={() => navigate('/documentos')}
          className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-200 cursor-pointer hover:border-amber-400 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">APRs Ativas</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900">
            {kpis.activeAprs || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Total histórico: {kpis.totalAprs || 0} emitidas
          </p>
        </div>

        {/* Risk Locations */}
        <div
          onClick={() => navigate('/mapa')}
          className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-200 cursor-pointer hover:border-red-400 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pontos de Risco</span>
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900">
            {kpis.totalRiskLocations || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Altura & Espaço Confinado
          </p>
        </div>

        {/* Expired / Critical Trainings */}
        <div
          onClick={() => navigate('/funcionarios')}
          className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-200 cursor-pointer hover:border-red-500 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Treinamentos Vencidos</span>
            <div className={`w-9 h-9 rounded-xl ${kpis.expiredTrainings > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-emerald-50 text-emerald-600'} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl md:text-3xl font-black ${kpis.expiredTrainings > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {kpis.expiredTrainings || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {kpis.expiringSoonTrainings || 0} vencendo nos próx. 30 dias
          </p>
        </div>

        {/* Active Workers */}
        <div
          onClick={() => navigate('/funcionarios')}
          className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-200 cursor-pointer hover:border-blue-400 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Funcionários Ativos</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900">
            {kpis.activeEmployees || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Total cadastrado: {kpis.totalEmployees || 0}
          </p>
        </div>
      </div>

      {/* TWO COLUMN GRID: RISK BREAKDOWN & RECENT APRS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Breakdown Card */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-900">Mapeamento de Riscos Críticos</h3>
            <button
              onClick={() => navigate('/mapa')}
              className="text-xs text-amber-600 font-bold hover:underline flex items-center gap-1"
            >
              Abrir Mapa <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-red-50 rounded-2xl border border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🧗</span>
                <div>
                  <h4 className="font-bold text-xs text-red-950">Trabalho em Altura (NR-35)</h4>
                  <p className="text-[10px] text-red-700">Locais com desnível superior a 2,00m</p>
                </div>
              </div>
              <span className="text-lg font-black text-red-700">{breakdown.altura || 0}</span>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🕳️</span>
                <div>
                  <h4 className="font-bold text-xs text-amber-950">Espaço Confinado (NR-33)</h4>
                  <p className="text-[10px] text-amber-700">Silos, galerias, reatores e poços</p>
                </div>
              </div>
              <span className="text-lg font-black text-amber-800">{breakdown.espaco_confinado || 0}</span>
            </div>

            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="font-bold text-xs text-purple-950">Risco Duplo (Altura + Confinado)</h4>
                  <p className="text-[10px] text-purple-700">Acesso elevado com entrada em vaso</p>
                </div>
              </div>
              <span className="text-lg font-black text-purple-800">{breakdown.ambos || 0}</span>
            </div>
          </div>
        </div>

        {/* Recent APRs with Device ID info */}
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Últimas APRs Emitidas</h3>
              <p className="text-[11px] text-slate-500">Documentos recentes com rastreabilidade de dispositivo</p>
            </div>
            <button
              onClick={() => navigate('/documentos')}
              className="text-xs text-amber-600 font-bold hover:underline flex items-center gap-1"
            >
              Ver Todas <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {stats?.recentAprs && stats.recentAprs.length > 0 ? (
              stats.recentAprs.map((apr: any) => (
                <div key={apr.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-900">{apr.code}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                        {apr.type.replace('APR_', '')}
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        {apr.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium truncate mt-0.5">{apr.title}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                      <span>Emitido por: {apr.created_by_name}</span>
                      <span className="flex items-center gap-1">
                        <Smartphone className="w-3 h-3 text-slate-400" />
                        {apr.device_name ? apr.device_name.split('(')[0] : 'Web'}
                      </span>
                      <span>{new Date(apr.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/documentos?docId=${apr.id}`)}
                    className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Abrir
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">Nenhuma APR emitida ainda.</p>
            )}
          </div>
        </div>
      </div>

      {/* RECENT AUDIT LOG PREVIEW */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <h3 className="font-bold text-sm text-slate-900">Auditoria Recente do Sistema</h3>
          </div>
          {can('audit', 'view') && (
            <button
              onClick={() => navigate('/auditoria')}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              Registro Completo →
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stats?.recentAuditLogs?.slice(0, 3).map((log: any) => (
            <div key={log.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="font-bold text-slate-700">{log.user_name}</span>
                <span>{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
              </div>
              <p className="font-medium text-slate-800 text-[11px] truncate">{log.details || log.action}</p>
              <div className="text-[9px] text-slate-400 font-mono mt-1 truncate">
                Dispositivo: {log.device_id}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
