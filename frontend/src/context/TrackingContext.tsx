import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import { ActiveUserLocation, NearbyRiskAlert } from '../types';

interface MyGPSLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

interface TrackingContextType {
  myLocation: MyGPSLocation | null;
  activeUsers: ActiveUserLocation[];
  gpsError: string | null;
  isTracking: boolean;
  nearbyRisks: NearbyRiskAlert[];
  activeProximityAlert: NearbyRiskAlert | null;
  dismissProximityAlert: () => void;
  requestGpsPermission: () => void;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

// Web Audio API emergency/warning beep
function playProximityWarningSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(750, ctx.currentTime);
    osc.frequency.setValueAtTime(950, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(750, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (err) {
    // Audio context may require user interaction
  }
}

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [myLocation, setMyLocation] = useState<MyGPSLocation | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUserLocation[]>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [nearbyRisks, setNearbyRisks] = useState<NearbyRiskAlert[]>([]);
  const [activeProximityAlert, setActiveProximityAlert] = useState<NearbyRiskAlert | null>(null);

  const dismissedRisksRef = useRef<Set<string>>(new Set());
  const watchIdRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<any>(null);
  const pollUsersIntervalRef = useRef<any>(null);

  // 1. Fetch active users list from server
  const fetchActiveUsers = async () => {
    if (!user) return;
    try {
      const users = await api.get<ActiveUserLocation[]>('/tracking/active-users');
      setActiveUsers(users);
    } catch (err) {
      // Silently handle
    }
  };

  // 2. Send GPS Heartbeat to server
  const sendHeartbeat = async (loc: MyGPSLocation) => {
    if (!user) return;
    try {
      const res = await api.post<{ success: boolean; nearbyRisks: NearbyRiskAlert[] }>('/tracking/heartbeat', {
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
        heading: loc.heading,
        speed: loc.speed
      });

      if (res && res.nearbyRisks) {
        setNearbyRisks(res.nearbyRisks);

        // Check if there's an active proximity alert that hasn't been dismissed yet
        if (res.nearbyRisks.length > 0) {
          const firstUnnotified = res.nearbyRisks.find(r => !dismissedRisksRef.current.has(r.id));
          if (firstUnnotified) {
            setActiveProximityAlert(firstUnnotified);

            // Trigger sound and vibration
            playProximityWarningSound();
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200, 100, 300]);
            }
          }
        } else {
          setActiveProximityAlert(null);
          dismissedRisksRef.current.clear();
        }
      }
    } catch (err) {
      // Silently handle transient network issues
    }
  };

  // 3. Start Geolocation Watcher
  const startWatchingLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Seu dispositivo ou navegador não possui suporte a GPS.');
      return;
    }

    setGpsError(null);
    setIsTracking(true);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newLoc: MyGPSLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0),
          heading: pos.coords.heading || undefined,
          speed: pos.coords.speed || undefined
        };
        setMyLocation(newLoc);
        sendHeartbeat(newLoc);
      },
      (err) => {
        let msg = 'Erro ao obter localização GPS.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Permissão de GPS negada no navegador.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Sinal de GPS indisponível no momento.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Tempo limite de busca do GPS esgotado.';
        }
        setGpsError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000
      }
    );
  };

  useEffect(() => {
    if (!user) {
      // Cleanup on logout
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (pollUsersIntervalRef.current) clearInterval(pollUsersIntervalRef.current);
      setMyLocation(null);
      setActiveUsers([]);
      setIsTracking(false);
      return;
    }

    // Start GPS watch
    startWatchingLocation();

    // High frequency heartbeat (every 4 seconds) to guarantee live position even if stationary
    heartbeatIntervalRef.current = setInterval(() => {
      setMyLocation((currentLoc) => {
        if (currentLoc) {
          sendHeartbeat(currentLoc);
        }
        return currentLoc;
      });
    }, 4000);

    // High frequency poll for active online teammates (every 3 seconds)
    fetchActiveUsers();
    pollUsersIntervalRef.current = setInterval(fetchActiveUsers, 3000);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (pollUsersIntervalRef.current) clearInterval(pollUsersIntervalRef.current);

      // Notify server user is offline
      api.post('/tracking/offline', {}).catch(() => {});
    };
  }, [user]);

  const dismissProximityAlert = () => {
    if (activeProximityAlert) {
      dismissedRisksRef.current.add(activeProximityAlert.id);
      setActiveProximityAlert(null);
    }
  };

  return (
    <TrackingContext.Provider
      value={{
        myLocation,
        activeUsers,
        gpsError,
        isTracking,
        nearbyRisks,
        activeProximityAlert,
        dismissProximityAlert,
        requestGpsPermission: startWatchingLocation
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
};

export const useUserTracking = () => {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useUserTracking must be used within a TrackingProvider');
  }
  return context;
};
