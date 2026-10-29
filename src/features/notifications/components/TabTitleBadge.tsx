'use client';

// ============================================
// TabTitleBadge
// ============================================
// Aviso de pestaña estilo Skool: alterna el titulo con el conteo y una frase
// de las notificaciones sin leer. No renderiza nada.
// Debe montarse dentro de <NotificationProvider>.

import { useMemo } from 'react';
import { useNotificationContext } from '@/features/notifications/contexts';
import { useTabNotifier } from '../hooks/useTabNotifier';
import { describeNotification } from '../utils/notificationPhrase';

/** Cuántas frases se preparan; el motor rota solo las primeras. */
const MAX_ITEMS = 3;

interface PhraseItem {
  text: string;
  at: number;
}

export function TabTitleBadge() {
  const { notifications, unreadCount: communityUnread } = useNotificationContext();
  const count = communityUnread;

  // Clave de contenido: evita rearmar el array (y reiniciar el ciclo) en cada
  // render cuando las notificaciones llegan por Realtime sin cambios reales.
  const notificationsKey = notifications
    .filter((n) => !n.read)
    .map((n) => n.id)
    .join(',');

  const phrases = useMemo(() => {
    const fromNotifications: PhraseItem[] = notifications
      .filter((n) => !n.read)
      .map((n) => ({
        text: describeNotification(n) ?? '',
        at: new Date(n.created_at).getTime(),
      }))
      .filter((item) => item.text.length > 0);

    return fromNotifications
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_ITEMS)
      .map((item) => item.text);
    // Las deps son las CLAVES de contenido, no los arrays (identidad inestable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationsKey]);

  useTabNotifier({ count, phrases });

  return null;
}

export default TabTitleBadge;
