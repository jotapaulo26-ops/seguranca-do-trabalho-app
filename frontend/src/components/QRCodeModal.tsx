import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { RiskLocation } from '../types';
import { X, Printer, Download, QrCode, ShieldAlert, AlertTriangle } from 'lucide-react';

interface QRCodeModalProps {
  location: RiskLocation | null;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ location, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [directUrl, setDirectUrl] = useState<string>('');

  useEffect(() => {
    if (!location) return;

    // Direct routing URL to open this risk location in the system
    const targetUrl = `${window.location.origin}/qr?type=risk&id=${location.id}`;
    setDirectUrl(targetUrl);

    QRCode.toDataURL(targetUrl, {
      width: 450,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).then(setQrDataUrl).catch(console.error);
  }, [location]);

  if (!location) return null;

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Placa SST - ${location.name}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            body { margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 90vh; }
            .plate-card {
              border: 8px solid #000;
              border-radius: 24px;
              width: 100%;
              max-width: 550px;
              text-align: center;
              overflow: hidden;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
            .header-strip {
              background: #f59e0b;
              color: #000;
              padding: 16px 20px;
              font-size: 22px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 2px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              border-bottom: 6px solid #000;
            }
            .content-body {
              padding: 28px 24px;
              background: #fff;
            }
            .risk-title {
              font-size: 24px;
              font-weight: 900;
              color: #0f172a;
              margin: 0 0 12px;
              line-height: 1.2;
            }
            .risk-tag {
              display: inline-block;
              background: #ef4444;
              color: #fff;
              font-size: 13px;
              font-weight: 800;
              padding: 6px 14px;
              border-radius: 9999px;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 20px;
            }
            .qr-image {
              width: 280px;
              height: 280px;
              margin: 0 auto 16px;
              display: block;
              border: 3px solid #e2e8f0;
              border-radius: 16px;
              padding: 8px;
            }
            .instruction {
              font-size: 14px;
              font-weight: 700;
              color: #334155;
              line-height: 1.4;
              margin: 0 0 20px;
            }
            .footer-info {
              border-top: 2px dashed #cbd5e1;
              padding-top: 14px;
              font-size: 11px;
              color: #64748b;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
          </style>
        </head>
        <body>
          <div class="plate-card">
            <div class="header-strip">
              ⚠️ ATENÇÃO: ÁREA DE RISCO
            </div>
            <div class="content-body">
              <h1 class="risk-title">${location.name}</h1>
              <div class="risk-tag">
                ${location.risk_type === 'altura' ? 'Trabalho em Altura (NR-35)' : location.risk_type === 'espaco_confinado' ? 'Espaço Confinado (NR-33)' : 'Risco Crítico (NR-35 / NR-33)'}
              </div>

              <img src="${qrDataUrl}" class="qr-image" />

              <p class="instruction">
                APONTE A CÂMERA DO SMARTPHONE PARA ACESSAR A FICHA DE SEGURANÇA, EPIS OBRIGATÓRIOS E DIRETRIZES DA ÁREA
              </p>

              <div class="footer-info">
                Usina Santa Isabel • Sistema Integrado SegTrabalho SST • Norma NR-01 / NR-26
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
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
        <div id="printable-qr-card" className="text-center p-3 border-2 border-slate-900 rounded-2xl bg-white mb-4 shadow-sm">
          <div className="bg-amber-500 text-slate-950 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 mb-3 font-black text-xs tracking-wider uppercase border border-slate-900">
            <AlertTriangle className="w-4 h-4 text-slate-950" />
            <span>ÁREA DE RISCO OPERACIONAL</span>
          </div>

          <h3 className="font-extrabold text-slate-900 text-base mb-1 leading-tight">{location.name}</h3>

          <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase mb-3 bg-red-100 text-red-900">
            {location.risk_type === 'altura'
              ? '🧗 Trabalho em Altura (NR-35)'
              : location.risk_type === 'espaco_confinado'
              ? '🕳️ Espaço Confinado (NR-33)'
              : '⚠️ Risco Crítico Duplo (NR-35 / NR-33)'}
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

          <p className="text-[10px] text-slate-500 font-bold leading-tight">
            Aponte a câmera do smartphone para abrir a ficha técnica, consultar EPIs obrigatórios e APRs deste local.
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
            className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir Placa
          </button>
        </div>
      </div>
    </div>
  );
};
