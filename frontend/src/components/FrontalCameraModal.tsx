import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Check, AlertCircle } from 'lucide-react';

interface FrontalCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (compressedDataUrl: string) => void;
  title?: string;
  workerName?: string;
}

export const FrontalCameraModal: React.FC<FrontalCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Captura de Presença Facial',
  workerName
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Stop camera helper
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Initialize camera with facingMode (default: 'user' - frontal)
  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    stopStream();
    setCameraError(null);
    setIsInitializing(true);

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

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('[FrontalCamera] Erro ao acessar câmera:', err);
      // Fallback try without specific facingMode if first attempt failed
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr: any) {
        setCameraError('Não foi possível acessar a câmera do dispositivo. Verifique as permissões de vídeo no navegador.');
      }
    } finally {
      setIsInitializing(false);
    }
  }, [stopStream]);

  // Start on modal open, stop on close
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      startCamera(facingMode);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startCamera, stopStream]);

  // Toggle between Frontal and Rear camera
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
  };

  // Capture frame from video, crop center square and compress to 320x320 px WebP/JPEG
  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    // Determine square center crop
    const size = Math.min(width, height);
    const startX = (width - size) / 2;
    const startY = (height - size) / 2;

    const canvas = document.createElement('canvas');
    const targetSize = 320; // 320x320 px (ultra-lightweight ~25KB)
    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If user facing (frontal), flip horizontally for mirror effect natural feel
    if (facingMode === 'user') {
      ctx.translate(targetSize, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, startX, startY, size, size, 0, 0, targetSize, targetSize);

    // Compress to JPEG 0.78 (~25KB payload)
    const compressedUrl = canvas.toDataURL('image/jpeg', 0.78);
    setCapturedImage(compressedUrl);
    stopStream();
  };

  // Confirm photo
  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
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
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">{title}</h3>
              {workerName && <p className="text-[11px] text-amber-300 font-medium">Colaborador: {workerName}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="p-4 flex flex-col items-center">
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-700 shadow-inner flex items-center justify-center">
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
              <img
                src={capturedImage}
                alt="Foto capturada"
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
                {isInitializing && (
                  <div className="absolute inset-0 bg-slate-950/60 flex flex-col items-center justify-center gap-2">
                    <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-slate-300 font-medium">Iniciando câmera frontal...</span>
                  </div>
                )}
                {/* Facial Oval Framing Overlay */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-48 h-60 rounded-[50%] border-2 border-dashed border-amber-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] flex items-center justify-center">
                    <span className="text-[10px] text-amber-300 font-semibold uppercase tracking-wider bg-slate-950/70 px-2 py-0.5 rounded-full border border-amber-400/40 mt-36">
                      Enquadre o Rosto
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-2 text-center">
            {capturedImage
              ? 'Verifique se o rosto está nítido e bem iluminado.'
              : 'Olhe para a câmera frontal para validação biométrica de presença.'}
          </p>
        </div>

        {/* Controls Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between gap-3">
          {!capturedImage ? (
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
          )}
        </div>
      </div>
    </div>
  );
};
