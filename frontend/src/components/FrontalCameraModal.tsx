import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Check, AlertCircle, Scan, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react';
import { compareFaces, BiometricMatchResult } from '../services/facialBiometrics';

interface FrontalCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (compressedDataUrl: string) => void;
  title?: string;
  workerName?: string;
  referencePhotoUrl?: string | null;
}

export const FrontalCameraModal: React.FC<FrontalCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Captura de Presença Facial',
  workerName,
  referencePhotoUrl
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const isComparingRef = useRef(false);
  const hasMatchedRef = useRef(false);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Auto Face ID state
  const isAutoMode = Boolean(referencePhotoUrl && referencePhotoUrl.length > 20);
  const [autoStatus, setAutoStatus] = useState<'starting' | 'scanning' | 'approved' | 'timeout'>('starting');
  const [autoMessage, setAutoMessage] = useState('Iniciando Face ID...');
  const [matchResult, setMatchResult] = useState<BiometricMatchResult | null>(null);
  const [scanSeconds, setScanSeconds] = useState(0);

  // Harmonic success chime
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
    } catch (e) {}
  };

  // Divergence alert beep
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
    } catch (e) {}
  };

  // Stop camera helper
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

  // Initialize camera with facingMode (default: 'user' - frontal)
  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    stopStream();
    setCameraError(null);
    setIsInitializing(true);
    setCapturedImage(null);
    setMatchResult(null);
    setScanSeconds(0);
    hasMatchedRef.current = false;
    isComparingRef.current = false;
    setAutoStatus('starting');
    setAutoMessage('Iniciando câmera...');

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play().then(() => {
            setIsInitializing(false);
            setAutoStatus('scanning');
            setAutoMessage('Reconhecimento Face ID ativo...');
          }).catch(() => {
            setIsInitializing(false);
            setAutoStatus('scanning');
          });
        };
      }
    } catch (err: any) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = fallbackStream;
          video.onloadedmetadata = () => {
            video.play().then(() => {
              setIsInitializing(false);
              setAutoStatus('scanning');
            }).catch(() => {
              setIsInitializing(false);
              setAutoStatus('scanning');
            });
          };
        }
      } catch (fallbackErr: any) {
        setIsInitializing(false);
        setCameraError('Não foi possível acessar a câmera do dispositivo. Verifique as permissões de vídeo no navegador.');
      }
    }
  }, [stopStream]);

  // Start on modal open, stop on close
  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startCamera, stopStream]);

  // Keep stream wired if element was late
  useEffect(() => {
    if (isOpen && streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isOpen, isInitializing]);

  // Automatic Face ID scanning loop when referencePhotoUrl is present
  useEffect(() => {
    if (!isOpen || !isAutoMode || isInitializing || !!cameraError || !referencePhotoUrl) {
      return;
    }

    if (hasMatchedRef.current || autoStatus === 'approved' || autoStatus === 'timeout') {
      return;
    }

    const startTime = Date.now();
    const TIMEOUT_MS = 8500; // 8.5s limit

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
        setAutoStatus('timeout');
        setAutoMessage('Rosto não reconhecido com o titular.');
        return;
      }

      isComparingRef.current = true;
      setAutoMessage('Escaneando feições em tempo real...');

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
          if (facingMode === 'user') {
            ctx.translate(targetSize, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, startX, startY, size, size, 0, 0, targetSize, targetSize);

          const liveDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const result = await compareFaces(referencePhotoUrl, liveDataUrl);

          if (result.isMatch && result.score >= 58 && !hasMatchedRef.current) {
            hasMatchedRef.current = true;
            if (scanIntervalRef.current) {
              clearInterval(scanIntervalRef.current);
              scanIntervalRef.current = null;
            }

            setCapturedImage(liveDataUrl);
            setMatchResult(result);
            setAutoStatus('approved');
            setAutoMessage(`Face ID Aprovado (${result.score}%)! Confirmando...`);
            playSuccessChime();

            setTimeout(() => {
              stopStream();
              onCapture(liveDataUrl);
              onClose();
            }, 650);
            return;
          }
        }
      } catch (err) {
        // Continue scanning next tick
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
  }, [isOpen, isAutoMode, isInitializing, cameraError, referencePhotoUrl, autoStatus, facingMode, stopStream, onCapture, onClose]);

  // Toggle between Frontal and Rear camera
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
  };

  // Manual fallback capture
  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;

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
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(targetSize, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, startX, startY, size, size, 0, 0, targetSize, targetSize);
    const compressedUrl = canvas.toDataURL('image/jpeg', 0.78);
    setCapturedImage(compressedUrl);
    stopStream();
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
              isAutoMode ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {isAutoMode ? <ShieldCheck className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm text-white">
                  {isAutoMode ? 'Face ID Automático' : title}
                </h3>
                {isAutoMode && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 font-bold rounded-md">
                    Hands-free
                  </span>
                )}
              </div>
              {workerName && (
                <p className="text-[11px] text-amber-300 font-medium truncate max-w-[240px]">
                  Colaborador: {workerName}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="p-4 flex flex-col items-center">
          <div className={`relative w-72 h-72 rounded-2xl overflow-hidden bg-slate-950 border-2 shadow-inner flex items-center justify-center transition-colors duration-300 ${
            isAutoMode && autoStatus === 'approved'
              ? 'border-emerald-500 ring-4 ring-emerald-500/30'
              : isAutoMode && autoStatus === 'timeout'
              ? 'border-rose-500 ring-4 ring-rose-500/30'
              : 'border-slate-700'
          }`}>
            {cameraError ? (
              <div className="p-6 text-center text-rose-300 flex flex-col items-center gap-3">
                <AlertCircle className="w-10 h-10 text-rose-500" />
                <p className="text-xs font-semibold">{cameraError}</p>
                <button
                  onClick={() => startCamera(facingMode)}
                  className="mt-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-white border border-slate-600"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : capturedImage ? (
              <div className="relative w-full h-full">
                <img
                  src={capturedImage}
                  alt="Foto capturada"
                  className="w-full h-full object-cover rounded-2xl"
                />
                {isAutoMode && autoStatus === 'approved' && (
                  <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in zoom-in-95">
                    <div className="w-14 h-14 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/50 mb-1">
                      <Check className="w-8 h-8 stroke-[3]" />
                    </div>
                    <span className="text-xs font-black text-white">BIOMETRIA HOMOLOGADA</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />

                {isInitializing && (
                  <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-7 h-7 text-amber-500 animate-spin" />
                    <span className="text-xs text-slate-300 font-medium">Iniciando câmera...</span>
                  </div>
                )}

                {/* Facial Framing Overlay */}
                {!isInitializing && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className={`w-48 h-60 rounded-[50%] border-2 flex items-center justify-center transition-all ${
                      isAutoMode
                        ? 'border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse'
                        : 'border-dashed border-amber-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]'
                    }`}>
                      {isAutoMode && autoStatus === 'scanning' && (
                        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] animate-bounce"></div>
                      )}
                    </div>
                  </div>
                )}

                {isAutoMode && !isInitializing && autoStatus === 'scanning' && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded-full text-[10px] font-mono text-amber-300 font-bold border border-amber-500/40">
                    {8 - scanSeconds}s
                  </div>
                )}
              </>
            )}
          </div>

          {/* Dynamic Status / Instructions */}
          {isAutoMode ? (
            <div className="mt-3 flex flex-col items-center text-center">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                {autoStatus === 'scanning' && (
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Scan className="w-4 h-4 animate-pulse text-amber-400" />
                    {autoMessage}
                  </span>
                )}
                {autoStatus === 'approved' && matchResult && (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    Face ID Aprovado ({matchResult.score}%) • Homologando...
                  </span>
                )}
                {autoStatus === 'timeout' && (
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Rosto não identificado ou divergente
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                {autoStatus === 'scanning'
                  ? 'Olhe para a câmera. O reconhecimento é 100% automático e valida no mesmo instante.'
                  : autoStatus === 'timeout'
                  ? 'Ajuste a iluminação e clique em "Tentar Novamente" abaixo.'
                  : 'Presença confirmada com sucesso.'}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 mt-2 text-center max-w-xs">
              {capturedImage
                ? 'Verifique se a foto está nítida e bem iluminada para concluir.'
                : 'Posicione seu rosto dentro da moldura e clique em Capturar Foto.'}
            </p>
          )}
        </div>

        {/* Controls Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between gap-3">
          {isAutoMode ? (
            /* Auto Mode Footer */
            autoStatus === 'timeout' ? (
              <div className="flex items-center gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <RefreshCw className="w-4 h-4" />
                  Tentar Novamente
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  title="Alternar entre câmera frontal e traseira"
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>{facingMode === 'user' ? 'Frontal' : 'Traseira'}</span>
                </button>
                <span className="text-[11px] text-slate-500 font-medium">Reconhecimento sem clique</span>
              </div>
            )
          ) : (
            /* Manual Capture Mode Footer (First-time enrollment) */
            !capturedImage ? (
              <>
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  title="Alternar entre câmera frontal e traseira"
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  <span>{facingMode === 'user' ? 'Câmera Frontal' : 'Câmera Traseira'}</span>
                </button>

                <button
                  type="button"
                  onClick={takeSnapshot}
                  disabled={!!cameraError || isInitializing}
                  className="py-3 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capturar Foto</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Tirar Outra</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirm}
                  className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Aprovar e Usar Foto</span>
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};
