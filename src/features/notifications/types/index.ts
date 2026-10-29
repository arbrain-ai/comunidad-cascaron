// ============================================
// Notification Types
// ============================================
// Type definitions for notification system

import type { UserProfile } from '@/shared/types/user.types';

export type NotificationType =
  | 'mention'              // @username en post/comment
  | 'reply'                // Respuesta a tu comentario
  | 'message'              // Mensaje privado
  | 'admin_post'           // Admin publicó nuevo post
  | 'post_comment'         // Comentario en tu post
  | 'like'                 // Like en tu post/comment
  | 'agent_response'       // Agente AI respondió
  | 'new_course'           // Nuevo curso publicado
  | 'new_lesson'           // Nueva lección en curso
  | 'new_event'            // Nuevo evento
  | 'event_reminder'       // Recordatorio de evento
  | 'points_awarded'       // Recibo de puntos acreditados por logros o participación
  | 'video_call_started';  // Videollamada en vivo

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  read: boolean;
  created_at: string;
  author_avatar?: string | null; // Columna directa para avatar del autor
}

export interface NotificationWithSender extends Notification {
  sender?: UserProfile | null;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_name?: string | null;
  browser?: string | null;
  user_agent?: string | null;
  created_at: string;
  last_used_at: string;
}

export interface CreateNotificationInput {
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, any>;
}

export interface SendPushNotificationInput {
  userId: string;
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: Record<string, any>;
    tag?: string;
    requireInteraction?: boolean;
  };
}
