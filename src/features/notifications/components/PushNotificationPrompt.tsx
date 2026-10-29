// ============================================
// Push Notification Prompt Component
// ============================================
// Permite al usuario activar notificaciones push para recibir
// notificaciones incluso cuando la app está cerrada/minimizada

'use client';

import { useState, useEffect } from 'react';
import { Smartphone, X } from 'lucide-react';
import { usePushSubscription } from '../hooks';

interface PushNotificationPromptProps {
  /**
   * Si es true, muestra el prompt automáticamente
   * Si es false, el usuario debe activarlo manualmente
   */
  autoShow?: boolean;

  /**
   * Callback cuando el usuario activa/desactiva notificaciones
   */
  onSubscriptionChange?: (isSubscribed: boolean) => void;
}

export function PushNotificationPrompt({
  autoShow = false,
  onSubscriptionChange,
}: PushNotificationPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    loading,
    error,
  } = usePushSubscription();

  // Auto-show prompt si:
  // 1. autoShow está activado
  // 2. El browser soporta push notifications
  // 3. No está subscrito aún
  // 4. El permiso es 'default' (no ha respondido)
  // 5. No ha sido dismissed antes
  useEffect(() => {
    if (!autoShow) return;

    const isDismissedBefore = localStorage.getItem('push-prompt-dismissed') === 'true';

    if (
      isSupported &&
      !isSubscribed &&
      permission === 'default' &&
      !isDismissedBefore &&
      !dismissed
    ) {
      // Mostrar después de 3 segundos (para no ser intrusivo)
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [autoShow, isSupported, isSubscribed, permission, dismissed]);

  // Callback cuando cambia la subscripción
  useEffect(() => {
    if (onSubscriptionChange) {
      onSubscriptionChange(isSubscribed);
    }
  }, [isSubscribed, onSubscriptionChange]);

  const handleSubscribe = async () => {
    try {
      await subscribe();
      setShowPrompt(false);
      // Marcar como dismissed para que no vuelva a aparecer
      localStorage.setItem('push-prompt-dismissed', 'true');
    } catch (err) {
      console.error('Error al activar notificaciones:', err);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('push-prompt-dismissed', 'true');
  };

  // Si no soporta push notifications, no mostrar nada
  if (!isSupported) {
    return null;
  }

  // Si autoShow está desactivado, no mostrar nada
  if (!autoShow) {
    return null;
  }

  // Si ya está subscrito, no mostrar nada (ya activó notificaciones)
  if (isSubscribed) {
    return null;
  }

  // Si ya fue dismissed antes, no mostrar nada (ya decidió no activarlas)
  if (localStorage.getItem('push-prompt-dismissed') === 'true') {
    return null;
  }

  // Si está denegado, no mostrar nada (no podemos hacer nada)
  if (permission === 'denied') {
    return null;
  }

  // Prompt Banner (cuando autoShow = true)
  if (showPrompt && !isSubscribed) {
    return (
      <div className="glass-panel p-4 rounded-xl border border-primary/50 bg-primary/5 animate-slide-down">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">
              ¿Activar notificaciones push?
            </h3>
            <p className="text-xs text-muted mt-1">
              Recibe notificaciones en tiempo real, incluso cuando la app esté cerrada.
            </p>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="btn-primary text-xs py-2"
              >
                {loading ? 'Activando...' : 'Activar'}
              </button>

              <button
                onClick={handleDismiss}
                className="btn-ghost text-xs py-2"
              >
                Ahora no
              </button>
            </div>

            {error && (
              <p className="text-xs text-destructive mt-2">
                Error: {error}
              </p>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-white/10 flex items-center
                      justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Si llegamos aquí, no mostrar nada
  return null;
}
