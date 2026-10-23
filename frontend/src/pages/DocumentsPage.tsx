import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DocumentRecord } from '../types';
import { generateAprPdf } from '../services/aprPdfGenerator';
import { generateDocumentPdf } from '../services/documentPdfGenerator';
import { SignatureModalCenter } from '../components/SignatureModalCenter';
import {
  FileText,
  Plus,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Smartphone,
  Trash2,
  PenTool,
  X,
  MapPin,
  ExternalLink,
  ShieldAlert,
  Zap,
  HardHat,
  ClipboardCheck,
  Award,
  AlertTriangle,
  Lock,
  Users,
  Check
} from 'lucide-react';

export const DocumentsPage: React.FC = () => {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [signatureFilter, setSignatureFilter] = useState<'ALL' | 'pendente' | 'parcial' | 'homologado'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // Signature modal state
  const [signModalDoc, setSignModalDoc] = useState<DocumentRecord | null>(null);

  // Detail modal state
  const [viewDoc, setViewDoc] = useState<DocumentRecord | null>(null);

  const loadDocuments = async () => {
    try {
      const data = await api.get<DocumentRecord[]>('/documents');
      setDocuments(data);

      const docIdParam = searchParams.get('docId');
      if (docIdParam) {
        const found = data.find(d => d.id === docIdParam);
        if (found) setViewDoc(found);
      }
    } catch (err) {
      console.error('Erro ao carregar documentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [searchParams]);

  const handleDownloadPdf = async (doc: DocumentRecord) => {
    try {
      // Ensure we have full document data (with high-res signatures and photos)
      const fullDoc = await api.get<DocumentRecord>(`/documents/${doc.id}`).catch(() => doc);
      await generateDocumentPdf(fullDoc);
    } catch (err: any) {
      alert('Erro ao gerar PDF: ' + err.message);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (confirm(`Deseja realmente excluir o documento ${code}?`)) {
      try {
        await api.delete(`/documents/${id}`);
        loadDocuments();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleSaveSignature = async (dataUrl: string) => {
    if (!signModalDoc) return;
    try {
      await api.post(`/documents/${signModalDoc.id}/sign`, {
        signerName: user?.name,
        signerRole: user?.roleName,
        signerType: user?.roleId === 'role_admin' || user?.roleName.includes('Técnico') ? 'supervisor' : 'executante',
        signatureDataUrl: dataUrl
      });
      setSignModalDoc(null);
      loadDocuments();
      alert('Assinatura digital registrada com sucesso no documento!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const countHomologados = documents.filter(d => d.signatureStatus?.status === 'homologado').length;
  const countParciais = documents.filter(d => d.signatureStatus?.status === 'parcial').length;
  const countPendentes = documents.filter(d => !d.signatureStatus || d.signatureStatus?.status === 'pendente').length;

  const filteredDocs = documents.filter(doc => {
    let matchesTab = true;
    if (activeTab === 'APR') {
      matchesTab = doc.type.startsWith('APR_');
    } else if (activeTab === 'PT') {
      matchesTab = doc.type === 'PT' || doc.type === 'PET';
    } else if (activeTab === 'OS') {
      matchesTab = doc.type === 'OS' || doc.type === 'OSS';
    } else if (activeTab === 'EPI') {
      matchesTab = doc.type === 'EPI_FICHA';
    } else if (activeTab === 'CHECKLIST') {
      matchesTab = doc.type === 'CHECKLIST' || doc.type === 'INSPECAO';
    }

    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.device_id && doc.device_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.employee_name && doc.employee_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || doc.status === statusFilter;

    const matchesSig =
      signatureFilter === 'ALL' ||
      (doc.signatureStatus && doc.signatureStatus.status === signatureFilter) ||
      (signatureFilter === 'pendente' && (!doc.signatureStatus || doc.signatureStatus.status === 'pendente'));

    return matchesTab && matchesSearch && matchesStatus && matchesSig;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            Central de Documentos de Segurança do Trabalho
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Emissão de APRs, Permissões de Trabalho (PT/PET), Ordens de Serviço (NR-01), Fichas de EPI e Checklists de Campo
          </p>
        </div>

        {can('documents', 'create') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            Emitir Documento SST
          </button>
        )}
      </div>

      {/* MOSTRADOR DE ASSINATURAS E HOMOLOGAÇÃO SST (3 KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setSignatureFilter(signatureFilter === 'homologado' ? 'ALL' : 'homologado')}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
            signatureFilter === 'homologado'
              ? 'bg-emerald-500 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400'
              : 'bg-white hover:bg-emerald-50/50 border-slate-200 text-slate-800 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                signatureFilter === 'homologado' ? 'bg-white text-emerald-600' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  signatureFilter === 'homologado' ? 'text-emerald-100' : 'text-slate-500'
                }`}
              >
                100% Homologados
              </p>
              <h3 className="text-xl font-black leading-none mt-0.5">{countHomologados}</h3>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              signatureFilter === 'homologado' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            Liberados
          </span>
        </button>

        <button
          onClick={() => setSignatureFilter(signatureFilter === 'parcial' ? 'ALL' : 'parcial')}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
            signatureFilter === 'parcial'
              ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400'
              : 'bg-white hover:bg-amber-50/50 border-slate-200 text-slate-800 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                signatureFilter === 'parcial' ? 'bg-slate-950 text-amber-400' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  signatureFilter === 'parcial' ? 'text-amber-950/80' : 'text-slate-500'
                }`}
              >
                Assinatura Parcial
              </p>
              <h3 className="text-xl font-black leading-none mt-0.5">{countParciais}</h3>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              signatureFilter === 'parcial' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-900'
            }`}
          >
            Em Coleta
          </span>
        </button>

        <button
          onClick={() => setSignatureFilter(signatureFilter === 'pendente' ? 'ALL' : 'pendente')}
          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
            signatureFilter === 'pendente'
              ? 'bg-red-500 text-white border-red-600 shadow-md ring-2 ring-red-400'
              : 'bg-white hover:bg-red-50/50 border-slate-200 text-slate-800 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                signatureFilter === 'pendente' ? 'bg-white text-red-600' : 'bg-red-100 text-red-700'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  signatureFilter === 'pendente' ? 'text-red-100' : 'text-slate-500'
                }`}
              >
                Pendentes de Assinatura
              </p>
              <h3 className="text-xl font-black leading-none mt-0.5">{countPendentes}</h3>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              signatureFilter === 'pendente' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800'
            }`}
          >
            Bloqueados
          </span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 text-xs font-bold border-b border-slate-200 scrollbar-none">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`py-2 px-3.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Todos ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab('APR')}
          className={`py-2 px-3.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'APR'
              ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          🦺 APRs ({documents.filter(d => d.type.startsWith('APR_')).length})
        </button>
        <button
          onClick={() => setActiveTab('PT')}
          className={`py-2 px-3.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'PT'
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          ⚡ PT / PET ({documents.filter(d => d.type === 'PT' || d.type === 'PET').length})
        </button>
        <button
          onClick={() => setActiveTab('OS')}
          className={`py-2 px-3.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'OS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          📋 Ordens de Serviço (OS) ({documents.filter(d => d.type === 'OS' || d.type === 'OSS').length})
        </button>
        <button
          onClick={() => setActiveTab('EPI')}
          className={`py-2 px-3.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'EPI'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          🥾 Fichas de EPI ({documents.filter(d => d.type === 'EPI_FICHA').length})
        </button>
        <button
          onClick={() => setActiveTab('CHECKLIST')}
          className={`py-2 px-3.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'CHECKLIST'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          ✅ Checklists de Campo ({documents.filter(d => d.type === 'CHECKLIST' || d.type === 'INSPECAO').length})
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código (ex: APR-2026), título ou ID do aparelho..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-xl">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ativa">Ativa</option>
            <option value="encerrada">Encerrada</option>
            <option value="rascunho">Rascunho</option>
          </select>
        </div>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-400">Carregando acervo de documentos...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-sm">Nenhum documento encontrado</h3>
          <p className="text-xs text-slate-400 mt-1">Clique em "Emitir Nova APR" para registrar uma análise.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocs.map(doc => {
            const sigStatus = doc.signatureStatus || {
              totalRequired: 1,
              totalSigned: 0,
              percentage: 0,
              status: 'pendente',
              isFullySigned: false,
              pendingWorkers: [],
              signedWorkers: []
            };
            const isHomologated = sigStatus.status === 'homologado';

            return (
              <div
                key={doc.id}
                className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm hover:border-amber-400 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="font-black text-xs font-mono px-2 py-0.5 rounded-lg bg-slate-100 text-slate-900 border border-slate-200">
                      {doc.code}
                    </span>

                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        doc.type === 'APR_ALTURA'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : doc.type === 'APR_ESPACO_CONFINADO'
                          ? 'bg-orange-100 text-orange-900 border border-orange-300'
                          : doc.type === 'PT'
                          ? 'bg-red-100 text-red-900 border border-red-300'
                          : doc.type === 'PET'
                          ? 'bg-rose-100 text-rose-900 border border-rose-300 font-black'
                          : doc.type === 'OS' || doc.type === 'OSS'
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : doc.type === 'EPI_FICHA'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : doc.type === 'CHECKLIST'
                          ? 'bg-purple-100 text-purple-900 border border-purple-300'
                          : 'bg-slate-100 text-slate-800 border border-slate-300'
                      }`}
                    >
                      {doc.type === 'EPI_FICHA'
                        ? 'Ficha EPI (NR-06)'
                        : doc.type === 'OS'
                        ? 'Ordem de Serviço (NR-01)'
                        : doc.type === 'PET'
                        ? 'PET Confinado (NR-33)'
                        : doc.type === 'CHECKLIST'
                        ? 'Checklist de Campo'
                        : doc.type.replace('APR_', 'APR ').replace('_', ' ')}
                    </span>

                    {/* Mostrador Visual de Assinatura no Card */}
                    {isHomologated ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        100% Homologado ({sigStatus.totalSigned}/{sigStatus.totalRequired})
                      </span>
                    ) : sigStatus.status === 'parcial' ? (
                      <span className="text-[10px] bg-amber-100 text-amber-950 border border-amber-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Assinatura Parcial ({sigStatus.totalSigned}/{sigStatus.totalRequired} • {sigStatus.percentage}%)
                      </span>
                    ) : (
                      <span className="text-[10px] bg-red-100 text-red-900 border border-red-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        Pendente de Assinaturas (0/{sigStatus.totalRequired})
                      </span>
                    )}

                    <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                      Status: {doc.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm md:text-base leading-snug mb-1">
                    {doc.title}
                  </h3>

                  {doc.location_name && (
                    <div className="flex items-center gap-1 text-xs text-amber-700 font-medium mb-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{doc.location_name}</span>
                    </div>
                  )}

                  {doc.employee_name && (
                    <div className="text-xs text-blue-700 font-medium mb-1">
                      Colaborador: <strong>{doc.employee_name}</strong>
                    </div>
                  )}

                  {/* Pending Workers Mini Badges */}
                  {!isHomologated && sigStatus.pendingWorkers?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                      <span className="text-[10px] font-bold text-slate-400">Falta assinar:</span>
                      {sigStatus.pendingWorkers.slice(0, 3).map((w, idx) => (
                        <span
                          key={idx}
                          className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1"
                        >
                          <Clock className="w-3 h-3 text-amber-600" />
                          {w.name}
                        </span>
                      ))}
                      {sigStatus.pendingWorkers.length > 3 && (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          +{sigStatus.pendingWorkers.length - 3} outros
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-2">
                    <span>Emitido por: <strong className="text-slate-600">{doc.created_by_name}</strong></span>
                    <span>Data: {new Date(doc.created_at).toLocaleDateString('pt-BR')}</span>

                    {/* Device ID display */}
                    <div className="flex items-center gap-1 font-mono text-[10px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-500">
                      <Smartphone className="w-3 h-3 text-amber-500" />
                      <span>{doc.device_id || 'ID-WEB'}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  {/* Trava de Segurança SST para Geração de PT */}
                  {doc.type.startsWith('APR_') && (
                    isHomologated ? (
                      <button
                        onClick={() => navigate(`/documentos/novo?type=PT&aprId=${doc.id}`)}
                        className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors border border-red-200 shadow-sm"
                        title="APR 100% Homologada! Clique para emitir a Permissão de Trabalho (PT)"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Gerar PT
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const pendings = sigStatus.pendingWorkers?.map(w => w.name).join(', ') || 'equipe';
                          alert(
                            `⛔ BLOQUEIO OPERACIONAL SST:\nNão é permitido gerar Permissão de Trabalho (PT) enquanto a APR ${doc.code} não estiver 100% homologada.\n\nAssinaturas ainda pendentes: ${pendings}.\n\nClique no botão "Assinaturas" para coletar as assinaturas dos colaboradores antes de emitir a PT.`
                          );
                        }}
                        className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors border border-slate-200"
                        title="Bloqueio de Segurança: A APR precisa de 100% das assinaturas para liberar a emissão da PT"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                        PT Bloqueada
                      </button>
                    )
                  )}

                  <button
                    onClick={() => handleDownloadPdf(doc)}
                    className="py-2 px-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                    title="Baixar em PDF oficial formatado com quadro de assinaturas"
                  >
                    <Download className="w-4 h-4" />
                    Gerar PDF
                  </button>

                  {/* Botão de Central de Assinaturas & Homologação */}
                  <button
                    onClick={() => setSignModalDoc(doc)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm ${
                      isHomologated
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-900 hover:bg-slate-800 text-amber-400'
                    }`}
                    title="Abrir Central de Assinaturas da Equipe"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Assinaturas ({sigStatus.totalSigned}/{sigStatus.totalRequired})</span>
                  </button>

                  <button
                    onClick={() => setViewDoc(doc)}
                    className="py-2 px-3 text-slate-500 hover:text-slate-800 text-xs font-semibold"
                  >
                    Detalhes
                  </button>

                  {can('documents', 'delete') && (
                    <button
                      onClick={() => handleDelete(doc.id, doc.code)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                      title="Excluir Documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CENTRAL DE ASSINATURAS POR COLABORADOR (z-[99999]) */}
      {signModalDoc && (
        <SignatureModalCenter
          document={signModalDoc}
          onClose={() => setSignModalDoc(null)}
          onSignatureSaved={(updatedDoc) => {
            loadDocuments();
            setSignModalDoc(updatedDoc);
          }}
        />
      )}

      {/* MODAL: DOCUMENT DETAILS */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                  {viewDoc.code}
                </span>
                <h3 className="font-extrabold text-slate-900 text-base mt-1">{viewDoc.title}</h3>
              </div>
              <button
                onClick={() => setViewDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">ID do Aparelho Emissor:</span>
                  <strong className="font-mono text-amber-800">{viewDoc.device_id}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Identificação do Dispositivo:</span>
                  <span className="text-slate-800">{viewDoc.device_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Endereço IP:</span>
                  <span className="text-slate-800">{viewDoc.ip_address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Emitido por:</span>
                  <span className="text-slate-800 font-bold">{viewDoc.created_by_name}</span>
                </div>
              </div>

              {viewDoc.data?.activityDetails && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Descrição do Trabalho:</h4>
                  <p className="text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {viewDoc.data.activityDetails}
                  </p>
                </div>
              )}

              {viewDoc.data?.hazards && viewDoc.data.hazards.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Perigos Identificados:</h4>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                    {viewDoc.data.hazards.map((h: string, idx: number) => (
                      <li key={idx}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {viewDoc.data?.signatures && viewDoc.data.signatures.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-1.5">Assinaturas Coletadas ({viewDoc.data.signatures.length}):</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {viewDoc.data.signatures.map((sig: any, idx: number) => (
                      <div key={idx} className="p-2 border border-slate-200 rounded-xl bg-slate-50 text-center">
                        {sig.signatureDataUrl && (
                          <img
                            src={sig.signatureDataUrl}
                            alt="Assinatura"
                            className="h-10 mx-auto object-contain mb-1"
                          />
                        )}
                        <p className="font-bold text-[10px] text-slate-800">{sig.signerName}</p>
                        <span className="text-[9px] text-slate-400 block font-mono">Dispositivo: {sig.deviceId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-5">
              <button
                onClick={() => handleDownloadPdf(viewDoc)}
                className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md"
              >
                <Download className="w-4 h-4" />
                Baixar PDF Completo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SELETOR DE EMISSÃO DE DOCUMENTOS SST (z-[99999]) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold">📑</span>
                <div>
                  <h3 className="font-black text-base">Qual documento você deseja emitir?</h3>
                  <p className="text-xs text-slate-400">Selecione o modelo operacional conforme a Norma Regulamentadora (NR)</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div
                onClick={() => {
                  setShowCreateModal(false);
                  navigate('/documentos/novo?type=APR');
                }}
                className="p-4 rounded-2xl border border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/40 cursor-pointer transition-all space-y-1.5 group"
              >
                <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                  <span className="text-xl">🦺</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">APR (Análise de Risco)</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug">
                  Análise Preliminar para Altura (NR-35), Espaço Confinado (NR-33) ou serviços gerais.
                </p>
                <span className="text-[10px] font-black text-amber-700 block pt-1">Emitir APR →</span>
              </div>

              <div
                onClick={() => {
                  setShowCreateModal(false);
                  navigate('/documentos/novo?type=PT');
                }}
                className="p-4 rounded-2xl border border-slate-200 hover:border-red-400 bg-slate-50 hover:bg-red-50/40 cursor-pointer transition-all space-y-1.5 group"
              >
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                  <span className="text-xl">⚡</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">PT / PET (Permissão)</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug">
                  Liberação formal de trabalho crítico com teste contínuo de gases e vigia.
                </p>
                <span className="text-[10px] font-black text-red-700 block pt-1">Emitir PT / PET →</span>
              </div>

              <div
                onClick={() => {
                  setShowCreateModal(false);
                  navigate('/documentos/novo?type=OS');
                }}
                className="p-4 rounded-2xl border border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/40 cursor-pointer transition-all space-y-1.5 group"
              >
                <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                  <span className="text-xl">📋</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">Ordem de Serviço (NR-01)</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug">
                  Instruções de segurança, obrigações, proibições e ciência individual por colaborador.
                </p>
                <span className="text-[10px] font-black text-blue-700 block pt-1">Emitir OS NR-01 →</span>
              </div>

              <div
                onClick={() => {
                  setShowCreateModal(false);
                  navigate('/documentos/novo?type=EPI_FICHA');
                }}
                className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 bg-slate-50 hover:bg-emerald-50/40 cursor-pointer transition-all space-y-1.5 group"
              >
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                  <span className="text-xl">🥾</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">Ficha de EPI (NR-06)</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug">
                  Recibo legal com número de CA e termo de guarda e conservação assinado.
                </p>
                <span className="text-[10px] font-black text-emerald-700 block pt-1">Emitir Ficha EPI →</span>
              </div>

              <div
                onClick={() => {
                  setShowCreateModal(false);
                  navigate('/documentos/novo?type=CHECKLIST');
                }}
                className="p-4 rounded-2xl border border-slate-200 hover:border-purple-400 bg-slate-50 hover:bg-purple-50/40 cursor-pointer transition-all space-y-1.5 group col-span-1 sm:col-span-2"
              >
                <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                  <span className="text-xl">✅</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">Checklist Pré-Operacional de Campo</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug">
                  Vistorias de andaimes, escadas, cinto/talabarte, ferramentas elétricas e máquinas NR-12 com laudo Apto/Não Apto.
                </p>
                <span className="text-[10px] font-black text-purple-700 block pt-1">Iniciar Checklist de Campo →</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
