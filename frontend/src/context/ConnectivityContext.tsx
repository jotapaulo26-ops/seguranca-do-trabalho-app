import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getSyncQueue,
  syncPendingQueue,
  isQueueSyncing,
  SYNC_UPDATE_EVENT
} from '../services/offlineSync';
import { subscribeToInstallPrompt, promptInstall, isPwaInstalled } from '../registerServiceWorker';

interface ConnectivityContextType {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  canInstall: boolean;
  isInstalled: boolean;
  triggerInstall: () => Promise<boolean>;
  lastSyncTime: string | null;
}

const ConnectivityContext = createContext<ConnectivityContextType | null>(null);

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(() => getSyncQueue().length);
  const [isSyncing, setIsSyncing] = useState<boolean>(() => isQueueSyncing());
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isPwaInstalled());
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('SEGTRABALHO_LAST_SYNC');
  });

  // Update pending queue status
  const updateQueueStatus = useCallback(() => {
    setPendingCount(getSyncQueue().length);
    setIsSyncing(isQueueSyncing());
  }, []);

  // Sync now action
  const syncNow = useCallback(async () => {
    if (!navigator.onLine) {
      return;
    }
    setIsSyncing(true);
    try {
      const result = await syncPendingQueue();
      if (result.successful > 0 || getSyncQueue().length === 0) {
        const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(now);
        localStorage.setItem('SEGTRABALHO_LAST_SYNC', now);
      }
    } finally {
      updateQueueStatus();
    }
  }, [updateQueueStatus]);

  // Install PWA action
  const triggerInstall = useCallback(async () => {
    const success = await promptInstall();
    if (success) {
      setCanInstall(false);
      setIsInstalled(true);
    }
    return success;
  }, []);

  // Listen to connectivity & sync changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[Connectivity] Conexão detectada! Disparando sincronização automática em segundo plano...');
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[Connectivity] Dispositivo desconectado. Modo Offline ativado.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(SYNC_UPDATE_EVENT, updateQueueStatus);

    // Subscribe to PWA install availability
    const unsubscribeInstall = subscribeToInstallPrompt((available) => {
      setCanInstall(available);
      setIsInstalled(isPwaInstalled());
    });

    // Check periodically for sync queue updates
    const interval = setInterval(() => {
      updateQueueStatus();
      if (navigator.onLine && getSyncQueue().length > 0 && !isQueueSyncing()) {
        syncNow();
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(SYNC_UPDATE_EVENT, updateQueueStatus);
      unsubscribeInstall();
      clearInterval(interval);
    };
  }, [syncNow, updateQueueStatus]);

  return (
    <ConnectivityContext.Provider
      value={{
        isOnline,
        pendingCount,
        isSyncing,
        syncNow,
        canInstall,
        isInstalled,
        triggerInstall,
        lastSyncTime
      }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
};

export function useConnectivity() {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity deve ser usado dentro de um ConnectivityProvider');
  }
  return context;
}
