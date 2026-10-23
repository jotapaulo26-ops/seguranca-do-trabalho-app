import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { RiskLocation, ActiveUserLocation } from '../types';
import { useUserTracking } from '../context/TrackingContext';
import { AlertTriangle, Shield, QrCode, FileText, Plus, MapPin, Layers, Navigation, Phone, Users, Flame } from 'lucide-react';

// Distance calculation in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Custom Map Marker Icons for Risk Points
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
      <div class="flex items-center justify-center w-9 h-9 rounded-full shadow-2xl border-2 border-white ${colorClass} transition-transform hover:scale-125 cursor-pointer font-bold text-sm ring-2 ring-black/40">
        ${emoji}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  });
}

// Custom Icon for Current User (Pulsing Blue Radar)
const currentUserIcon = L.divIcon({
  className: 'custom-current-user-gps-marker',
  html: `
    <div class="relative flex items-center justify-center">
      <div class="absolute w-10 h-10 rounded-full bg-blue-500/40 animate-ping"></div>
      <div class="relative w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-2xl flex items-center justify-center text-white text-[10px] font-black ring-2 ring-blue-400">
        📍
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

// Custom Icon for Teammates (Colored pill by role)
function createTeammateIcon(user: ActiveUserLocation) {
  let badgeColor = 'bg-blue-600 border-blue-800';
  let roleIcon = '👷';

  if (user.roleType === 'brigadista') {
    badgeColor = 'bg-red-600 border-red-800';
    roleIcon = '🧯';
  } else if (user.roleType === 'sst') {
    badgeColor = 'bg-amber-600 border-amber-800';
    roleIcon = '🛡️';
  }

  const firstName = user.name.split(' ')[0];

  return L.divIcon({
    className: 'custom-teammate-gps-marker',
    html: `
      <div class="flex flex-col items-center cursor-pointer transition-transform hover:scale-110">
        <div class="px-2 py-0.5 rounded-full text-[10px] font-black text-white ${badgeColor} shadow-lg border border-white/80 whitespace-nowrap flex items-center gap-1">
          <span>${roleIcon}</span>
          <span>${firstName}</span>
        </div>
        <div class="w-3 h-3 rounded-full ${badgeColor} border-2 border-white -mt-0.5 shadow-md"></div>
      </div>
    `,
    iconSize: [80, 36],
    iconAnchor: [40, 32],
    popupAnchor: [0, -32]
  });
}

// Controller to smoothly pan/zoom map
function MapController({ targetCenter }: { targetCenter: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetCenter) {
      map.flyTo(targetCenter, 18, { duration: 1.2 });
    }
  }, [targetCenter, map]);
  return null;
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
  previewCircle?: { lat: number; lng: number; radius: number; color?: string } | null;
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
  previewCircle,
  height = '580px',
  // Default centered in Usina Santa Isabel (Novo Horizonte - SP)
  initialCenter = [-21.5083, -49.2081],
  zoom = 16
}) => {
  const { myLocation, activeUsers, gpsError, requestGpsPermission } = useUserTracking();

  const [filterType, setFilterType] = useState<string>('all');
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapMode, setMapMode] = useState<'satellite' | 'streets'>('satellite');
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [showTeamLayer, setShowTeamLayer] = useState(true);

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

  const handleCenterOnMe = () => {
    if (myLocation) {
      setFlyToCoords([myLocation.lat, myLocation.lng]);
    } else {
      requestGpsPermission();
    }
  };

  // Other online teammates (excluding current user to avoid duplicate marker)
  const teammates = activeUsers.filter(u => !u.isCurrentUser);

  return (
    <div className="relative isolate z-0 rounded-3xl overflow-hidden shadow-xl border-2 border-slate-700/50">
      {/* Top Filter Bar, Satellite Switcher, and Location Badge */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left side: Location Badge, Satellite Mode, and Live Team Count */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Usina Santa Isabel Location Badge */}
          <div className="bg-slate-950/90 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 border border-slate-700 backdrop-blur-sm">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>Usina Santa Isabel - Novo Horizonte</span>
          </div>

          {/* Satellite vs Streets View Switcher */}
          <div className="flex bg-slate-950/90 backdrop-blur-sm p-1 rounded-xl shadow-lg border border-slate-700 text-xs">
            <button
              onClick={() => setMapMode('satellite')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                mapMode === 'satellite'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>🛰️</span> Satélite (Padrão)
            </button>
            <button
              onClick={() => setMapMode('streets')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                mapMode === 'streets'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>🗺️</span> Ruas
            </button>
          </div>

          {/* Active GPS Team Toggle */}
          <button
            onClick={() => setShowTeamLayer(!showTeamLayer)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg border transition-all ${
              showTeamLayer
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/20'
                : 'bg-slate-950/90 text-slate-400 border-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{activeUsers.length} em Campo (GPS)</span>
          </button>
        </div>

        {/* Right side: Risk Type Filters */}
        <div className="flex flex-wrap gap-1 bg-slate-950/90 backdrop-blur-sm p-1 rounded-xl shadow-lg border border-slate-700 text-xs pointer-events-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
              filterType === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Todos ({locations.length})
          </button>
          <button
            onClick={() => setFilterType('altura')}
            className={`px-2 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors ${
              filterType === 'altura' ? 'bg-red-600 text-white font-bold' : 'text-red-400 hover:text-red-200'
            }`}
          >
            <span>🧗</span> Altura ({locations.filter(l => l.risk_type === 'altura').length})
          </button>
          <button
            onClick={() => setFilterType('espaco_confinado')}
            className={`px-2 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors ${
              filterType === 'espaco_confinado' ? 'bg-amber-600 text-white font-bold' : 'text-amber-400 hover:text-amber-200'
            }`}
          >
            <span>🕳️</span> Confinado ({locations.filter(l => l.risk_type === 'espaco_confinado').length})
          </button>
          <button
            onClick={() => setFilterType('ambos')}
            className={`px-2 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors ${
              filterType === 'ambos' ? 'bg-purple-700 text-white font-bold' : 'text-purple-400 hover:text-purple-200'
            }`}
          >
            <span>⚠️</span> Ambos ({locations.filter(l => l.risk_type === 'ambos').length})
          </button>
        </div>
      </div>

      {/* Floating GPS Recenter Button */}
      <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={handleCenterOnMe}
          title={myLocation ? 'Centralizar no Meu GPS' : 'Ativar meu GPS'}
          className={`p-3 rounded-2xl shadow-2xl flex items-center gap-2 font-black text-xs transition-transform active:scale-95 border ${
            myLocation
              ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-blue-600/30'
              : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-700'
          }`}
        >
          <Navigation className={`w-4 h-4 ${myLocation ? 'animate-pulse' : ''}`} />
          <span>{myLocation ? 'Meu GPS' : 'Ligar GPS'}</span>
        </button>
      </div>

      {/* GPS Status / Error Notice */}
      {gpsError && (
        <div className="absolute bottom-16 right-4 z-[1000] bg-red-950/90 text-red-200 text-[11px] px-3 py-1.5 rounded-xl border border-red-700/60 shadow-lg pointer-events-auto flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Leaflet Map Container */}
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        style={{ height, width: '100%', minHeight: '420px' }}
        scrollWheelZoom={true}
      >
        <MapController targetCenter={flyToCoords} />

        {/* SATELLITE (DEFAULT) OR STREETS TILE LAYER */}
        {mapMode === 'satellite' ? (
          <TileLayer
            key="satellite-layer"
            attribution='&copy; Google Maps Imagens de Satélite &copy; CNES/Airbus &copy; Maxar'
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            maxZoom={20}
          />
        ) : (
          <TileLayer
            key="streets-layer"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        )}

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

        {/* ----------------- GEOFENCE VIRTUAL FENCE CIRCLES (ZONAS DE RISCO) ----------------- */}
        {filteredLocations.map((loc) => {
          const radius = loc.geofence_radius || 25;
          const color =
            loc.risk_type === 'espaco_confinado'
              ? '#8b5cf6'
              : loc.risk_type === 'altura'
              ? '#f59e0b'
              : loc.risk_type === 'ambos'
              ? '#ef4444'
              : '#06b6d4';

          return (
            <Circle
              key={`geofence-${loc.id}`}
              center={[loc.lat, loc.lng]}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.12,
                weight: 1.5,
                dashArray: '6, 6'
              }}
            />
          );
        })}

        {/* Live Interactive Preview Circle while creating/editing with slider */}
        {previewCircle && (
          <Circle
            center={[previewCircle.lat, previewCircle.lng]}
            radius={previewCircle.radius}
            pathOptions={{
              color: previewCircle.color || '#ef4444',
              fillColor: previewCircle.color || '#ef4444',
              fillOpacity: 0.25,
              weight: 2,
              dashArray: '4, 4'
            }}
          />
        )}

        {/* ----------------- CURRENT USER GPS MARKER (VOCÊ) ----------------- */}
        {showTeamLayer && myLocation && (
          <>
            <Circle
              center={[myLocation.lat, myLocation.lng]}
              radius={Math.max(10, myLocation.accuracy || 15)}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                weight: 1.5
              }}
            />
            <Marker position={[myLocation.lat, myLocation.lng]} icon={currentUserIcon}>
              <Popup maxWidth={260}>
                <div className="p-1 text-center">
                  <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 mb-1">
                    Sua Posição (Você)
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">GPS Ativo em Tempo Real</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Precisão: ~{myLocation.accuracy || 10} metros
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">
                    {myLocation.lat.toFixed(6)}, {myLocation.lng.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* ----------------- LOGGED-IN TEAMMATES MARKERS (COLEGAS) ----------------- */}
        {showTeamLayer &&
          teammates.map(tm => {
            const distance = myLocation
              ? calculateDistanceMeters(myLocation.lat, myLocation.lng, tm.lat, tm.lng)
              : null;

            return (
              <Marker
                key={tm.userId}
                position={[tm.lat, tm.lng]}
                icon={createTeammateIcon(tm)}
              >
                <Popup maxWidth={280}>
                  <div className="p-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full ${tm.roleType === 'brigadista' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                      <span className="text-[10px] font-black uppercase text-slate-500">
                        {tm.roleType === 'brigadista' ? 'Brigadista' : tm.roleType === 'sst' ? 'Equipe SST' : 'Executante'}
                      </span>
                    </div>

                    <h4 className="font-black text-sm text-slate-900">{tm.name}</h4>
                    <p className="text-xs text-slate-600 font-medium">{tm.roleName}</p>

                    {distance !== null && (
                      <div className="mt-2 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">
                        📍 A {distance} metros de você
                      </div>
                    )}

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Atualizado há segundos</span>
                      {tm.phone && (
                        <a
                          href={`tel:${tm.phone}`}
                          className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-lg hover:bg-emerald-100"
                        >
                          <Phone className="w-3 h-3" />
                          Ligar
                        </a>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

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
