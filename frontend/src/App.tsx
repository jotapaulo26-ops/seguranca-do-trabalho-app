import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { RiskMapPage } from './pages/RiskMapPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { AprCreatePage } from './pages/AprCreatePage';
import { DocumentCreatePage } from './pages/DocumentCreatePage';
import { UsersAndRolesPage } from './pages/UsersAndRolesPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { BrigadePage } from './pages/BrigadePage';
import { PublicSignaturePage } from './pages/PublicSignaturePage';
import { QRDispatcherPage } from './pages/QRDispatcherPage';

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
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
