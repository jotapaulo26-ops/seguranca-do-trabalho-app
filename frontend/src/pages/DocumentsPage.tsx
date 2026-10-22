import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DocumentRecord } from '../types';
import { generateAprPdf } from '../services/aprPdfGenerator';
import { SignaturePad } from '../components/SignaturePad';
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
  ShieldAlert
} from 'lucide-react';

export const DocumentsPage: React.FC = () => {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('APR');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
      await generateAprPdf(doc);
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

  const filteredDocs = documents.filter(doc => {
    // Tab filtering
    let matchesTab = true;
    if (activeTab === 'APR') {
      matchesTab = doc.type.startsWith('APR_');
    } else if (activeTab === 'PT') {
      matchesTab = doc.type === 'PT';
    } else if (activeTab === 'OUTROS') {
      matchesTab = !doc.type.startsWith('APR_') && doc.type !== 'PT';
    }

    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.device_id && doc.device_id.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || doc.status === statusFilter;

    return matchesTab && matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            Central de Documentos & APRs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Emissão de Análises Preliminares de Risco, Permissões de Trabalho e arquivo digital com rastreabilidade
          </p>
        </div>

        {can('documents', 'create') && (
          <button
            onClick={() => navigate('/documentos/nova-apr')}
            className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            Emitir Nova APR
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 text-xs font-bold border-b border-slate-200">
        <button
          onClick={() => setActiveTab('APR')}
          className={`py-2 px-4 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'APR'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          📄 APRs - Análises de Risco ({documents.filter(d => d.type.startsWith('APR_')).length})
        </button>
        <button
          onClick={() => setActiveTab('PT')}
          className={`py-2 px-4 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'PT'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          🛡️ Permissões de Trabalho (PT) ({documents.filter(d => d.type === 'PT').length})
        </button>
        <button
          onClick={() => setActiveTab('OUTROS')}
          className={`py-2 px-4 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'OUTROS'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          📁 Outros Documentos (OSS, CIPA, Inspeções)
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
            const signaturesCount = doc.data?.signatures?.length || 0;
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
                          ? 'bg-red-100 text-red-800'
                          : doc.type === 'APR_ESPACO_CONFINADO'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {doc.type.replace('APR_', '').replace('_', ' ')}
                    </span>

                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      {doc.status}
                    </span>

                    {signaturesCount > 0 && (
                      <span className="text-[10px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                        <PenTool className="w-3 h-3 text-emerald-600" />
                        {signaturesCount} Assinatura(s)
                      </span>
                    )}
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
                  <button
                    onClick={() => handleDownloadPdf(doc)}
                    className="py-2 px-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                    title="Baixar em PDF com máxima informação"
                  >
                    <Download className="w-4 h-4" />
                    Gerar PDF
                  </button>

                  <button
                    onClick={() => setSignModalDoc(doc)}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                    title="Assinar digitalmente"
                  >
                    <PenTool className="w-3.5 h-3.5 text-amber-600" />
                    Assinar
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

      {/* MODAL: DIGITAL SIGNATURE */}
      {signModalDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <SignaturePad
            title={`Assinar Documento ${signModalDoc.code}`}
            signerNameDefault={user?.name}
            onSave={handleSaveSignature}
            onCancel={() => setSignModalDoc(null)}
          />
        </div>
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
    </div>
  );
};
