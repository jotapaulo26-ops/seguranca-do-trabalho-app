import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, ShieldCheck } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel?: () => void;
  title?: string;
  signerNameDefault?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  onCancel,
  title = 'Assinatura Digital de Conformidade SST',
  signerNameDefault = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState(signerNameDefault);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High resolution canvas scaling
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a'; // Navy 900
  }, []);

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

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-xl border border-slate-200 max-w-md w-full mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-5 h-5 text-amber-500" />
        <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Nome do Signatário / Cargo:
        </label>
        <input
          type="text"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Ex: Carlos Mendes - Técnico SST"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <p className="text-xs text-slate-500 mb-2">
        Desenhe sua assinatura abaixo (com o dedo no celular ou mouse no computador):
      </p>

      {/* Touch/Mouse Canvas */}
      <div className="relative border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50 touch-none">
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
          <span>X Assinatura Digital</span>
          <span>Validade Legal SST</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-2 mt-4">
        <button
          type="button"
          onClick={clearCanvas}
          className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Eraser className="w-4 h-4" />
          Limpar
        </button>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasDrawn}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors ${
              hasDrawn
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            Confirmar Assinatura
          </button>
        </div>
      </div>
    </div>
  );
};
