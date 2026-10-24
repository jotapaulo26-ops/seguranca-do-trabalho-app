import React from 'react';
import { useUserTracking } from '../context/TrackingContext';
import { AlertTriangle, HardHat, ShieldAlert, X, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const GeofenceAlertBanner: React.FC = () => {
  const { activeProximityAlert, dismissProximityAlert, remoteSupervisorAlarm, dismissRemoteSupervisorAlarm } = useUserTracking();
  const navigate = useNavigate();

  // 1. If remote supervisor emergency siren was triggered
  if (remoteSupervisorAlarm) {
    return (
      <div className="fixed top-16 md:top-6 left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-lg animate-in slide-in-from-top-4 duration-200">
        <div className="text-white rounded-3xl p-5 shadow-2xl flex items-start gap-4 relative overflow-hidden border-2 bg-gradient-to-r from-red-600 via-rose-700 to-red-800 border-red-300 ring-4 ring-red-500/50 animate-pulse">
          <div className="p-3 rounded-2xl flex-shrink-0 bg-red-950/80 text-rose-200">
            <ShieldAlert className="w-8 h-8 animate-bounce" />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-red-950 text-white border-white">
                🚨 ORDEM DE EVACUAÇÃO SST
              </span>
            </div>

            <h4 className="font-black text-lg leading-tight mt-1.5 text-white">
              Sirene Acionada pela Supervisão!
            </h4>

            <p className="mt-2 text-xs bg-red-950/80 p-3 rounded-xl border border-red-400 text-red-100 font-bold leading-relaxed">
              Você está em área restrita (<span className="text-amber-300">{remoteSupervisorAlarm.riskName}</span>) sem autorização. O Administrador está monitorando e solicitando sua retirada imediata!
            </p>

            <div className="mt-3.5 flex items-center gap-2">
              <button
                onClick={dismissRemoteSupervisorAlarm}
                className="px-4 py-2 bg-white text-red-900 font-black text-xs rounded-xl shadow-lg hover:bg-red-50 transition-all active:scale-95"
              >
                Ciente / Evacuando Área
              </button>
            </div>
          </div>

          <button
            onClick={dismissRemoteSupervisorAlarm}
            className="absolute top-3 right-3 p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (!activeProximityAlert) return null;

  const isIntrusion = !!activeProximityAlert.isUnauthorizedIntrusion;

  return (
    <div className="fixed top-16 md:top-6 left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-lg animate-in slide-in-from-top-4 duration-200">
      <div
        className={`text-white rounded-3xl p-4 shadow-2xl flex items-start gap-3.5 relative overflow-hidden border-2 ${
          isIntrusion
            ? 'bg-gradient-to-r from-red-700 via-rose-800 to-red-900 border-red-400 ring-4 ring-red-500/40 animate-pulse'
            : 'bg-gradient-to-r from-amber-600 via-red-700 to-amber-700 border-amber-400'
        }`}
      >
        {/* Pulsing indicator */}
        <div className={`p-2.5 rounded-2xl flex-shrink-0 ${isIntrusion ? 'bg-red-950/60 text-red-200' : 'bg-white/20 text-amber-300'}`}>
          <ShieldAlert className="w-6 h-6 animate-bounce" />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isIntrusion
                  ? 'bg-red-950 text-rose-300 border-rose-400'
                  : 'bg-black/30 text-amber-300 border-amber-300/30'
              }`}
            >
              {isIntrusion ? '🚨 INTRUSÃO NÃO AUTORIZADA' : 'Cerca Virtual SST'}
            </span>
            <span className="text-[11px] font-bold text-red-100">
              A {activeProximityAlert.distance}m de você (Raio: {activeProximityAlert.radius || 25}m)
            </span>
          </div>

          <h4 className="font-black text-base leading-tight mt-1 truncate">
            {activeProximityAlert.name}
          </h4>

          {isIntrusion ? (
            <div className="mt-2 text-xs bg-red-950/70 p-2.5 rounded-xl border border-red-500/40 text-red-100 leading-snug font-medium">
              ⚠️ <strong>Violação de Segurança:</strong> Você entrou nesta área de risco <strong>SEM Permissão de Trabalho (PT) ou APR homologada</strong> para seu usuário. Saia imediatamente do perímetro de risco!
            </div>
          ) : (
            activeProximityAlert.required_epis && activeProximityAlert.required_epis.length > 0 && (
              <div className="mt-2 text-xs bg-black/25 p-2 rounded-xl border border-white/10 flex items-start gap-1.5">
                <HardHat className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-200 block text-[10px] uppercase">EPIs Obrigatórios:</span>
                  <span className="text-white text-[11px] font-medium leading-tight line-clamp-2">
                    {activeProximityAlert.required_epis.join(' • ')}
                  </span>
                </div>
              </div>
            )
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                navigate(`/mapa?spotId=${activeProximityAlert.id}`);
                dismissProximityAlert();
              }}
              className={`px-3 py-1.5 font-black text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5 ${
                isIntrusion
                  ? 'bg-white text-red-900 hover:bg-red-100'
                  : 'bg-white text-slate-950 hover:bg-amber-100'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-red-600" />
              Ver no Mapa
            </button>

            <button
              onClick={dismissProximityAlert}
              className="px-3 py-1.5 bg-black/30 hover:bg-black/50 text-white font-bold text-xs rounded-xl transition-colors"
            >
              Ciente / Sair
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={dismissProximityAlert}
          className="absolute top-3 right-3 p-1.5 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
