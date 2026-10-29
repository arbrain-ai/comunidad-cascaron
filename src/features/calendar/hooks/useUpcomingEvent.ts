'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { getCached, setCached } from '@/shared/lib/queryCache';
import { EventWithCreator } from '../types';

type UserTier = 'standard' | 'vip' | null;

interface UseUpcomingEventOptions {
  userTier: UserTier;
  hoursAhead?: number; // How many hours ahead to look (default: 72)
}

export type EventStatus =
  | 'future'        // More than JOIN_WINDOW_MINUTES before start
  | 'window_open'   // Within JOIN_WINDOW_MINUTES of start_time, not yet started
  | 'live'          // Between start_time and end_time
  | 'recently_ended'; // After end_time but recording/event still relevant

interface UseUpcomingEventReturn {
  upcomingEvent: EventWithCreator | null;
  timeUntil: string | null;
  /** Minutes until start. Negative if already started. */
  minutesUntilStart: number | null;
  /** Minutes until end. Negative if already ended. */
  minutesUntilEnd: number | null;
  status: EventStatus | null;
  /** True when users can join (−JOIN_WINDOW_MINUTES to event end). */
  canJoin: boolean;
  isLoading: boolean;
}

// Users can enter the room from JOIN_WINDOW_MINUTES before start_time
// until the event end (start_time + duration_minutes).
export const JOIN_WINDOW_MINUTES = 10;
// How long a finished event stays surfaced on the banner with its recording link.
const RECENTLY_ENDED_WINDOW_MINUTES = 24 * 60;

function formatCountdown(diffMs: number): string {
  // Collapse the last second into "ahora" so we never render "0:00" for the
  // user; mm:ss with a zero second window was confusing in QA.
  if (diffMs < 1000) return 'ahora';

  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  // Fine-grained view when the join window is close: mm:ss
  if (totalMinutes < JOIN_WINDOW_MINUTES) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  if (totalHours < 24) {
    const remainingMinutes = totalMinutes % 60;
    if (remainingMinutes > 0) {
      return `${totalHours}h ${remainingMinutes}min`;
    }
    return `${totalHours} hora${totalHours > 1 ? 's' : ''}`;
  }

  const remainingHours = totalHours % 24;
  if (remainingHours > 0) {
    return `${totalDays}d ${remainingHours}h`;
  }
  return `${totalDays} día${totalDays > 1 ? 's' : ''}`;
}

/**
 * Get the most relevant event for the community banner:
 * in-progress > about-to-start > future > recently-ended-with-recording.
 * Filters by user tier (standard users only see standard events).
 */
export function useUpcomingEvent({
  userTier,
  hoursAhead = 72,
}: UseUpcomingEventOptions): UseUpcomingEventReturn {
  // Paint-first: el banner pinta el último evento conocido al instante y se
  // revalida en silencio (la relevancia live/future se recalcula en el tick).
  const cacheKey = userTier ? `upcoming-event:${userTier}:${hoursAhead}` : null;
  const initialCache = getCached<EventWithCreator | null>(cacheKey);
  const [upcomingEvent, setUpcomingEvent] = useState<EventWithCreator | null>(
    initialCache ? initialCache.data : null
  );
  const [isLoading, setIsLoading] = useState(!initialCache);

  const [timeUntil, setTimeUntil] = useState<string | null>(null);
  const [minutesUntilStart, setMinutesUntilStart] = useState<number | null>(null);
  const [minutesUntilEnd, setMinutesUntilEnd] = useState<number | null>(null);
  const [status, setStatus] = useState<EventStatus | null>(null);

  useEffect(() => {
    async function fetchUpcomingEvent() {
      if (!userTier) {
        setIsLoading(false);
        return;
      }

      try {
        const now = new Date();
        // Pull events whose start_time is within a window that may include
        // an event still in-progress or just ended (up to ~4h back) and
        // anything starting in the next hoursAhead hours.
        const pastLimit = new Date(now.getTime() - 4 * 60 * 60 * 1000);
        const futureLimit = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

        let query = supabase
          .from('events')
          .select(`
            *,
            creator:profiles!events_created_by_fkey (
              id,
              full_name,
              avatar_url
            )
          `)
          .gte('start_time', pastLimit.toISOString())
          .lte('start_time', futureLimit.toISOString())
          // UNA CLASE CANCELADA NO ESTA "EN VIVO" (4 sep 2026). Este banner
          // sale en el feed de TODA la comunidad y no miraba `status`: un
          // evento cancelado seguia anunciandose con el punto ambar y el
          // "Entrar a la clase", mandando gente a una sala que no existe.
          // `null` cuenta como programado (las filas viejas no tienen status).
          .or('status.is.null,status.neq.cancelado')
          .order('start_time', { ascending: true })
          .limit(10);

        if (userTier === 'standard') {
          query = query.eq('visible_to_tier', 'standard');
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching upcoming event:', error);
          setUpcomingEvent(null);
          return;
        }

        if (!data || data.length === 0) {
          setUpcomingEvent(null);
          return;
        }

        // Pick the most relevant event:
        // 1. In-progress (start <= now <= end)
        // 2. Next future
        // 3. Most recent ended-with-recording within 24h
        const tNow = Date.now();
        const events = data as EventWithCreator[];
        const enriched = events.map((e) => {
          const start = new Date(e.start_time).getTime();
          const end = start + (e.duration_minutes || 60) * 60 * 1000;
          return { e, start, end };
        });

        const live = enriched.find(({ start, end }) => tNow >= start && tNow <= end);
        const future = enriched.find(({ start }) => start > tNow);
        const endedWithRecording = [...enriched]
          .reverse()
          .find(({ e, end }) =>
            end < tNow &&
            tNow - end <= RECENTLY_ENDED_WINDOW_MINUTES * 60 * 1000 &&
            // treat a recently-ended event as worth surfacing even without URL,
            // so users still see "Clase terminada" briefly after the call.
            !!e.id
          );

        const chosen = live ?? future ?? endedWithRecording;
        setCached(`upcoming-event:${userTier}:${hoursAhead}`, chosen?.e ?? null);
        setUpcomingEvent(chosen?.e ?? null);
      } catch (err) {
        console.error('Error in useUpcomingEvent:', err);
        setUpcomingEvent(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUpcomingEvent();
  }, [userTier, hoursAhead]);

  // Derive timing state. Ticks every second when close to the join window,
  // every 60s otherwise, so the countdown feels live near the event.
  useEffect(() => {
    if (!upcomingEvent) {
      setTimeUntil(null);
      setMinutesUntilStart(null);
      setMinutesUntilEnd(null);
      setStatus(null);
      return;
    }

    let interval: ReturnType<typeof setInterval>;

    function tick() {
      const now = Date.now();
      const eventStart = new Date(upcomingEvent!.start_time).getTime();
      const eventEnd = eventStart + (upcomingEvent!.duration_minutes || 60) * 60 * 1000;
      const windowStart = eventStart - JOIN_WINDOW_MINUTES * 60 * 1000;

      const msToStart = eventStart - now;
      const msToEnd = eventEnd - now;
      const minsToStart = Math.floor(msToStart / 60000);
      const minsToEnd = Math.floor(msToEnd / 60000);

      setMinutesUntilStart(minsToStart);
      setMinutesUntilEnd(minsToEnd);

      let nextStatus: EventStatus;
      if (now > eventEnd) {
        nextStatus = 'recently_ended';
      } else if (now >= eventStart) {
        nextStatus = 'live';
      } else if (now >= windowStart) {
        nextStatus = 'window_open';
      } else {
        nextStatus = 'future';
      }
      setStatus(nextStatus);

      // Countdown: shows fine-grained seconds once within the join window.
      if (nextStatus === 'live') {
        setTimeUntil(formatCountdown(msToEnd));
      } else if (nextStatus === 'recently_ended') {
        setTimeUntil(null);
      } else {
        setTimeUntil(formatCountdown(msToStart));
      }

      // Adaptive tick: 1s if close to window, else 60s.
      const useFastTick =
        nextStatus === 'live' ||
        nextStatus === 'window_open' ||
        (msToStart > 0 && msToStart <= (JOIN_WINDOW_MINUTES + 1) * 60 * 1000);

      const desired = useFastTick ? 1000 : 60000;
      if (interval) clearInterval(interval);
      interval = setInterval(tick, desired);
    }

    tick();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [upcomingEvent]);

  const canJoin =
    status === 'window_open' || status === 'live';

  return {
    upcomingEvent,
    timeUntil,
    minutesUntilStart,
    minutesUntilEnd,
    status,
    canJoin,
    isLoading,
  };
}
