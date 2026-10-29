'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/shared/lib/supabase';

// Core 6 reactions - the 20% that produces 80% of engagement
export const REACTIONS = [
  { emoji: '\uD83D\uDC4D', label: 'Me gusta' },
  { emoji: '\u2764\uFE0F', label: 'Corazon' },
  { emoji: '\uD83D\uDE02', label: 'Risa' },
  { emoji: '\uD83D\uDE2E', label: 'Sorpresa' },
  { emoji: '\uD83D\uDC4F', label: 'Aplauso' },
  { emoji: '\uD83D\uDD25', label: 'Fuego' },
] as const;

export type ReactionEmoji = typeof REACTIONS[number]['emoji'];

export interface VisibleReaction {
  id: string;
  emoji: ReactionEmoji;
  userName: string;
  timestamp: number;
}

interface UseReactionsOptions {
  roomId: string;
  userId: string;
  userName: string;
  /** Ref to shared broadcast channel. When provided, uses it for sending (parent registers handlers). */
  sharedChannelRef?: React.MutableRefObject<ReturnType<typeof supabase.channel> | null>;
}

interface UseReactionsReturn {
  visibleReactions: VisibleReaction[];
  sendReaction: (emoji: string) => void;
  /** Handler for incoming reactions. Parent registers this on the shared channel. */
  handleIncomingReaction: (payload: { payload: { emoji?: string; userName?: string; senderId?: string } }) => void;
}

const REACTION_VISIBLE_MS = 3000;

export function useReactions({ roomId, userId, userName, sharedChannelRef }: UseReactionsOptions): UseReactionsReturn {
  const [visibleReactions, setVisibleReactions] = useState<VisibleReaction[]>([]);
  const ownChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const counterRef = useRef(0);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Handler for incoming reactions (exposed for parent to register on shared channel)
  const handleIncomingReaction = useCallback((payload: { payload: { emoji?: string; userName?: string; senderId?: string } }) => {
    const { emoji, userName: senderName, senderId } = payload.payload || {};
    if (!emoji) return;

    const reaction: VisibleReaction = {
      id: `${senderId}-${Date.now()}-${counterRef.current++}`,
      emoji: emoji as ReactionEmoji,
      userName: senderName || 'Usuario',
      timestamp: Date.now(),
    };

    setVisibleReactions((prev) => [...prev, reaction]);

    // Auto-remove after animation (with cleanup tracking)
    const timer = setTimeout(() => {
      setVisibleReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      timersRef.current.delete(timer);
    }, REACTION_VISIBLE_MS);
    timersRef.current.add(timer);
  }, []);

  // Standalone channel fallback (only when no shared channel ref provided)
  useEffect(() => {
    if (sharedChannelRef) {
      return () => {
        timersRef.current.forEach(t => clearTimeout(t));
        timersRef.current.clear();
      };
    }

    const channel = supabase.channel(`video:reactions:${roomId}`);
    channel.on('broadcast', { event: 'reaction' }, handleIncomingReaction);
    channel.subscribe();
    ownChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
  }, [roomId, sharedChannelRef, handleIncomingReaction]);

  // Send a reaction
  const sendReaction = useCallback((emoji: string) => {
    const channel = sharedChannelRef?.current || ownChannelRef.current;
    if (!channel) return;

    channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: {
        emoji,
        userName,
        senderId: userId,
      },
    });
  }, [sharedChannelRef, userId, userName]);

  return {
    visibleReactions,
    sendReaction,
    handleIncomingReaction,
  };
}
