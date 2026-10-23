import { getDeviceId } from './deviceId';

export const API_BASE_URL = '/api';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Unauthorized or session expired
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
