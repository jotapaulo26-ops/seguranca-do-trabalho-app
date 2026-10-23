import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, ShieldCheck, AlertTriangle, RefreshCw, X, Check, Lock } from 'lucide-react';
import { compareFaces, BiometricMatchResult } from '../services/facialBiometrics';

interface BiometricLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  referencePhotoUrl: string;
  onSuccess: (score: number) => void;
  onFailure?: (errorMsg: string) => void;
}

export const BiometricLoginModal: React.FC<BiometricLoginModalProps> = ({
  isOpen,
  onClose,
  userName,
  referencePhotoUrl,
  onSuccess,
  onFailure
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchResult, setMatchResult] = useState<BiometricMatchResult | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setCameraError(null);
    setAuthFailed(null);
    setMatchResult(null);
    setCapturedPhoto(null);
    setIsInitializing(true);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr) {
        setCameraError('Permissão de câmera não concedida. Permita o uso da câmera frontal para validação biométrica.');
      }
    } finally {
      setIsInitializing(false);
    }
  }, [stopStream]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, startCamera, stopStream]);

  // Capture frame and compare with reference
  const handleScanFace = async () => {
    const video = videoRef.current;
    if (!video) return;

    setIsAnalyzing(true);
    setAuthFailed(null);

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    const size = Math.min(width, height);
    const startX = (width - size) / 2;
    const startY = (height - size) / 2;

    const canvas = document.createElement('canvas');
    const targetSize = 320;
    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsAnalyzing(false);
      return;
    }

    // Frontal mirror
    ctx.translate(targetSize, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, startX, startY, size, size, 0, 0, targetSize, targetSize);

    const liveDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedPhoto(liveDataUrl);

    try {
      const result = await compareFaces(referencePhotoUrl, liveDataUrl);
      setMatchResult(result);

      if (result.isMatch && result.score >= 60) {
        // Stop stream and call success
        stopStream();
        setTimeout(() => {
          onSuccess(result.score);
        }, 800);
      } else {
        // Beep alert
        playDivergenceBeep();
        setAuthFailed(`Rosto divergente do titular cadastrado (${result.score}% de similaridade). Acesso não autorizado!`);
        if (onFailure) onFailure('Divergência facial.');
      }
    } catch (err: any) {
      setAuthFailed('Erro ao processar análise biométrica. Tente novamente com boa iluminação.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const playDivergenceBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      // AudioContext not allowed or unsupported
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Validação Biométrica Facial</h3>
              <p className="text-[11px] text-amber-300 font-medium">Titular: {userName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewfinder */}
        <div className="p-5 flex flex-col items-center">
          {cameraError ? (
            <div className="w-full p-4 rounded-2xl bg-red-950/40 border border-red-800/80 text-red-300 text-xs flex items-start gap-2.5 my-4">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Acesso à câmera bloqueado</p>
                <p className="text-[11px] mt-1 text-slate-300">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="mt-3 px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
                </button>
              </div>
            </div>
          ) : (
            <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-amber-500/70 shadow-2xl bg-black my-2 flex items-center justify-center">
              {isInitializing ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                  <span>Iniciando câmera frontal...</span>
                </div>
              ) : capturedPhoto && !isAnalyzing ? (
                <img src={capturedPhoto} alt="Foto Capturada" className="w-full h-full object-cover" />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                  {/* Facial Scanner Radar Overlay */}
                  <div className="absolute inset-0 border-2 border-amber-400/40 rounded-full pointer-events-none animate-pulse"></div>
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-amber-400/70 shadow-[0_0_10px_#f59e0b] pointer-events-none animate-bounce"></div>
                </>
              )}
            </div>
          )}

          {/* Feedback messages */}
          {authFailed && (
            <div className="w-full mt-3 p-3 bg-red-950/60 border border-red-700/80 rounded-2xl text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-semibold text-[11px]">{authFailed}</span>
            </div>
          )}

          {matchResult && matchResult.isMatch && (
            <div className="w-full mt-3 p-3 bg-emerald-950/60 border border-emerald-600/80 rounded-2xl text-emerald-200 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold">Biometria Aprovada ({matchResult.score}%)</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full">
                Liberando...
              </span>
            </div>
          )}

          <p className="text-[11px] text-slate-400 text-center mt-3 max-w-xs">
            Posicione seu rosto dentro do círculo e clique em{' '}
            <strong className="text-white">Validar Biometria</strong> para desbloquear seu acesso.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full mt-5">
            {capturedPhoto && !matchResult?.isMatch ? (
              <button
                type="button"
                onClick={startCamera}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </button>
            ) : (
              <button
                type="button"
                onClick={handleScanFace}
                disabled={isAnalyzing || isInitializing || !!cameraError}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analisando Face...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Validar Biometria Facial
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
