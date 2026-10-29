// ============================================
// NotificationDropdown Component
// ============================================
// Dropdown de notificaciones para desktop
// Consistente con MessagesDropdown en tamaño y estilo

'use client';

import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import { Sheet } from '@/shared/components/Sheet';
import { useIsMobile } from '@/shared/hooks/useMediaQuery';
import type { Notification } from '../types';

interface NotificationDropdownProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
  onClose: () => void;
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  loading,
  hasMore,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onLoadMore,
  onClose,
}: NotificationDropdownProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  const handleNotificationClick = (notification: Notification) => {
    // Close dropdown
    onClose();

    // Navigate based on notification type and data
    const url = getNotificationUrl(notification);
    if (url) {
      router.push(url);
    }
  };

  // Content reutilizado en dropdown y sheet
  const content = (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Notificaciones
            </h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-primary text-primary-foreground rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Marcar leídas</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary/20 border-t-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Bell className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">
              Sin notificaciones
            </p>
            <p className="text-xs text-muted-foreground">
              Te avisaremos cuando haya algo nuevo
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/30">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={onMarkRead}
                  onDelete={onDelete}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>

            {/* Load more button */}
            {hasMore && (
              <div className="p-3">
                <button
                  onClick={onLoadMore}
                  disabled={loading}
                  className="w-full py-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Cargando...' : 'Ver más'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer - Ver todas */}
      {notifications.length > 0 && (
        <div className="border-t border-border flex-shrink-0">
          <button
            onClick={() => {
              onClose();
              router.push('/notifications');
            }}
            className="w-full flex items-center justify-center gap-1 px-4 py-2.5 text-xs font-medium text-primary hover:bg-accent/50 transition-colors"
          >
            Ver todas
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  // Mobile: Sheet
  if (isMobile) {
    return (
      <Sheet isOpen={true} onClose={onClose} showCloseButton={false}>
        <div className="h-[85vh] flex flex-col">
          {content}
        </div>
      </Sheet>
    );
  }

  // Desktop: Dropdown (mismo tamaño que MessagesDropdown)
  return (
    <div className="
      absolute right-0 top-full mt-2
      w-[420px] max-h-[520px]
      bg-surface backdrop-blur-sm
      border border-border
      rounded-xl
      shadow-lg
      overflow-hidden
      z-[9999]
      flex flex-col
      animate-in fade-in slide-in-from-top-2 duration-150
    ">
      {content}
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get navigation URL based on notification type and data
 */
function getNotificationUrl(notification: Notification): string | null {
  const { type, data } = notification;

  if (!data) return null;

  switch (type) {
    case 'points_awarded':
      return '/leaderboard';

    case 'mention':
    case 'reply':
    case 'post_comment':
    case 'admin_post':
    case 'agent_response':
      // Posts open in modal via ?post=<id> query param
      if (data.post_id) {
        return `/community?post=${data.post_id}`;
      }
      return '/community';

    case 'new_course':
      if (data.course_id) {
        return `/classroom/courses/${data.course_id}`;
      }
      return '/classroom';

    case 'new_lesson':
      if (data.lesson_id && data.course_id) {
        return `/classroom/${data.course_id}?lesson=${data.lesson_id}`;
      }
      return '/classroom';

    case 'new_event':
    case 'event_reminder':
      if (data.event_id) {
        return `/calendar?event=${data.event_id}`;
      }
      return '/calendar';

    default:
      return null;
  }
}
