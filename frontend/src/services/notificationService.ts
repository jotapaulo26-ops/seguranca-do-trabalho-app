// Notification Service for Background Geofence & Critical SST Alerts

export interface GeofenceNotificationParams {
  riskId: string;
  riskName: string;
  riskType: string;
  distance: number;
  radius: number;
  isUnauthorizedIntrusion?: boolean;
  requiredEpis?: string[];
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function hasNotificationPermission(): boolean {
  if (!isNotificationSupported()) return false;
  return Notification.permission === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch (err) {
    console.warn('[NotificationService] Falha ao solicitar permissão de notificação:', err);
    return false;
  }
}

// Sound synthesized alarm helper for critical intrusions
function playAlarmAudio(isIntrusion: boolean) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isIntrusion ? 'sawtooth' : 'sine';
    const now = ctx.currentTime;
    
    if (isIntrusion) {
      // Siren style pitch shift
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(440, now + 0.25);
      osc.frequency.linearRampToValueAtTime(880, now + 0.5);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.8);
    } else {
      // Gentle warning double beep
      osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch {
    // AudioContext blocked by browser autoplay policy
  }
}

export async function showGeofenceNotification(params: GeofenceNotificationParams): Promise<void> {
  if (!isNotificationSupported()) return;

  // Sound and physical vibration
  playAlarmAudio(!!params.isUnauthorizedIntrusion);
  if (navigator.vibrate) {
    if (params.isUnauthorizedIntrusion) {
      navigator.vibrate([400, 150, 400, 150, 600]);
    } else {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  }

  // Only trigger system native push notification if permission is granted
  if (Notification.permission !== 'granted') {
    return;
  }

  const isIntrusion = !!params.isUnauthorizedIntrusion;
  const title = isIntrusion
    ? `🚨 INTRUSÃO NÃO AUTORIZADA: ${params.riskName}`
    : `⚠️ ZONA DE RISCO SST: ${params.riskName}`;

  const episText = params.requiredEpis && params.requiredEpis.length > 0
    ? ` | EPIs: ${params.requiredEpis.join(', ')}`
    : '';

  const body = isIntrusion
    ? `Você entrou no raio de ${params.radius}m SEM Permissão de Trabalho (PT) homologada! Risco iminente. Saia da área ou procure o supervisor.`
    : `Você está a ${params.distance}m da área de risco (Cerca de ${params.radius}m).${episText}`;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration && registration.showNotification) {
      await registration.showNotification(title, {
        body,
        icon: '/icon-192.svg',
        badge: '/icon-192.svg',
        tag: `geofence-${params.riskId}`,
        renotify: isIntrusion,
        requireInteraction: isIntrusion,
        data: {
          url: `/mapa?riskId=${params.riskId}`
        }
      } as any);
    }
  } catch (err) {
    console.warn('[NotificationService] Falha ao exibir notificação via Service Worker:', err);
  }
}
