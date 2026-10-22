import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  LogOut,
  Menu,
  X,
  AlertTriangle,
  Smartphone,
  PlusCircle
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alertSummary, setAlertSummary] = useState<{ totalExpired: number; totalExpiringSoon: number }>({
    totalExpired: 0,
    totalExpiringSoon: 0
  });

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
    { label: 'Documentos & APRs', path: '/documentos', icon: FileText, show: can('documents', 'view') },
    { label: 'Perfis & Acessos', path: '/usuarios', icon: Shield, show: can('users', 'view') || can('roles', 'view') },
    { label: 'Auditoria de Ações', path: '/auditoria', icon: FileCheck, show: can('audit', 'view') },
    { label: 'Configurações', path: '/configuracoes', icon: Settings, show: can('settings', 'view') }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row pb-16 md:pb-0">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shrink-0 border-r border-slate-800">
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
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 border-b border-slate-800 shadow-md">
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
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex">
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

            <div className="pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-400 mb-2 truncate">
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
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
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
    </div>
  );
};
