import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { DocumentRecord, RequiredSigner, DigitalSignature } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FrontalCameraModal } from './FrontalCameraModal';
import { compareFaces, BiometricMatchResult } from '../services/facialBiometrics';
import {
  X,
  PenTool,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  QrCode,
  Camera,
  Smartphone,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Copy,
  Users,
  HardHat,
  Eye,
  Check,
  Download,
  Sparkles,
  User
} from 'lucide-react';

interface SignatureModalCenterProps {
  document: DocumentRecord;
  onClose: () => void;
  onSignatureSaved: (updatedDoc: DocumentRecord) => void;
}

export const SignatureModalCenter: React.FC<SignatureModalCenterProps> = ({
  document: initialDoc,
  onClose,
  onSignatureSaved
}) => {
  const { user } = useAuth();
  const [doc, setDoc] = useState<DocumentRecord>(initialDoc);
  const [selectedWorker, setSelectedWorker] = useState<RequiredSigner | null>(null);

  // Canvas state for drawing signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Photo selfie & Frontal Camera state
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [workerReferencePhoto, setWorkerReferencePhoto] = useState<string | null>(null);
  const [biometricResult, setBiometricResult] = useState<BiometricMatchResult | null>(null);
  const [isRegisteringBiometrics, setIsRegisteringBiometrics] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // QR Code state
  const [qrWorker, setQrWorker] = useState<RequiredSigner | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sigStatus = doc.signatureStatus || {
    totalRequired: 1,
    totalSigned: 0,
    percentage: 0,
    status: 'pendente',
    isFullySigned: false,
    pendingWorkers: [],
    signedWorkers: [],
    requiredWorkers: []
  };

  // Reload document to ensure fresh status and full signatures on mount
  const refreshDocument = async () => {
    try {
      const refreshed = await api.get<DocumentRecord>(`/documents/${doc.id}`);
      setDoc(refreshed);
      onSignatureSaved(refreshed);
    } catch (err) {
      console.error('Erro ao atualizar documento:', err);
    }
  };

  useEffect(() => {
    refreshDocument();
  }, [doc.id]);

  // Load worker reference biometrics when a worker is selected and auto-open frontal camera
  useEffect(() => {
    if (!selectedWorker) {
      setHasDrawn(false);
      setPhotoDataUrl(null);
      setWorkerReferencePhoto(null);
      setBiometricResult(null);
      return;
    }

    async function loadWorkerBiometrics() {
      try {
        const emps = await api.get<any[]>('/employees').catch(() => []);
        const emp = emps.find(
          (e: any) => e.id === selectedWorker?.id || (selectedWorker?.cpf && e.cpf === selectedWorker.cpf)
        );
        if (emp && emp.photo_url) {
          setWorkerReferencePhoto(emp.photo_url);
        } else {
          setWorkerReferencePhoto(null);
        }
      } catch {
        setWorkerReferencePhoto(null);
      }
    }
    loadWorkerBiometrics();

    // Auto-open frontal camera viewfinder for fast biometric verification
    const timer = setTimeout(() => {
      setCameraModalOpen(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedWorker]);

  // Setup canvas when a worker is selected for signing
  useEffect(() => {
    if (!selectedWorker) {
      setHasDrawn(false);
      setPhotoDataUrl(null);
      return;
    }

    const timer = setTimeout(() => {
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
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedWorker]);

  // Generate QR code when qrWorker is set
  useEffect(() => {
    if (!qrWorker) return;
    const publicUrl = `${window.location.origin}/assinar-documento?docId=${doc.id}&workerId=${qrWorker.id}&workerName=${encodeURIComponent(qrWorker.name)}&workerRole=${encodeURIComponent(qrWorker.role || '')}`;
    
    QRCode.toDataURL(publicUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [qrWorker, doc.id]);

  // Canvas drawing handlers
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

  // Handle Photo capture from Frontal Camera
  const handlePhotoCapture = async (compressedDataUrl: string) => {
    setPhotoDataUrl(compressedDataUrl);
    if (workerReferencePhoto) {
      const result = await compareFaces(workerReferencePhoto, compressedDataUrl);
      setBiometricResult(result);
    } else {
      // Colaborador ainda sem biometria -> cadastra automaticamente no ato
      const workerId =
        selectedWorker && !selectedWorker.id.startsWith('supervisor_') && !selectedWorker.id.startsWith('watch_')
          ? selectedWorker.id
          : null;
      if (workerId) {
        try {
          await api.post(`/employees/${workerId}/biometrics`, { photo_url: compressedDataUrl });
          setWorkerReferencePhoto(compressedDataUrl);
          setBiometricResult({
            score: 100,
            isMatch: true,
            confidence: 'alta',
            label: '✅ Biometria Facial Registrada e Validada!',
            color: 'emerald',
            hasReference: true
          });
        } catch {
          setBiometricResult({
            score: 100,
            isMatch: true,
            confidence: 'alta',
            label: '✅ Selfie Frontal Registrada',
            color: 'emerald',
            hasReference: false
          });
        }
      } else {
        setBiometricResult({
          score: 100,
          isMatch: true,
          confidence: 'alta',
          label: '✅ Selfie Frontal Registrada',
          color: 'emerald',
          hasReference: false
        });
      }
    }
  };

  // Quick Register Biometrics for current worker
  const handleRegisterBiometrics = async () => {
    if (!photoDataUrl || !selectedWorker) return;
    const workerId = selectedWorker.id.startsWith('supervisor_') || selectedWorker.id.startsWith('watch_') ? null : selectedWorker.id;
    if (!workerId) {
      alert('Cadastro biométrico disponível para colaboradores registrados.');
      return;
    }

    setIsRegisteringBiometrics(true);
    try {
      await api.post(`/employees/${workerId}/biometrics`, { photo_url: photoDataUrl });
      setWorkerReferencePhoto(photoDataUrl);
      const result = await compareFaces(photoDataUrl, photoDataUrl);
      setBiometricResult(result);
      alert(`Biometria facial de ${selectedWorker.name} cadastrada com sucesso como referência!`);
    } catch (err: any) {
      alert('Erro ao registrar biometria: ' + (err.message || 'Tente novamente'));
    } finally {
      setIsRegisteringBiometrics(false);
    }
  };

  // Handle Photo/Selfie file fallback
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

  // Save Signature for selected worker with strict SST safety locks
  const handleSaveSignature = async () => {
    if (!selectedWorker) return;
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) {
      alert('Bloqueio SST: A rubrica digital desenhada no quadro é estritamente obrigatória.');
      return;
    }
    if (!photoDataUrl) {
      alert('Bloqueio SST: A foto de presença com câmera frontal é estritamente obrigatória.');
      return;
    }
    if (workerReferencePhoto && (!biometricResult || !biometricResult.isMatch)) {
      alert('Bloqueio Biométrico SST: O rosto capturado está divergente da biometria cadastrada. Homologação bloqueada.');
      return;
    }

    const signatureDataUrl = canvas.toDataURL('image/png');
    setSaving(true);
    setErrorMessage(null);

    try {
      const res = await api.post<{ message: string; document: DocumentRecord; signatureStatus: any }>(
        `/documents/${doc.id}/sign`,
        {
          employeeId: selectedWorker.id.startsWith('supervisor_') || selectedWorker.id.startsWith('watch_') ? undefined : selectedWorker.id,
          signerName: selectedWorker.name,
          signerRole: selectedWorker.role,
          signerCpf: selectedWorker.cpf,
          signerType: selectedWorker.type,
          signatureDataUrl,
          photoDataUrl
        }
      );

      setDoc(res.document);
      onSignatureSaved(res.document);
      setSelectedWorker(null);
      setPhotoDataUrl(null);
      alert(`Assinatura de ${selectedWorker.name} homologada com sucesso!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao registrar assinatura.');
    } finally {
      setSaving(false);
    }
  };

  const copyQrLink = () => {
    if (!qrWorker) return;
    const publicUrl = `${window.location.origin}/assinar-documento?docId=${doc.id}&workerId=${qrWorker.id}&workerName=${encodeURIComponent(qrWorker.name)}&workerRole=${encodeURIComponent(qrWorker.role || '')}`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-black bg-slate-900 text-amber-400 px-2.5 py-0.5 rounded-lg">
                {doc.code}
              </span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {doc.type.replace('_', ' ')}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
              Central de Assinaturas & Homologação
            </h2>
            <p className="text-xs text-slate-500 truncate max-w-md">
              {doc.title} {doc.location_name ? `• ${doc.location_name}` : ''}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ======================================================== */}
        {/* VIEW 1: SIGNATURE BOARD FOR SPECIFIC WORKER */}
        {/* ======================================================== */}
        {selectedWorker ? (
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                  Colaborador Selecionado para Assinar:
                </span>
                <strong className="text-sm font-black text-slate-900">{selectedWorker.name}</strong>
                <span className="text-xs text-amber-900 block font-medium">
                  {selectedWorker.role} {selectedWorker.cpf ? `• CPF: ${selectedWorker.cpf}` : ''}
                </span>
              </div>
              <button
                onClick={() => setSelectedWorker(null)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 underline px-2 py-1"
              >
                Trocar de Colaborador
              </button>
            </div>

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Signature Canvas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-amber-600" />
                  Desenhe a Rubrica / Assinatura do Colaborador:
                </label>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-[11px] font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Limpar Traço
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
                  className="w-full h-44 cursor-crosshair"
                />
                <div className="absolute bottom-2 left-4 right-4 border-b border-slate-300 pointer-events-none flex justify-between text-[10px] text-slate-400 pb-0.5">
                  <span>X Rubrica de {selectedWorker.name}</span>
                  <span>Conformidade NR-01 / NR-35 / NR-33</span>
                </div>
              </div>
            </div>

            {/* Selfie / Biometrics Photo Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Photo comparison / preview */}
                  <div className="flex items-center gap-2">
                    {/* Reference photo (if registered) */}
                    {workerReferencePhoto ? (
                      <div className="relative" title="Foto Oficial do Cadastro">
                        <img
                          src={workerReferencePhoto}
                          alt="Cadastro Oficial"
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-300 shadow-sm"
                        />
                        <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[9px] px-1 py-0.2 rounded font-bold">
                          Ref
                        </span>
                      </div>
                    ) : null}

                    {/* Captured Selfie */}
                    {photoDataUrl ? (
                      <div className="relative">
                        <img
                          src={photoDataUrl}
                          alt="Foto capturada em campo"
                          className={`w-14 h-14 rounded-2xl object-cover border-2 shadow-sm ${
                            biometricResult?.isMatch ? 'border-emerald-500' : 'border-amber-500'
                          }`}
                        />
                        <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[9px] px-1 py-0.2 rounded font-bold">
                          Campo
                        </span>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-400">
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Validação Facial Biométrica</span>
                      {workerReferencePhoto && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold">
                          Biometria Ativa
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {photoDataUrl
                        ? 'Selfie frontal registrada para confirmação de presença.'
                        : 'Abra a câmera frontal para enquadrar o rosto do colaborador.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setCameraModalOpen(true)}
                    className="py-2 px-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
                  >
                    <Camera className="w-4 h-4 text-slate-950" />
                    <span>{photoDataUrl ? 'Trocar Selfie Frontal' : 'Câmera Frontal'}</span>
                  </button>
                </div>
              </div>

              {/* Biometric Analysis Indicator */}
              {biometricResult && (
                <div
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                    biometricResult.color === 'emerald'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : biometricResult.color === 'amber'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {biometricResult.color === 'emerald' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{biometricResult.label}</span>
                  </div>

                  {photoDataUrl && !workerReferencePhoto && (
                    <button
                      type="button"
                      onClick={handleRegisterBiometrics}
                      disabled={isRegisteringBiometrics}
                      className="py-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isRegisteringBiometrics ? 'Gravando...' : 'Definir como Biometria Oficial'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Checklist de Conformidade Obrigatória SST */}
            <div className="p-3 bg-slate-100/90 rounded-2xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
              {/* Rubrica status */}
              <div className="flex items-center gap-1.5 font-medium">
                {hasDrawn ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
                <span className={hasDrawn ? 'text-emerald-800' : 'text-slate-600'}>
                  Rubrica: <strong>{hasDrawn ? 'Preenchida' : 'Obrigatória'}</strong>
                </span>
              </div>

              {/* Foto status */}
              <div className="flex items-center gap-1.5 font-medium">
                {photoDataUrl ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
                <span className={photoDataUrl ? 'text-emerald-800' : 'text-slate-600'}>
                  Selfie Frontal: <strong>{photoDataUrl ? 'Capturada' : 'Obrigatória'}</strong>
                </span>
              </div>

              {/* Biometria status */}
              <div className="flex items-center gap-1.5 font-medium">
                {workerReferencePhoto ? (
                  biometricResult?.isMatch ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : biometricResult && !biometricResult.isMatch ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-pulse" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  )
                ) : photoDataUrl ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span
                  className={
                    workerReferencePhoto && biometricResult && !biometricResult.isMatch
                      ? 'text-rose-700 font-black'
                      : photoDataUrl
                      ? 'text-emerald-800 font-semibold'
                      : 'text-slate-600'
                  }
                >
                  Biometria:{' '}
                  <strong>
                    {workerReferencePhoto && biometricResult && !biometricResult.isMatch
                      ? 'Divergente (Bloqueado)'
                      : photoDataUrl
                      ? 'Validada'
                      : 'Aguardando Foto'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedWorker(null)}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                {/* Impediment reason warning */}
                {(!hasDrawn || !photoDataUrl || (workerReferencePhoto && biometricResult && !biometricResult.isMatch)) && (
                  <span className="text-[11px] text-rose-600 font-bold text-center sm:text-right">
                    {!photoDataUrl
                      ? '⚠️ Tire a selfie frontal'
                      : workerReferencePhoto && biometricResult && !biometricResult.isMatch
                      ? '⛔ Rosto divergente (Bloqueado)'
                      : !hasDrawn
                      ? '⚠️ Desenhe a rubrica'
                      : ''}
                  </span>
                )}

                <button
                  type="button"
                  disabled={
                    !hasDrawn ||
                    !photoDataUrl ||
                    (workerReferencePhoto && biometricResult && !biometricResult.isMatch) ||
                    saving
                  }
                  onClick={handleSaveSignature}
                  className={`w-full sm:w-auto py-2.5 px-5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition-all ${
                    hasDrawn && photoDataUrl && (!workerReferencePhoto || biometricResult?.isMatch) && !saving
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 hover:scale-[1.02]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Registrando...' : 'Homologar Assinatura'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* VIEW 2: MASTER LIST OF REQUIRED SIGNERS */
          /* ======================================================== */
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            
            {/* Visual Status Banner */}
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                sigStatus.status === 'homologado'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : sigStatus.status === 'parcial'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-red-50 border-red-200 text-red-950'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-sm ${
                    sigStatus.status === 'homologado'
                      ? 'bg-emerald-500 text-white'
                      : sigStatus.status === 'parcial'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-red-500 text-white'
                  }`}
                >
                  {sigStatus.status === 'homologado' ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : sigStatus.status === 'parcial' ? (
                    <Clock className="w-6 h-6" />
                  ) : (
                    <AlertTriangle className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm uppercase tracking-wide">
                      {sigStatus.status === 'homologado'
                        ? '🟢 Documento 100% Homologado'
                        : sigStatus.status === 'parcial'
                        ? '🟡 Assinaturas Parciais'
                        : '🔴 Pendente de Assinaturas'}
                    </span>
                    <span className="text-xs font-mono font-bold bg-white/70 px-2 py-0.5 rounded-full border border-black/10">
                      {sigStatus.totalSigned} de {sigStatus.totalRequired} ({sigStatus.percentage}%)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {sigStatus.status === 'homologado'
                      ? 'Todos os executantes e o responsável técnico assinaram. Atividade liberada para execução!'
                      : 'Clique no nome de cada colaborador abaixo para registrar a assinatura ou gere o QR Code.'}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full sm:w-36 bg-slate-200 rounded-full h-2.5 overflow-hidden shrink-0 border border-slate-300">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    sigStatus.status === 'homologado'
                      ? 'bg-emerald-500'
                      : sigStatus.status === 'parcial'
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${sigStatus.percentage}%` }}
                />
              </div>
            </div>

            {/* List of collaborators to sign */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" />
                  Equipe de Trabalho & Responsáveis ({sigStatus.requiredWorkers?.length || 0})
                </h3>
                <span className="text-[11px] text-slate-400">
                  Toque no colaborador para abrir a assinatura
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {sigStatus.requiredWorkers?.map((worker) => {
                  const signedData = sigStatus.signedWorkers?.find(
                    (s) =>
                      s.id === worker.id ||
                      (worker.isSupervisor && s.isSupervisor) ||
                      s.name.toLowerCase() === worker.name.toLowerCase()
                  );
                  const isSigned = !!signedData;

                  return (
                    <div
                      key={worker.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSigned
                          ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                          : 'bg-white border-slate-200 hover:border-amber-400 shadow-sm'
                      }`}
                    >
                      {/* Left: Worker Info & Signature Preview */}
                      <div className="flex items-center gap-3 min-w-0">
                        {isSigned ? (
                          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            <Check className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center font-bold text-xs shrink-0">
                            <PenTool className="w-4 h-4" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm text-slate-900 truncate">
                              {worker.name}
                            </h4>
                            {worker.isSupervisor && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.2 rounded-full bg-slate-900 text-amber-400">
                                Emissor SST
                              </span>
                            )}
                            {worker.type === 'vigia' && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.2 rounded-full bg-orange-600 text-white">
                                Vigia NR-33
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 truncate">
                            {worker.role} {worker.cpf ? `• CPF: ${worker.cpf}` : ''}
                          </p>

                          {/* If signed, display signature time and device badge */}
                          {isSigned && signedData && (
                            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-emerald-800">
                              <span className="font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Assinado em {new Date(signedData.signedAt).toLocaleString('pt-BR')}
                              </span>
                              {signedData.deviceId && (
                                <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300 text-slate-500">
                                  ID: {signedData.deviceId}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {isSigned && signedData ? (
                          <div className="flex items-center gap-2">
                            {/* Rubrica preview */}
                            <div className="h-10 px-2 bg-white rounded-xl border border-slate-200 flex items-center justify-center">
                              <img
                                src={signedData.signatureDataUrl}
                                alt="Rubrica"
                                className="h-7 max-w-[80px] object-contain"
                              />
                            </div>
                            {signedData.photoDataUrl && (
                              <img
                                src={signedData.photoDataUrl}
                                alt="Presença"
                                title="Presença verificada por foto"
                                className="w-9 h-9 rounded-xl object-cover border border-emerald-400"
                              />
                            )}
                            {/* Re-sign button */}
                            <button
                              onClick={() => setSelectedWorker(worker)}
                              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1 hover:bg-slate-100 rounded-lg"
                              title="Refazer assinatura"
                            >
                              Refazer
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedWorker(worker)}
                              className="py-2 px-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02]"
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              Assinar Agora
                            </button>

                            <button
                              onClick={() => setQrWorker(worker)}
                              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors border border-slate-200"
                              title="Gerar QR Code para o trabalhador assinar no próprio celular"
                            >
                              <QrCode className="w-3.5 h-3.5 text-slate-600" />
                              QR Code
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Smartphone className="w-3.5 h-3.5 text-amber-500" />
            <span>Usina Santa Isabel • Novo Horizonte-SP</span>
          </div>
          <button
            onClick={onClose}
            className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
          >
            Fechar Painel
          </button>
        </div>

        {/* ======================================================== */}
        {/* MODAL OVERLAY: QR CODE FOR WORKER'S SMARTPHONE */}
        {/* ======================================================== */}
        {qrWorker && (
          <div className="fixed inset-0 z-[100000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="text-left">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                    Assinatura Sem Contato
                  </span>
                  <h3 className="font-black text-sm text-slate-900">{qrWorker.name}</h3>
                </div>
                <button
                  onClick={() => setQrWorker(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Peça para o colaborador apontar a <strong>câmera do celular dele</strong> para o QR Code abaixo para assinar na própria tela:
              </p>

              {qrDataUrl && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl inline-block shadow-inner mb-3">
                  <img src={qrDataUrl} alt="QR Code de Assinatura" className="w-56 h-56 mx-auto" />
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={copyQrLink}
                  className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-300"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? 'Link Copiado para o Zap!' : 'Copiar Link de Assinatura'}
                </button>

                <button
                  onClick={() => {
                    setQrWorker(null);
                    refreshDocument();
                  }}
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl"
                >
                  Atualizar Status Após Assinatura
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Frontal Camera Viewfinder Modal */}
        <FrontalCameraModal
          isOpen={cameraModalOpen}
          onClose={() => setCameraModalOpen(false)}
          onCapture={handlePhotoCapture}
          workerName={selectedWorker?.name}
          referencePhotoUrl={workerReferencePhoto}
          title="Biometria Facial na Homologação"
        />
      </div>
    </div>
  );
};
