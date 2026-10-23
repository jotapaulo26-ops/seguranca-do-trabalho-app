import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Extinguisher,
  BrigadeMember,
  MeetingPoint,
  EvacuationDrill,
  BrigadeStats,
  Employee
} from '../types';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Flame,
  Shield,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Plus,
  Search,
  Filter,
  QrCode,
  Phone,
  UserCheck,
  Calendar,
  Play,
  Pause,
  RotateCcw,
  CheckSquare,
  X,
  Layers,
  Trash2,
  Edit,
  Download,
  AlertCircle,
  PhoneCall,
  Activity,
  Award,
  Users
} from 'lucide-react';

const USINA_SANTA_ISABEL_COORDS: [number, number] = [-21.5083, -49.2081];

// Custom Leaflet Markers for Brigade Elements
function createExtinguisherIcon(status: string) {
  let bg = 'bg-red-600 border-red-800';
  if (status === 'operacional') bg = 'bg-red-600 border-red-800';
  else if (status === 'em_manutencao') bg = 'bg-amber-600 border-amber-800';
  else if (status === 'vencido' || status === 'descarregado') bg = 'bg-rose-700 border-rose-950 animate-pulse';

  return L.divIcon({
    className: 'custom-brigade-marker',
    html: `
      <div class="flex items-center justify-center w-8 h-8 rounded-full shadow-2xl border-2 border-white ${bg} text-white cursor-pointer ring-2 ring-black/40 text-sm">
        🧯
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
}

function createMeetingPointIcon() {
  return L.divIcon({
    className: 'custom-brigade-marker',
    html: `
      <div class="flex items-center justify-center w-8 h-8 rounded-full shadow-2xl border-2 border-white bg-emerald-600 border-emerald-800 text-white cursor-pointer ring-2 ring-black/40 text-sm">
        🚩
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
}

function createBrigadistIcon(isOnDuty: boolean) {
  const bg = isOnDuty ? 'bg-blue-600 border-blue-900 ring-emerald-400' : 'bg-slate-600 border-slate-800 ring-slate-400';
  return L.divIcon({
    className: 'custom-brigade-marker',
    html: `
      <div class="flex items-center justify-center w-8 h-8 rounded-full shadow-2xl border-2 border-white ${bg} text-white cursor-pointer ring-2 text-sm">
        🧑‍🚒
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

export const BrigadePage: React.FC = () => {
  const { user, can } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'mapa' | 'extintores' | 'brigadistas' | 'pontos_encontro'>('mapa');

  // Core Data
  const [stats, setStats] = useState<BrigadeStats | null>(null);
  const [extinguishers, setExtinguishers] = useState<Extinguisher[]>([]);
  const [members, setMembers] = useState<(BrigadeMember & { employee_name?: string; employee_phone?: string; employee_role?: string; employee_department?: string })[]>([]);
  const [meetingPoints, setMeetingPoints] = useState<(MeetingPoint & { coordinator_name?: string; coordinator_phone?: string })[]>([]);
  const [drills, setDrills] = useState<EvacuationDrill[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Tactical Map States
  const [mapMode, setMapMode] = useState<'satellite' | 'streets'>('satellite');
  const [mapLayerFilter, setMapLayerFilter] = useState<'all' | 'extinguishers' | 'points' | 'members'>('all');
  const [selectedMapItem, setSelectedMapItem] = useState<{ type: 'extinguisher' | 'point' | 'member'; data: any } | null>(null);
  const [quickAddCoords, setQuickAddCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Extinguishers Filter & Modal
  const [extSearch, setExtSearch] = useState('');
  const [extTypeFilter, setExtTypeFilter] = useState<string>('all');
  const [showAddExtModal, setShowAddExtModal] = useState(false);
  const [inspectingExt, setInspectingExt] = useState<Extinguisher | null>(null);
  const [qrCodeData, setQrCodeData] = useState<{ code: string; location: string; dataUrl: string } | null>(null);

  // Inspection Checklist Form
  const [inspectionForm, setInspectionForm] = useState({
    pressureOk: true,
    sealIntact: true,
    hoseClear: true,
    signVisible: true,
    unobstructed: true,
    notes: ''
  });

  // Extinguisher Form
  const [extForm, setExtForm] = useState({
    code: '',
    type: 'PQS_ABC' as Extinguisher['type'],
    capacity: '4 kg',
    location_name: '',
    lat: USINA_SANTA_ISABEL_COORDS[0],
    lng: USINA_SANTA_ISABEL_COORDS[1],
    selo_inmetro: '',
    next_recharge_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    hydrostatic_test_date: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  // Brigadists Filter & Modal
  const [memberSearch, setMemberSearch] = useState('');
  const [memberShiftFilter, setMemberShiftFilter] = useState<string>('all');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState({
    employee_id: '',
    role_in_brigade: 'brigadista_combate' as BrigadeMember['role_in_brigade'],
    shift: 'Turno 1 (06:00 - 14:00)',
    station_location: 'Setor de Produção',
    training_cert_code: '',
    training_expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: ''
  });

  // Meeting Points & Drills Modal
  const [showAddPointModal, setShowAddPointModal] = useState(false);
  const [pointForm, setPointForm] = useState({
    code: '',
    name: '',
    lat: USINA_SANTA_ISABEL_COORDS[0],
    lng: USINA_SANTA_ISABEL_COORDS[1],
    capacity_people: 80,
    evacuated_sectors: '',
    coordinator_employee_id: '',
    description: ''
  });

  // Evacuation Drill Stopwatch
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const stopwatchTimerRef = useRef<any>(null);
  const [showDrillModal, setShowDrillModal] = useState(false);
  const [drillForm, setDrillForm] = useState({
    title: 'Simulado Geral de Abandono Semestral',
    date: new Date().toISOString().split('T')[0],
    evacuation_time_seconds: 0,
    total_evacuated_people: 65,
    meeting_point_id: '',
    drill_type: 'simulado_geral' as EvacuationDrill['drill_type'],
    evaluation: 'excelente' as EvacuationDrill['evaluation'],
    observations: ''
  });

  // Load all data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, extsRes, membersRes, pointsRes, drillsRes, empsRes] = await Promise.all([
        api.get<BrigadeStats>('/brigade/stats'),
        api.get<Extinguisher[]>('/brigade/extinguishers'),
        api.get<any[]>('/brigade/members'),
        api.get<any[]>('/brigade/meeting-points'),
        api.get<EvacuationDrill[]>('/brigade/drills'),
        api.get<Employee[]>('/employees')
      ]);

      setStats(statsRes);
      setExtinguishers(extsRes);
      setMembers(membersRes);
      setMeetingPoints(pointsRes);
      setDrills(drillsRes);
      setEmployees(empsRes);
    } catch (err) {
      console.error('Erro ao carregar dados da Brigada:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Stopwatch effect
  useEffect(() => {
    if (stopwatchRunning) {
      stopwatchTimerRef.current = setInterval(() => {
        setStopwatchSeconds(prev => prev + 1);
      }, 1000);
    } else if (stopwatchTimerRef.current) {
      clearInterval(stopwatchTimerRef.current);
    }
    return () => {
      if (stopwatchTimerRef.current) clearInterval(stopwatchTimerRef.current);
    };
  }, [stopwatchRunning]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle on-duty status
  const handleToggleDuty = async (memberId: string) => {
    try {
      await api.put(`/brigade/members/${memberId}/toggle-duty`, {});
      fetchData();
    } catch (err) {
      alert('Erro ao atualizar status de plantão.');
    }
  };

  // Submit Extinguisher Inspection
  const handleSaveInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingExt) return;

    try {
      const isApproved =
        inspectionForm.pressureOk &&
        inspectionForm.sealIntact &&
        inspectionForm.hoseClear &&
        inspectionForm.signVisible &&
        inspectionForm.unobstructed;

      await api.post(`/brigade/extinguishers/${inspectingExt.id}/inspect`, {
        ...inspectionForm,
        status: isApproved ? 'aprovado' : 'reprovado'
      });

      setInspectingExt(null);
      setInspectionForm({
        pressureOk: true,
        sealIntact: true,
        hoseClear: true,
        signVisible: true,
        unobstructed: true,
        notes: ''
      });
      fetchData();
      alert('Inspeção registrada com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar inspeção.');
    }
  };

  // Fetch QR Code for Extinguisher
  const handleOpenQrCode = async (ext: Extinguisher) => {
    try {
      const origin = encodeURIComponent(window.location.origin);
      const res = await api.get<{ qrCodeDataUrl: string }>(`/brigade/extinguishers/${ext.id}/qrcode?origin=${origin}`);
      setQrCodeData({
        code: ext.code,
        location: ext.location_name,
        dataUrl: res.qrCodeDataUrl
      });
    } catch (err) {
      alert('Erro ao obter QR Code');
    }
  };

  // Create Extinguisher
  const handleCreateExtinguisher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/brigade/extinguishers', extForm);
      setShowAddExtModal(false);
      setExtForm({
        code: '',
        type: 'PQS_ABC',
        capacity: '4 kg',
        location_name: '',
        lat: USINA_SANTA_ISABEL_COORDS[0],
        lng: USINA_SANTA_ISABEL_COORDS[1],
        selo_inmetro: '',
        next_recharge_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        hydrostatic_test_date: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
      fetchData();
      alert('Extintor cadastrado com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar extintor.');
    }
  };

  // Delete Extinguisher
  const handleDeleteExtinguisher = async (id: string, code: string) => {
    if (!confirm(`Deseja realmente excluir o extintor ${code}?`)) return;
    try {
      await api.delete(`/brigade/extinguishers/${id}`);
      fetchData();
    } catch (err) {
      alert('Erro ao excluir extintor.');
    }
  };

  // Create Brigadist Member
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.employee_id) {
      alert('Selecione um funcionário.');
      return;
    }
    try {
      await api.post('/brigade/members', memberForm);
      setShowAddMemberModal(false);
      setMemberForm({
        employee_id: '',
        role_in_brigade: 'brigadista_combate',
        shift: 'Turno 1 (06:00 - 14:00)',
        station_location: 'Setor de Produção',
        training_cert_code: '',
        training_expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: ''
      });
      fetchData();
      alert('Brigadista cadastrado com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar brigadista.');
    }
  };

  // Delete Member
  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`Remover ${name} do quadro de brigadistas?`)) return;
    try {
      await api.delete(`/brigade/members/${id}`);
      fetchData();
    } catch (err) {
      alert('Erro ao excluir brigadista.');
    }
  };

  // Create Meeting Point
  const handleCreatePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sectorsArray = pointForm.evacuated_sectors
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      await api.post('/brigade/meeting-points', {
        ...pointForm,
        evacuated_sectors: sectorsArray
      });

      setShowAddPointModal(false);
      setPointForm({
        code: '',
        name: '',
        lat: USINA_SANTA_ISABEL_COORDS[0],
        lng: USINA_SANTA_ISABEL_COORDS[1],
        capacity_people: 80,
        evacuated_sectors: '',
        coordinator_employee_id: '',
        description: ''
      });
      fetchData();
      alert('Ponto de Encontro cadastrado com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar ponto de encontro.');
    }
  };

  // Delete Meeting Point
  const handleDeletePoint = async (id: string, code: string) => {
    if (!confirm(`Deseja realmente remover o ponto de encontro ${code}?`)) return;
    try {
      await api.delete(`/brigade/meeting-points/${id}`);
      fetchData();
    } catch (err) {
      alert('Erro ao excluir ponto de encontro.');
    }
  };

  // Record Evacuation Drill
  const handleSaveDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/brigade/drills', {
        ...drillForm,
        evacuation_time_seconds: drillForm.evacuation_time_seconds || stopwatchSeconds
      });

      setShowDrillModal(false);
      setStopwatchRunning(false);
      setStopwatchSeconds(0);
      setDrillForm({
        title: 'Simulado Geral de Abandono',
        date: new Date().toISOString().split('T')[0],
        evacuation_time_seconds: 0,
        total_evacuated_people: 50,
        meeting_point_id: '',
        drill_type: 'simulado_geral',
        evaluation: 'excelente',
        observations: ''
      });
      fetchData();
      alert('Simulado de evacuação registrado com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar simulado.');
    }
  };

  // Filtered Extinguishers
  const filteredExtinguishers = extinguishers.filter(ext => {
    const matchSearch =
      ext.code.toLowerCase().includes(extSearch.toLowerCase()) ||
      ext.location_name.toLowerCase().includes(extSearch.toLowerCase());
    const matchType = extTypeFilter === 'all' || ext.type === extTypeFilter;
    return matchSearch && matchType;
  });

  // Filtered Members
  const filteredMembers = members.filter(m => {
    const name = m.employee_name || '';
    const matchSearch =
      name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.station_location.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.role_in_brigade.toLowerCase().includes(memberSearch.toLowerCase());
    const matchShift = memberShiftFilter === 'all' || m.shift === memberShiftFilter;
    return matchSearch && matchShift;
  });

  // On duty members for quick emergency access
  const onDutyMembers = members.filter(m => m.is_on_duty);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & EMERGENCY CALL STRIP */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-red-950 via-slate-900 to-slate-900 p-5 md:p-6 rounded-3xl border border-red-900/40 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/30">
              <Flame className="w-6 h-6 animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Brigada de Incêndio</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30">
                  NR-23 & IT-17
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400">
                Gestão tática de extintores, simulados de evacuação e brigadistas em plantão.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Emergency Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="tel:193"
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs md:text-sm shadow-lg shadow-red-600/30 hover:scale-105 transition-all"
          >
            <PhoneCall className="w-4 h-4 animate-bounce" />
            DISCAR 193 (BOMBEIROS)
          </a>

          {onDutyMembers.length > 0 && onDutyMembers[0].employee_phone && (
            <a
              href={`tel:${onDutyMembers[0].employee_phone}`}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl font-bold text-xs shadow-sm transition-all"
            >
              <Phone className="w-4 h-4" />
              Líder Plantão ({onDutyMembers[0].employee_name?.split(' ')[0]})
            </a>
          )}
        </div>
      </div>

      {/* 2. STATS KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* KPI 1: Extintores */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Extintores Cadastrados</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{stats?.extinguishers.total || 0}</span>
              {stats?.extinguishers.expired ? (
                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-md">
                  {stats.extinguishers.expired} vencidos
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                  100% em dia
                </span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg">
            🧯
          </div>
        </div>

        {/* KPI 2: Brigadistas em Plantão */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Brigadistas em Plantão</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-blue-600">{stats?.members.onDuty || 0}</span>
              <span className="text-[11px] text-slate-400 font-medium">de {stats?.members.total || 0} ativos</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Pontos de Encontro */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Pontos de Encontro</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-600">{stats?.meetingPoints.total || 0}</span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                Evacuação
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
            🚩
          </div>
        </div>

        {/* KPI 4: Último Simulado */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Simulados Realizados</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{stats?.drills.total || 0}</span>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md">
                {stats?.drills.lastDate ? new Date(stats.drills.lastDate).toLocaleDateString('pt-BR') : 'Sem registros'}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveTab('mapa')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all ${
            activeTab === 'mapa'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MapPin className="w-4 h-4" />
          🛰️ Mapa Tático da Brigada
        </button>

        <button
          onClick={() => setActiveTab('extintores')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all ${
            activeTab === 'extintores'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>🧯</span>
          Extintores & Inspeções
          {stats?.extinguishers.expired ? (
            <span className="bg-white text-red-600 px-1.5 py-0.2 rounded-full text-[10px] font-black">
              {stats.extinguishers.expired}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab('brigadistas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all ${
            activeTab === 'brigadistas'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Brigadistas de Plantão
          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full text-[10px] font-black">
            {stats?.members.onDuty || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('pontos_encontro')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all ${
            activeTab === 'pontos_encontro'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>🚩</span>
          Pontos de Encontro & Simulados
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: MAPA TÁTICO (SATELLITE VIEW USINA SANTA ISABEL - NOVO HORIZONTE) */}
      {/* ======================================================== */}
      {activeTab === 'mapa' && (
        <div className="space-y-4">
          <div className="relative isolate z-0 rounded-3xl overflow-hidden shadow-xl border-2 border-slate-700/50">
            {/* Top Controls on Map */}
            <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              {/* Left: Location & Layer Filter */}
              <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
                <div className="bg-slate-950/90 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 border border-slate-700 backdrop-blur-sm">
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                  <span>Usina Santa Isabel - Novo Horizonte</span>
                </div>

                {/* Layer pills */}
                <div className="bg-slate-950/85 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 flex items-center gap-1 shadow-lg">
                  <button
                    onClick={() => setMapLayerFilter('all')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      mapLayerFilter === 'all' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Todos ({extinguishers.length + meetingPoints.length + members.length})
                  </button>
                  <button
                    onClick={() => setMapLayerFilter('extinguishers')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      mapLayerFilter === 'extinguishers' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    🧯 Extintores ({extinguishers.length})
                  </button>
                  <button
                    onClick={() => setMapLayerFilter('points')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      mapLayerFilter === 'points' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    🚩 Pontos ({meetingPoints.length})
                  </button>
                  <button
                    onClick={() => setMapLayerFilter('members')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      mapLayerFilter === 'members' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    🧑‍🚒 Brigadistas ({members.filter(m => m.lat && m.lng).length})
                  </button>
                </div>
              </div>

              {/* Right: Map Style Switcher (Satellite vs Streets) */}
              <div className="flex items-center gap-2 pointer-events-auto">
                <div className="bg-slate-950/85 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 flex items-center shadow-lg">
                  <button
                    onClick={() => setMapMode('satellite')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      mapMode === 'satellite' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>🛰️ Satélite</span>
                  </button>
                  <button
                    onClick={() => setMapMode('streets')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      mapMode === 'streets' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Ruas</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Click to add hint banner */}
            <div className="absolute bottom-3 left-3 z-20 bg-slate-950/80 text-slate-200 text-[11px] px-3 py-1.5 rounded-xl border border-slate-700 shadow-md backdrop-blur-sm pointer-events-none">
              💡 Clique em qualquer ponto do mapa para marcar novo extintor ou ponto de encontro
            </div>

            {/* LEAFLET MAP CONTAINER */}
            <div style={{ height: '620px', width: '100%' }}>
              <MapContainer
                center={USINA_SANTA_ISABEL_COORDS}
                zoom={16}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%', background: '#0f172a' }}
              >
                {mapMode === 'satellite' ? (
                  <TileLayer
                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                    maxZoom={20}
                    attribution="&copy; Google Satellite Imagery"
                  />
                ) : (
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                    attribution="&copy; OpenStreetMap contributors"
                  />
                )}

                {/* Map Click Listener */}
                <MapClickHandler
                  onMapClick={(lat, lng) => {
                    setQuickAddCoords({ lat, lng });
                  }}
                />

                {/* RENDER EXTINGUISHERS */}
                {(mapLayerFilter === 'all' || mapLayerFilter === 'extinguishers') &&
                  extinguishers.map(ext => (
                    <Marker
                      key={`ext-${ext.id}`}
                      position={[ext.lat, ext.lng]}
                      icon={createExtinguisherIcon(ext.status)}
                      eventHandlers={{
                        click: () => setSelectedMapItem({ type: 'extinguisher', data: ext })
                      }}
                    />
                  ))}

                {/* RENDER MEETING POINTS */}
                {(mapLayerFilter === 'all' || mapLayerFilter === 'points') &&
                  meetingPoints.map(point => (
                    <Marker
                      key={`point-${point.id}`}
                      position={[point.lat, point.lng]}
                      icon={createMeetingPointIcon()}
                      eventHandlers={{
                        click: () => setSelectedMapItem({ type: 'point', data: point })
                      }}
                    />
                  ))}

                {/* RENDER BRIGADISTS ON DUTY / STATIONS */}
                {(mapLayerFilter === 'all' || mapLayerFilter === 'members') &&
                  members
                    .filter(m => m.lat && m.lng)
                    .map(m => (
                      <Marker
                        key={`member-${m.id}`}
                        position={[m.lat!, m.lng!]}
                        icon={createBrigadistIcon(m.is_on_duty)}
                        eventHandlers={{
                          click: () => setSelectedMapItem({ type: 'member', data: m })
                        }}
                      />
                    ))}
              </MapContainer>
            </div>
          </div>

          {/* Quick Add at Coordinate Floating Bar */}
          {quickAddCoords && (
            <div className="bg-slate-900 border border-slate-700 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold">📍</span>
                <div>
                  <p className="font-bold text-sm">Coordenada selecionada no mapa:</p>
                  <p className="text-xs font-mono text-amber-400">
                    Lat: {quickAddCoords.lat.toFixed(6)} | Lng: {quickAddCoords.lng.toFixed(6)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setExtForm(prev => ({ ...prev, lat: quickAddCoords.lat, lng: quickAddCoords.lng }));
                    setShowAddExtModal(true);
                    setQuickAddCoords(null);
                  }}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>🧯</span> Adicionar Extintor Aqui
                </button>
                <button
                  onClick={() => {
                    setPointForm(prev => ({ ...prev, lat: quickAddCoords.lat, lng: quickAddCoords.lng }));
                    setShowAddPointModal(true);
                    setQuickAddCoords(null);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>🚩</span> Ponto de Encontro Aqui
                </button>
                <button
                  onClick={() => setQuickAddCoords(null)}
                  className="p-2 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: EXTINTORES & INSPEÇÕES */}
      {/* ======================================================== */}
      {activeTab === 'extintores' && (
        <div className="space-y-4">
          {/* Action & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar extintor por código ou local..."
                  value={extSearch}
                  onChange={e => setExtSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <select
                value={extTypeFilter}
                onChange={e => setExtTypeFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="all">Todos os Agentes</option>
                <option value="PQS_ABC">Pó Químico ABC</option>
                <option value="PQS_BC">Pó Químico BC</option>
                <option value="CO2">Gás Carbônico (CO2)</option>
                <option value="AGUA">Água Pressurizada (AP)</option>
                <option value="ESPUMA">Espuma Mecânica</option>
              </select>
            </div>

            {can('brigada', 'create') && (
              <button
                onClick={() => setShowAddExtModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-red-600/20"
              >
                <Plus className="w-4 h-4" />
                Novo Extintor
              </button>
            )}
          </div>

          {/* Extinguishers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExtinguishers.map(ext => {
              const isExpired = new Date(ext.next_recharge_date) < new Date();
              const isHydroExpired = new Date(ext.hydrostatic_test_date) < new Date();
              const lastInspection = ext.inspections && ext.inspections.length > 0 ? ext.inspections[0] : null;

              return (
                <div
                  key={ext.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 hover:border-red-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Code & Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🧯</span>
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-base">{ext.code}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {ext.type.replace('_', ' ')} • {ext.capacity}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isExpired || ext.status === 'vencido'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : ext.status === 'em_manutencao'
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isExpired ? 'VENCIDO' : ext.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Location & Details */}
                    <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5 mb-3">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      {ext.location_name}
                    </p>

                    <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] space-y-1.5 border border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Selo INMETRO:</span>
                        <span className="font-mono font-bold text-slate-800">{ext.selo_inmetro || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Próxima Recarga:</span>
                        <span
                          className={`font-bold ${
                            isExpired ? 'text-red-600 font-black' : 'text-slate-800'
                          }`}
                        >
                          {new Date(ext.next_recharge_date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Teste Hidrostático:</span>
                        <span
                          className={`font-semibold ${
                            isHydroExpired ? 'text-red-600' : 'text-slate-700'
                          }`}
                        >
                          {new Date(ext.hydrostatic_test_date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-200/60">
                        <span className="text-slate-500">Última Inspeção:</span>
                        <span className="font-semibold text-slate-800">
                          {lastInspection ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-bold">
                              <CheckCircle className="w-3 h-3" />
                              {new Date(lastInspection.date).toLocaleDateString('pt-BR')}
                            </span>
                          ) : (
                            <span className="text-amber-600">Pendente</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-1.5 pt-3 mt-3 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setInspectingExt(ext);
                        setInspectionForm({
                          pressureOk: true,
                          sealIntact: true,
                          hoseClear: true,
                          signVisible: true,
                          unobstructed: true,
                          notes: ''
                        });
                      }}
                      className="flex-1 py-1.5 px-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      Inspeção Mensal
                    </button>

                    <button
                      onClick={() => handleOpenQrCode(ext)}
                      title="QR Code da Placa"
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>

                    {can('brigada', 'delete') && (
                      <button
                        onClick={() => handleDeleteExtinguisher(ext.id, ext.code)}
                        title="Excluir Extintor"
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: BRIGADISTAS & CONTROLE DE PLANTÃO */}
      {/* ======================================================== */}
      {activeTab === 'brigadistas' && (
        <div className="space-y-4">
          {/* Header Action & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar brigadista por nome ou setor..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <select
                value={memberShiftFilter}
                onChange={e => setMemberShiftFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="all">Todos os Turnos</option>
                <option value="Turno 1 (06:00 - 14:00)">Turno 1 (06:00 - 14:00)</option>
                <option value="Turno 2 (14:00 - 22:00)">Turno 2 (14:00 - 22:00)</option>
                <option value="Turno 3 (22:00 - 06:00)">Turno 3 (22:00 - 06:00)</option>
                <option value="Administrativo / Geral">Administrativo / Geral</option>
              </select>
            </div>

            {can('brigada', 'create') && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-red-600/20"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Brigadista
              </button>
            )}
          </div>

          {/* Members Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map(m => {
              const isCertExpired = new Date(m.training_expiry_date) < new Date();
              const roleDisplayMap: Record<string, string> = {
                lider: 'Líder Geral da Brigada',
                vice_lider: 'Vice-Líder da Brigada',
                chefe_setor: 'Chefe de Setor',
                brigadista_combate: 'Brigadista de Combate',
                socorrista: 'Socorrista / Primeiros Socorros'
              };

              return (
                <div
                  key={m.id}
                  className={`bg-white rounded-2xl border transition-all p-4 flex flex-col justify-between shadow-sm ${
                    m.is_on_duty ? 'border-blue-300 ring-2 ring-blue-500/10' : 'border-slate-200'
                  }`}
                >
                  <div>
                    {/* Member Top Card */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-slate-900 text-white font-extrabold flex items-center justify-center text-sm shadow-md border-2 border-red-500">
                          {m.employee_name ? m.employee_name.charAt(0).toUpperCase() : 'B'}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-sm leading-tight">
                            {m.employee_name || 'Colaborador'}
                          </h3>
                          <p className="text-[11px] text-slate-500">{m.employee_role || 'Brigadista'}</p>
                          <span className="inline-block mt-0.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-red-100 text-red-800">
                            {roleDisplayMap[m.role_in_brigade] || m.role_in_brigade}
                          </span>
                        </div>
                      </div>

                      {/* Plantão Toggle Switch */}
                      <button
                        onClick={() => handleToggleDuty(m.id)}
                        title="Alternar Plantão"
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-black tracking-tight transition-all flex items-center gap-1 ${
                          m.is_on_duty
                            ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 animate-pulse'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        <Activity className="w-3 h-3" />
                        {m.is_on_duty ? 'EM PLANTÃO' : 'FOLGA'}
                      </button>
                    </div>

                    {/* Member Metadata */}
                    <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] space-y-1.5 border border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Posto de Atuação:</span>
                        <span className="font-semibold text-slate-800">{m.station_location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Turno de Trabalho:</span>
                        <span className="font-semibold text-slate-800">{m.shift}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Treinamento IT-17:</span>
                        <span
                          className={`font-bold ${
                            isCertExpired ? 'text-red-600 font-black' : 'text-emerald-700'
                          }`}
                        >
                          {isCertExpired ? 'VENCIDO - RECICLAR' : `Vence ${new Date(m.training_expiry_date).toLocaleDateString('pt-BR')}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Phone Contact */}
                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-100">
                    {m.employee_phone ? (
                      <a
                        href={`tel:${m.employee_phone}`}
                        className="flex-1 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Ligar ({m.employee_phone})
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Sem telefone</span>
                    )}

                    {can('brigada', 'delete') && (
                      <button
                        onClick={() => handleDeleteMember(m.id, m.employee_name || 'Brigadista')}
                        title="Remover Brigadista"
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: PONTOS DE ENCONTRO & SIMULADOS DE ABANDONO */}
      {/* ======================================================== */}
      {activeTab === 'pontos_encontro' && (
        <div className="space-y-6">
          {/* TOP SECTION: LIVE EVACUATION STOPWATCH (CRONÔMETRO DE SIMULADO) */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 text-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                    Cronômetro Tático de Evacuação
                  </span>
                  <span className="text-slate-400 text-xs">Instrução Técnica 17 / NR-23</span>
                </div>
                <h2 className="text-xl font-black text-white mt-1">Simulado de Abandono de Área</h2>
                <p className="text-xs text-slate-400 max-w-lg mt-0.5">
                  Acione o cronômetro assim que o alarme soar e pause quando o último colaborador chegar ao Ponto de Encontro.
                </p>
              </div>

              {/* Digital Stopwatch Display */}
              <div className="flex items-center gap-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
                <div className="font-mono text-4xl md:text-5xl font-black text-amber-400 tracking-wider">
                  {formatTimer(stopwatchSeconds)}
                </div>

                <div className="flex flex-col gap-1.5">
                  {!stopwatchRunning ? (
                    <button
                      onClick={() => setStopwatchRunning(true)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Iniciar
                    </button>
                  ) : (
                    <button
                      onClick={() => setStopwatchRunning(false)}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all animate-pulse"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      Pausar
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setStopwatchRunning(false);
                        setStopwatchSeconds(0);
                      }}
                      title="Zerar Cronômetro"
                      className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setDrillForm(prev => ({ ...prev, evacuation_time_seconds: stopwatchSeconds }));
                        setShowDrillModal(true);
                      }}
                      className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-[11px] shadow-sm"
                    >
                      Gravar Simulado
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: PONTOS DE ENCONTRO CARDS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>🚩</span> Pontos de Encontro Cadastrados (Áreas Seguras)
                </h3>
                <p className="text-xs text-slate-500">Locais abertos para contagem e verificação da equipe evacuada.</p>
              </div>

              {can('brigada', 'create') && (
                <button
                  onClick={() => setShowAddPointModal(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  <Plus className="w-4 h-4" />
                  Novo Ponto de Encontro
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meetingPoints.map(point => (
                <div
                  key={point.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-3xl">🚩</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {point.code}
                            </span>
                            <h4 className="font-extrabold text-slate-900 text-base">{point.name}</h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{point.description || 'Ponto de reunião externa.'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 border border-slate-100 mt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Capacidade Prevista:</span>
                        <span className="font-bold text-slate-800">{point.capacity_people} pessoas</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Coordenador do Ponto:</span>
                        <span className="font-bold text-slate-800">
                          {point.coordinator_name || 'Não designado'}
                          {point.coordinator_phone ? ` (${point.coordinator_phone})` : ''}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-slate-200">
                        <span className="text-slate-500 block mb-1">Setores atendidos:</span>
                        <div className="flex flex-wrap gap-1">
                          {point.evacuated_sectors && point.evacuated_sectors.length > 0 ? (
                            point.evacuated_sectors.map((sec, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-semibold text-slate-700"
                              >
                                {sec}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Geral da planta</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                    <span className="font-mono text-[10px] text-slate-400">
                      GPS: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                    </span>
                    {can('brigada', 'delete') && (
                      <button
                        onClick={() => handleDeletePoint(point.id, point.code)}
                        className="text-red-500 hover:text-red-700 font-semibold text-[11px]"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: SIMULADOS DE ABANDONO HISTÓRICO */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  Histórico de Simulados Realizados
                </h3>
                <p className="text-xs text-slate-500">Registro oficial de prontidão conforme NR-23.</p>
              </div>

              <button
                onClick={() => setShowDrillModal(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md"
              >
                <Plus className="w-4 h-4" />
                Registrar Manualmente
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Simulado</th>
                      <th className="px-4 py-3">Tempo de Abandono</th>
                      <th className="px-4 py-3">Pessoas Evacuadas</th>
                      <th className="px-4 py-3">Avaliação</th>
                      <th className="px-4 py-3">Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drills.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {new Date(d.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 block">{d.title}</span>
                          <span className="text-[10px] text-slate-500">{d.observations || 'Sem observações adicionais.'}</span>
                        </td>
                        <td className="px-4 py-3 font-mono font-black text-red-600 text-sm">
                          {formatTimer(d.evacuation_time_seconds)} ({d.evacuation_time_seconds}s)
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {d.total_evacuated_people} colaboradores
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              d.evaluation === 'excelente'
                                ? 'bg-emerald-100 text-emerald-800'
                                : d.evaluation === 'bom'
                                ? 'bg-blue-100 text-blue-800'
                                : d.evaluation === 'regular'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {d.evaluation.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {d.responsible_name}
                        </td>
                      </tr>
                    ))}
                    {drills.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-400">
                          Nenhum simulado de abandono registrado ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: DETALHES DE ELEMENTO CLICADO NO MAPA (z-[99999]) */}
      {/* ======================================================== */}
      {selectedMapItem && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {selectedMapItem.type === 'extinguisher' ? '🧯' : selectedMapItem.type === 'point' ? '🚩' : '🧑‍🚒'}
                </span>
                <h3 className="font-bold text-sm">
                  {selectedMapItem.type === 'extinguisher'
                    ? `Extintor: ${selectedMapItem.data.code}`
                    : selectedMapItem.type === 'point'
                    ? `Ponto de Encontro: ${selectedMapItem.data.code}`
                    : `Brigadista: ${selectedMapItem.data.employee_name || 'Brigadista'}`}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMapItem(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {selectedMapItem.type === 'extinguisher' && (
                <>
                  <div className="bg-slate-50 p-3 rounded-2xl space-y-1.5 text-xs">
                    <p>
                      <strong>Local:</strong> {selectedMapItem.data.location_name}
                    </p>
                    <p>
                      <strong>Agente:</strong> {selectedMapItem.data.type} ({selectedMapItem.data.capacity})
                    </p>
                    <p>
                      <strong>Selo INMETRO:</strong> {selectedMapItem.data.selo_inmetro || 'N/A'}
                    </p>
                    <p>
                      <strong>Próxima Recarga:</strong>{' '}
                      {new Date(selectedMapItem.data.next_recharge_date).toLocaleDateString('pt-BR')}
                    </p>
                    <p>
                      <strong>Status:</strong>{' '}
                      <span className="font-bold text-emerald-600 uppercase">{selectedMapItem.data.status}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => {
                        setInspectingExt(selectedMapItem.data);
                        setSelectedMapItem(null);
                      }}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs shadow-md"
                    >
                      Realizar Inspeção Agora
                    </button>
                    <button
                      onClick={() => {
                        handleOpenQrCode(selectedMapItem.data);
                        setSelectedMapItem(null);
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                    >
                      QR Code
                    </button>
                  </div>
                </>
              )}

              {selectedMapItem.type === 'point' && (
                <>
                  <div className="bg-slate-50 p-3 rounded-2xl space-y-1.5 text-xs">
                    <p>
                      <strong>Nome:</strong> {selectedMapItem.data.name}
                    </p>
                    <p>
                      <strong>Capacidade:</strong> {selectedMapItem.data.capacity_people} pessoas
                    </p>
                    <p>
                      <strong>Coordenador:</strong> {selectedMapItem.data.coordinator_name || 'Não designado'}
                    </p>
                    <p>
                      <strong>Setores:</strong> {selectedMapItem.data.evacuated_sectors?.join(', ') || 'Geral'}
                    </p>
                  </div>
                </>
              )}

              {selectedMapItem.type === 'member' && (
                <>
                  <div className="bg-slate-50 p-3 rounded-2xl space-y-1.5 text-xs">
                    <p>
                      <strong>Nome:</strong> {selectedMapItem.data.employee_name}
                    </p>
                    <p>
                      <strong>Função:</strong> {selectedMapItem.data.role_in_brigade}
                    </p>
                    <p>
                      <strong>Posto:</strong> {selectedMapItem.data.station_location}
                    </p>
                    <p>
                      <strong>Turno:</strong> {selectedMapItem.data.shift}
                    </p>
                    <p>
                      <strong>Plantão:</strong>{' '}
                      <span
                        className={`font-bold ${
                          selectedMapItem.data.is_on_duty ? 'text-emerald-600' : 'text-slate-500'
                        }`}
                      >
                        {selectedMapItem.data.is_on_duty ? 'EM ATIVIDADE' : 'FOLGA'}
                      </span>
                    </p>
                  </div>
                  {selectedMapItem.data.employee_phone && (
                    <a
                      href={`tel:${selectedMapItem.data.employee_phone}`}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Ligar para o Brigadista
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CHECKLIST DE INSPEÇÃO MENSAL (z-[99999]) */}
      {/* ======================================================== */}
      {inspectingExt && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <span>📋</span> Inspeção Mensal no Extintor {inspectingExt.code}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {inspectingExt.type} • {inspectingExt.location_name}
                </p>
              </div>
              <button
                onClick={() => setInspectingExt(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInspection} className="p-5 space-y-4">
              <div className="space-y-2.5">
                <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inspectionForm.pressureOk}
                    onChange={e => setInspectionForm(prev => ({ ...prev, pressureOk: e.target.checked }))}
                    className="w-5 h-5 text-red-600 rounded"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Pressão / Manômetro no Verde (Faixa Adequada)</span>
                    <span className="text-[11px] text-slate-500">Ponteiro na faixa de operação permitida.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inspectionForm.sealIntact}
                    onChange={e => setInspectionForm(prev => ({ ...prev, sealIntact: e.target.checked }))}
                    className="w-5 h-5 text-red-600 rounded"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Lacre Plástico e Pino de Segurança Intactos</span>
                    <span className="text-[11px] text-slate-500">Gatilho travado sem indício de violação.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inspectionForm.hoseClear}
                    onChange={e => setInspectionForm(prev => ({ ...prev, hoseClear: e.target.checked }))}
                    className="w-5 h-5 text-red-600 rounded"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Mangueira e Bico Desobstruídos</span>
                    <span className="text-[11px] text-slate-500">Sem trincas, ressecamento ou ninhos de insetos.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inspectionForm.signVisible}
                    onChange={e => setInspectionForm(prev => ({ ...prev, signVisible: e.target.checked }))}
                    className="w-5 h-5 text-red-600 rounded"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Placa de Sinalização Fotoluminescente Visível</span>
                    <span className="text-[11px] text-slate-500">Sinalização de parede e solo em conformidade.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inspectionForm.unobstructed}
                    onChange={e => setInspectionForm(prev => ({ ...prev, unobstructed: e.target.checked }))}
                    className="w-5 h-5 text-red-600 rounded"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">Acesso ao Extintor 100% Livre e Desobstruído</span>
                    <span className="text-[11px] text-slate-500">Nenhum palete, caixa ou máquina bloqueando o extintor.</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observações da Inspeção:</label>
                <textarea
                  value={inspectionForm.notes}
                  onChange={e => setInspectionForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observações eventuais sobre o cilindro, pintura, suporte..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-500"
                  rows={2}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInspectingExt(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  Salvar Inspeção e Emitir Laudo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: NOVO EXTINTOR (z-[99999]) */}
      {/* ======================================================== */}
      {showAddExtModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span>🧯</span> Cadastrar Novo Extintor
              </h3>
              <button
                onClick={() => setShowAddExtModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExtinguisher} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código / Tag *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: EXT-05"
                    value={extForm.code}
                    onChange={e => setExtForm(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Agente Extintor *</label>
                  <select
                    value={extForm.type}
                    onChange={e => setExtForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  >
                    <option value="PQS_ABC">Pó Químico ABC</option>
                    <option value="PQS_BC">Pó Químico BC</option>
                    <option value="CO2">Gás Carbônico (CO2)</option>
                    <option value="AGUA">Água Pressurizada (AP)</option>
                    <option value="ESPUMA">Espuma Mecânica</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Capacidade</label>
                  <input
                    type="text"
                    placeholder="Ex: 4 kg ou 10 L"
                    value={extForm.capacity}
                    onChange={e => setExtForm(prev => ({ ...prev, capacity: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Selo INMETRO</label>
                  <input
                    type="text"
                    placeholder="Ex: INM-883921"
                    value={extForm.selo_inmetro}
                    onChange={e => setExtForm(prev => ({ ...prev, selo_inmetro: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Localização Descritiva *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Galpão Principal - Coluna 12"
                  value={extForm.location_name}
                  onChange={e => setExtForm(prev => ({ ...prev, location_name: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={extForm.lat}
                    onChange={e => setExtForm(prev => ({ ...prev, lat: parseFloat(e.target.value) }))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={extForm.lng}
                    onChange={e => setExtForm(prev => ({ ...prev, lng: parseFloat(e.target.value) }))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Próxima Recarga</label>
                  <input
                    type="date"
                    required
                    value={extForm.next_recharge_date}
                    onChange={e => setExtForm(prev => ({ ...prev, next_recharge_date: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teste Hidrostático (5 anos)</label>
                  <input
                    type="date"
                    required
                    value={extForm.hydrostatic_test_date}
                    onChange={e => setExtForm(prev => ({ ...prev, hydrostatic_test_date: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddExtModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  Salvar Extintor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: NOVO BRIGADISTA (z-[99999]) */}
      {/* ======================================================== */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-red-500" />
                Cadastrar Membro da Brigada
              </h3>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Selecionar Colaborador *</label>
                <select
                  required
                  value={memberForm.employee_id}
                  onChange={e => setMemberForm(prev => ({ ...prev, employee_id: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="">Selecione um funcionário cadastrado...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.role} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Função na Brigada *</label>
                  <select
                    value={memberForm.role_in_brigade}
                    onChange={e => setMemberForm(prev => ({ ...prev, role_in_brigade: e.target.value as any }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                  >
                    <option value="lider">Líder Geral</option>
                    <option value="vice_lider">Vice-Líder</option>
                    <option value="chefe_setor">Chefe de Setor</option>
                    <option value="brigadista_combate">Brigadista de Combate</option>
                    <option value="socorrista">Socorrista</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Turno *</label>
                  <select
                    value={memberForm.shift}
                    onChange={e => setMemberForm(prev => ({ ...prev, shift: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                  >
                    <option value="Turno 1 (06:00 - 14:00)">Turno 1 (06:00 - 14:00)</option>
                    <option value="Turno 2 (14:00 - 22:00)">Turno 2 (14:00 - 22:00)</option>
                    <option value="Turno 3 (22:00 - 06:00)">Turno 3 (22:00 - 06:00)</option>
                    <option value="Administrativo / Geral">Administrativo / Geral</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Posto de Atendimento Habitual</label>
                <input
                  type="text"
                  placeholder="Ex: Sala de Máquinas ou Recepção"
                  value={memberForm.station_location}
                  onChange={e => setMemberForm(prev => ({ ...prev, station_location: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cód. Certificado IT-17</label>
                  <input
                    type="text"
                    placeholder="Ex: CERT-BRIG-2026"
                    value={memberForm.training_cert_code}
                    onChange={e => setMemberForm(prev => ({ ...prev, training_cert_code: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Validade do Treinamento *</label>
                  <input
                    type="date"
                    required
                    value={memberForm.training_expiry_date}
                    onChange={e => setMemberForm(prev => ({ ...prev, training_expiry_date: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  Salvar Brigadista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: NOVO PONTO DE ENCONTRO (z-[99999]) */}
      {/* ======================================================== */}
      {showAddPointModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span>🚩</span> Cadastrar Ponto de Encontro
              </h3>
              <button
                onClick={() => setShowAddPointModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePoint} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PE-03"
                    value={pointForm.code}
                    onChange={e => setPointForm(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Capacidade (Pessoas)</label>
                  <input
                    type="number"
                    value={pointForm.capacity_people}
                    onChange={e => setPointForm(prev => ({ ...prev, capacity_people: parseInt(e.target.value) }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome / Identificação *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ponto de Encontro 3 - Estacionamento dos Fundos"
                  value={pointForm.name}
                  onChange={e => setPointForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={pointForm.lat}
                    onChange={e => setPointForm(prev => ({ ...prev, lat: parseFloat(e.target.value) }))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={pointForm.lng}
                    onChange={e => setPointForm(prev => ({ ...prev, lng: parseFloat(e.target.value) }))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Setores Evacuados (separar por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: Caldeiraria, Pintura, Logística"
                  value={pointForm.evacuated_sectors}
                  onChange={e => setPointForm(prev => ({ ...prev, evacuated_sectors: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPointModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  Salvar Ponto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: REGISTRO DE SIMULADO (z-[99999]) */}
      {/* ======================================================== */}
      {showDrillModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                Registrar Simulado de Abandono
              </h3>
              <button
                onClick={() => setShowDrillModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDrill} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título do Simulado *</label>
                <input
                  type="text"
                  required
                  value={drillForm.title}
                  onChange={e => setDrillForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data Realizada</label>
                  <input
                    type="date"
                    required
                    value={drillForm.date}
                    onChange={e => setDrillForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tempo Total (segundos) *</label>
                  <input
                    type="number"
                    required
                    value={drillForm.evacuation_time_seconds || stopwatchSeconds}
                    onChange={e => setDrillForm(prev => ({ ...prev, evacuation_time_seconds: parseInt(e.target.value) }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-red-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pessoas Evacuadas</label>
                  <input
                    type="number"
                    value={drillForm.total_evacuated_people}
                    onChange={e => setDrillForm(prev => ({ ...prev, total_evacuated_people: parseInt(e.target.value) }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Avaliação do Desempenho</label>
                  <select
                    value={drillForm.evaluation}
                    onChange={e => setDrillForm(prev => ({ ...prev, evaluation: e.target.value as any }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  >
                    <option value="excelente">Excelente (Abaixo do tempo limite)</option>
                    <option value="bom">Bom (Dentro do tempo)</option>
                    <option value="regular">Regular (Houve retenção leve)</option>
                    <option value="insatisfatorio">Insatisfatório (Requer repetição)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ponto de Encontro Utilizado</label>
                <select
                  value={drillForm.meeting_point_id}
                  onChange={e => setDrillForm(prev => ({ ...prev, meeting_point_id: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                >
                  <option value="">Selecione o ponto de encontro...</option>
                  {meetingPoints.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observações e Recomendações</label>
                <textarea
                  value={drillForm.observations}
                  onChange={e => setDrillForm(prev => ({ ...prev, observations: e.target.value }))}
                  placeholder="Comportamento dos colaboradores, tempo de resposta dos brigadistas..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                  rows={2}
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDrillModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  Gravar Relatório do Simulado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 7: QR CODE DA PLACA DE EXTINTOR (z-[99999]) */}
      {/* ======================================================== */}
      {qrCodeData && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-center p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-extrabold text-sm text-slate-900">Placa QR Code do Extintor</span>
              <button
                onClick={() => setQrCodeData(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 inline-block">
              <img
                src={qrCodeData.dataUrl}
                alt="QR Code Extintor"
                className="w-52 h-52 mx-auto rounded-lg"
              />
            </div>

            <div>
              <h4 className="font-black text-xl text-slate-900">{qrCodeData.code}</h4>
              <p className="text-xs text-slate-500 font-medium">{qrCodeData.location}</p>
            </div>

            <p className="text-[11px] text-slate-400">
              Imprima e fixe acima do extintor para acesso rápido ao checklist de inspeção e laudos.
            </p>

            <button
              onClick={() => {
                const win = window.open('', '_blank');
                if (win) {
                  win.document.write(`
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <title>Placa Extintor ${qrCodeData.code}</title>
                        <style>
                          @page { size: A4 portrait; margin: 15mm; }
                          * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                          body { margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 90vh; }
                          .plate-card {
                            border: 8px solid #dc2626;
                            border-radius: 24px;
                            width: 100%;
                            max-width: 550px;
                            text-align: center;
                            overflow: hidden;
                            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                          }
                          .header-strip {
                            background: #dc2626;
                            color: #ffffff;
                            padding: 16px 20px;
                            font-size: 22px;
                            font-weight: 900;
                            text-transform: uppercase;
                            letter-spacing: 2px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 10px;
                          }
                          .content-body {
                            padding: 28px 24px;
                            background: #fff;
                          }
                          .tag-code {
                            font-size: 32px;
                            font-weight: 900;
                            color: #0f172a;
                            margin: 0 0 8px;
                            font-family: monospace;
                          }
                          .location-name {
                            font-size: 16px;
                            font-weight: 700;
                            color: #475569;
                            margin: 0 0 20px;
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
                            color: #1e293b;
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
                          }
                        </style>
                      </head>
                      <body>
                        <div class="plate-card">
                          <div class="header-strip">
                            🧯 EQUIPAMENTO DE COMBATE A INCÊNDIO
                          </div>
                          <div class="content-body">
                            <h1 class="tag-code">${qrCodeData.code}</h1>
                            <p class="location-name">${qrCodeData.location}</p>

                            <img src="${qrCodeData.dataUrl}" class="qr-image" />

                            <p class="instruction">
                              APONTE A CÂMERA DO SMARTPHONE PARA ACESSAR A FICHA DO EQUIPAMENTO E REGISTRAR A INSPEÇÃO MENSAL
                            </p>

                            <div class="footer-info">
                              Usina Santa Isabel • Brigada de Incêndio SST • Norma NBR 12962 / NR-23
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
                }
              }}
              className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
            >
              <Download className="w-4 h-4" />
              Imprimir Placa de Identificação
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default BrigadePage;
