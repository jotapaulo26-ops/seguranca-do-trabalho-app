import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, X, Check, Sparkles, Scan } from 'lucide-react';
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
          setStatusMessage('Posicione o rosto: Reconhecimento Face ID ativo...');
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

  // Keep stream alive if video element attaches late
  useEffect(() => {
    if (isOpen && streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isOpen, isInitializing]);

  // Automatic Face ID continuous scanning loop
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

      // Timeout reached: stop scanning and request retry
      if (elapsed >= TIMEOUT_MS) {
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        playDivergenceBeep();
        setScanStatus('timeout');
        setAuthFailed('Rosto não reconhecido ou iluminação insuficiente. Posicione seu rosto de frente para a câmera e tente novamente.');
        if (onFailure) onFailure('Tempo esgotado na validação biométrica.');
        return;
      }

      // Capture frame to offscreen canvas
      isComparingRef.current = true;
      setStatusMessage('Escaneando feições em tempo real...');

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
          // Mirroring frontal camera
          ctx.translate(targetSize, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, startX, startY, size, size, 0, 0, targetSize, targetSize);

          const liveDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const result = await compareFaces(referencePhotoUrl, liveDataUrl);

          // Threshold: score >= 58 is a match for the registered user
          if (result.isMatch && result.score >= 58 && !hasMatchedRef.current) {
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
    }, 350); // Scans every 350ms

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [isOpen, isInitializing, cameraError, referencePhotoUrl, scanStatus, stopStream, onSuccess, onFailure]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold transition-colors ${
              scanStatus === 'approved'
                ? 'bg-emerald-500/20 text-emerald-400'
                : scanStatus === 'timeout'
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm text-white">Face ID Automático</h3>
                <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 font-bold rounded-md">
                  Hands-free
                </span>
              </div>
              <p className="text-[11px] text-amber-300 font-medium truncate max-w-[240px]">Colaborador: {userName}</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
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
                <p className="font-bold">Acesso à câmera indisponível</p>
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
            <div className="relative my-2 flex items-center justify-center">
              {/* Outer Pulsing Radar Ring */}
              <div
                className={`absolute -inset-3 rounded-full transition-all duration-300 pointer-events-none ${
                  scanStatus === 'approved'
                    ? 'border-4 border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.6)] animate-pulse'
                    : scanStatus === 'timeout'
                    ? 'border-4 border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                    : 'border-2 border-dashed border-amber-400/80 animate-[spin_6s_linear_infinite]'
                }`}
              />

              {/* Viewfinder Circle */}
              <div className={`relative w-64 h-64 rounded-full overflow-hidden border-4 shadow-2xl bg-black flex items-center justify-center transition-colors duration-300 ${
                scanStatus === 'approved'
                  ? 'border-emerald-500 ring-4 ring-emerald-500/30'
                  : scanStatus === 'timeout'
                  ? 'border-rose-500 ring-4 ring-rose-500/30'
                  : 'border-amber-500'
              }`}>
                {/* Permanent Video Element in DOM to ensure tracks are always wired */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform scale-x-[-1] ${
                    capturedPhoto ? 'hidden' : 'block'
                  }`}
                />

                {/* If snapshot captured and analyzing or result shown */}
                {capturedPhoto && (
                  <img
                    src={capturedPhoto}
                    alt="Foto Capturada"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}

                {/* Loading Spinner Overlay while camera starts */}
                {isInitializing && !capturedPhoto && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2 text-slate-300 text-xs">
                    <RefreshCw className="w-7 h-7 animate-spin text-amber-500" />
                    <span className="font-semibold">Iniciando Face ID...</span>
                  </div>
                )}

                {/* Active Facial Scanning Radar Laser Line */}
                {!isInitializing && !capturedPhoto && scanStatus === 'scanning' && (
                  <>
                    <div className="absolute inset-0 border border-amber-400/30 rounded-full pointer-events-none"></div>
                    <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_#f59e0b] pointer-events-none animate-bounce"></div>
                    <div className="absolute top-3 right-4 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded-full text-[10px] font-mono text-amber-300 font-bold border border-amber-500/40">
                      {8 - scanSeconds}s
                    </div>
                  </>
                )}

                {/* Approved Success Overlay Icon */}
                {scanStatus === 'approved' && (
                  <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in zoom-in-95 duration-200">
                    <div className="w-14 h-14 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/50 mb-1">
                      <Check className="w-8 h-8 stroke-[3]" />
                    </div>
                    <span className="text-xs font-black text-white">RECONHECIDO</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dynamic Status Bar */}
          <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold">
            {scanStatus === 'scanning' && (
              <span className="flex items-center gap-2 text-amber-300">
                <Scan className="w-4 h-4 animate-pulse text-amber-400" />
                {statusMessage}
              </span>
            )}
            {scanStatus === 'approved' && matchResult && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Sparkles className="w-4 h-4 text-emerald-300" />
                Biometria Aprovada ({matchResult.score}%) • Liberando Acesso...
              </span>
            )}
            {scanStatus === 'timeout' && (
              <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Rosto não reconhecido
              </span>
            )}
          </div>

          {/* Feedback messages */}
          {authFailed && (
            <div className="w-full mt-3 p-3 bg-red-950/70 border border-red-700 rounded-2xl text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-medium text-[11px] leading-tight">{authFailed}</span>
            </div>
          )}

          <p className="text-[11px] text-slate-400 text-center mt-2 max-w-xs">
            {scanStatus === 'scanning' ? (
              <>Basta olhar diretamente para a câmera. O sistema reconhece e <strong className="text-white">libera o acesso automaticamente</strong>.</>
            ) : scanStatus === 'timeout' ? (
              <>Certifique-se de estar em um local iluminado e clique abaixo para tentar novamente.</>
            ) : (
              <>Acesso validado com sucesso.</>
            )}
          </p>

          {/* Action Buttons: Only shown if timeout occurs or camera error */}
          {scanStatus === 'timeout' && (
            <div className="flex items-center gap-2.5 w-full mt-4 animate-in fade-in">
              <button
                type="button"
                onClick={startCamera}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Reconhecimento Novamente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
