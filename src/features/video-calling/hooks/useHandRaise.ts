'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/shared/lib/supabase';
import type { VideoHandRaiseWithProfile, HandRaisePriority } from '../types';
import { getHandRaiseChannel } from '../config/livekit';

interface UseHandRaiseOptions {
  sessionId: string | null;
  userId: string;
  priority?: HandRaisePriority;
}

interface UseHandRaiseReturn {
  queue: VideoHandRaiseWithProfile[];
  isHandRaised: boolean;
  raiseHand: () => Promise<void>;
  lowerHand: () => Promise<void>;
  acknowledgeHand: (handRaiseId: string) => Promise<void>;
  lowerAllHands: () => Promise<void>;
}

export function useHandRaise({ sessionId, userId, priority = 'normal' }: UseHandRaiseOptions): UseHandRaiseReturn {
  const [queue, setQueue] = useState<VideoHandRaiseWithProfile[]>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // Reusable queue loader
  const loadQueue = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    const { data } = await supabase
      .from('video_hand_raises')
      .select(`*, profile:user_id(id, full_name, avatar_url, current_level, tier)`)
      .eq('session_id', sid)
      .is('lowered_at', null)
      .order('priority', { ascending: false })
      .order('position_in_queue', { ascending: true });

    if (data) {
      setQueue(data as unknown as VideoHandRaiseWithProfile[]);
      setIsHandRaised(data.some((h: { user_id: string }) => h.user_id === userId));
    }
  }, [userId]);

  // Load initial queue and subscribe to changes
  useEffect(() => {
    if (!sessionId) return;

    loadQueue();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(getHandRaiseChannel(sessionId))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_hand_raises',
        filter: `session_id=eq.${sessionId}`,
      }, () => {
        loadQueue();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, loadQueue]);

  const raiseHand = useCallback(async () => {
    if (!sessionId || isHandRaised) return;

    const maxPos = queue.length > 0
      ? Math.max(...queue.map(h => h.position_in_queue || 0))
      : 0;

    const { error } = await supabase.from('video_hand_raises').insert({
      session_id: sessionId,
      user_id: userId,
      priority,
      position_in_queue: maxPos + 1,
    });

    if (!error) {
      setIsHandRaised(true);
      // Immediately reload queue instead of waiting for realtime
      await loadQueue();
    }
  }, [sessionId, userId, priority, isHandRaised, queue, loadQueue]);

  const lowerHand = useCallback(async () => {
    if (!sessionId) return;

    const { error } = await supabase
      .from('video_hand_raises')
      .update({ lowered_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .is('lowered_at', null);

    if (!error) {
      setIsHandRaised(false);
      await loadQueue();
    }
  }, [sessionId, userId, loadQueue]);

  const acknowledgeHand = useCallback(async (handRaiseId: string) => {
    const { error } = await supabase
      .from('video_hand_raises')
      .update({
        acknowledged_at: new Date().toISOString(),
        was_addressed: true,
        lowered_at: new Date().toISOString(),
      })
      .eq('id', handRaiseId);

    if (!error) {
      await loadQueue();
    }
  }, [loadQueue]);

  const lowerAllHands = useCallback(async () => {
    if (!sessionId) return;

    const { error } = await supabase
      .from('video_hand_raises')
      .update({ lowered_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is('lowered_at', null);

    if (!error) {
      setIsHandRaised(false);
      await loadQueue();
    }
  }, [sessionId, loadQueue]);

  return { queue, isHandRaised, raiseHand, lowerHand, acknowledgeHand, lowerAllHands };
}
