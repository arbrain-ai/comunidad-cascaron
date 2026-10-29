import {
  addDays,
  addWeeks,
  addMonths,
  isBefore,
  isAfter,
  parseISO,
  getDay,
  setDate,
} from 'date-fns';
import { CreateEventInput, RecurrencePattern } from '../types';

/**
 * Generate recurring event instances based on a pattern
 * Pre-generates events up to the specified end date
 */
export function generateRecurringEvents(
  baseEvent: CreateEventInput,
  pattern: RecurrencePattern
): CreateEventInput[] {
  const events: CreateEventInput[] = [];
  const startDate = parseISO(baseEvent.start_time);
  const untilDate = parseISO(pattern.until);

  // Validate pattern
  if (isAfter(startDate, untilDate)) {
    return [baseEvent]; // No recurrence if start is after until
  }

  let currentDate = startDate;
  let occurrenceCount = 0;
  const maxOccurrences = pattern.occurrences || 100; // Safety limit

  while (
    isBefore(currentDate, untilDate) &&
    occurrenceCount < maxOccurrences
  ) {
    // Check if this date should be included based on pattern type
    const shouldInclude = shouldIncludeDate(currentDate, pattern, startDate);

    if (shouldInclude) {
      events.push({
        ...baseEvent,
        start_time: currentDate.toISOString(),
        is_recurring: true,
        recurrence_pattern: pattern,
      });
      occurrenceCount++;
    }

    // Move to next potential date
    currentDate = getNextDate(currentDate, pattern, startDate);
  }

  return events;
}

/**
 * Determine if a date should be included based on pattern
 */
function shouldIncludeDate(
  date: Date,
  pattern: RecurrencePattern,
  originalStart: Date
): boolean {
  switch (pattern.type) {
    case 'daily':
      return true; // All days included for daily

    case 'weekly':
      if (pattern.days_of_week && pattern.days_of_week.length > 0) {
        // Check if current day of week is in the selected days
        return pattern.days_of_week.includes(getDay(date));
      }
      // Default: same day of week as original
      return getDay(date) === getDay(originalStart);

    case 'monthly':
      if (pattern.day_of_month) {
        return date.getDate() === pattern.day_of_month;
      }
      // Default: same day of month as original
      return date.getDate() === originalStart.getDate();

    default:
      return true;
  }
}

/**
 * Get the next date based on pattern
 */
function getNextDate(
  currentDate: Date,
  pattern: RecurrencePattern,
  originalStart: Date
): Date {
  const interval = pattern.interval || 1;

  switch (pattern.type) {
    case 'daily':
      return addDays(currentDate, interval);

    case 'weekly':
      if (pattern.days_of_week && pattern.days_of_week.length > 1) {
        // For multiple days per week, find next day
        const currentDayOfWeek = getDay(currentDate);
        const sortedDays = [...pattern.days_of_week].sort((a, b) => a - b);

        // Find next day in the same week
        const nextDayInWeek = sortedDays.find(d => d > currentDayOfWeek);

        if (nextDayInWeek !== undefined) {
          // Move to next selected day in same week
          return addDays(currentDate, nextDayInWeek - currentDayOfWeek);
        } else {
          // Move to first selected day of next interval week
          const daysUntilFirstDay = 7 - currentDayOfWeek + sortedDays[0];
          return addDays(currentDate, daysUntilFirstDay + (interval - 1) * 7);
        }
      }
      return addWeeks(currentDate, interval);

    case 'monthly':
      const nextMonth = addMonths(currentDate, interval);
      // Handle day of month (e.g., if original is 31st but next month has 30 days)
      const targetDay = pattern.day_of_month || originalStart.getDate();
      return setDate(nextMonth, Math.min(targetDay, getDaysInMonth(nextMonth)));

    default:
      return addDays(currentDate, 1);
  }
}

/**
 * Get number of days in a month
 */
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Get a human-readable description of the recurrence pattern
 */
export function getRecurrenceDescription(pattern: RecurrencePattern): string {
  const interval = pattern.interval || 1;
  const intervalText = interval === 1 ? '' : `cada ${interval} `;

  switch (pattern.type) {
    case 'daily':
      return interval === 1 ? 'Todos los días' : `Cada ${interval} días`;

    case 'weekly':
      if (pattern.days_of_week && pattern.days_of_week.length > 0) {
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const days = pattern.days_of_week
          .sort((a, b) => a - b)
          .map(d => dayNames[d])
          .join(', ');
        return interval === 1
          ? `Cada semana: ${days}`
          : `Cada ${interval} semanas: ${days}`;
      }
      return interval === 1 ? 'Cada semana' : `Cada ${interval} semanas`;

    case 'monthly':
      const dayText = pattern.day_of_month ? `el día ${pattern.day_of_month}` : '';
      return interval === 1
        ? `Cada mes ${dayText}`
        : `Cada ${interval} meses ${dayText}`;

    default:
      return 'Recurrente';
  }
}

/**
 * Calculate how many events will be generated by a pattern
 */
export function estimateOccurrences(
  startDate: Date,
  pattern: RecurrencePattern
): number {
  const untilDate = parseISO(pattern.until);

  if (pattern.occurrences) {
    return pattern.occurrences;
  }

  // Simple estimation based on pattern type and date range
  const daysDiff = Math.ceil(
    (untilDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const interval = pattern.interval || 1;

  switch (pattern.type) {
    case 'daily':
      return Math.ceil(daysDiff / interval);

    case 'weekly':
      const weeksCount = Math.ceil(daysDiff / 7 / interval);
      const daysPerWeek = pattern.days_of_week?.length || 1;
      return weeksCount * daysPerWeek;

    case 'monthly':
      return Math.ceil(daysDiff / 30 / interval);

    default:
      return 1;
  }
}

/**
 * Validate a recurrence pattern
 */
export function validateRecurrencePattern(pattern: RecurrencePattern): string | null {
  if (!pattern.type) {
    return 'Tipo de recurrencia requerido';
  }

  if (!pattern.until) {
    return 'Fecha de fin requerida';
  }

  const interval = pattern.interval || 1;
  if (interval < 1 || interval > 99) {
    return 'Intervalo debe ser entre 1 y 99';
  }

  if (pattern.type === 'weekly' && pattern.days_of_week) {
    if (pattern.days_of_week.length === 0) {
      return 'Selecciona al menos un día de la semana';
    }
    if (pattern.days_of_week.some(d => d < 0 || d > 6)) {
      return 'Día de semana inválido';
    }
  }

  if (pattern.type === 'monthly' && pattern.day_of_month) {
    if (pattern.day_of_month < 1 || pattern.day_of_month > 31) {
      return 'Día del mes debe ser entre 1 y 31';
    }
  }

  // Check for reasonable end date (max 1 year)
  const startDate = new Date();
  const untilDate = parseISO(pattern.until);
  const oneYearLater = addMonths(startDate, 12);

  if (isAfter(untilDate, oneYearLater)) {
    return 'La recurrencia no puede ser mayor a 1 año';
  }

  return null;
}
