'use client';

// ============================================
// PushReviveBanner: campaña SUAVE de re-suscripción a push
// ============================================
// Recupera a miembros que perdieron su suscripción push sin ser molesto:
//   - Solo PWA móvil instalada, con soporte y permiso NO denegado
//   - Solo si el dispositivo NO tiene suscripción viva (verdad de la BD
//     vía la reconciliación del hook)
//   - Aparece con delay (no compite con el first paint)
//   - Dismissible con cooldown de 14 días (localStorage)
//   - Un tap: pide permiso + suscribe + confirma con toast

import { useEffect, useState } from 'react';
import { Bell, X } from '@phosphor-icons/react/dist/ssr';
import { usePushSubscription } from '@/features/notifications/hooks';
import { useIsMobile, useIsPWA } from '@/shared/hooks/useMediaQuery';
import { useToast } from '@/shared/hooks/useToast';

const DISMISS_KEY = 'app-push-banner-dismissed-at';
const DISMISS_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000; // 15 días
const APPEAR_DELAY_MS = 4000; // deja respirar el first paint + reconciliación

export function PushReviveBanner() {
  const isMobile = useIsMobile();
  const isPWA = useIsPWA();
  const { isSupported, isSubscribed, permission, loading, requestPermission, subscribe } =
    usePushSubscription();
  const { showSuccess, showError } = useToast();

  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true); // pesimista hasta leer storage

  useEffect(() => {
    try {
      // Decisión de producto: el banner SÍ se le re-ofrece cada 15 días
      // incluso a quien desactivó a propósito (preguntar suave está bien; lo
      // que NO hacemos es revivirle el canal en silencio — ver isPushOptedOut
      // en la auto-recuperación del hook).
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      setDismissed(dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS);
    } catch {
      setDismissed(false);
    }

    const timer = setTimeout(() => setReady(true), APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
  };

  const handleActivate = async () => {
    const granted = await requestPermission();
    if (granted !== 'granted') {
      handleDismiss();
      return;
    }

    const ok = await subscribe(granted);
    if (ok) {
      showSuccess('Notificaciones activadas 🔔');
      handleDismiss();
    } else {
      showError('No se pudieron activar. Intenta desde el menú de tu perfil.');
    }
  };

  const show =
    ready &&
    !dismissed &&
    isMobile &&
    isPWA &&
    isSupported &&
    permission !== 'denied' &&
    !isSubscribed;

  if (!show) return null;

  return (
    <div className="md:hidden fixed bottom-20 inset-x-3 z-40 animate-slide-in-right">
      <div className="solid-card flex items-center gap-3 p-3 rounded-xl shadow-lg border border-border-accent">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Bell size={20} weight="duotone" className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">
            Activa las notificaciones
          </p>
          <p className="text-xs text-muted leading-snug">
            Entérate de anuncios, respuestas y eventos
          </p>
        </div>
        <button
          onClick={handleActivate}
          disabled={loading}
          className="btn-primary px-3 py-1.5 text-sm rounded-lg shrink-0 disabled:opacity-50"
        >
          {loading ? '...' : 'Activar'}
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Cerrar"
          className="text-muted hover:text-foreground p-1 shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
