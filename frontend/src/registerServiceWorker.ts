// PWA Service Worker & Install Prompt Registry

let deferredPrompt: any = null;
const installListeners = new Set<(canInstall: boolean) => void>();

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registrado com escopo:', registration.scope);
        })
        .catch((error) => {
          console.warn('[PWA] Falha ao registrar Service Worker:', error);
        });
    });
  }

  // Capture PWA install prompt
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    installListeners.forEach((listener) => listener(true));
    console.log('[PWA] Prompt de instalação capturado e pronto para uso!');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installListeners.forEach((listener) => listener(false));
    console.log('[PWA] Aplicativo instalado com sucesso!');
  });
}

export function subscribeToInstallPrompt(callback: (canInstall: boolean) => void) {
  installListeners.add(callback);
  callback(!!deferredPrompt);
  return () => {
    installListeners.delete(callback);
  };
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }
  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installListeners.forEach((listener) => listener(false));
    return outcome === 'accepted';
  } catch (err) {
    console.error('[PWA] Erro ao disparar prompt de instalação:', err);
    return false;
  }
}

export function isPwaInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}
