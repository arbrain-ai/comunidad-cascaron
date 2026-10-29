// ============================================
// useNotifications Hook
// ============================================
// Manages notifications with Realtime updates

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  subscribeToNotifications,
} from '../services';
import type { Notification } from '../types';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteOne: (notificationId: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useNotifications(userId: string | null): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const LIMIT = 20;

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

      // If we got less than LIMIT, there's no more
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
      const count = await getUnreadCount(userId);
      setUnreadCount(count);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications(true);
    fetchUnreadCount();
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToNotifications(userId, (newNotification) => {
      // Add new notification to top of list
      setNotifications((prev) => [newNotification, ...prev]);

      // Increment unread count if not already read
      if (!newNotification.read) {
        setUnreadCount((prev) => prev + 1);
      }

      // Show browser notification if app is in background
      if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
        // Push notification will be handled by service worker
        // This is just for in-app notifications when tab is hidden
      }
    });

    return unsubscribe;
  }, [userId]);

  // Mark as read
  const handleMarkRead = useCallback(async (notificationId: string) => {
    try {
      await markAsRead(notificationId);

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );

      // Decrement unread count
      setUnreadCount((prev) => Math.max(0, prev - 1));
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

      // Update local state
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
      await deleteNotification(notificationId);

      // Update local state
      const notification = notifications.find((n) => n.id === notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      // Decrement unread count if it was unread
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

  return {
    notifications,
    unreadCount,
    loading,
    markRead: handleMarkRead,
    markAllRead: handleMarkAllRead,
    deleteOne: handleDeleteOne,
    refresh,
    loadMore,
    hasMore,
  };
}
