// ============================================
// Notification Service
// ============================================
// Handles all notification-related operations with Supabase

import { supabase } from '@/shared/lib/supabase';
import type { Notification, CreateNotificationInput, PushSubscription } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// Fetch Notifications
// ============================================

/**
 * Get all notifications for a user — SIN los DMs.
 *
 * La campana es actividad de la COMUNIDAD (posts, respuestas, cursos, eventos).
 * Los mensajes privados viven en su propia bandeja (MessagesButton) y no se
 * cuentan dos veces. Las filas type='message' siguen existiendo en la tabla
 * porque el push nace de un webhook sobre INSERT en `notifications`
 * (`api/notifications/webhook`): sin esa fila no hay push. Se escriben, se
 * envían, y se quedan fuera de la vista.
 *
 * Historia: el trigger se borró el 20-nov-2024 justo por el doble badge, y se
 * revivió el 22-nov porque era el único camino al push. Lo que faltaba no era
 * el trigger, era este filtro.
 */
export async function getNotifications(
  userId: string,
  limit = 50,
  offset = 0
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .neq('type', 'message')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }

  return data || [];
}

/**
 * Sin leer en la campana: actividad de comunidad, DMs excluidos.
 *
 * Mismo criterio que `getNotifications` — un mensaje privado se cuenta una
 * sola vez, en el badge del avión de papel. Contarlo aquí también lo mostraba
 * al doble (era la queja: "me llegó un DM y me aparece en las dos").
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
    .neq('type', 'message');

  if (error) {
    console.error('Error fetching unread count:', error);
    throw error;
  }

  return count || 0;
}

// ============================================
// Mark as Read
// ============================================

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications related to a specific post as read
 * Covers: admin_post, mention, reply, post_comment
 */
export async function markPostNotificationsAsRead(
  userId: string,
  postId: string
): Promise<void> {
  // Use contains to match JSONB data->post_id
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
    .contains('data', { post_id: postId });

  if (error) {
    console.error('Error auto-marking post notifications as read:', error);
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

// ============================================
// Delete Notifications
// ============================================

/**
 * Delete a single notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting all notifications:', error);
    throw error;
  }
}

// ============================================
// Realtime Subscriptions
// ============================================

/**
 * Subscribe to new notifications for a user via Supabase Realtime
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
): () => void {
  // Unique channel name per call (anti React strict mode double-mount bug)
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const channel: RealtimeChannel = supabase
    .channel(`notifications:${userId}-${uniqueId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('[Realtime] New notification:', payload.new);
        callback(payload.new as Notification);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    console.log('[Realtime] Unsubscribing from notifications');
    supabase.removeChannel(channel);
  };
}

// ============================================
// Push Subscription Management (SIMPLIFIED)
// ============================================
// No auth required - uses ANON_KEY like sistema-financiero-app

/**
 * Register a push subscription (no auth required)
 */
export async function registerPushSubscription(
  subscription: PushSubscriptionJSON,
  deviceInfo?: { deviceName?: string; browser?: string }
): Promise<void> {
  console.log('[Push Service] Registering subscription...');

  const response = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscription,
      deviceInfo: {
        ...deviceInfo,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
    }),
  });

  console.log('[Push Service] Response status:', response.status);

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Push Service] Error:', errorData);
    throw new Error(errorData.error || 'Failed to register subscription');
  }

  const result = await response.json();
  console.log('[Push Service] Success! ID:', result.subscription_id);
}

/**
 * Unregister a push subscription (no auth required)
 */
export async function unregisterPushSubscription(endpoint: string): Promise<void> {
  const response = await fetch('/api/notifications/subscribe', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unregister subscription');
  }
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported');
  }

  const permission = await Notification.requestPermission();
  return permission;
}
