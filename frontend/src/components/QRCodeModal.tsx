import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { RiskLocation } from '../types';
import { X, Printer, Download, QrCode, ShieldAlert } from 'lucide-react';

interface QRCodeModalProps {
  location: RiskLocation | null;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ location, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!location) return;

    const payload = JSON.stringify({
      app: 'SegTrabalho',
      spotId: location.id,
      name: location.name,
      riskType: location.risk_type,
      lat: location.lat,
      lng: location.lng
    });

    QRCode.toDataURL(payload, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).then(setQrDataUrl).catch(console.error);
  }, [location]);

  if (!location) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QRCode_SST_${location.name.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Printable Card Area */}
        <div id="printable-qr-card" className="text-center p-2 border-2 border-slate-900 rounded-2xl bg-white mb-4">
          <div className="bg-slate-900 text-white py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="font-black text-xs tracking-wider uppercase">PONTO DE RISCO SST</span>
          </div>

          <h3 className="font-extrabold text-slate-900 text-base mb-1 leading-tight">{location.name}</h3>

          <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase mb-3 bg-amber-100 text-amber-900">
            {location.risk_type === 'altura'
              ? '🧗 Trabalho em Altura (NR-35)'
              : location.risk_type === 'espaco_confinado'
              ? '🕳️ Espaço Confinado (NR-33)'
              : '⚠️ Risco Duplo (NR-35 / NR-33)'}
          </div>

          <div className="flex justify-center mb-3">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code do Ponto de Risco"
                className="w-48 h-48 border border-slate-200 rounded-xl p-1 shadow-sm"
              />
            ) : (
              <div className="w-48 h-48 bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400 text-xs">
                Gerando código...
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-500 font-medium">
            Aponte a câmera do smartphone para visualizar as diretrizes e assinar a APR deste local.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4" />
            Salvar Imagem
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir Placa
          </button>
        </div>
      </div>
    </div>
  );
};
