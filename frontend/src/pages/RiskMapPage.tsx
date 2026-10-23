import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RiskLocation, Employee } from '../types';
import { InteractiveMap } from '../components/InteractiveMap';
import { QRCodeModal } from '../components/QRCodeModal';
import {
  MapPin,
  Plus,
  ShieldAlert,
  QrCode,
  FileText,
  AlertTriangle,
  Camera,
  Users,
  HardHat,
  X,
  Trash2,
  Edit,
  ExternalLink,
  Crosshair,
  Radio
} from 'lucide-react';

const COMMON_EPIS = [
  'Cinto de Segurança Tipo Paraquedista',
  'Talabarte Duplo Y com Absorvedor',
  'Trava-quedas para Linha de Vida',
  'Capacete de Segurança com Jugular',
  'Detector Multigases (O2, LEL, CO, H2S)',
  'Tripé com Guincho de Resgate',
  'Exaustor / Insuflador de Ar',
  'Óculos de Proteção contra Impactos',
  'Luvas de Vaqueta / Couro',
  'Botina com Biqueira de Composite',
  'Máscara com Filtro Químico'
];

// Default coordinates for Usina Santa Isabel (Novo Horizonte - SP)
const USINA_SANTA_ISABEL_COORDS = {
  lat: -21.5083,
  lng: -49.2081
};

export const RiskMapPage: React.FC = () => {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [locations, setLocations] = useState<RiskLocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Drawer states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<RiskLocation | null>(null);
  const [qrModalLocation, setQrModalLocation] = useState<RiskLocation | null>(null);

  // Form states for creating a new spot
  const [formData, setFormData] = useState({
    name: '',
    lat: USINA_SANTA_ISABEL_COORDS.lat,
    lng: USINA_SANTA_ISABEL_COORDS.lng,
    risk_type: 'altura' as 'altura' | 'espaco_confinado' | 'ambos',
    description: '',
    geofence_radius: 25,
    required_epis: [] as string[],
    authorized_employee_ids: [] as string[],
    photo_url: ''
  });

  const loadData = async () => {
    try {
      const [risksData, empsData] = await Promise.all([
        api.get<RiskLocation[]>('/risks'),
        api.get<Employee[]>('/employees')
      ]);
      setLocations(risksData);
      setEmployees(empsData);

      // Check if spotId query param is present
      const spotId = searchParams.get('spotId');
      if (spotId) {
        const found = risksData.find(r => r.id === spotId);
        if (found) setSelectedLocation(found);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do mapa:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When clicking on the map, IMMEDIATELY open the menu in front of the map
  const handleMapClick = (coords: { lat: number; lng: number }) => {
    if (!can('map', 'create')) return;
    setFormData({
      ...formData,
      lat: coords.lat,
      lng: coords.lng,
      name: '',
      description: '',
      geofence_radius: formData.geofence_radius || 25,
      required_epis: [],
      authorized_employee_ids: []
    });
    // Open in front of map
    setAddModalOpen(true);
  };

  const handleEpiToggle = (epi: string) => {
    if (formData.required_epis.includes(epi)) {
      setFormData({
        ...formData,
        required_epis: formData.required_epis.filter(e => e !== epi)
      });
    } else {
      setFormData({
        ...formData,
        required_epis: [...formData.required_epis, epi]
      });
    }
  };

  const handleEmployeeToggle = (empId: string) => {
    if (formData.authorized_employee_ids.includes(empId)) {
      setFormData({
        ...formData,
        authorized_employee_ids: formData.authorized_employee_ids.filter(id => id !== empId)
      });
    } else {
      setFormData({
        ...formData,
        authorized_employee_ids: [...formData.authorized_employee_ids, empId]
      });
    }
  };

  const handleSubmitSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.description) {
      alert('Preencha o nome do local e a descrição dos riscos.');
      return;
    }

    try {
      await api.post('/risks', formData);
      setAddModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar ponto de risco.');
    }
  };

  const handleDeleteSpot = async (id: string, name: string) => {
    if (confirm(`Deseja realmente remover o ponto de risco "${name}" do mapa?`)) {
      try {
        await api.delete(`/risks/${id}`);
        setSelectedLocation(null);
        loadData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleGenerateAprForSpot = (loc: RiskLocation) => {
    navigate(`/documentos/nova-apr?locationId=${loc.id}&riskType=${loc.risk_type}`);
  };

  return (
    <div className="space-y-4">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-500" />
            Mapa de Riscos — Novo Horizonte - SP
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Geolocalização de pontos de Altura (NR-35) e Espaços Confinados (NR-33) com cadastro direto na tela
          </p>
        </div>

        {can('map', 'create') && (
          <button
            onClick={() => {
              setFormData({
                name: '',
                lat: USINA_SANTA_ISABEL_COORDS.lat,
                lng: USINA_SANTA_ISABEL_COORDS.lng,
                risk_type: 'altura',
                description: '',
                geofence_radius: 25,
                required_epis: [],
                authorized_employee_ids: [],
                photo_url: ''
              });
              setAddModalOpen(true);
            }}
            className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            Adicionar Ponto de Risco
          </button>
        )}
      </div>

      {/* Main Interactive Map (Centered in Novo Horizonte - SP) */}
      <div className="relative">
        <InteractiveMap
          locations={locations}
          onSelectLocation={(loc) => setSelectedLocation(loc)}
          onAddPointClick={handleMapClick}
          onGenerateApr={handleGenerateAprForSpot}
          onShowQrCode={(loc) => setQrModalLocation(loc)}
          previewCircle={
            addModalOpen
              ? {
                  lat: formData.lat,
                  lng: formData.lng,
                  radius: formData.geofence_radius || 25,
                  color:
                    formData.risk_type === 'espaco_confinado'
                      ? '#8b5cf6'
                      : formData.risk_type === 'altura'
                      ? '#f59e0b'
                      : '#ef4444'
                }
              : null
          }
          initialCenter={[-21.5083, -49.2081]}
          zoom={16}
          height="600px"
        />

        {/* SPOT DETAIL MODAL / DRAWER (Always floating directly in FRONT of the map) */}
        {selectedLocation && (
          <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        selectedLocation.risk_type === 'altura'
                          ? 'bg-red-100 text-red-700'
                          : selectedLocation.risk_type === 'espaco_confinado'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {selectedLocation.risk_type === 'altura'
                        ? '🧗 Trabalho em Altura (NR-35)'
                        : selectedLocation.risk_type === 'espaco_confinado'
                        ? '🕳️ Espaço Confinado (NR-33)'
                        : '⚠️ Risco Duplo (NR-35 / 33)'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Novo Horizonte (Lat: {selectedLocation.lat.toFixed(4)}, Lng: {selectedLocation.lng.toFixed(4)})
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900">{selectedLocation.name}</h3>
                </div>

                <button
                  onClick={() => setSelectedLocation(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-3 text-xs text-slate-600">
                <p className="mb-3 leading-relaxed">{selectedLocation.description}</p>

                {/* Raio da Cerca Virtual Georreferenciada */}
                <div className="mb-3 flex items-center gap-2.5 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <Radio className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">
                      Cerca Virtual Georreferenciada: {selectedLocation.geofence_radius || 25} metros
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Dispara alarme sonoro e notificação imediata no celular do colaborador ao entrar neste raio.
                    </span>
                  </div>
                </div>

                {/* Required EPIs */}
                {selectedLocation.required_epis && selectedLocation.required_epis.length > 0 && (
                  <div className="mb-3">
                    <strong className="text-slate-800 text-[11px] block mb-1.5">
                      EPIs e Equipamentos Obrigatórios para este Ponto:
                    </strong>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLocation.required_epis.map(epi => (
                        <span key={epi} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                          {epi}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleGenerateAprForSpot(selectedLocation)}
                  className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Emitir APR para este Ponto
                </button>

                <button
                  onClick={() => setQrModalLocation(selectedLocation)}
                  className="py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <QrCode className="w-4 h-4 text-amber-400" />
                  QR Code da Placa
                </button>

                {can('map', 'delete') && (
                  <button
                    onClick={() => handleDeleteSpot(selectedLocation.id, selectedLocation.name)}
                    className="py-2 px-3 text-red-500 hover:bg-red-50 rounded-xl text-xs font-semibold flex items-center gap-1 ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD RISK SPOT FORM (Always floating directly IN FRONT OF MAP with z-[99999]) */}
      {addModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border-2 border-amber-400 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-amber-500" />
                  Cadastrar Ponto de Risco na Usina Santa Isabel
                </h3>
                <p className="text-[11px] text-slate-500">
                  Localização clicada no mapa pronta para cadastro
                </p>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSpot} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Local / Equipamento / Instalação *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Silo 04 - Passarela Superior ou Galeria Subterrânea"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Risco Crítico *</label>
                  <select
                    value={formData.risk_type}
                    onChange={(e) => setFormData({ ...formData, risk_type: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="altura">🧗 Trabalho em Altura (NR-35)</option>
                    <option value="espaco_confinado">🕳️ Espaço Confinado (NR-33)</option>
                    <option value="ambos">⚠️ Ambos (Altura + Espaço Confinado)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Latitude (SP)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.lat}
                      onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Longitude (SP)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.lng}
                      onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Raio da Cerca Virtual (Geofence Radius) com Live Preview */}
              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-amber-600 animate-pulse" />
                    Raio da Cerca Virtual de Alerta:
                  </label>
                  <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 shadow-sm">
                    {formData.geofence_radius || 25} metros
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mb-2.5 leading-tight">
                  Colaboradores que entrarem no círculo desta cerca receberão aviso no celular em segundo plano e alarme sonoro.
                </p>

                {/* Slider */}
                <input
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={formData.geofence_radius || 25}
                  onChange={(e) => setFormData({ ...formData, geofence_radius: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 cursor-pointer mb-2"
                />

                {/* Presets */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '15m (Estrito)', val: 15 },
                    { label: '30m (Padrão)', val: 30 },
                    { label: '50m (Amplo)', val: 50 },
                    { label: '100m (Geral)', val: 100 }
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setFormData({ ...formData, geofence_radius: p.val })}
                      className={`text-[10px] font-semibold py-1.5 px-1 rounded-lg border text-center transition-all ${
                        formData.geofence_radius === p.val
                          ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-100/50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição dos Riscos & Medidas Específicas *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva as características do local em Novo Horizonte, altura estimada, necessidade de ancoragem, riscos atmosféricos, etc."
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              {/* EPIs Selection Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  EPIs e Equipamentos Obrigatórios:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {COMMON_EPIS.map(epi => (
                    <label key={epi} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-0.5 hover:bg-white rounded">
                      <input
                        type="checkbox"
                        checked={formData.required_epis.includes(epi)}
                        onChange={() => handleEpiToggle(epi)}
                        className="rounded text-amber-500 focus:ring-amber-500"
                      />
                      <span>{epi}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Authorized Employees Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Funcionários Pré-Autorizados:
                </label>
                <div className="space-y-1 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center justify-between text-xs text-slate-700 p-1 hover:bg-white rounded cursor-pointer">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.authorized_employee_ids.includes(emp.id)}
                          onChange={() => handleEmployeeToggle(emp.id)}
                          className="rounded text-amber-500 focus:ring-amber-500"
                        />
                        <span className="font-medium">{emp.name}</span>
                        <span className="text-[10px] text-slate-400">({emp.role})</span>
                      </div>
                      {emp.complianceStatus === 'critico' && (
                        <span className="text-[9px] text-red-600 font-bold">⚠️ Vencido</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="py-2.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors"
                >
                  Salvar Ponto no Mapa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal for Printing/Scanning */}
      <QRCodeModal
        location={qrModalLocation}
        onClose={() => setQrModalLocation(null)}
      />
    </div>
  );
};
