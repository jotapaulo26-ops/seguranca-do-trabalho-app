import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { api } from '../services/api';
import { getDeviceId } from '../services/deviceId';
import {
  LayoutDashboard,
  Users,
  MapPin,
  FileText,
  Shield,
  FileCheck,
  Settings,
  Database,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  Smartphone,
  PlusCircle,
  Flame,
  QrCode,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  CheckCircle2
} from 'lucide-react';
import { QRScannerModal } from './QRScannerModal';
import { GeofenceAlertBanner } from './GeofenceAlertBanner';

export const Layout: React.FC = () => {
  const { user, logout, can } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow, canInstall, isInstalled, triggerInstall, lastSyncTime } = useConnectivity();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alertSummary, setAlertSummary] = useState<{ totalExpired: number; totalExpiringSoon: number }>({
    totalExpired: 0,
    totalExpiringSoon: 0
  });
  const [brigadeAlerts, setBrigadeAlerts] = useState<number>(0);
  const [scannerOpen, setScannerOpen] = useState(false);

  const deviceId = getDeviceId();

  useEffect(() => {
    // Fetch alert summary periodically for safety badges
    async function fetchAlerts() {
      try {
        const res = await api.get<{ totalExpired: number; totalExpiringSoon: number }>('/employees/alerts/summary');
        setAlertSummary(res);
      } catch (err) {
        // Silently handle
      }

      try {
        const bRes = await api.get<any>('/brigade/stats');
        setBrigadeAlerts((bRes.extinguishers?.expired || 0) + (bRes.members?.expiredCerts || 0));
      } catch (err) {
        // Silently handle
      }
    }
    fetchAlerts();
  }, [location.pathname]);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, show: true },
    {
      label: 'Funcionários',
      path: '/funcionarios',
      icon: Users,
      show: can('employees', 'view'),
      badge: alertSummary.totalExpired > 0 ? alertSummary.totalExpired : undefined,
      badgeColor: 'bg-red-500'
    },
    { label: 'Mapa de Riscos', path: '/mapa', icon: MapPin, show: can('map', 'view') },
    {
      label: 'Brigada de Incêndio',
      path: '/brigada',
      icon: Flame,
      show: can('brigada', 'view') || can('employees', 'view') || true,
      badge: brigadeAlerts > 0 ? brigadeAlerts : undefined,
      badgeColor: 'bg-red-600'
    },
    { label: 'Documentos & APRs', path: '/documentos', icon: FileText, show: can('documents', 'view') },
    { label: 'Perfis & Acessos', path: '/usuarios', icon: Shield, show: can('users', 'view') || can('roles', 'view') },
    { label: 'Auditoria de Ações', path: '/auditoria', icon: FileCheck, show: can('audit', 'view') },
    {
      label: 'Dados',
      path: '/dados',
      icon: Database,
      show: user?.roleId === 'role_admin' || user?.roleName?.toLowerCase() === 'administrador' || user?.email === 'admin@segtrabalho.com.br'
    },
    { label: 'Configurações', path: '/configuracoes', icon: Settings, show: can('settings', 'view') }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row pb-16 md:pb-0">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shrink-0 border-r border-slate-800 relative z-40">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              🛡️
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-white leading-none">SegTrabalho</h1>
              <p className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase mt-1">SST Operacional</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.filter(item => item.show).map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`${item.badgeColor || 'bg-red-500'} text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* QR Code Scanner Quick Button */}
        <div className="px-3 mb-2">
          <button
            onClick={() => setScannerOpen(true)}
            className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-amber-500/40 transition-all shadow-sm active:scale-95"
          >
            <QrCode className="w-4 h-4 text-amber-400" />
            <span>Bipar / Ler QR Code</span>
          </button>
        </div>

        {/* PWA Install Button */}
        {canInstall && (
          <div className="px-3 mb-2">
            <button
              onClick={triggerInstall}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Download className="w-4 h-4 text-emerald-200" />
              <span>Instalar Aplicativo (PWA)</span>
            </button>
          </div>
        )}

        {/* Offline & Connectivity Status Box */}
        <div className="px-3 py-2.5 mx-3 mb-2 bg-slate-800/90 rounded-xl border border-slate-700/80">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              {isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-emerald-400">Online</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[11px] font-bold text-amber-400">Modo Offline</span>
                </>
              )}
            </div>
            <button
              onClick={() => syncNow()}
              disabled={isSyncing || !isOnline}
              title="Sincronizar fila de alterações"
              className="p-1 text-slate-400 hover:text-amber-400 disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>

          {pendingCount > 0 ? (
            <div className="text-[10px] text-amber-300 font-medium bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 mb-1">
              {pendingCount} item(ns) pendente(s) de envio
            </div>
          ) : (
            <div className="text-[10px] text-slate-400">
              {lastSyncTime ? `Sincronizado às ${lastSyncTime}` : 'Dados 100% atualizados'}
            </div>
          )}

          {isOnline && pendingCount > 0 && (
            <button
              onClick={() => syncNow()}
              disabled={isSyncing}
              className="w-full mt-1.5 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded transition-colors flex items-center justify-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Enviar Agora'}
            </button>
          )}
        </div>

        {/* Device Tracker Box in Desktop Sidebar */}
        <div className="px-4 py-3 mx-3 mb-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
          <div className="flex items-center gap-2 text-slate-400 text-[11px] mb-1">
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-slate-300">ID do Aparelho Atual</span>
          </div>
          <p className="text-[10px] font-mono text-amber-300 truncate" title={deviceId}>
            {deviceId}
          </p>
        </div>

        {/* User Card */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-slate-800 text-amber-400 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                <span className="inline-block px-1.5 py-0.2 text-[9px] font-medium rounded bg-amber-500/20 text-amber-300 truncate">
                  {user?.roleName}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sair do Sistema"
              className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE TOP NAVBAR */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black text-xs shadow-sm">
            🛡️
          </div>
          <div>
            <span className="font-black text-sm text-white">SegTrabalho</span>
            <span className="text-[9px] text-amber-400 font-semibold block leading-none">SST Móvel</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Connectivity Pill */}
          <button
            onClick={() => isOnline && pendingCount > 0 && syncNow()}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${
              isOnline
                ? pendingCount > 0
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'bg-rose-500/20 border-rose-500/50 text-rose-300'
            }`}
          >
            {isOnline ? (
              pendingCount > 0 ? (
                <>
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{pendingCount} pend.</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span>Online</span>
                </>
              )
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-rose-400" />
                <span>Offline{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
              </>
            )}
          </button>

          <button
            onClick={() => setScannerOpen(true)}
            title="Escanear QR Code de Campo"
            className="p-1.5 text-amber-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <QrCode className="w-5 h-5" />
          </button>
          {alertSummary.totalExpired > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              {alertSummary.totalExpired}
            </span>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex">
          <div className="w-4/5 max-w-xs bg-slate-900 h-full p-4 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-3">
                <span className="font-bold text-white text-sm">Menu do Sistema</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                {navItems.filter(item => item.show).map(item => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-3 rounded-xl font-medium text-sm ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`
                      }
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              {canInstall && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    triggerInstall();
                  }}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95"
                >
                  <Download className="w-4 h-4 text-emerald-200" />
                  <span>Instalar Aplicativo no Celular</span>
                </button>
              )}

              {/* Mobile Connectivity Card */}
              <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {isOnline ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-bold text-emerald-400">Online</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="font-bold text-amber-400">Modo Offline</span>
                      </>
                    )}
                  </div>
                  {isOnline && pendingCount > 0 && (
                    <button
                      onClick={() => syncNow()}
                      disabled={isSyncing}
                      className="text-[10px] font-bold text-amber-400 underline"
                    >
                      {isSyncing ? 'Enviando...' : 'Sincronizar'}
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-slate-400">
                  {pendingCount > 0
                    ? `${pendingCount} alteração(ões) pendente(s)`
                    : lastSyncTime
                    ? `Sincronizado às ${lastSyncTime}`
                    : '100% Sincronizado'}
                </div>
              </div>

              <div className="text-xs text-slate-400 truncate">
                Dispositivo: <span className="font-mono text-amber-300">{deviceId}</span>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sair da Conta
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* MAIN CONTENT WRAPPER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-0">
        {/* Offline Operation Notification Banner */}
        {!isOnline && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-900 bg-amber-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Modo Offline Ativo:</strong> Você está sem sinal de internet. Novas APRs, assinaturas e inspeções serão salvas no aparelho e sincronizadas automaticamente ao reconectar.
                {pendingCount > 0 && ` (${pendingCount} pendência(s) na fila)`}
              </span>
            </div>
          </div>
        )}

        {/* Automatic Sync in Progress Banner */}
        {isOnline && pendingCount > 0 && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 text-xs text-blue-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-blue-600 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                Conexão restabelecida! Sincronizando {pendingCount} alteração(ões) pendente(s) com a base central...
              </span>
            </div>
            <button
              onClick={() => syncNow()}
              disabled={isSyncing}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 underline shrink-0 ml-2"
            >
              {isSyncing ? 'Enviando...' : 'Sincronizar Agora'}
            </button>
          </div>
        )}

        {/* Critical Alerts Banner (Top of page) */}
        {alertSummary.totalExpired > 0 && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between text-xs text-red-800">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                <strong>Atenção SST:</strong> Existem <strong>{alertSummary.totalExpired} treinamento(s) vencido(s)</strong> que impedem a liberação de funcionários em APRs de Altura / Espaço Confinado!
              </span>
            </div>
            <button
              onClick={() => navigate('/funcionarios')}
              className="font-bold underline text-red-700 hover:text-red-900 shrink-0 ml-2"
            >
              Verificar
            </button>
          </div>
        )}

        <div className="p-4 md:p-8 flex-1 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (Thumb-friendly for smartphone workers) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-semibold transition-colors ${
              isActive ? 'text-amber-600' : 'text-slate-500'
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Início</span>
        </NavLink>

        <NavLink
          to="/mapa"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-semibold transition-colors ${
              isActive ? 'text-amber-600' : 'text-slate-500'
            }`
          }
        >
          <MapPin className="w-5 h-5 mb-0.5" />
          <span>Mapa</span>
        </NavLink>

        {/* Center Prominent New APR Button */}
        <NavLink
          to="/documentos/nova-apr"
          className="flex flex-col items-center -mt-5 bg-amber-500 text-slate-950 p-3 rounded-full shadow-lg shadow-amber-500/30 hover:scale-105 transition-transform"
        >
          <PlusCircle className="w-6 h-6" />
        </NavLink>

        <NavLink
          to="/documentos"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-semibold transition-colors ${
              isActive ? 'text-amber-600' : 'text-slate-500'
            }`
          }
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span>APRs</span>
        </NavLink>

        <NavLink
          to="/funcionarios"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-semibold transition-colors ${
              isActive ? 'text-amber-600' : 'text-slate-500'
            }`
          }
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span>Equipe</span>
        </NavLink>
      </div>

      {/* Integrated Camera QR Scanner Modal */}
      <QRScannerModal isOpen={scannerOpen} onClose={() => setScannerOpen(false)} />

      {/* Geofencing Proximity Alert Banner */}
      <GeofenceAlertBanner />
    </div>
  );
};
