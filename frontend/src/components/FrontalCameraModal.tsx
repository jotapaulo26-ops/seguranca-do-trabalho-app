import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Check, AlertCircle, Scan, Sparkles, ShieldCheck, AlertTriangle, Fingerprint, Smile, Activity, Lightbulb } from 'lucide-react';
import { 
  compareFaces, 
  BiometricMatchResult, 
  verifyLiveness, 
  evaluateDynamicLiveness, 
  DynamicLivenessType 
} from '../services/facialBiometrics';
import { authenticateWithDeviceBiometrics } from '../services/deviceBiometrics';
import { api } from '../services/api';

interface FrontalCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (compressedDataUrl: string, biometricType?: 'face' | 'fingerprint') => void;
  title?: string;
  workerName?: string;
  referencePhotoUrl?: string | null;
  requireLivenessChallenge?: boolean;
}

export const FrontalCameraModal: React.FC<FrontalCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Captura de Presença Facial',
  workerName,
  referencePhotoUrl,
  requireLivenessChallenge = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const isComparingRef = useRef(false);
  const hasMatchedRef = useRef(false);
  const prevPixelsRef = useRef<number[]>([]);
  const baselinePixelsRef = useRef<number[]>([]);
  const consecutiveMatchesRef = useRef<number>(0);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Dynamic Liveness State
  const [challengeType, setChallengeType] = useState<DynamicLivenessType>('smile');
  const [livenessPassed, setLivenessPassed] = useState<boolean>(!requireLivenessChallenge);
  const [livenessProgress, setLivenessProgress] = useState<number>(requireLivenessChallenge ? 0 : 100);
  const [livenessHint, setLivenessHint] = useState<string>(
    requireLivenessChallenge ? '😊 Dê um leve sorriso para comprovar presença viva' : 'Verificando presença...'
  );

  // Auto Face ID state
  const isAutoMode = Boolean(referencePhotoUrl && referencePhotoUrl.length > 20);
  const [autoStatus, setAutoStatus] = useState<'starting' | 'scanning' | 'approved' | 'timeout'>('starting');
  const [autoMessage, setAutoMessage] = useState('Iniciando Face ID...');
  const [matchResult, setMatchResult] = useState<BiometricMatchResult | null>(null);
  const [scanSeconds, setScanSeconds] = useState(0);

  // Screen Flash Ring Light (defaults to TRUE to illuminate operator's face with full-screen pure white)
  const [screenFlash, setScreenFlash] = useState(true);

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

  // Fallback state: fail counter and fingerprint status
  const [failCount, setFailCount] = useState(0);
  const [isAuthenticatingFingerprint, setIsAuthenticatingFingerprint] = useState(false);

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

  // Intermediate liveness completion chime
  const playLivenessTone = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
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

  // Log divergence snapshot with GPS to backend
  const logDivergenceSnapshot = (snapshotUrl?: string) => {
    try {
      const sendLog = (lat?: number, lng?: number) => {
        api.post('/audit/divergence', {
          workerName: workerName || 'Colaborador',
          attemptNumber: failCount + 1,
          snapshotPhotoUrl: snapshotUrl,
          lat,
          lng,
          reason: 'Divergência facial detectada (rosto diferente do cadastro ou liveness reprovado)'
        }).catch(() => {});
      };

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => sendLog(pos.coords.latitude, pos.coords.longitude),
          () => sendLog(),
          { timeout: 3500 }
        );
      } else {
        sendLog();
      }
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
    prevPixelsRef.current = [];
    baselinePixelsRef.current = [];
    consecutiveMatchesRef.current = 0;
    
    // Reset liveness based on prop
    const needsLiveness = requireLivenessChallenge;
    setLivenessPassed(!needsLiveness);
    setLivenessProgress(needsLiveness ? 0 : 100);
    setLivenessHint(
      needsLiveness 
        ? challengeType === 'smile' 
          ? '😊 Dê um leve sorriso para comprovar presença viva' 
          : '↔️ Incline levemente a cabeça para validar'
        : 'Verificando presença...'
    );

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
            setAutoMessage(needsLiveness ? 'Aguardando teste de vida...' : 'Reconhecimento Face ID ativo...');
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
  }, [stopStream, requireLivenessChallenge, challengeType]);

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

  // Switch challenge type manually
  const toggleChallengeType = () => {
    const nextType: DynamicLivenessType = challengeType === 'smile' ? 'tilt' : 'smile';
    setChallengeType(nextType);
    setLivenessProgress(0);
    setLivenessPassed(false);
    baselinePixelsRef.current = [];
    setLivenessHint(
      nextType === 'smile' 
        ? '😊 Dê um leve sorriso para comprovar presença viva' 
        : '↔️ Incline levemente a cabeça para validar'
    );
  };

  // High-Precision Face ID scanning loop with Dual-Layer Liveness & 2-Frame Consensus
  useEffect(() => {
    if (!isOpen || !isAutoMode || isInitializing || !!cameraError || !referencePhotoUrl) {
      return;
    }

    if (hasMatchedRef.current || autoStatus === 'approved' || autoStatus === 'timeout') {
      return;
    }

    const startTime = Date.now();
    // 11.5s timeout for dynamic liveness challenge; 8.5s for standard login
    const TIMEOUT_MS = requireLivenessChallenge ? 12000 : 8500;

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
        setFailCount((prev) => prev + 1);

        // Capture snapshot of the failed face for audit log
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 320;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, 320, 320);
            const snapshotUrl = canvas.toDataURL('image/jpeg', 0.65);
            logDivergenceSnapshot(snapshotUrl);
          }
        } catch (e) {}

        setAutoStatus('timeout');
        setAutoMessage('Rosto divergente do titular cadastrado.');
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
          if (facingMode === 'user') {
            ctx.translate(targetSize, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, startX, startY, size, size, 0, 0, targetSize, targetSize);

          const liveDataUrl = canvas.toDataURL('image/jpeg', 0.85);

          // Amostragem em 64x64 px para alta resolução de feições
          const analysisCanvas = document.createElement('canvas');
          analysisCanvas.width = 64;
          analysisCanvas.height = 64;
          const aCtx = analysisCanvas.getContext('2d');
          if (!aCtx) return;

          aCtx.drawImage(canvas, 0, 0, 64, 64);
          const imgData = aCtx.getImageData(0, 0, 64, 64).data;
          const currPixels64: number[] = [];
          for (let p = 0; p < imgData.length; p += 4) {
            currPixels64.push(Math.round(0.299 * imgData[p] + 0.587 * imgData[p + 1] + 0.114 * imgData[p + 2]));
          }

          // Inicializa frame base se ainda vazio
          if (baselinePixelsRef.current.length === 0) {
            baselinePixelsRef.current = [...currPixels64];
          }

          // CAMADA 1: Prova de Vida Passiva Contínua (Anti-Foto Estática)
          const passiveLiveness = verifyLiveness(prevPixelsRef.current, currPixels64);
          prevPixelsRef.current = currPixels64;

          if (!passiveLiveness.isLive) {
            setAutoMessage('Aviso: Movimente suavemente o rosto (Anti-Spoofing)');
            return;
          }

          // CAMADA 2: Desafio Dinâmico Interativo (Sorriso ou Inclinação)
          if (requireLivenessChallenge && !livenessPassed) {
            const dynamicResult = evaluateDynamicLiveness(
              challengeType,
              baselinePixelsRef.current,
              currPixels64,
              64
            );

            setLivenessProgress(dynamicResult.progress);
            setLivenessHint(dynamicResult.hint);

            if (dynamicResult.passed) {
              setLivenessPassed(true);
              playLivenessTone();
              setAutoMessage('Prova de vida OK! Verificando Face ID...');
            } else {
              setAutoMessage(dynamicResult.hint);
              return; // Bloqueia comparação biométrica até que o desafio de vida seja concluído
            }
          }

          // CAMADA 3: Comparação Facial Multizonal (Alta Precisão 65%)
          const result = await compareFaces(referencePhotoUrl, liveDataUrl);

          // Consenso Multi-Frame: Requer 2 frames consecutivos válidos (>= 65%)
          if (result.isMatch && result.score >= 65) {
            consecutiveMatchesRef.current += 1;

            if (consecutiveMatchesRef.current >= 2 && !hasMatchedRef.current) {
              hasMatchedRef.current = true;
              if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current);
                scanIntervalRef.current = null;
              }

              setCapturedImage(liveDataUrl);
              setMatchResult(result);
              setAutoStatus('approved');
              setAutoMessage(`✅ Face ID Confirmado (${result.score}%) + Prova de Vida OK`);
              playSuccessChime();

              setTimeout(() => {
                stopStream();
                onCapture(liveDataUrl, 'face');
                onClose();
              }, 700);
              return;
            } else {
              setAutoMessage(`Face detectada (${result.score}%) — Confirmando consenso...`);
            }
          } else {
            // Se um frame falhar, reseta o consenso para evitar falsos positivos
            consecutiveMatchesRef.current = 0;
            if (result.score >= 55) {
              setAutoMessage(`Alinhando... similaridade em ${result.score}% (Mínimo: 65%)`);
            } else {
              setAutoMessage('Aguardando alinhamento frontal do rosto...');
            }
          }
        }
      } catch (err) {
        // Continuar tentando no próximo tick
      } finally {
        isComparingRef.current = false;
      }
    }, 320);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [
    isOpen, 
    isAutoMode, 
    isInitializing, 
    cameraError, 
    referencePhotoUrl, 
    autoStatus, 
    facingMode, 
    requireLivenessChallenge, 
    livenessPassed, 
    challengeType, 
    stopStream, 
    onCapture, 
    onClose
  ]);

  // Fallback: Trigger Device Biometrics (Fingerprint / WebAuthn)
  const handleDeviceFingerprint = async () => {
    setIsAuthenticatingFingerprint(true);
    try {
      const res = await authenticateWithDeviceBiometrics(workerName || 'Colaborador');
      if (res.success) {
        playSuccessChime();
        setAutoStatus('approved');
        setAutoMessage('Digital do Aparelho Aprovada!');
        setTimeout(() => {
          stopStream();
          onCapture(capturedImage || referencePhotoUrl || '', 'fingerprint');
          onClose();
        }, 650);
      } else {
        playDivergenceBeep();
        alert(res.error || 'Falha ao autenticar com a digital do aparelho.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro no sensor de biometria digital.');
    } finally {
      setIsAuthenticatingFingerprint(false);
    }
  };

  // Toggle between Frontal and Rear camera
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
  };

  // Manual fallback capture
  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;

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

      if (!ctx) return;

      if (facingMode === 'user') {
        ctx.translate(targetSize, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, startX, startY, size, size, 0, 0, targetSize, targetSize);
      const photoUrl = canvas.toDataURL('image/jpeg', 0.82);
      setCapturedImage(photoUrl);
    } catch (err) {
      alert('Erro ao capturar foto. Tente novamente.');
    }
  };

  // Confirm manual photo
  const handleConfirm = () => {
    if (capturedImage) {
      stopStream();
      onCapture(capturedImage, 'face');
      onClose();
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-4 sm:p-6 transition-colors duration-300 animate-in fade-in select-none ${
        screenFlash ? 'bg-white text-slate-950' : 'bg-slate-950/90 text-white backdrop-blur-md'
      }`}
    >
      <div className={`relative w-full max-w-sm flex flex-col justify-between h-full ${
        screenFlash ? 'text-slate-950' : 'text-white'
      }`}>
        {/* Header */}
        <div className={`px-4 py-3 border rounded-2xl flex items-center justify-between shadow-sm transition-colors ${
          screenFlash ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              screenFlash ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-sm font-black ${screenFlash ? 'text-slate-950' : 'text-white'}`}>{title}</h3>
              <p className={`text-[11px] font-medium ${screenFlash ? 'text-slate-600' : 'text-slate-400'}`}>
                {workerName ? (
                  <>Titular: <span className={screenFlash ? 'text-amber-800 font-bold' : 'text-amber-300 font-semibold'}>{workerName}</span></>
                ) : (
                  'Posicione o rosto no círculo central'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Flash Light Toggle */}
            <button
              type="button"
              onClick={() => setScreenFlash(!screenFlash)}
              title={screenFlash ? 'Desativar flash de tela branca' : 'Ativar flash de tela branca'}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95 border ${
                screenFlash
                  ? 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              <Lightbulb className={`w-4 h-4 ${screenFlash ? 'text-amber-600 fill-amber-400' : 'text-slate-400'}`} />
            </button>

            <button
              onClick={() => {
                stopStream();
                onClose();
              }}
              className={`p-2 rounded-xl transition-colors ${
                screenFlash ? 'text-slate-500 hover:text-slate-950 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Circular Cutout (Only place where face is visible) */}
        <div className="relative my-auto flex flex-col items-center justify-center">
          <div className={`relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden bg-black shadow-2xl border-4 flex items-center justify-center transition-all duration-300 ${
            screenFlash
              ? 'border-slate-950 shadow-[0_0_60px_rgba(0,0,0,0.35)] ring-4 ring-amber-400/50'
              : 'border-slate-700 shadow-inner'
          }`}>
            {cameraError ? (
              <div className="p-4 text-center flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 text-rose-500" />
                <p className="text-xs text-rose-300 font-medium">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="mt-2 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : capturedImage ? (
              <div className="relative w-full h-full">
                <img
                  src={capturedImage}
                  alt="Foto capturada"
                  className="w-full h-full object-cover"
                />
                {isAutoMode && autoStatus === 'approved' && (
                  <div className="absolute inset-0 bg-emerald-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in zoom-in-95">
                    <div className="w-14 h-14 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/50 mb-1">
                      <Check className="w-8 h-8 stroke-[3]" />
                    </div>
                    <span className="text-xs font-black text-white">BIOMETRIA HOMOLOGADA</span>
                    <span className="text-[10px] text-emerald-200 font-mono mt-0.5">LIVENESS PASS 100%</span>
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

                {/* Facial Framing Overlay with Dynamic Ring */}
                {!isInitializing && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className={`w-48 h-60 rounded-[50%] border-2 flex items-center justify-center transition-all ${
                      isAutoMode
                        ? livenessPassed 
                          ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.6)] animate-pulse'
                          : 'border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                        : 'border-dashed border-amber-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]'
                    }`}>
                      {isAutoMode && autoStatus === 'scanning' && (
                        <div className={`w-full h-0.5 bg-gradient-to-r from-transparent ${
                          livenessPassed ? 'via-emerald-400' : 'via-amber-400'
                        } to-transparent shadow-[0_0_12px_#f59e0b] animate-bounce`}></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timer Pill */}
                {isAutoMode && !isInitializing && autoStatus === 'scanning' && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded-full text-[10px] font-mono text-amber-300 font-bold border border-amber-500/40">
                    {requireLivenessChallenge ? (12 - scanSeconds) : (8 - scanSeconds)}s
                  </div>
                )}
              </>
            )}
          </div>

          {/* DYNAMIC LIVENESS CHALLENGE BANNER */}
          {requireLivenessChallenge && isAutoMode && autoStatus === 'scanning' && (
            <div className={`w-full mt-3 p-3 rounded-2xl border flex flex-col gap-1.5 animate-in fade-in transition-colors ${
              screenFlash ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-sm' : 'bg-slate-950/70 border-slate-800 text-white'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {challengeType === 'smile' ? (
                    <Smile className={`w-4 h-4 ${livenessPassed ? 'text-emerald-500' : 'text-amber-600 animate-bounce'}`} />
                  ) : (
                    <Activity className={`w-4 h-4 ${livenessPassed ? 'text-emerald-500' : 'text-amber-600 animate-pulse'}`} />
                  )}
                  <span className={`text-[11px] font-extrabold ${livenessPassed ? 'text-emerald-700' : screenFlash ? 'text-slate-900' : 'text-amber-200'}`}>
                    {livenessPassed ? '✅ Prova de Vida Aprovada!' : livenessHint}
                  </span>
                </div>
                {!livenessPassed && (
                  <button
                    type="button"
                    onClick={toggleChallengeType}
                    title="Mudar tipo de desafio de vida"
                    className={`text-[9px] underline font-bold ${screenFlash ? 'text-slate-600 hover:text-black' : 'text-slate-400 hover:text-amber-300'}`}
                  >
                    Alternar teste
                  </button>
                )}
              </div>

              {/* Animated Progress Bar */}
              <div className={`w-full h-2 rounded-full overflow-hidden ${screenFlash ? 'bg-slate-200' : 'bg-slate-800'}`}>
                <div
                  className={`h-full transition-all duration-200 ${
                    livenessPassed ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'
                  }`}
                  style={{ width: `${livenessProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Dynamic Status / Instructions */}
          {isAutoMode ? (
            <div className="mt-2.5 flex flex-col items-center text-center">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                {autoStatus === 'scanning' && (
                  <span className={`flex items-center gap-1.5 font-black ${livenessPassed ? 'text-emerald-600' : screenFlash ? 'text-amber-800' : 'text-amber-300'}`}>
                    <Scan className="w-4 h-4 animate-pulse text-amber-500" />
                    {autoMessage}
                  </span>
                )}
                {autoStatus === 'approved' && matchResult && (
                  <span className="flex items-center gap-1.5 text-emerald-600 font-black">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    Face ID Aprovado ({matchResult.score}%) • Homologando...
                  </span>
                )}
                {autoStatus === 'timeout' && (
                  <span className="flex items-center gap-1.5 text-rose-600 font-black">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Rosto diferente do cadastro ({failCount}ª tentativa)
                  </span>
                )}
              </div>
              <p className={`text-[11px] mt-1 max-w-xs ${screenFlash ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                {autoStatus === 'scanning'
                  ? requireLivenessChallenge && !livenessPassed
                    ? 'Execute o movimento solicitado para validar que você está ao vivo em frente à câmera.'
                    : 'A tela branca ilumina o rosto. Mantenha o rosto alinhado no círculo.'
                  : autoStatus === 'timeout'
                  ? failCount >= 2
                    ? '2 falhas consecutivas: você pode tentar novamente ou assinar com a digital do aparelho abaixo.'
                    : 'Ajuste a iluminação e clique em "Tentar Novamente" abaixo.'
                  : 'Presença confirmada com sucesso.'}
              </p>
            </div>
          ) : (
            <p className={`text-[11px] mt-2 text-center max-w-xs ${screenFlash ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
              {capturedImage
                ? 'Verifique se a foto está nítida e bem iluminada para concluir.'
                : 'Posicione seu rosto dentro do círculo central e clique em Capturar Foto.'}
            </p>
          )}
        </div>

        {/* Controls Footer */}
        <div className={`p-3.5 border rounded-2xl flex flex-col gap-2.5 shadow-sm transition-colors ${
          screenFlash ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}>
          {isAutoMode ? (
            autoStatus === 'timeout' ? (
              <div className="flex flex-col gap-2 w-full animate-in fade-in">
                {/* Contingência com Digital do Aparelho (disponível se falhou 2 vezes) */}
                {failCount >= 2 && (
                  <button
                    type="button"
                    onClick={handleDeviceFingerprint}
                    disabled={isAuthenticatingFingerprint}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    <Fingerprint className="w-4 h-4 text-indigo-200" />
                    {isAuthenticatingFingerprint ? 'Aguardando Sensor Digital...' : 'Assinar com a Digital do Aparelho'}
                  </button>
                )}

                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    Tentar Facial Novamente
                  </button>

                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                      screenFlash ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    <span>{facingMode === 'user' ? 'Frontal' : 'Traseira'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  title="Alternar entre câmera frontal e traseira"
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                    screenFlash ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                  <span>{facingMode === 'user' ? 'Frontal' : 'Traseira'}</span>
                </button>
                <span className={`text-[11px] font-bold ${screenFlash ? 'text-slate-600' : 'text-slate-500'}`}>
                  Reconhecimento sem clique
                </span>
              </div>
            )
          ) : (
            /* Manual Capture Mode Footer (First-time enrollment) */
            !capturedImage ? (
              <div className="flex items-center justify-between gap-3 w-full">
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  title="Alternar entre câmera frontal e traseira"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors ${
                    screenFlash ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <RefreshCw className="w-4 h-4 text-amber-500" />
                  <span>{facingMode === 'user' ? 'Frontal' : 'Traseira'}</span>
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
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 w-full">
                <button
                  type="button"
                  onClick={handleRetake}
                  className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors ${
                    screenFlash ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
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
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
