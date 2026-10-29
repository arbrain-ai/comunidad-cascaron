'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import {
  getEvents,
  createEvent,
  createEvents,
  updateEvent,
  updateFutureRecurringEvents,
  deleteEvent,
  deleteFutureRecurringEvents,
  uploadEventCover,
} from '../services/calendarService';
import {
  EventWithCreator,
  CreateEventInput,
  UpdateEventInput,
  EventFilters,
  DeleteType,
  EditType,
} from '../types';
import { generateRecurringEvents } from '../utils/recurrenceHelpers';
import { getCached, setCached, invalidateCached } from '@/shared/lib/queryCache';

interface UseEventsOptions {
  filters?: EventFilters;
  autoFetch?: boolean;
}

interface UseEventsReturn {
  events: EventWithCreator[];
  isLoading: boolean;
  error: string | null;
  fetchEvents: (filters: EventFilters) => Promise<void>;
  createNewEvent: (input: CreateEventInput, coverFile?: File) => Promise<void>;
  updateExistingEvent: (event: EventWithCreator, input: UpdateEventInput, editType: EditType, coverFile?: File) => Promise<void>;
  deleteExistingEvent: (event: EventWithCreator, deleteType: DeleteType) => Promise<void>;
  getEventsForDay: (date: Date) => EventWithCreator[];
}

export function useEvents(options: UseEventsOptions = {}): UseEventsReturn {
  const { userProfile } = useUserProfile();
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (filters: EventFilters) => {
    // Paint-first: el mes cacheado pinta al instante y se revalida en
    // silencio detrás (cero skeleton al volver al calendario).
    const key = `events:${JSON.stringify(filters)}`;
    const entry = getCached<EventWithCreator[]>(key);
    if (entry) {
      setEvents(entry.data);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await getEvents(filters);
      setCached(key, data);
      setEvents(data);
    } catch (err) {
      if (!entry) setError(err instanceof Error ? err.message : 'Error al cargar eventos');
      console.error('Error fetching events:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-fetch on mount if filters provided
  useEffect(() => {
    if (options.autoFetch && options.filters) {
      fetchEvents(options.filters);
    }
  }, [options.autoFetch, options.filters?.startDate, options.filters?.endDate, fetchEvents]);

  const createNewEvent = useCallback(async (
    input: CreateEventInput,
    coverFile?: File
  ) => {
    if (!userProfile?.id) {
      throw new Error('Usuario no autenticado');
    }

    setIsLoading(true);
    setError(null);

    try {
      let coverImageUrl = input.cover_image_url;

      // If recurring, generate all instances
      if (input.is_recurring && input.recurrence_pattern) {
        const recurringEvents = generateRecurringEvents(input, input.recurrence_pattern);

        // Create first event (parent)
        const parentEvent = await createEvent(userProfile.id, {
          ...recurringEvents[0],
          cover_image_url: coverImageUrl,
        });

        // Upload cover if provided
        if (coverFile) {
          coverImageUrl = await uploadEventCover(coverFile, parentEvent.id);
          await updateEvent(parentEvent.id, { cover_image_url: coverImageUrl });
        }

        // Create child events (skip first since it's the parent)
        if (recurringEvents.length > 1) {
          await createEvents(
            userProfile.id,
            recurringEvents.slice(1).map(e => ({
              ...e,
              cover_image_url: coverImageUrl,
            })),
            parentEvent.id
          );
        }
      } else {
        // Single event
        const event = await createEvent(userProfile.id, input);

        // Upload cover if provided
        if (coverFile) {
          coverImageUrl = await uploadEventCover(coverFile, event.id);
          await updateEvent(event.id, { cover_image_url: coverImageUrl });
        }
      }

      // Refetch events if we have filters
      if (options.filters) {
        await fetchEvents(options.filters);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear evento';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userProfile?.id, options.filters, fetchEvents]);

  const updateExistingEvent = useCallback(async (
    event: EventWithCreator,
    input: UpdateEventInput,
    editType: EditType,
    coverFile?: File
  ) => {
    setIsLoading(true);
    setError(null);
    // El estado local se actualiza abajo; el caché quedaría viejo → fuera
    invalidateCached('events:');

    try {
      const eventId = event.id;
      const parentId = event.parent_event_id;

      // Upload cover image if provided
      let coverImageUrl = input.cover_image_url;
      if (coverFile) {
        coverImageUrl = await uploadEventCover(coverFile, eventId);
        input = { ...input, cover_image_url: coverImageUrl };
      }

      switch (editType) {
        case 'single':
          // Update only this event
          await updateEvent(eventId, input);
          setEvents(prev =>
            prev.map(e =>
              e.id === eventId
                ? { ...e, ...input }
                : e
            )
          );
          break;

        case 'future':
          // Update this event and all future events in the series
          await updateFutureRecurringEvents(eventId, event.start_time, parentId || null, input);
          setEvents(prev =>
            prev.map(e => {
              const eParentId = e.parent_event_id;
              const seriesParentId = parentId || eventId;
              const isInSeries = e.id === seriesParentId || eParentId === seriesParentId || e.id === eventId;
              if (!isInSeries) return e;
              // For events in the series on or after this event, apply changes
              if (new Date(e.start_time) >= new Date(event.start_time)) {
                return { ...e, ...input };
              }
              return e;
            })
          );
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar evento';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteExistingEvent = useCallback(async (
    event: EventWithCreator,
    deleteType: DeleteType
  ) => {
    setIsLoading(true);
    setError(null);
    invalidateCached('events:');

    try {
      const eventId = event.id;
      const parentId = event.parent_event_id;
      const isRecurring = event.is_recurring;

      switch (deleteType) {
        case 'single':
          // Delete only this event
          await deleteEvent(eventId);
          setEvents(prev => prev.filter(e => e.id !== eventId));
          break;

        case 'future':
          // Delete this event and all future events in the series
          if (isRecurring) {
            await deleteFutureRecurringEvents(eventId, event.start_time, parentId || null);
            setEvents(prev =>
              prev.filter(e => {
                // Keep events that are not in this series
                const eParentId = e.parent_event_id;
                const seriesParentId = parentId || eventId;
                const isInSeries = e.id === seriesParentId || eParentId === seriesParentId;
                if (!isInSeries) return true;
                // For events in the series, keep only those before this event
                return new Date(e.start_time) < new Date(event.start_time);
              })
            );
          } else {
            // Non-recurring event, just delete it
            await deleteEvent(eventId);
            setEvents(prev => prev.filter(e => e.id !== eventId));
          }
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar evento';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getEventsForDay = useCallback((date: Date): EventWithCreator[] => {
    const dateStr = date.toISOString().split('T')[0];

    return events.filter(event => {
      const eventDate = new Date(event.start_time).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  }, [events]);

  return {
    events,
    isLoading,
    error,
    fetchEvents,
    createNewEvent,
    updateExistingEvent,
    deleteExistingEvent,
    getEventsForDay,
  };
}
