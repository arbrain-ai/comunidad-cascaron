// ============================================
// NotificationContext
// ============================================
// Contexto global para compartir estado de notificaciones
// entre NotificationBell y NotificationsPage

'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  subscribeToNotifications,
} from '../services';
import type { Notification } from '../types';

interface NotificationContextType {
  /** Actividad de la comunidad. Los DMs NO entran aquí (viven en MessagesContext). */
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteOne: (notificationId: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const LIMIT = 20;

interface NotificationProviderProps {
  children: ReactNode;
  userId: string | null;
}

export function NotificationProvider({ children, userId }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Fetch notifications
  const fetchNotifications = useCallback(async (resetOffset = false) => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const currentOffset = resetOffset ? 0 : offset;
      const data = await getNotifications(userId, LIMIT, currentOffset);

      if (resetOffset) {
        setNotifications(data);
        setOffset(LIMIT);
      } else {
        setNotifications((prev) => [...prev, ...data]);
        setOffset((prev) => prev + LIMIT);
      }

      setHasMore(data.length === LIMIT);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, offset]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    try {
      setUnreadCount(await getUnreadCount(userId));
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchNotifications(true);
      fetchUnreadCount();
    }
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToNotifications(userId, (newNotification) => {
      // Los DMs llegan por este canal (el trigger los escribe para disparar el
      // push) pero no son actividad de comunidad: se ignoran aquí y se cuentan
      // en MessagesContext. Mismo filtro que `getNotifications`.
      if (newNotification.type === 'message') return;

      setNotifications((prev) => [newNotification, ...prev]);

      if (!newNotification.read) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    return unsubscribe;
  }, [userId]);

  // Mark as read
  const handleMarkRead = useCallback(async (notificationId: string) => {
    try {
      await markAsRead(notificationId);

      // Solo baja el contador si de verdad estaba sin leer: marcar dos veces
      // la misma no debe restar dos.
      let wasUnread = false;
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id !== notificationId) return n;
          wasUnread = !n.read;
          return { ...n, read: true };
        })
      );

      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
      throw err;
    }
  }, []);

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    if (!userId) return;

    try {
      await markAllAsRead(userId);

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
      throw err;
    }
  }, [userId]);

  // Delete one
  const handleDeleteOne = useCallback(async (notificationId: string) => {
    try {
      const notification = notifications.find((n) => n.id === notificationId);

      await deleteNotification(notificationId);

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      throw err;
    }
  }, [notifications]);

  // Refresh
  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchNotifications(true);
    await fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchNotifications(false);
  }, [hasMore, loading, fetchNotifications]);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    hasMore,
    markRead: handleMarkRead,
    markAllRead: handleMarkAllRead,
    deleteOne: handleDeleteOne,
    refresh,
    loadMore,
  }), [
    notifications,
    unreadCount,
    loading,
    hasMore,
    handleMarkRead,
    handleMarkAllRead,
    handleDeleteOne,
    refresh,
    loadMore,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}

// Sin provider no hay actividad que contar: cero y no-ops. Constante a nivel
// de módulo para que la identidad sea estable entre renders.
const SIN_PROVIDER: NotificationContextType = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  hasMore: false,
  markRead: async () => {},
  markAllRead: async () => {},
  deleteOne: async () => {},
  refresh: async () => {},
  loadMore: async () => {},
};

/**
 * La versión que no revienta cuando el provider no está montado. Mismo patrón
 * que `useMessagesContextSafe` y `useFocusModeSafe`, por la misma razón: el
 * shell del (main)/layout (MainHeader → NotificationBell) se pinta en cuanto
 * hay perfil cacheado, y un contexto ausente no debe tumbar la app entera.
 */
export function useNotificationContextSafe(): NotificationContextType {
  return useContext(NotificationContext) ?? SIN_PROVIDER;
}
