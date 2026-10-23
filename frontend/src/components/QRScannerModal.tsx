import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Image, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const containerId = 'interactive-qr-reader-region';

  useEffect(() => {
    if (!isOpen) return;

    setCameraError(null);
    setScanResult(null);

    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            handleDecodedText(decodedText);
          },
          () => {
            // scan failure callback (ignored for frame-by-frame)
          }
        );
        setScanning(true);
      } catch (err: any) {
        console.error('Erro ao iniciar câmera:', err);
        setCameraError(
          err?.message ||
          'Não foi possível acessar a câmera do dispositivo. Verifique as permissões de vídeo do seu navegador.'
        );
      }
    };

    // Small delay to ensure container element is mounted
    const timer = setTimeout(() => {
      startScanner();
    }, 200);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  const handleDecodedText = (decodedText: string) => {
    if (scanResult) return; // Prevent multiple triggers
    setScanResult(decodedText);

    // Provide haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    // Stop camera
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
    }

    setTimeout(() => {
      onClose();
      dispatchScannedContent(decodedText);
    }, 600);
  };

  const dispatchScannedContent = (rawText: string) => {
    try {
      // 1. If it's a full URL containing /qr
      if (rawText.includes('/qr')) {
        const url = new URL(rawText, window.location.origin);
        navigate(`/qr${url.search}`);
        return;
      }

      // 2. If it's a URL to /assinar-documento
      if (rawText.includes('/assinar-documento')) {
        const url = new URL(rawText, window.location.origin);
        navigate(`/assinar-documento${url.search}`);
        return;
      }

      // 3. If it's a JSON payload (legacy tags)
      if (rawText.startsWith('{') && rawText.endsWith('}')) {
        const parsed = JSON.parse(rawText);
        if (parsed.type === 'EXTINGUISHER' || parsed.agent) {
          navigate(`/qr?type=extinguisher&id=${parsed.id || parsed.code}`);
          return;
        }
        if (parsed.spotId || parsed.type === 'SEG_RISK_SPOT') {
          navigate(`/qr?type=risk&id=${parsed.spotId || parsed.id}`);
          return;
        }
      }

      // 4. If it's a plain string with code (e.g. EXT-01 or SEG-RISCO-01)
      if (rawText.startsWith('EXT-')) {
        navigate(`/brigada?search=${rawText}`);
        return;
      }

      // Default fallback
      alert(`Código lido: ${rawText}`);
    } catch (err) {
      console.error('Erro ao processar código lido:', err);
      alert(`Conteúdo lido: ${rawText}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId);
      }
      const decodedText = await scannerRef.current.scanFile(file, true);
      handleDecodedText(decodedText);
    } catch (err: any) {
      alert('Nenhum código QR nítido foi encontrado na imagem selecionada.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 shadow-2xl relative overflow-hidden flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-white text-base">Leitor de QR Code SST</h3>
              <p className="text-[11px] text-slate-400">Aponte para placas de risco, extintores ou crachás</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video / Camera Reader Region */}
        <div className="w-full relative rounded-2xl overflow-hidden bg-black aspect-square flex items-center justify-center border border-slate-800 shadow-inner">
          <div id={containerId} className="w-full h-full" />

          {/* Scanner Aim Overlay */}
          {!cameraError && !scanResult && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-dashed border-amber-400/80 rounded-2xl relative flex items-center justify-center">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-amber-400 -mt-1 -ml-1 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-amber-400 -mt-1 -mr-1 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-amber-400 -mb-1 -ml-1 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-amber-400 -mb-1 -mr-1 rounded-br-lg" />
                <span className="text-[11px] font-bold text-amber-300 bg-slate-950/80 px-2 py-1 rounded-full backdrop-blur-sm">
                  Posicione a etiqueta aqui
                </span>
              </div>
            </div>
          )}

          {/* Success Indicator Overlay */}
          {scanResult && (
            <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center text-center p-4 animate-in fade-in">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-bounce mb-2" />
              <h4 className="text-lg font-black text-white">QR Code Reconhecido!</h4>
              <p className="text-xs text-emerald-300 mt-1">Redirecionando para a função...</p>
            </div>
          )}

          {/* Camera Permission / Error State */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
              <h4 className="text-sm font-black text-white">Câmera Indisponível</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">{cameraError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-colors"
              >
                <Image className="w-4 h-4" />
                Carregar Foto da Galeria
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="w-full mt-4 flex items-center justify-between gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-colors"
          >
            <Image className="w-4 h-4 text-amber-400" />
            Ler de Imagem/Arquivo
          </button>

          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
