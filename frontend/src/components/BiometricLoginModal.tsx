import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, X, Check, Sparkles, Scan, Lightbulb } from 'lucide-react';
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
  const scanIntervalRef = useRef<any>(null);
  const isComparingRef = useRef(false);
  const hasMatchedRef = useRef(false);

  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'starting' | 'scanning' | 'approved' | 'timeout'>('starting');
  const [statusMessage, setStatusMessage] = useState('Iniciando câmera frontal...');
  const [matchResult, setMatchResult] = useState<BiometricMatchResult | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState<string | null>(null);
  const [scanSeconds, setScanSeconds] = useState(0);

  // Screen Flash Ring Light (defaults to TRUE to illuminate operator's face with full-screen pure white)
  const [screenFlash, setScreenFlash] = useState(true);

  // Play pleasant harmonic ascending chime on Face ID approval
  const playSuccessChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.09 + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.09);
        osc.stop(ctx.currentTime + idx * 0.09 + 0.4);
      });
    } catch (e) {
      // AudioContext not permitted or unsupported
    }
  };

  // Play divergence alert sound on timeout/failure
  const playDivergenceBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      // AudioContext not permitted or unsupported
    }
  };

  // Keep screen bright & awake via Screen Wake Lock API
  useEffect(() => {
    let wakeLockSentinel: any = null;
    if (isOpen && typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
      (navigator as any).wakeLock.request('screen').then((lock: any) => {
        wakeLockSentinel = lock;
      }).catch(() => {});
    }
    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [isOpen]);

  const stopStream = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const attachStreamToVideo = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play().then(() => {
          setIsInitializing(false);
          setScanStatus('scanning');
          setStatusMessage('Posicione o rosto no círculo central...');
        }).catch(() => {
          setIsInitializing(false);
          setScanStatus('scanning');
        });
      };
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setCameraError(null);
    setAuthFailed(null);
    setMatchResult(null);
    setCapturedPhoto(null);
    setIsInitializing(true);
    setScanStatus('starting');
    setStatusMessage('Iniciando câmera frontal...');
    setScanSeconds(0);
    hasMatchedRef.current = false;
    isComparingRef.current = false;

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
      attachStreamToVideo(stream);
    } catch (err) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        attachStreamToVideo(fallbackStream);
      } catch (fallbackErr) {
        setIsInitializing(false);
        setCameraError('Permissão de câmera não concedida. Por favor, autorize o acesso à câmera frontal para validar sua biometria.');
      }
    }
  }, [stopStream, attachStreamToVideo]);

  // Start on modal open, stop on close
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

  // Keep stream wired if element was late
  useEffect(() => {
    if (isOpen && streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isOpen, isInitializing]);

  // Automatic Face ID scanning loop
  useEffect(() => {
    if (!isOpen || isInitializing || !!cameraError || !referencePhotoUrl) {
      return;
    }

    if (hasMatchedRef.current || scanStatus === 'approved' || scanStatus === 'timeout') {
      return;
    }

    const startTime = Date.now();
    const TIMEOUT_MS = 8500; // 8.5 seconds limit

    scanIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || isComparingRef.current || hasMatchedRef.current) {
        return;
      }

      const elapsed = Date.now() - startTime;
      setScanSeconds(Math.floor(elapsed / 1000));

      if (elapsed >= TIMEOUT_MS) {
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        playDivergenceBeep();
        setScanStatus('timeout');
        setStatusMessage('Rosto divergente do titular cadastrado.');
        setAuthFailed('A similaridade biométrica não atingiu a margem de segurança. Ajuste a posição do rosto e tente novamente.');
        if (onFailure) {
          onFailure('Rosto divergente da biometria cadastrada. Acesso não autorizado.');
        }
        return;
      }

      isComparingRef.current = true;

      try {
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

        if (ctx) {
          ctx.translate(targetSize, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, startX, startY, size, size, 0, 0, targetSize, targetSize);

          const liveDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const result = await compareFaces(referencePhotoUrl, liveDataUrl);

          if (result.isMatch && result.score >= 60 && !hasMatchedRef.current) {
            hasMatchedRef.current = true;
            if (scanIntervalRef.current) {
              clearInterval(scanIntervalRef.current);
              scanIntervalRef.current = null;
            }

            setCapturedPhoto(liveDataUrl);
            setMatchResult(result);
            setScanStatus('approved');
            setStatusMessage(`Face ID Aprovado (${result.score}%)! Liberando acesso...`);
            playSuccessChime();

            setTimeout(() => {
              stopStream();
              onSuccess(result.score);
            }, 650);
            return;
          }
        }
      } catch (err) {
        // Continue scanning silently next interval
      } finally {
        isComparingRef.current = false;
      }
    }, 350);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [isOpen, isInitializing, cameraError, referencePhotoUrl, scanStatus, stopStream, onSuccess, onFailure]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[100000] flex flex-col items-center justify-between p-4 sm:p-6 transition-colors duration-300 animate-in fade-in select-none ${
        screenFlash ? 'bg-white text-slate-950' : 'bg-slate-950/95 text-white backdrop-blur-md'
      }`}
    >
      {/* Top Header Controls */}
      <div className="w-full max-w-lg flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold shadow-md transition-colors ${
              screenFlash
                ? 'bg-amber-500 text-slate-950 border border-amber-400'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className={`font-black text-sm tracking-tight ${screenFlash ? 'text-slate-950' : 'text-white'}`}>
                Face ID Automático
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 font-bold rounded-md uppercase font-mono ${
                  screenFlash
                    ? 'bg-amber-100 text-amber-950 border border-amber-300'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                Hands-free
              </span>
            </div>
            <p className={`text-xs font-semibold truncate max-w-[220px] ${screenFlash ? 'text-slate-700' : 'text-amber-300'}`}>
              Titular: {userName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Screen Flash Ring Light */}
          <button
            type="button"
            onClick={() => setScreenFlash(!screenFlash)}
            title={screenFlash ? 'Desativar flash de tela branca' : 'Ativar flash de tela branca para iluminar o rosto'}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 border ${
              screenFlash
                ? 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Lightbulb className={`w-4 h-4 ${screenFlash ? 'text-amber-600 fill-amber-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline text-[11px] font-black">
              {screenFlash ? 'Flash Ring Light ON' : 'Flash OFF'}
            </span>
          </button>

          {/* Close Modal */}
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className={`p-2 rounded-xl transition-colors ${
              screenFlash ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Central Viewfinder Circle with Ring Light */}
      <div className="relative my-auto flex flex-col items-center justify-center">
        {cameraError ? (
          <div className="w-full max-w-sm p-5 rounded-3xl bg-red-50 border-2 border-red-300 text-red-900 text-xs flex flex-col items-center text-center gap-2 shadow-xl">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <p className="font-extrabold text-sm">Câmera indisponível</p>
            <p className="text-[11px] text-red-800">{cameraError}</p>
            <button
              onClick={startCamera}
              className="mt-3 px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md"
            >
              <RefreshCw className="w-4 h-4" /> Tentar Novamente
            </button>
          </div>
        ) : (
          <>
            {/* Pulsing Aura */}
            <div
              className={`absolute -inset-4 sm:-inset-6 rounded-full transition-all duration-300 pointer-events-none ${
                scanStatus === 'approved'
                  ? 'border-4 border-emerald-500 shadow-[0_0_60px_rgba(16,185,129,0.9)] animate-pulse'
                  : scanStatus === 'timeout'
                  ? 'border-4 border-rose-600 shadow-[0_0_50px_rgba(225,29,72,0.8)]'
                  : screenFlash
                  ? 'border-4 border-amber-400 shadow-[0_0_60px_rgba(245,158,11,0.6)] animate-pulse'
                  : 'border-2 border-dashed border-amber-400/80 animate-[spin_6s_linear_infinite]'
              }`}
            />

            {/* Circular Viewfinder Window (Only area to see face) */}
            <div
              className={`relative w-72 h-72 sm:w-84 sm:h-84 rounded-full overflow-hidden border-4 shadow-2xl bg-black flex items-center justify-center transition-all duration-300 ${
                scanStatus === 'approved'
                  ? 'border-emerald-500 ring-8 ring-emerald-500/40 shadow-[0_0_70px_rgba(16,185,129,0.8)]'
                  : scanStatus === 'timeout'
                  ? 'border-rose-600 ring-8 ring-rose-500/40 shadow-[0_0_60px_rgba(225,29,72,0.7)]'
                  : 'border-slate-950 ring-4 ring-amber-400/50 shadow-[0_0_50px_rgba(0,0,0,0.35)]'
              }`}
            >
              {/* Permanent Video Element in DOM */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform scale-x-[-1] ${
                  capturedPhoto ? 'hidden' : 'block'
                }`}
              />

              {/* If snapshot captured */}
              {capturedPhoto && (
                <img
                  src={capturedPhoto}
                  alt="Foto Capturada"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}

              {/* Loading Spinner */}
              {isInitializing && !capturedPhoto && (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 text-slate-200 text-xs">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                  <span className="font-bold">Iniciando câmera...</span>
                </div>
              )}

              {/* Active Facial Scanning Radar Laser Line */}
              {!isInitializing && !capturedPhoto && scanStatus === 'scanning' && (
                <>
                  <div className="absolute inset-0 border-2 border-amber-400/40 rounded-full pointer-events-none"></div>
                  <div className="absolute left-6 right-6 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_#f59e0b] pointer-events-none animate-bounce"></div>
                  <div className="absolute top-4 px-3 py-1 bg-slate-950/80 backdrop-blur-md rounded-full text-xs font-mono text-amber-300 font-black border border-amber-500/50 shadow-lg">
                    {8 - scanSeconds}s
                  </div>
                </>
              )}

              {/* Approved Success Overlay Icon */}
              {scanStatus === 'approved' && (
                <div className="absolute inset-0 bg-emerald-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-xl shadow-emerald-500/60 mb-2">
                    <Check className="w-10 h-10 stroke-[3]" />
                  </div>
                  <span className="text-sm font-black text-white tracking-wide">RECONHECIDO</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Status & Instructions */}
      <div className="w-full max-w-md flex flex-col items-center text-center pb-3">
        <div className="flex items-center justify-center gap-2 text-sm font-extrabold mb-1">
          {scanStatus === 'scanning' && (
            <span className={`flex items-center gap-2 ${screenFlash ? 'text-amber-800' : 'text-amber-300'}`}>
              <Scan className="w-4 h-4 animate-pulse text-amber-500" />
              {statusMessage}
            </span>
          )}
          {scanStatus === 'approved' && matchResult && (
            <span className="flex items-center gap-1.5 text-emerald-600 font-black">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              Biometria Aprovada ({matchResult.score}%) • Liberando Acesso...
            </span>
          )}
          {scanStatus === 'timeout' && (
            <span className="flex items-center gap-1.5 text-rose-600 font-black">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Rosto não reconhecido
            </span>
          )}
        </div>

        <p className={`text-xs max-w-xs leading-relaxed ${screenFlash ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
          {scanStatus === 'scanning' ? (
            <>Olhe para o círculo central. A tela branca funciona como <strong className={screenFlash ? 'text-slate-900 font-bold' : 'text-white'}>iluminação frontal para o seu rosto</strong>.</>
          ) : scanStatus === 'timeout' ? (
            <>Mantenha o rosto centralizado no círculo e clique no botão abaixo para tentar novamente.</>
          ) : (
            <>Identidade validada com sucesso.</>
          )}
        </p>

        {authFailed && (
          <div className="w-full mt-2 p-2.5 bg-red-100 border border-red-300 rounded-xl text-red-900 text-xs font-semibold flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{authFailed}</span>
          </div>
        )}

        {scanStatus === 'timeout' && (
          <button
            type="button"
            onClick={startCamera}
            className="mt-3 py-3 px-6 rounded-2xl bg-slate-950 hover:bg-slate-900 text-white text-xs font-black flex items-center gap-2 shadow-xl active:scale-95 transition-all"
          >
            <RefreshCw className="w-4 h-4 text-amber-400" />
            Tentar Reconhecimento Novamente
          </button>
        )}
      </div>
    </div>
  );
};
