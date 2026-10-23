import { getDeviceId } from './deviceId';
import {
  saveToCache,
  getFromCache,
  addToSyncQueue,
  applyOptimisticUpdate
} from './offlineSync';

export const API_BASE_URL = '/api';

function getActionDescription(endpoint: string, method: string, body: any): string {
  if (endpoint.includes('/apr')) return `Emissão de APR: ${body?.title || 'Sem título'}`;
  if (endpoint.includes('/pt')) return `Emissão de PT: ${body?.title || 'Sem título'}`;
  if (endpoint.includes('/os')) return `Emissão de OS NR-01: ${body?.title || 'Colaborador'}`;
  if (endpoint.includes('/epi-receipt')) return `Recibo de EPI: ${body?.title || 'Colaborador'}`;
  if (endpoint.includes('/checklist')) return `Checklist Operacional: ${body?.title || 'Inspeção'}`;
  if (endpoint.includes('/sign')) return `Assinatura Digital SST: ${body?.signerName || 'Executante'}`;
  if (endpoint.includes('/inspect')) return `Inspeção Mensal de Extintor`;
  if (endpoint.startsWith('/employees')) return `${method === 'POST' ? 'Cadastro' : 'Edição'} de Funcionário`;
  if (endpoint.startsWith('/tracking')) return `Telemetria GPS de Campo`;
  return `${method} ${endpoint}`;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const token = localStorage.getItem('SEGTRABALHO_AUTH_TOKEN');
  const deviceId = getDeviceId();

  const headers = new Headers(options.headers || {});
  headers.set('x-device-id', deviceId);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // --- 1. HANDLING GET REQUESTS (Offline Fallback & Local Cache) ---
  if (method === 'GET') {
    if (!navigator.onLine) {
      const cached = getFromCache<T>(endpoint);
      if (cached !== null) {
        return cached;
      }
      throw new Error(`Sem conexão com a internet. Os dados deste módulo ainda não foram armazenados localmente.`);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        localStorage.removeItem('SEGTRABALHO_AUTH_TOKEN');
        localStorage.removeItem('SEGTRABALHO_USER');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Erro na requisição ao servidor.');
      }

      // Cache successful GET response for future offline use
      saveToCache<T>(endpoint, data as T);
      return data as T;
    } catch (fetchErr: any) {
      // If network dropped or server unreachable, fallback to cache
      const cached = getFromCache<T>(endpoint);
      if (cached !== null) {
        console.warn(`[API] Rede indisponível. Servindo dados do cache local para: ${endpoint}`);
        return cached;
      }
      throw fetchErr;
    }
  }

  // --- 2. HANDLING MUTATION REQUESTS (POST, PUT, DELETE) ---
  let parsedBody: any = null;
  if (typeof options.body === 'string') {
    try {
      parsedBody = JSON.parse(options.body);
    } catch {
      parsedBody = options.body;
    }
  } else {
    parsedBody = options.body;
  }

  // If strictly offline, queue operation and apply optimistic update
  if (!navigator.onLine) {
    const optimisticResult = applyOptimisticUpdate(endpoint, method, parsedBody);
    const description = getActionDescription(endpoint, method, parsedBody);

    addToSyncQueue({
      url: endpoint,
      method: method as 'POST' | 'PUT' | 'DELETE',
      body: parsedBody,
      description
    });

    return {
      success: true,
      offline: true,
      message: 'Salvo localmente no dispositivo (offline). Será sincronizado automaticamente ao reconectar à internet.',
      ...(optimisticResult || parsedBody || {})
    } as unknown as T;
  }

  // Online: Attempt network fetch
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      localStorage.removeItem('SEGTRABALHO_AUTH_TOKEN');
      localStorage.removeItem('SEGTRABALHO_USER');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Erro na requisição ao servidor.');
    }

    return data as T;
  } catch (err: any) {
    // If request failed because network abruptly dropped
    const isNetworkError =
      !navigator.onLine ||
      err.name === 'TypeError' ||
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('NetworkError');

    if (isNetworkError) {
      console.warn(`[API] Perda repentina de sinal ao enviar ${endpoint}. Enfileirando offline.`);
      const optimisticResult = applyOptimisticUpdate(endpoint, method, parsedBody);
      const description = getActionDescription(endpoint, method, parsedBody);

      addToSyncQueue({
        url: endpoint,
        method: method as 'POST' | 'PUT' | 'DELETE',
        body: parsedBody,
        description
      });

      return {
        success: true,
        offline: true,
        message: 'Conexão interrompida. Registro salvo localmente e programado para sincronização automática.',
        ...(optimisticResult || parsedBody || {})
      } as unknown as T;
    }

    throw err;
  }
}

export const api = {
  get: <T = any>(url: string) => apiRequest<T>(url, { method: 'GET' }),
  post: <T = any>(url: string, body?: any) =>
    apiRequest<T>(url, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),
  put: <T = any>(url: string, body?: any) =>
    apiRequest<T>(url, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),
  delete: <T = any>(url: string) => apiRequest<T>(url, { method: 'DELETE' })
};
