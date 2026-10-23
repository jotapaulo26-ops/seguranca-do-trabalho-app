// Offline Storage & Synchronization Engine

export interface SyncQueueItem {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body?: any;
  timestamp: string;
  description: string;
  retryCount?: number;
}

const SYNC_QUEUE_KEY = 'SEGTRABALHO_SYNC_QUEUE';
const CACHE_PREFIX = 'SEGTRABALHO_CACHE_';

// Event dispatched when queue size or sync state changes
export const SYNC_UPDATE_EVENT = 'segtrabalho:sync-update';

export function notifySyncUpdate() {
  window.dispatchEvent(new CustomEvent(SYNC_UPDATE_EVENT));
}

// 1. Local Cache Management (GET requests caching)
export function getCacheKey(url: string): string {
  // Normalize key by stripping trailing slashes
  return CACHE_PREFIX + url.replace(/\/+$/, '');
}

export function saveToCache<T = any>(url: string, data: T): void {
  try {
    const key = getCacheKey(url);
    const payload = {
      timestamp: new Date().toISOString(),
      data
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.warn('[OfflineSync] Não foi possível salvar em cache local:', err);
  }
}

export function getFromCache<T = any>(url: string): T | null {
  try {
    const key = getCacheKey(url);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.data as T;
  } catch (err) {
    console.warn('[OfflineSync] Falha ao recuperar cache local de:', url, err);
    return null;
  }
}

// 2. Sync Queue Management (POST / PUT / DELETE)
export function getSyncQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SyncQueueItem[];
  } catch (err) {
    console.error('[OfflineSync] Falha ao ler fila de sincronização:', err);
    return [];
  }
}

function saveSyncQueue(queue: SyncQueueItem[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    notifySyncUpdate();
  } catch (err) {
    console.error('[OfflineSync] Falha ao gravar fila de sincronização:', err);
  }
}

export function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>): SyncQueueItem {
  const queue = getSyncQueue();
  const newItem: SyncQueueItem = {
    ...item,
    id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    retryCount: 0
  };

  queue.push(newItem);
  saveSyncQueue(queue);
  console.log(`[OfflineSync] Operação enfileirada para sincronização offline: ${newItem.description}`);
  return newItem;
}

export function removeSyncQueueItem(id: string): void {
  const queue = getSyncQueue();
  const filtered = queue.filter((i) => i.id !== id);
  saveSyncQueue(filtered);
}

export function clearSyncQueue(): void {
  saveSyncQueue([]);
}

// 3. Optimistic Cache Updates when Working Offline
export function applyOptimisticUpdate(url: string, method: string, body: any): any {
  // A. New Document created offline (APR, PT, OS, EPI, Checklist, General)
  if (url.startsWith('/documents') && method === 'POST' && !url.includes('/sign')) {
    const cachedDocs = getFromCache<any[]>('/documents') || [];
    const prefix = url.includes('/apr') ? 'APR' : url.includes('/pt') ? 'PT' : url.includes('/os') ? 'OS' : url.includes('/checklist') ? 'CHK' : 'DOC';
    const tempDoc = {
      id: body.id || ('doc_offline_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      code: `${prefix}-OFFLINE-${Math.floor(1000 + Math.random() * 9000)}`,
      type: body.aprType || (body.isPet ? 'PET' : 'PT') || body.type || 'APR_GENERICA',
      title: body.title || 'Documento Criado Offline',
      description: body.description || '',
      location_id: body.locationId || undefined,
      apr_id: body.aprId || undefined,
      status: 'ativa',
      data: {
        ...(body.data || body),
        offlineCreated: true,
        createdDate: new Date().toISOString()
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      offline: true
    };

    saveToCache('/documents', [tempDoc, ...cachedDocs]);
    return tempDoc;
  }

  // B. Signature added offline (/documents/:id/sign or /documents/:id/sign-public)
  if (url.includes('/documents/') && url.includes('/sign')) {
    const docIdMatch = url.match(/\/documents\/([^\/]+)\/sign/);
    const docId = docIdMatch ? docIdMatch[1] : null;

    if (docId) {
      const cachedDocs = getFromCache<any[]>('/documents') || [];
      const updatedDocs = cachedDocs.map((doc) => {
        if (doc.id === docId) {
          const sigs = Array.isArray(doc.data?.signatures) ? [...doc.data.signatures] : [];
          const newSig = {
            id: 'sig_offline_' + Date.now(),
            signerName: body.signerName,
            signerRole: body.signerRole,
            signerCpf: body.signerCpf,
            signerType: body.signerType,
            signatureDataUrl: body.signatureDataUrl,
            photoDataUrl: body.photoDataUrl,
            signedAt: new Date().toISOString(),
            isSupervisor: body.isSupervisor || false,
            offline: true
          };
          return {
            ...doc,
            data: {
              ...doc.data,
              signatures: [...sigs, newSig]
            }
          };
        }
        return doc;
      });
      saveToCache('/documents', updatedDocs);
    }
  }

  // C. Extinguisher monthly inspection performed offline
  if (url.includes('/brigade/extinguishers/') && url.includes('/inspect')) {
    const extIdMatch = url.match(/\/brigade\/extinguishers\/([^\/]+)\/inspect/);
    const extId = extIdMatch ? extIdMatch[1] : null;

    if (extId) {
      const cachedExts = getFromCache<any[]>('/brigade/extinguishers') || [];
      const updatedExts = cachedExts.map((ext) => {
        if (ext.id === extId) {
          const insp = {
            id: 'insp_offline_' + Date.now(),
            date: new Date().toISOString().split('T')[0],
            inspectorName: body.inspectorName || 'Inspetor SST',
            pressureOk: !!body.pressureOk,
            sealIntact: !!body.sealIntact,
            hoseOk: !!body.hoseOk,
            signageOk: !!body.signageOk,
            accessClear: !!body.accessClear,
            observations: body.observations || 'Registrado offline',
            status: (body.pressureOk && body.sealIntact && body.hoseOk) ? 'conforme' : 'nao_conforme',
            offline: true
          };
          const inspections = ext.inspections ? [insp, ...ext.inspections] : [insp];
          return {
            ...ext,
            inspections,
            status: insp.status === 'conforme' ? 'operacional' : 'em_manutencao'
          };
        }
        return ext;
      });
      saveToCache('/brigade/extinguishers', updatedExts);
    }
  }

  return null;
}

// 4. Automatic & Manual Queue Synchronization Engine
let isCurrentlySyncing = false;

export async function syncPendingQueue(
  onProgress?: (current: number, total: number) => void
): Promise<{ successful: number; failed: number }> {
  if (isCurrentlySyncing) {
    return { successful: 0, failed: 0 };
  }

  const queue = getSyncQueue();
  if (queue.length === 0) {
    return { successful: 0, failed: 0 };
  }

  isCurrentlySyncing = true;
  notifySyncUpdate();

  let successful = 0;
  let failed = 0;
  const token = localStorage.getItem('SEGTRABALHO_AUTH_TOKEN');

  try {
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (onProgress) {
        onProgress(i + 1, queue.length);
      }

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api' + item.url, {
          method: item.method,
          headers,
          body: item.body ? JSON.stringify(item.body) : undefined
        });

        if (response.ok) {
          successful++;
          removeSyncQueueItem(item.id);
          console.log(`[OfflineSync] Item sincronizado com sucesso: ${item.description}`);
        } else {
          // If server returned 4xx or 5xx
          const errorData = await response.json().catch(() => ({}));
          console.warn(`[OfflineSync] Erro do servidor ao sincronizar ${item.description}:`, errorData);

          // If client error (e.g. 400 with invalid validation or unresolvable conflict), drop it to avoid queue deadlock
          if (response.status >= 400 && response.status < 500) {
            removeSyncQueueItem(item.id);
          }
          failed++;
        }
      } catch (networkErr) {
        // Network still unreachable; abort loop and wait for next online event
        console.warn(`[OfflineSync] Rede ainda inacessível durante envio de ${item.description}:`, networkErr);
        break;
      }
    }
  } finally {
    isCurrentlySyncing = false;
    notifySyncUpdate();
  }

  return { successful, failed };
}

export function isQueueSyncing(): boolean {
  return isCurrentlySyncing;
}
