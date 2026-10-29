// ============================================
// NotificationItem Component - Premium Edition
// ============================================
// Individual notification card with Skool-like premium styling

'use client';

import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Bell,
  MessageCircle,
  AtSign,
  Heart,
  MessageSquare,
  BookOpen,
  Calendar,
  Megaphone,
  Bot,
  X,
  Trophy,
  Video
} from 'lucide-react';
import type { Notification, NotificationType } from '../types';

interface NotificationItemProps {
  notification: Notification;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (notification: Notification) => void;
}

export function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  onClick,
}: NotificationItemProps) {
  const handleClick = () => {
    // Mark as read when clicked
    if (!notification.read && onMarkRead) {
      onMarkRead(notification.id);
    }

    // Navigate to content
    if (onClick) {
      onClick(notification);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(notification.id);
    }
  };

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkRead) {
      onMarkRead(notification.id);
    }
  };

  // Verificar avatar del autor en múltiples fuentes:
  // 1. Columna directa author_avatar (triggers de PostgreSQL)
  // 2. data.author_avatar (JSON fallback)
  const authorAvatar =
    notification.author_avatar ||
    notification.data?.author_avatar;
  const authorName = notification.data?.author_name || 'Usuario';

  // Limpiar HTML del body
  const cleanBody = notification.body ? stripHtmlTags(notification.body) : null;

  const isUnread = !notification.read;

  return (
    <div
      onClick={handleClick}
      className={`
        group relative cursor-pointer
        transition-colors duration-fast ease-out-expo
        ${isUnread
          ? 'bg-primary/8 border-l-[3px] border-l-primary hover:bg-primary/12'
          : 'hover:bg-card-hover border-l-[3px] border-l-transparent'
        }
      `}
    >
      {/* Premium hover glow effect (subtle) */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent" />
      </div>

      <div className="relative px-5 py-4">
        <div className="flex items-start gap-4">
          {/* Unread indicator dot - más visible con pulse animation */}
          {isUnread && (
            <div className="absolute left-1.5 top-1/2 -translate-y-1/2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse-dot" />
            </div>
          )}

          {/* Avatar/Icon - tamaño aumentado */}
          <div className="relative flex-shrink-0">
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt={authorName}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-background shadow-md"
              />
            ) : (
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center
                ring-2 ring-background shadow-md
                ${getIconBgColor(notification.type)}
              `}>
                {getIcon(notification.type)}
              </div>
            )}

            {/* Type badge overlay (pequeño icono en esquina) */}
            <div className={`
              absolute -bottom-0.5 -right-0.5
              w-5 h-5 rounded-full
              flex items-center justify-center
              border-2 border-background
              shadow-sm
              ${getIconBgColor(notification.type)}
            `}>
              {getIcon(notification.type, 'w-2.5 h-2.5')}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pt-0.5">
            {/* Title - más bold para mejor hierarchy */}
            <p className={`
              text-sm leading-snug
              ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'}
            `}>
              {notification.title}
            </p>

            {/* Body preview - mejor contraste */}
            {cleanBody && (
              <p className="text-[13px] text-muted-foreground/80 mt-1.5 line-clamp-2 leading-relaxed">
                {cleanBody}
              </p>
            )}

            {/* Timestamp - estilo más sutil */}
            <p className="text-xs text-muted-foreground/60 mt-2 font-medium">
              {formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
                locale: es,
              })}
            </p>
          </div>

          {/* Action buttons container */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Mark as read button - Skool-style dot */}
            {isUnread && onMarkRead && (
              <button
                onClick={handleMarkRead}
                className="
                  relative p-2 rounded-xl
                  opacity-60 hover:opacity-100
                  hover:bg-primary/10
                  transition-all duration-200
                  focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary/20
                  group/read
                "
                aria-label="Marcar como leída"
                title="Marcar como leída"
              >
                <div className="w-2.5 h-2.5 bg-primary rounded-full transition-transform group-hover/read:scale-110" />
              </button>
            )}

            {/* Delete button - mejor hover state */}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="
                  p-2 rounded-xl
                  opacity-0 group-hover:opacity-100
                  hover:bg-error/10 hover:text-error
                  transition-all duration-200
                  focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary/20
                "
                aria-label="Eliminar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom separator line - más sutil */}
      <div className="absolute bottom-0 left-5 right-5 h-px bg-border/40" />
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

/**
 * Elimina tags HTML y devuelve solo el texto limpio
 */
function stripHtmlTags(html: string): string {
  // Reemplazar tags HTML con espacios
  const withoutTags = html.replace(/<[^>]*>/g, ' ');

  // Decodificar entidades HTML comunes
  const decoded = withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Eliminar espacios múltiples y trim
  return decoded.replace(/\s+/g, ' ').trim();
}

function getIcon(type: NotificationType, customClass?: string) {
  const iconClass = customClass || "w-5 h-5";

  switch (type) {
    case 'points_awarded':
      return <Trophy className={iconClass} />;
    case 'mention':
      return <AtSign className={iconClass} />;
    case 'reply':
      return <MessageSquare className={iconClass} />;
    case 'message':
      return <MessageCircle className={iconClass} />;
    case 'admin_post':
      return <Megaphone className={iconClass} />;
    case 'post_comment':
      return <MessageSquare className={iconClass} />;
    case 'like':
      return <Heart className={iconClass} />;
    case 'agent_response':
      return <Bot className={iconClass} />;
    case 'new_course':
    case 'new_lesson':
      return <BookOpen className={iconClass} />;
    case 'new_event':
    case 'event_reminder':
      return <Calendar className={iconClass} />;
    case 'video_call_started':
      return <Video className={iconClass} />;
    default:
      return <Bell className={iconClass} />;
  }
}

function getIconBgColor(type: NotificationType): string {
  switch (type) {
    case 'points_awarded':
      return 'bg-amber-500/15 text-amber-500';
    case 'mention':
      return 'bg-blue-500/15 text-blue-500';
    case 'reply':
      return 'bg-emerald-500/15 text-emerald-500';
    case 'message':
      return 'bg-violet-500/15 text-violet-500';
    case 'admin_post':
      return 'bg-rose-500/15 text-rose-500';
    case 'post_comment':
      return 'bg-emerald-500/15 text-emerald-500';
    case 'like':
      return 'bg-pink-500/15 text-pink-500';
    case 'agent_response':
      return 'bg-indigo-500/15 text-indigo-500';
    case 'new_course':
    case 'new_lesson':
      return 'bg-amber-500/15 text-amber-500';
    case 'new_event':
    case 'event_reminder':
      return 'bg-orange-500/15 text-orange-500';
    case 'video_call_started':
      return 'bg-red-500/15 text-red-500';
    default:
      return 'bg-gray-500/15 text-gray-400';
  }
}
