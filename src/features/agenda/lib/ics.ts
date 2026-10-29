/**
 * .ics — llevarse la clase al calendario propio.
 *
 * El calendario viejo no tenia NINGUNA forma de hacerlo: ni .ics, ni "añadir a
 * Google Calendar", ni recordatorio. La clase existia solo dentro de la app.
 */
import type { Clase } from '../types';
import { BRAND } from '@/shared/config/brand';

/** Dominio para el UID del evento (RFC 5545): el host del sitio. */
function dominioUid(): string {
  try { return new URL(BRAND.siteUrl).hostname; } catch { return 'localhost'; }
}

const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function claseAIcs(c: Clase, urlEvento: string): string {
  const ini = new Date(c.start_time);
  const fin = new Date(ini.getTime() + (c.duration_minutes ?? 60) * 60000);
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${BRAND.name}//Calendario//ES`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${c.id}@${dominioUid()}`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(ini)}`,
    `DTEND:${utc(fin)}`,
    `SUMMARY:${esc(c.title)}`,
    c.description ? `DESCRIPTION:${esc(c.description.slice(0, 900))}` : null,
    `URL:${urlEvento}`,
    `LOCATION:${esc(c.google_meet_link || urlEvento)}`,
    c.status === 'cancelado' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    // recordatorio nativo del calendario del miembro, 15 min antes
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(c.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lineas.join('\r\n');
}

/** Link de "añadir a Google Calendar" (el camino de 1 clic en escritorio). */
export function urlGoogleCalendar(c: Clase, urlEvento: string): string {
  const ini = new Date(c.start_time);
  const fin = new Date(ini.getTime() + (c.duration_minutes ?? 60) * 60000);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: c.title,
    dates: `${utc(ini)}/${utc(fin)}`,
    details: `${c.description?.slice(0, 500) ?? ''}\n\n${urlEvento}`,
    location: c.google_meet_link || urlEvento,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
