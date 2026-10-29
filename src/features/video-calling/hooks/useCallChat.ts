'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/shared/lib/supabase';
import type { InCallChatMessage, InCallChatAttachment } from '../types';

// Where chat-call attachments live. Reuse the existing public bucket used
// by community posts — same UUID-filename pattern keeps URLs unguessable.
const ATTACHMENT_BUCKET = 'post-attachments';
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB per file
// Allowed mime patterns. Images render inline; everything else as document card.
const IMAGE_MIME_RE = /^image\/(png|jpe?g|webp|gif)$/i;
const DOCUMENT_MIME_RE = /^(application\/pdf|application\/vnd\.|application\/msword|application\/vnd\.openxmlformats|application\/zip|text\/.*)/i;

const SPEAKER_TIME_LIMIT = '3 minutos';

interface UseCallChatOptions {
  sessionId: string | null;
  userId: string;
  userName: string;
  userAvatar: string | null;
  /** Ref to shared broadcast channel. When provided, uses it for sending (parent registers handlers). */
  sharedChannelRef?: React.MutableRefObject<ReturnType<typeof supabase.channel> | null>;
}

interface UseCallChatReturn {
  messages: InCallChatMessage[];
  sendMessage: (content: string, attachment?: InCallChatAttachment) => void;
  /** Upload a file and send it as a message. Returns the URL or null on error. */
  sendAttachment: (file: File, captionContent?: string) => Promise<string | null>;
  /** True while an attachment upload is in flight. UI uses this to show progress. */
  isUploadingAttachment: boolean;
  unreadCount: number;
  clearUnread: () => void;
  /** Handler for incoming chat messages. Parent registers this on the shared channel. */
  handleIncomingMessage: (payload: { payload: InCallChatMessage }) => void;
  /** Prefill the chat input (p.ej. desde el modal de levantar la mano) */
  prefillContent: string;
  clearPrefill: () => void;
  setPrefill: (content: string) => void;
}

const MAX_CHAT_MESSAGES = 200;

/** Mensaje fijo de bienvenida (solo local, nunca se transmite). */
function createPinnedMessage(sessionId: string): InCallChatMessage {
  return {
    id: 'chat-welcome',
    session_id: sessionId || '',
    user_id: 'system',
    user_name: 'Chat de la llamada',
    user_avatar: null,
    content: `Bienvenido al chat de la llamada.\n\nPara mantener la participacion organizada, cada intervención con micrófono tiene un limite de ${SPEAKER_TIME_LIMIT}. Al quedar 30 segundos veras un contador.`,
    timestamp: new Date().toISOString(),
    is_pinned: true,
  };
}

export function useCallChat({ sessionId, userId, userName, userAvatar, sharedChannelRef }: UseCallChatOptions): UseCallChatReturn {
  const [messages, setMessages] = useState<InCallChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prefillContent, setPrefillContent] = useState('');
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const ownChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Inject pinned welcome message on mount.
  useEffect(() => {
    if (sessionId) {
      setMessages([createPinnedMessage(sessionId)]);
    }
  }, [sessionId]);

  // Handler for incoming chat messages (exposed for parent to register on shared channel)
  const handleIncomingMessage = useCallback((payload: { payload: InCallChatMessage }) => {
    const msg = payload.payload as InCallChatMessage;
    setMessages(prev => {
      const next = [...prev, msg];
      return next.length > MAX_CHAT_MESSAGES ? [prev[0], ...next.slice(-(MAX_CHAT_MESSAGES - 1))] : next;
    });
    if (msg.user_id !== userId) {
      setUnreadCount(prev => prev + 1);
    }
  }, [userId]);

  // Standalone channel fallback (only when no shared channel ref provided)
  useEffect(() => {
    if (!sessionId || sharedChannelRef) return;

    const channel = supabase.channel(`video:chat:${sessionId}`);
    ownChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'chat_message' }, handleIncomingMessage)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      ownChannelRef.current = null;
    };
  }, [sessionId, sharedChannelRef, handleIncomingMessage]);

  const sendMessage = useCallback((content: string, attachment?: InCallChatAttachment) => {
    const channel = sharedChannelRef?.current || ownChannelRef.current;
    if (!channel || !sessionId) return;
    const trimmed = content.trim();
    // A message must have either text content OR an attachment — but not be empty.
    if (!trimmed && !attachment) return;

    const msg: InCallChatMessage = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      user_id: userId,
      user_name: userName,
      user_avatar: userAvatar,
      content: trimmed,
      timestamp: new Date().toISOString(),
      ...(attachment ? { attachment } : {}),
    };

    channel.send({
      type: 'broadcast',
      event: 'chat_message',
      payload: msg,
    });

    // Add to local state immediately (capped, preserve pinned)
    setMessages(prev => {
      const next = [...prev, msg];
      return next.length > MAX_CHAT_MESSAGES ? [prev[0], ...next.slice(-(MAX_CHAT_MESSAGES - 1))] : next;
    });
  }, [sharedChannelRef, sessionId, userId, userName, userAvatar]);

  /**
   * Upload a file to Supabase Storage and send a chat message referencing it.
   * Used by both the paste handler (Ctrl+V image from clipboard) and the
   * file-picker button. Returns the public URL on success, null on failure.
   */
  const sendAttachment = useCallback(async (file: File, captionContent: string = ''): Promise<string | null> => {
    if (!sessionId) return null;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      console.warn('[useCallChat] attachment too large:', file.size);
      return null;
    }
    const isImage = IMAGE_MIME_RE.test(file.type);
    const isDocument = DOCUMENT_MIME_RE.test(file.type);
    if (!isImage && !isDocument) {
      console.warn('[useCallChat] unsupported attachment type:', file.type);
      return null;
    }
    setIsUploadingAttachment(true);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const path = `video-call/${sessionId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadErr) {
        console.error('[useCallChat] upload failed:', uploadErr);
        return null;
      }
      const { data: urlData } = supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(path);
      const url = urlData.publicUrl;

      const attachment: InCallChatAttachment = {
        url,
        type: isImage ? 'image' : 'document',
        name: file.name || 'archivo',
        size: file.size,
        mime: file.type || 'application/octet-stream',
      };
      sendMessage(captionContent, attachment);
      return url;
    } catch (err) {
      console.error('[useCallChat] sendAttachment fatal:', err);
      return null;
    } finally {
      setIsUploadingAttachment(false);
    }
  }, [sessionId, sendMessage]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);
  const clearPrefill = useCallback(() => setPrefillContent(''), []);
  const setPrefill = useCallback((content: string) => setPrefillContent(content), []);

  return {
    messages,
    sendMessage,
    sendAttachment,
    isUploadingAttachment,
    unreadCount,
    clearUnread,
    handleIncomingMessage,
    prefillContent,
    clearPrefill,
    setPrefill,
  };
}
