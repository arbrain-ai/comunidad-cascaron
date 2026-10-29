import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Get all days to display in a calendar month grid
 * Includes days from previous/next month to fill the grid
 */
export function getMonthDays(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);

  // Start from Monday (weekStartsOn: 1)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
}

/**
 * Format date for display in calendar header
 * Returns: "Noviembre 2025"
 */
export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: es });
}

/**
 * Format date for display
 * Returns: "18 de noviembre"
 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "d 'de' MMMM", { locale: es });
}

/**
 * Format time for display
 * Returns: "10:30"
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm');
}

/**
 * Format date and time together
 * Returns: "18 nov, 10:30"
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "d MMM, HH:mm", { locale: es });
}

/**
 * Format date for form inputs (YYYY-MM-DD)
 */
export function formatDateInput(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format time for form inputs (HH:mm)
 */
export function formatTimeInput(date: Date): string {
  return format(date, 'HH:mm');
}

/**
 * Parse date and time inputs into ISO string
 */
export function parseDateTime(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  const date = new Date(year, month - 1, day, hours, minutes);
  return date.toISOString();
}

/**
 * Check if a day is in the current month
 */
export function isDayInMonth(day: Date, currentMonth: Date): boolean {
  return isSameMonth(day, currentMonth);
}

/**
 * Check if two dates are the same day
 */
export function isSameDayAs(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return isSameDay(d1, d2);
}

/**
 * Check if date is today
 */
export function isDateToday(date: Date): boolean {
  return isToday(date);
}

/**
 * Get next month
 */
export function getNextMonth(date: Date): Date {
  return addMonths(date, 1);
}

/**
 * Get previous month
 */
export function getPreviousMonth(date: Date): Date {
  return subMonths(date, 1);
}

/**
 * Get start and end of month for API queries
 * Returns ISO strings
 */
export function getMonthRange(date: Date): { start: string; end: string } {
  // Include some buffer for edge cases
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Get day of week header labels
 */
export function getWeekDayHeaders(): string[] {
  return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
}

/**
 * Format duration in human readable format
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}min`;
}

/**
 * Get the day number for display in calendar
 */
export function getDayNumber(date: Date): number {
  return date.getDate();
}
