// ============================================
// VIDEO CALLING - EVENT BRIDGE SERVICE
// ============================================
// Connects calendar events with video rooms.
// Creates/finds video rooms linked to events.

import { supabase } from '@/shared/lib/supabase';
import type { VideoRoom } from '../types';

/**
 * Get or create a video room linked to a calendar event.
 * If a room already exists for this event, returns it.
 * Otherwise creates a new one.
 */
export async function getOrCreateRoomForEvent(
  eventId: string
): Promise<VideoRoom> {
  // The database derives teacher/title from the scheduled occurrence and
  // creates the room + settings atomically, including member-first arrivals.
  const { data, error } = await supabase.rpc('ensure_event_video_room', {
    p_event_id: eventId,
  });
  if (error) {
    const expected = error.code === '42501' || error.code === 'P0002';
    throw new Error(expected ? error.message : 'No pudimos preparar la sala. Intenta entrar de nuevo.');
  }
  if (!data?.id || !data?.slug) throw new Error('No pudimos preparar la sala. Intenta entrar de nuevo.');
  return data as VideoRoom;
}

/**
 * Get the video room for a specific event (if it exists)
 */
export async function getRoomForEvent(eventId: string): Promise<VideoRoom | null> {
  const { data, error } = await supabase
    .from('video_rooms')
    .select('*')
    .eq('event_id', eventId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as VideoRoom | null;
}

/**
 * Check if an event has an active video call
 */
export async function isEventCallActive(eventId: string): Promise<boolean> {
  const { data: room } = await supabase
    .from('video_rooms')
    .select('status')
    .eq('event_id', eventId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  return !!room;
}
