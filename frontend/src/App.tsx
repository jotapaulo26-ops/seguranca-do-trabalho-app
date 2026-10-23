import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConnectivityProvider } from './context/ConnectivityContext';
import { TrackingProvider } from './context/TrackingContext';
import { Layout } from './components/Layout';

// Dynamic Code-Splitting with React.lazy() for ultra-fast startup and small bundle sizes
const Login = React.lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Employees = React.lazy(() => import('./pages/Employees').then((m) => ({ default: m.Employees })));
const RiskMapPage = React.lazy(() => import('./pages/RiskMapPage').then((m) => ({ default: m.RiskMapPage })));
const BrigadePage = React.lazy(() => import('./pages/BrigadePage').then((m) => ({ default: m.BrigadePage })));
const DocumentsPage = React.lazy(() => import('./pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })));
const DocumentCreatePage = React.lazy(() => import('./pages/DocumentCreatePage').then((m) => ({ default: m.DocumentCreatePage })));
const UsersAndRolesPage = React.lazy(() => import('./pages/UsersAndRolesPage').then((m) => ({ default: m.UsersAndRolesPage })));
const AuditLogsPage = React.lazy(() => import('./pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const PublicSignaturePage = React.lazy(() => import('./pages/PublicSignaturePage').then((m) => ({ default: m.PublicSignaturePage })));
const QRDispatcherPage = React.lazy(() => import('./pages/QRDispatcherPage').then((m) => ({ default: m.QRDispatcherPage })));

// Loading spinner fallback during lazy route transitions
const PageLoadingFallback: React.FC = () => (
  <div className="flex-1 min-h-[350px] flex flex-col items-center justify-center p-8 text-slate-500">
    <div className="w-9 h-9 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3 shadow-sm"></div>
    <p className="text-xs font-semibold text-slate-400 animate-pulse">Carregando módulo...</p>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <AuthProvider>
      <ConnectivityProvider>
        <TrackingProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/assinar-documento" element={<PublicSignaturePage />} />
                <Route path="/qr" element={<QRDispatcherPage />} />

                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="funcionarios" element={<Employees />} />
                  <Route path="mapa" element={<RiskMapPage />} />
                  <Route path="brigada" element={<BrigadePage />} />
                  <Route path="documentos" element={<DocumentsPage />} />
                  <Route path="documentos/novo" element={<DocumentCreatePage />} />
                  <Route path="documentos/nova-apr" element={<DocumentCreatePage />} />
                  <Route path="usuarios" element={<UsersAndRolesPage />} />
                  <Route path="auditoria" element={<AuditLogsPage />} />
                  <Route path="configuracoes" element={<SettingsPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TrackingProvider>
      </ConnectivityProvider>
    </AuthProvider>
  );
}

export default App;
