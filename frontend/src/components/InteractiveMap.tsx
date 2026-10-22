import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { RiskLocation } from '../types';
import { AlertTriangle, Shield, QrCode, FileText, Plus, MapPin } from 'lucide-react';

// Custom Map Marker Icons using Leaflet DivIcon
function createCustomIcon(riskType: string) {
  let colorClass = 'bg-red-600 border-red-800 text-white';
  let emoji = '🧗';

  if (riskType === 'espaco_confinado') {
    colorClass = 'bg-amber-600 border-amber-800 text-white';
    emoji = '🕳️';
  } else if (riskType === 'ambos') {
    colorClass = 'bg-purple-700 border-purple-900 text-white';
    emoji = '⚠️';
  }

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div class="flex items-center justify-center w-9 h-9 rounded-full shadow-lg border-2 ${colorClass} transition-transform hover:scale-125 cursor-pointer font-bold text-sm">
        ${emoji}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  });
}

// Component to handle map clicks for adding points
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

interface InteractiveMapProps {
  locations: RiskLocation[];
  onSelectLocation?: (location: RiskLocation) => void;
  onAddPointClick?: (coords: { lat: number; lng: number }) => void;
  onGenerateApr?: (location: RiskLocation) => void;
  onShowQrCode?: (location: RiskLocation) => void;
  height?: string;
  initialCenter?: [number, number];
  zoom?: number;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  locations,
  onSelectLocation,
  onAddPointClick,
  onGenerateApr,
  onShowQrCode,
  height = '580px',
  // Default centered in Novo Horizonte - SP
  initialCenter = [-21.4689, -49.2217],
  zoom = 15
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const filteredLocations = locations.filter(loc => {
    if (filterType === 'all') return true;
    return loc.risk_type === filterType;
  });

  const handleMapClick = (lat: number, lng: number) => {
    setClickedCoords({ lat, lng });
    if (onAddPointClick) {
      onAddPointClick({ lat, lng });
    }
  };

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-md border border-slate-200">
      {/* Top Filter Bar and Location Badge */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2">
        {/* Novo Horizonte - SP Location Badge */}
        <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 border border-slate-800">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span>Novo Horizonte - SP</span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-1.5 bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow-md border border-slate-200 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterType === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Todos ({locations.length})
          </button>
          <button
            onClick={() => setFilterType('altura')}
            className={`px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors ${
              filterType === 'altura' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'
            }`}
          >
            <span>🧗</span> Altura ({locations.filter(l => l.risk_type === 'altura').length})
          </button>
          <button
            onClick={() => setFilterType('espaco_confinado')}
            className={`px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors ${
              filterType === 'espaco_confinado' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <span>🕳️</span> Confinado ({locations.filter(l => l.risk_type === 'espaco_confinado').length})
          </button>
          <button
            onClick={() => setFilterType('ambos')}
            className={`px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors ${
              filterType === 'ambos' ? 'bg-purple-700 text-white' : 'text-purple-700 hover:bg-purple-50'
            }`}
          >
            <span>⚠️</span> Ambos ({locations.filter(l => l.risk_type === 'ambos').length})
          </button>
        </div>
      </div>

      {/* Floating Instructions Banner */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 text-white text-xs px-3 py-2 rounded-xl backdrop-blur-sm flex items-center gap-2 shadow-lg max-w-sm pointer-events-none">
        <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
        <span>Clique em qualquer ponto do mapa para abrir o formulário na sua frente.</span>
      </div>

      {/* Leaflet Map Container */}
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        style={{ height, width: '100%', minHeight: '400px' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onMapClick={handleMapClick} />

        {/* Existing Risk Locations */}
        {filteredLocations.map(loc => (
          <Marker
            key={loc.id}
            position={[loc.lat, loc.lng]}
            icon={createCustomIcon(loc.risk_type)}
            eventHandlers={{
              click: () => {
                if (onSelectLocation) onSelectLocation(loc);
              }
            }}
          >
            <Popup className="custom-popup" maxWidth={320}>
              <div className="p-1">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      loc.risk_type === 'altura'
                        ? 'bg-red-100 text-red-700'
                        : loc.risk_type === 'espaco_confinado'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {loc.risk_type === 'altura'
                      ? 'Trabalho em Altura (NR-35)'
                      : loc.risk_type === 'espaco_confinado'
                      ? 'Espaço Confinado (NR-33)'
                      : 'Ambos os Riscos (NR-35 / 33)'}
                  </span>
                  {loc.activeAprsCount !== undefined && loc.activeAprsCount > 0 && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      {loc.activeAprsCount} APR ativa
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-slate-900 text-sm mb-1">{loc.name}</h4>
                <p className="text-xs text-slate-600 mb-2 line-clamp-3">{loc.description}</p>

                {loc.required_epis && loc.required_epis.length > 0 && (
                  <div className="mb-3 text-[11px] text-slate-500">
                    <strong className="text-slate-700">EPIs: </strong>
                    {loc.required_epis.slice(0, 3).join(', ')}
                    {loc.required_epis.length > 3 && ` +${loc.required_epis.length - 3}`}
                  </div>
                )}

                <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                  {onGenerateApr && (
                    <button
                      onClick={() => onGenerateApr(loc)}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Emitir APR
                    </button>
                  )}
                  {onShowQrCode && (
                    <button
                      onClick={() => onShowQrCode(loc)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                      title="Ver e Imprimir QR Code"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Temporary Marker for new clicked point */}
        {clickedCoords && (
          <Marker
            position={[clickedCoords.lat, clickedCoords.lng]}
            icon={L.divIcon({
              className: 'pulse-marker',
              html: `<div class="w-8 h-8 rounded-full bg-amber-500 border-4 border-white shadow-xl animate-bounce flex items-center justify-center text-slate-950 font-black text-xs">+</div>`,
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            })}
          />
        )}
      </MapContainer>
    </div>
  );
};
