import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { getDeviceId, getDeviceDescription } from '../services/deviceId';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: Record<string, string[]>;
  photo_url?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  setAuthSession: (token: string, user: AuthUser) => void;
  logout: () => void;
  can: (module: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('SEGTRABALHO_USER');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('SEGTRABALHO_AUTH_TOKEN');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkAuth() {
      if (token) {
        try {
          const res = await api.get<{ user: AuthUser }>('/auth/me');
          setUser(res.user);
          localStorage.setItem('SEGTRABALHO_USER', JSON.stringify(res.user));
        } catch (err) {
          console.warn('Falha ao restaurar sessão:', err);
          logout();
        }
      }
      setIsLoading(false);
    }
    checkAuth();
  }, [token]);

  const login = async (email: string, password: string) => {
    const deviceId = getDeviceId();
    const deviceName = getDeviceDescription();

    const res = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
      email,
      password,
      deviceId,
      deviceName
    });

    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('SEGTRABALHO_AUTH_TOKEN', res.token);
    localStorage.setItem('SEGTRABALHO_USER', JSON.stringify(res.user));
  };

  const setAuthSession = (newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('SEGTRABALHO_AUTH_TOKEN', newToken);
    localStorage.setItem('SEGTRABALHO_USER', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('SEGTRABALHO_AUTH_TOKEN');
    localStorage.removeItem('SEGTRABALHO_USER');
  };

  const can = (moduleName: string, action: string): boolean => {
    if (!user) return false;
    if (user.roleId === 'role_admin' || user.roleName.toLowerCase() === 'administrador') {
      return true;
    }
    const perms = user.permissions?.[moduleName] || [];
    return perms.includes(action) || perms.includes('*') || perms.includes('manage');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, setAuthSession, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
