'use client';

import { useEffect } from 'react';
import { isChunkLoadError, recoverFromChunkError } from '@/shared/lib/chunkErrorRecovery';

/**
 * PWA Service Worker Registration Component
 * Registers the service worker when the app loads
 *
 * Matches the working implementation from sistema-financiero-app
 */
export default function PWARegister() {
  // Auto-recuperación de chunk errors post-deploy (PWA con build viejo):
  // fallos de import dinámico llegan como unhandledrejection; scripts rotos
  // como error event. Una recarga dura toma el build vivo (guard 60s adentro).
  useEffect(() => {
    const recover = (msg: string) => {
      if (isChunkLoadError(msg)) recoverFromChunkError('window');
    };
    const onError = (e: ErrorEvent) => recover(String(e.message || ''));
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string } | string | undefined;
      recover(String((typeof r === 'object' && r?.message) || r || ''));
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Workers not supported');
      return;
    }

    // Register Service Worker
    const registerServiceWorker = async () => {
      try {
        // Use window.location.origin to get the current domain (always available in client)
        // This prevents redirect issues on iOS Safari when the PWA is installed from a custom domain
        const swUrl = `${window.location.origin}/sw.js`;

        console.log('[PWA] Registering SW from:', swUrl);

        const registration = await navigator.serviceWorker.register(swUrl, {
          scope: '/',
        });

        console.log('✅ Service Worker registered:', registration.scope);

        // Check for updates and force activation
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🔄 New Service Worker version found');

          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW ready, force activation
              console.log('⚡ Forcing new Service Worker activation');
              newWorker.postMessage({ type: 'SKIP_WAITING' });

              // Guard anti reload-loop: máximo un
              // auto-reload por minuto. Si algo reinstalara el SW en ciclo,
              // esto rompe el loop en vez de parpadear la app para siempre.
              let lastReload = 0;
              try { lastReload = Number(localStorage.getItem('app-sw-reload-at') || 0); } catch { /* noop */ }
              if (Date.now() - lastReload < 60_000) {
                console.warn('🔄 SW nuevo instalado; reload omitido (guard anti-loop). Tomará control en la próxima navegación.');
                return;
              }
              try { localStorage.setItem('app-sw-reload-at', String(Date.now())); } catch { /* noop */ }

              // Reload to use new SW after a short delay
              setTimeout(() => {
                console.log('🔄 Reloading to activate new Service Worker');
                window.location.reload();
              }, 1000);
            } else if (newWorker.state === 'activated') {
              console.log('✅ Service Worker updated and activated');
            }
          });
        });

        // Check for updates periodically (every hour)
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
      }
    };

    // Register when page is loaded
    if (document.readyState === 'complete') {
      registerServiceWorker();
    } else {
      window.addEventListener('load', registerServiceWorker);
      return () => window.removeEventListener('load', registerServiceWorker);
    }
  }, []);

  return null; // This component doesn't render anything
}
