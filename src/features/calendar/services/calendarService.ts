import { supabase } from '@/shared/lib/supabase';
import { addMinutes } from 'date-fns';
import {
  Event,
  EventWithCreator,
  CreateEventInput,
  UpdateEventInput,
  EventFilters,
} from '../types';

/**
 * Fetch events within a date range with creator info
 */
export async function getEvents(filters: EventFilters): Promise<EventWithCreator[]> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:profiles!events_created_by_fkey (
        id,
        full_name,
        avatar_url
      )
    `)
    .gte('start_time', filters.startDate)
    .lte('start_time', filters.endDate)
    .order('start_time');

  if (error) throw error;
  return data as EventWithCreator[];
}

/**
 * Fetch upcoming events (for simple list view)
 */
export async function getUpcomingEvents(limit = 10): Promise<EventWithCreator[]> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:profiles!events_created_by_fkey (
        id,
        full_name,
        avatar_url
      )
    `)
    .gte('start_time', new Date().toISOString())
    .order('start_time')
    .limit(limit);

  if (error) throw error;
  return data as EventWithCreator[];
}

/**
 * Get a single event by ID with creator info
 */
export async function getEventById(eventId: string): Promise<EventWithCreator | null> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:profiles!events_created_by_fkey (
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('id', eventId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as EventWithCreator;
}

/**
 * Create a new event
 */
export async function createEvent(
  userId: string,
  input: CreateEventInput
): Promise<Event> {
  const startTime = new Date(input.start_time);
  const endTime = addMinutes(startTime, input.duration_minutes);

  const row = {
    title: input.title,
    description: input.description || null,
    start_time: input.start_time,
    end_time: endTime.toISOString(),
    google_meet_link: input.google_meet_link || null,
    cover_image_url: input.cover_image_url || null,
    recording_url: input.recording_url || null,
    duration_minutes: input.duration_minutes,
    is_recurring: input.is_recurring || false,
    recurrence_pattern: input.recurrence_pattern || null,
    required_tier: input.required_tier || 'standard',
    visible_to_tier: input.visible_to_tier || 'standard',
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('events')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create multiple events (for recurrence)
 */
export async function createEvents(
  userId: string,
  inputs: CreateEventInput[],
  parentEventId?: string
): Promise<Event[]> {
  const eventsToInsert = inputs.map((input) => {
    const startTime = new Date(input.start_time);
    const endTime = addMinutes(startTime, input.duration_minutes);

    return {
      title: input.title,
      description: input.description || null,
      start_time: input.start_time,
      end_time: endTime.toISOString(),
      google_meet_link: input.google_meet_link || null,
      cover_image_url: input.cover_image_url || null,
      duration_minutes: input.duration_minutes,
      is_recurring: true,
      recurrence_pattern: input.recurrence_pattern || null,
      required_tier: input.required_tier || 'standard',
      visible_to_tier: input.visible_to_tier || 'standard',
      parent_event_id: parentEventId || null,
      created_by: userId,
    };
  });

  const { data, error } = await supabase
    .from('events')
    .insert(eventsToInsert)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Update an event
 */
export async function updateEvent(
  eventId: string,
  input: UpdateEventInput
): Promise<Event> {
  const updateData: Record<string, unknown> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.google_meet_link !== undefined) updateData.google_meet_link = input.google_meet_link;
  if (input.cover_image_url !== undefined) updateData.cover_image_url = input.cover_image_url;

  // Link de la grabacion
  if (input.recording_url !== undefined) {
    updateData.recording_url = input.recording_url || null;
  }

  // If start_time or duration changes, recalculate end_time
  if (input.start_time !== undefined || input.duration_minutes !== undefined) {
    // Need to fetch current event to get missing values
    const { data: currentEvent } = await supabase
      .from('events')
      .select('start_time, duration_minutes')
      .eq('id', eventId)
      .single();

    if (currentEvent) {
      const startTime = new Date(input.start_time || currentEvent.start_time);
      const duration = input.duration_minutes || currentEvent.duration_minutes || 60;
      const endTime = addMinutes(startTime, duration);

      if (input.start_time) updateData.start_time = input.start_time;
      if (input.duration_minutes) updateData.duration_minutes = input.duration_minutes;
      updateData.end_time = endTime.toISOString();
    }
  }

  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a single event (handles parent promotion for recurring series)
 * If deleting the parent of a recurring series, promotes the next child as the new parent
 */
export async function deleteEvent(eventId: string): Promise<void> {
  // Check if this event has children (is a parent of a recurring series)
  const { data: children, error: childrenError } = await supabase
    .from('events')
    .select('id, start_time')
    .eq('parent_event_id', eventId)
    .order('start_time', { ascending: true });

  if (childrenError) throw childrenError;

  // If this event has children, we need to promote one before deleting
  if (children && children.length > 0) {
    const newParentId = children[0].id;
    const otherChildrenIds = children.slice(1).map(c => c.id);

    // Promote the first child as new parent (set parent_event_id to null)
    const { error: promoteError } = await supabase
      .from('events')
      .update({ parent_event_id: null })
      .eq('id', newParentId);

    if (promoteError) throw promoteError;

    // Update all other children to point to the new parent
    if (otherChildrenIds.length > 0) {
      const { error: updateError } = await supabase
        .from('events')
        .update({ parent_event_id: newParentId })
        .in('id', otherChildrenIds);

      if (updateError) throw updateError;
    }
  }

  // Now safe to delete the event (no cascade will happen)
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) throw error;
}

/**
 * Delete all recurring events (by parent_event_id)
 */
export async function deleteRecurringEvents(parentEventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('parent_event_id', parentEventId);

  if (error) throw error;

  // Also delete the parent event
  await deleteEvent(parentEventId);
}

/**
 * Delete future recurring events (from a specific event onwards)
 * Keeps past events, deletes selected event and all future ones in the series
 */
export async function deleteFutureRecurringEvents(
  eventId: string,
  eventStartTime: string,
  parentEventId: string | null
): Promise<void> {
  // Determine the parent ID to use for filtering
  const seriesParentId = parentEventId || eventId;

  // Delete all events in the series that start on or after the selected event
  const { error: futureError } = await supabase
    .from('events')
    .delete()
    .eq('parent_event_id', seriesParentId)
    .gte('start_time', eventStartTime);

  if (futureError) throw futureError;

  // Delete the selected event itself
  await deleteEvent(eventId);

  // If the selected event is the parent (no parent_event_id),
  // we need to check if there are remaining children and promote one
  if (!parentEventId) {
    // The parent was deleted, children with parent_event_id pointing to it
    // should already be deleted by the query above (if their start_time >= eventStartTime)
    // But past events still have parent_event_id pointing to deleted parent
    // We need to clear their parent_event_id or leave them as orphans
    // For simplicity, we'll leave them as they are (they're past events anyway)
  }
}

/**
 * Update future recurring events (from a specific event onwards)
 * Updates selected event and all future ones in the series
 * For time changes: applies the same time-of-day to all future events
 */
export async function updateFutureRecurringEvents(
  eventId: string,
  eventStartTime: string,
  parentEventId: string | null,
  input: UpdateEventInput
): Promise<void> {
  const seriesParentId = parentEventId || eventId;

  // Update the selected event first (includes time change)
  await updateEvent(eventId, input);

  // Build update data for future events (non-time fields)
  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.google_meet_link !== undefined) updateData.google_meet_link = input.google_meet_link;
  if (input.cover_image_url !== undefined) updateData.cover_image_url = input.cover_image_url;
  if (input.recording_url !== undefined) updateData.recording_url = input.recording_url || null;
  if (input.duration_minutes !== undefined) updateData.duration_minutes = input.duration_minutes;
  updateData.updated_at = new Date().toISOString();

  // Handle time changes for future events
  if (input.start_time) {
    const newTime = new Date(input.start_time);
    const newHours = newTime.getUTCHours();
    const newMinutes = newTime.getUTCMinutes();
    const duration = input.duration_minutes;

    // Get all future events in the series
    const { data: futureEvents, error: fetchError } = await supabase
      .from('events')
      .select('id, start_time, duration_minutes')
      .eq('parent_event_id', seriesParentId)
      .gt('start_time', eventStartTime);

    if (fetchError) throw fetchError;

    // Update each future event with the new time (keeping their date)
    for (const evt of futureEvents || []) {
      const evtDate = new Date(evt.start_time);
      evtDate.setUTCHours(newHours, newMinutes, 0, 0);
      const evtDuration = duration || evt.duration_minutes || 60;
      const evtEndTime = addMinutes(evtDate, evtDuration);

      await supabase
        .from('events')
        .update({
          ...updateData,
          start_time: evtDate.toISOString(),
          end_time: evtEndTime.toISOString(),
          duration_minutes: evtDuration,
        })
        .eq('id', evt.id);
    }

    // Update parent if it's in the future
    if (parentEventId) {
      const { data: parent } = await supabase
        .from('events')
        .select('id, start_time, duration_minutes')
        .eq('id', parentEventId)
        .single();

      if (parent && new Date(parent.start_time) >= new Date(eventStartTime)) {
        const parentDate = new Date(parent.start_time);
        parentDate.setUTCHours(newHours, newMinutes, 0, 0);
        const parentDuration = duration || parent.duration_minutes || 60;
        const parentEndTime = addMinutes(parentDate, parentDuration);

        await supabase
          .from('events')
          .update({
            ...updateData,
            start_time: parentDate.toISOString(),
            end_time: parentEndTime.toISOString(),
            duration_minutes: parentDuration,
          })
          .eq('id', parentEventId);
      }
    }
  } else {
    // No time change, just update non-time fields
    if (Object.keys(updateData).length > 1) {
      const { error: futureError } = await supabase
        .from('events')
        .update(updateData)
        .eq('parent_event_id', seriesParentId)
        .gt('start_time', eventStartTime);

      if (futureError) throw futureError;

      // Update parent if in the future
      if (parentEventId) {
        const { data: parent } = await supabase
          .from('events')
          .select('start_time')
          .eq('id', parentEventId)
          .single();

        if (parent && new Date(parent.start_time) >= new Date(eventStartTime)) {
          await supabase
            .from('events')
            .update(updateData)
            .eq('id', parentEventId);
        }
      }
    }
  }
}

/**
 * Update all recurring events in a series
 */
export async function updateAllRecurringEvents(
  eventId: string,
  parentEventId: string | null,
  input: UpdateEventInput
): Promise<void> {
  const seriesParentId = parentEventId || eventId;

  // Build update data (without time fields)
  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.google_meet_link !== undefined) updateData.google_meet_link = input.google_meet_link;
  if (input.cover_image_url !== undefined) updateData.cover_image_url = input.cover_image_url;
  if (input.recording_url !== undefined) updateData.recording_url = input.recording_url || null;
  if (input.duration_minutes !== undefined) updateData.duration_minutes = input.duration_minutes;
  updateData.updated_at = new Date().toISOString();

  // Update the parent event
  const { error: parentError } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', seriesParentId);

  if (parentError) throw parentError;

  // Update all child events
  const { error: childrenError } = await supabase
    .from('events')
    .update(updateData)
    .eq('parent_event_id', seriesParentId);

  if (childrenError) throw childrenError;
}

/**
 * Upload event cover image to Supabase Storage
 */
export async function uploadEventCover(
  file: File,
  eventId: string
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${eventId}-${Date.now()}.${fileExt}`;
  const filePath = `covers/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('event-covers')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('event-covers')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Delete event cover image from Storage
 */
export async function deleteEventCover(imageUrl: string): Promise<void> {
  // Extract file path from URL
  const url = new URL(imageUrl);
  const pathParts = url.pathname.split('/');
  const filePath = pathParts.slice(-2).join('/'); // covers/filename.ext

  const { error } = await supabase.storage
    .from('event-covers')
    .remove([filePath]);

  if (error) throw error;
}
