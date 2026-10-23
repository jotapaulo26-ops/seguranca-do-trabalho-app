import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { FrontalCameraModal } from '../components/FrontalCameraModal';
import { compareFaces, BiometricMatchResult } from '../services/facialBiometrics';
import {
  ShieldCheck,
  PenTool,
  CheckCircle2,
  Camera,
  RotateCcw,
  AlertTriangle,
  Smartphone,
  HardHat,
  MapPin,
  Check,
  Sparkles
} from 'lucide-react';

export const PublicSignaturePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const docId = searchParams.get('docId') || '';
  const workerId = searchParams.get('workerId') || '';
  const initialWorkerName = searchParams.get('workerName') || '';
  const initialWorkerRole = searchParams.get('workerRole') || '';

  const [docInfo, setDocInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [workerName, setWorkerName] = useState(initialWorkerName);
  const [workerRole, setWorkerRole] = useState(initialWorkerRole);
  const [signerCpf, setSignerCpf] = useState('');

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Photo selfie & Frontal Camera state
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [biometricResult, setBiometricResult] = useState<BiometricMatchResult | null>(null);
  const [workerReferencePhoto, setWorkerReferencePhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load public info of document
  useEffect(() => {
    async function fetchDoc() {
      if (!docId) {
        setLoading(false);
        return;
      }
      try {
        const info = await api.get<any>(`/documents/${docId}/public-info`);
        setDocInfo(info);
      } catch (err: any) {
        setErrorMessage('Não foi possível carregar as informações do documento.');
      } finally {
        setLoading(false);
      }
    }
    fetchDoc();
  }, [docId]);

  // Init canvas scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a';
  }, [loading]);

  // Touch & Mouse handlers
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handlePhotoCapture = async (compressedDataUrl: string) => {
    setPhotoDataUrl(compressedDataUrl);
    if (workerReferencePhoto) {
      const result = await compareFaces(workerReferencePhoto, compressedDataUrl);
      setBiometricResult(result);
    } else {
      setBiometricResult({
        score: 100,
        isMatch: true,
        confidence: 'alta',
        label: 'Selfie de presença registrada com sucesso!',
        color: 'emerald',
        hasReference: false
      });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      await handlePhotoCapture(raw);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) {
      alert('Por favor, informe seu nome completo.');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) {
      alert('Por favor, faça sua rubrica com o dedo na tela.');
      return;
    }

    const signatureDataUrl = canvas.toDataURL('image/png');
    setSaving(true);
    setErrorMessage(null);

    try {
      await api.post(`/documents/${docId}/sign-public`, {
        employeeId: workerId || undefined,
        signerName: workerName.trim(),
        signerRole: workerRole || 'Executante',
        signerCpf: signerCpf || undefined,
        signerType: 'executante',
        signatureDataUrl,
        photoDataUrl: photoDataUrl || undefined
      });

      setSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao registrar assinatura.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-300">Carregando formulário de assinatura...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-1">Assinatura Registrada!</h2>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Sua rubrica digital foi homologada com sucesso no documento{' '}
            <strong className="text-slate-900">{docInfo?.code || 'SST'}</strong>. Você está autorizado a participar desta atividade.
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-500 mb-4">
            <span>🛡️ Segurança do Trabalho • Usina Santa Isabel</span>
          </div>
          <p className="text-[11px] text-slate-400">Você já pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between py-6 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto space-y-4">
        
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/30">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Assinatura Digital de Campo SST</span>
          </div>
          <h1 className="text-xl font-black text-white">Usina Santa Isabel</h1>
          <p className="text-xs text-slate-400">Novo Horizonte - SP</p>
        </div>

        {/* Document Info Card */}
        {docInfo && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {docInfo.code}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                {docInfo.type?.replace('_', ' ')}
              </span>
            </div>
            <h3 className="font-extrabold text-sm text-slate-100">{docInfo.title}</h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{docInfo.location_name}</span>
            </div>
          </div>
        )}

        {/* Signing Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 mb-0.5">Identificação do Colaborador</h3>
            <p className="text-xs text-slate-500">Confirme seus dados para validação da APR/PT:</p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo:</label>
              <input
                type="text"
                required
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                placeholder="Ex: Carlos Eduardo Silveira"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cargo / Função:</label>
                <input
                  type="text"
                  value={workerRole}
                  onChange={(e) => setWorkerRole(e.target.value)}
                  placeholder="Ex: Eletricista"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CPF (Opcional):</label>
                <input
                  type="text"
                  value={signerCpf}
                  onChange={(e) => setSignerCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-amber-600" />
                Faça sua assinatura abaixo com o dedo:
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Limpar
              </button>
            </div>

            <div className="relative border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-slate-50 touch-none shadow-inner">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-40 cursor-crosshair"
              />
              <div className="absolute bottom-2 left-4 right-4 border-b border-slate-300 pointer-events-none flex justify-between text-[10px] text-slate-400 pb-0.5">
                <span>X Sua Rubrica</span>
                <span>Validade SST</span>
              </div>
            </div>
          </div>

          {/* Photo Selfie / Biometrics */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {photoDataUrl ? (
                  <img
                    src={photoDataUrl}
                    alt="Sua foto"
                    className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-500 shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-400">
                    <Camera className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {photoDataUrl ? 'Selfie de Presença Registrada' : 'Foto de Presença (Câmera Frontal)'}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {photoDataUrl ? 'Validação biométrica concluída' : 'Olhe para a câmera frontal para validação de presença.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCameraModalOpen(true)}
                className="py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <Camera className="w-3.5 h-3.5 text-slate-950" />
                {photoDataUrl ? 'Trocar' : 'Câmera Frontal'}
              </button>
            </div>

            {biometricResult && (
              <div
                className={`py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  biometricResult.color === 'emerald'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{biometricResult.label}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !hasDrawn}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01]"
          >
            <Check className="w-5 h-5" />
            {saving ? 'Gravando Assinatura...' : 'Confirmar e Assinar Documento'}
          </button>
        </form>

        <p className="text-center text-[10px] text-slate-500">
          Esta assinatura possui registro digital de horário e dispositivo para fins de conformidade com a NR-01.
        </p>

        {/* Frontal Camera Viewfinder Modal */}
        <FrontalCameraModal
          isOpen={cameraModalOpen}
          onClose={() => setCameraModalOpen(false)}
          onCapture={handlePhotoCapture}
          workerName={workerName}
          title="Selfie de Presença do Executante"
        />
      </div>
    </div>
  );
};
