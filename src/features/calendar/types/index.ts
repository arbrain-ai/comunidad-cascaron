import { Tables } from '@/shared/types/database.types';

// Base type from database
export type Event = Tables<'events'>;

// Tier types for events (standard y vip)
export type UserTier = 'standard' | 'vip';

// Action type for recurring events (edit/delete)
// 'single' = Only this event, 'future' = This and all future events in series
export type RecurringActionType = 'single' | 'future';

// Backwards compatibility aliases
export type DeleteType = RecurringActionType;
export type EditType = RecurringActionType;

// Recurrence pattern configuration
export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;              // Every N days/weeks/months
  days_of_week?: number[];       // 0=Sun, 1=Mon, ..., 6=Sat (for weekly)
  day_of_month?: number;         // 1-31 (for monthly)
  until: string;                 // ISO date string when recurrence ends
  occurrences?: number;          // Alternative: number of occurrences
}

// Event with creator profile joined and extended fields
export interface EventWithCreator extends Event {
  creator: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

// Input for creating a new event
export interface CreateEventInput {
  title: string;
  description?: string;
  start_time: string;            // ISO string in UTC
  duration_minutes: number;
  google_meet_link?: string;
  cover_image_url?: string;
  recording_url?: string;        // Link manual a la grabacion (events.recording_url)
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern;
  // Tier fields
  required_tier?: UserTier;
  visible_to_tier?: UserTier;
}

// Input for updating an event
export interface UpdateEventInput {
  title?: string;
  description?: string;
  start_time?: string;
  duration_minutes?: number;
  google_meet_link?: string | null;
  cover_image_url?: string;
  recording_url?: string; // Link manual a la grabacion (events.recording_url)
}

// Filters for fetching events
export interface EventFilters {
  startDate: string;             // ISO date string
  endDate: string;               // ISO date string
  createdBy?: string;            // Filter by creator
}

// Calendar view state
export interface CalendarViewState {
  currentMonth: Date;
  selectedDate: Date | null;
}

// Duration options for the selector
export interface DurationOption {
  label: string;
  minutes: number;
}

export const DURATION_OPTIONS: DurationOption[] = [
  { label: '30 min', minutes: 30 },
  { label: '1 hora', minutes: 60 },
  { label: '1.5 horas', minutes: 90 },
  { label: '2 horas', minutes: 120 },
  { label: '3 horas', minutes: 180 },
];

// Recurrence type labels
export const RECURRENCE_TYPE_LABELS: Record<RecurrencePattern['type'], string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
};

// Days of week labels (Spanish)
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom', fullLabel: 'Domingo' },
  { value: 1, label: 'Lun', fullLabel: 'Lunes' },
  { value: 2, label: 'Mar', fullLabel: 'Martes' },
  { value: 3, label: 'Mié', fullLabel: 'Miércoles' },
  { value: 4, label: 'Jue', fullLabel: 'Jueves' },
  { value: 5, label: 'Vie', fullLabel: 'Viernes' },
  { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
];
