import React from 'react';
import { useUserTracking } from '../context/TrackingContext';
import { AlertTriangle, HardHat, ShieldAlert, X, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const GeofenceAlertBanner: React.FC = () => {
  const { activeProximityAlert, dismissProximityAlert } = useUserTracking();
  const navigate = useNavigate();

  if (!activeProximityAlert) return null;

  return (
    <div className="fixed top-16 md:top-6 left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-lg animate-in slide-in-from-top-4 duration-200">
      <div className="bg-gradient-to-r from-red-600 via-red-700 to-amber-700 text-white rounded-3xl p-4 shadow-2xl border-2 border-amber-400 flex items-start gap-3.5 relative overflow-hidden">
        {/* Pulsing indicator */}
        <div className="p-2.5 rounded-2xl bg-white/20 flex-shrink-0 animate-pulse">
          <ShieldAlert className="w-6 h-6 text-amber-300" />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded-full text-amber-300 border border-amber-300/30">
              Cerca Virtual SST
            </span>
            <span className="text-[11px] font-bold text-red-100">
              A {activeProximityAlert.distance}m de você!
            </span>
          </div>

          <h4 className="font-black text-base leading-tight mt-1 truncate">
            {activeProximityAlert.name}
          </h4>

          {activeProximityAlert.required_epis && activeProximityAlert.required_epis.length > 0 && (
            <div className="mt-2 text-xs bg-black/25 p-2 rounded-xl border border-white/10 flex items-start gap-1.5">
              <HardHat className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-200 block text-[10px] uppercase">EPIs Obrigatórios:</span>
                <span className="text-white text-[11px] font-medium leading-tight line-clamp-2">
                  {activeProximityAlert.required_epis.join(' • ')}
                </span>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                navigate(`/mapa?spotId=${activeProximityAlert.id}`);
                dismissProximityAlert();
              }}
              className="px-3 py-1.5 bg-white text-slate-950 font-black text-xs rounded-xl shadow-md hover:bg-amber-100 transition-colors flex items-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5 text-red-600" />
              Ver no Mapa
            </button>

            <button
              onClick={dismissProximityAlert}
              className="px-3 py-1.5 bg-black/30 hover:bg-black/50 text-white font-bold text-xs rounded-xl transition-colors"
            >
              Entendido
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
