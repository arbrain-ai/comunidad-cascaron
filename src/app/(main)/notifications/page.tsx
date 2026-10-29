// ============================================
// Notifications Page - Premium Edition
// ============================================
// Full-screen notifications with Skool-like premium styling

'use client';

import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useNotificationContext } from '@/features/notifications/contexts';
import { NotificationItem } from '@/features/notifications/components';

export default function NotificationsPage() {
  const router = useRouter();
  const { userProfile } = useUserProfile();
  const {
    notifications,
    unreadCount,
    loading,
    hasMore,
    markRead,
    markAllRead,
    deleteOne,
    loadMore,
  } = useNotificationContext();

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  // Navigate to notification URL
  const handleNotificationClick = (notification: any) => {
    const data = notification.data || {};

    let url = '/community';

    switch (notification.type) {
      case 'points_awarded':
        url = '/leaderboard';
        break;
      case 'mention':
      case 'reply':
      case 'post_comment':
      case 'admin_post':
      case 'agent_response':
        // Posts open in modal via ?post=<id> query param
        url = data.post_id ? `/community?post=${data.post_id}` : '/community';
        break;
      case 'new_course':
        url = data.course_id ? `/classroom/courses/${data.course_id}` : '/classroom';
        break;
      case 'new_lesson':
        url = data.course_id && data.lesson_id
          ? `/classroom/${data.course_id}?lesson=${data.lesson_id}`
          : '/classroom';
        break;
      case 'new_event':
      case 'event_reminder':
        url = data.event_id ? `/calendar?event=${data.event_id}` : '/calendar';
        break;
    }

    router.push(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-70px)] md:h-[calc(100vh-120px)]">
      {/* Container con max-width en desktop */}
      <div className="
        w-full max-w-2xl mx-auto
        flex flex-col h-full
        bg-background
        md:rounded-2xl md:border md:border-border-accent
        md:shadow-elevation-lg
        md:my-4
        overflow-hidden
      ">

        {/* Header - Premium styling (solo en desktop, en móvil el título está en MainHeader) */}
        <div className="
          hidden md:flex items-center justify-between
          px-6 py-5
          border-b border-primary/10
          bg-gradient-to-r from-primary/5 via-transparent to-transparent
          backdrop-blur-xl
        ">
          <div className="flex items-center gap-4">
            <div className="
              w-12 h-12 rounded-xl
              bg-gradient-to-br from-primary/15 to-primary/5
              flex items-center justify-center
              shadow-md shadow-primary/10
            ">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Notificaciones</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground/70 mt-0.5">
                  <span className="font-semibold text-primary">{unreadCount}</span> sin leer
                </p>
              )}
            </div>
          </div>

          {/* Mark all as read */}
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="
                flex items-center gap-2
                px-4 py-2.5
                text-sm font-semibold text-primary
                bg-primary/5 hover:bg-primary/10
                rounded-xl
                transition-colors duration-fast
              "
            >
              <CheckCheck className="w-4 h-4" />
              Marcar todas como leídas
            </button>
          )}
        </div>

        {/* Mobile toolbar - contador y acciones */}
        {unreadCount > 0 && (
          <div className="
            md:hidden
            flex items-center justify-between
            px-5 py-3
            border-b border-primary/10
            bg-gradient-to-r from-primary/5 via-transparent to-transparent
          ">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{unreadCount}</span> sin leer
            </p>
            <button
              onClick={markAllRead}
              className="
                flex items-center gap-1.5
                text-sm font-semibold text-primary
                hover:text-primary/80
                transition-colors duration-200
              "
            >
              <CheckCheck className="w-4 h-4" />
              Marcar leídas
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary/20 border-t-primary" />
                <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-primary/30" />
              </div>
              <p className="text-sm text-muted-foreground mt-4 font-medium">
                Cargando notificaciones...
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="
                w-24 h-24 rounded-2xl
                bg-gradient-to-br from-primary/10 to-primary/5
                flex items-center justify-center mb-6
                shadow-xl shadow-primary/10
              ">
                <Bell className="w-12 h-12 text-primary/40" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                No tienes notificaciones
              </h3>
              <p className="text-base text-muted-foreground/70 max-w-[280px]">
                Cuando recibas notificaciones, aparecerán aquí
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={markRead}
                  onDelete={deleteOne}
                  onClick={handleNotificationClick}
                />
              ))}

              {/* Load More Button */}
              {hasMore && (
                <div className="p-5 border-t border-border/30">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="
                      w-full py-3.5
                      text-sm font-semibold
                      text-primary hover:text-primary/80
                      bg-primary/5 hover:bg-primary/10
                      rounded-xl
                      transition-colors duration-fast
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        Cargando...
                      </span>
                    ) : (
                      'Ver más notificaciones'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
