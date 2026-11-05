'use client';
import { useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function PwaControls() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const resize = () => {
      const height = viewport?.height || window.innerHeight;
      root.style.setProperty('--app-height', `${height}px`);
      root.toggleAttribute(
        'data-keyboard-open',
        height < window.innerHeight - 120,
      );
    };
    resize();
    viewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
      root.style.removeProperty('--app-height');
      root.removeAttribute('data-keyboard-open');
    };
  }, []);
  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const didInstall = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', didInstall);
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then(async () => {
          const registration = await navigator.serviceWorker.ready;
          const assets = performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((url) => {
              const parsed = new URL(url);
              return (
                parsed.origin === location.origin &&
                parsed.pathname.startsWith('/_next/static/')
              );
            });
          registration.active?.postMessage({ type: 'CACHE_APP_SHELL', assets });
        })
        .catch(() =>
          setHint(
            'La instalación no está disponible ahora. Puedes seguir jugando en el navegador.',
          ),
        );
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', didInstall);
    };
  }, []);
  const install = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    } catch {
      setHint(
        'Abre el menú del navegador y elige Instalar o Añadir a la pantalla de inicio.',
      );
    }
  };
  if (installed) return null;
  return (
    <div className="pwa-controls">
      {installEvent ? (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            void install();
          }}
        >
          Instalar aventura
        </button>
      ) : (
        <details>
          <summary>Instalar en móvil</summary>
          <p>
            Android: abre el menú del navegador y pulsa Instalar aplicación.
            iPhone: abre esta página en Safari, pulsa Compartir y Añadir a la
            pantalla de inicio. Necesitas abrir la dirección segura de la
            aplicación desde el móvil.
          </p>
        </details>
      )}
      {hint && <p role="status">{hint}</p>}
    </div>
  );
}
