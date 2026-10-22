/**
 * Helper to obtain or generate a persistent unique Device ID for the client browser/phone.
 * This ID is recorded on all created APRs, audit logs, and signatures as requested.
 */

const DEVICE_STORAGE_KEY = 'SEGTRABALHO_DEVICE_ID';

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (!deviceId) {
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const prefix = isMobile ? 'MOB' : 'DESK';
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestampHex = Date.now().toString(36).substring(4).toUpperCase();
    deviceId = `${prefix}-${randomHex}-${timestampHex}`;
    localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
  }
  return deviceId;
}

export function getDeviceDescription(): string {
  const ua = navigator.userAgent;
  let os = 'Dispositivo Desconhecido';
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 11/10';
  else if (/Android/i.test(ua)) os = 'Android Smartphone';
  else if (/iPhone|iPad/i.test(ua)) os = 'Apple iOS (iPhone/iPad)';
  else if (/Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Navegador Web';
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Edge';

  return `${browser} no ${os} (${getDeviceId()})`;
}
