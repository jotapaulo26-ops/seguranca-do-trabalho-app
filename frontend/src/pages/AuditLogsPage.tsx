import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { FileCheck, Search, Filter, Smartphone, Clock, ShieldAlert } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');

  useEffect(() => {
    async function loadLogs() {
      try {
        const data = await api.get<AuditLog[]>('/audit');
        setLogs(data);
      } catch (err) {
        console.error('Erro ao carregar logs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  const filteredLogs = logs.filter(l => {
    const matchesSearch =
      (l.user_name && l.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.action && l.action.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.details && l.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.device_id && l.device_id.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesModule = moduleFilter === 'ALL' || l.module === moduleFilter;

    return matchesSearch && matchesModule;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-amber-500" />
            Trilha de Auditoria & Rastreabilidade de Dispositivos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro imutável de emissão de APRs, assinaturas, cadastros e acessos com ID de aparelho e IP
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por usuário, ação, detalhes ou ID do aparelho..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-xl">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Módulos</option>
            <option value="DOCUMENTOS">Documentos / APRs</option>
            <option value="MAPA">Mapa de Riscos</option>
            <option value="FUNCIONARIOS">Funcionários</option>
            <option value="AUTENTICACAO">Autenticação</option>
            <option value="USUARIOS">Usuários & Perfis</option>
          </select>
        </div>
      </div>

      {/* Logs Table / Cards */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-400">Carregando auditoria...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Nenhum registro de auditoria encontrado.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map(log => (
              <div key={log.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900">{log.user_name}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {log.module}
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium text-xs">{log.details || log.action}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-mono shrink-0">
                  <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-200 text-slate-600">
                    <Smartphone className="w-3 h-3 text-amber-500" />
                    {log.device_id || 'ID-WEB'}
                  </span>
                  <span className="bg-slate-50 px-2 py-1 rounded border border-slate-200 text-slate-600">
                    IP: {log.ip_address || '127.0.0.1'}
                  </span>
                  <span className="flex items-center gap-1 text-slate-500 font-sans">
                    <Clock className="w-3 h-3" />
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
