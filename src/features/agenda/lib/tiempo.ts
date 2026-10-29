/**
 * LA CAPA DE TIEMPO.
 *
 * Renderizar con `format(date,'HH:mm')` da la hora local del navegador SIN decir
 * de que zona: el mismo evento se ve a horas distintas desde paises distintos.
 * En una comunidad repartida en varios husos, la hora sin zona no es un detalle
 * cosmetico, es una clase perdida.
 *
 * Regla de la casa: TODA hora que se muestra lleva su zona, y la zona es la
 * DEL MIEMBRO, no la del anfitrion.
 */
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

/** Zona de respaldo de la comunidad (configurable por env). */
export const ZONA_CASA = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'America/Mexico_City';

/** La zona del navegador. Es la semilla; el miembro puede cambiarla. */
export function zonaDelNavegador(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ZONA_CASA;
  } catch {
    return ZONA_CASA;
  }
}

/** "GMT-6", "GMT+2" — corto, para pegarlo junto a la hora sin ensuciar. */
export function etiquetaCortaZona(zona: string, ref: Date = new Date()): string {
  try {
    return formatInTimeZone(ref, zona, 'OOOO').replace('GMT', 'GMT').replace(/:00$/, '');
  } catch {
    return zona;
  }
}

/** "Ciudad de México" — el nombre humano de la zona, para el selector. */
export function nombreDeZona(zona: string): string {
  const ciudad = zona.split('/').pop()?.replace(/_/g, ' ') ?? zona;
  return ciudad;
}

/** "12:00" en la zona pedida. */
export function hora(iso: string | Date, zona: string): string {
  return formatInTimeZone(new Date(iso), zona, 'HH:mm');
}

/** "12:00 – 13:30" con la duracion real del evento. */
export function rangoHorario(iso: string | Date, minutos: number | null, zona: string): string {
  const ini = new Date(iso);
  const fin = new Date(ini.getTime() + (minutos ?? 60) * 60000);
  return `${formatInTimeZone(ini, zona, 'HH:mm')} – ${formatInTimeZone(fin, zona, 'HH:mm')}`;
}

/** Clave YYYY-MM-DD del dia EN LA ZONA DEL MIEMBRO (agrupar por dia local). */
export function claveDia(iso: string | Date, zona: string): string {
  return formatInTimeZone(new Date(iso), zona, 'yyyy-MM-dd');
}

/**
 * "Hoy", "Mañana", "Ayer", o "lunes 8 de septiembre".
 * lu.ma usa relativos para lo cercano: es lo que hace que se lea sin pensar.
 */
export function etiquetaDia(claveISO: string, zona: string): { titulo: string; relativo: boolean } {
  const hoy = formatInTimeZone(new Date(), zona, 'yyyy-MM-dd');
  const ayer = formatInTimeZone(new Date(Date.now() - 864e5), zona, 'yyyy-MM-dd');
  const manana = formatInTimeZone(new Date(Date.now() + 864e5), zona, 'yyyy-MM-dd');
  if (claveISO === hoy) return { titulo: 'Hoy', relativo: true };
  if (claveISO === manana) return { titulo: 'Mañana', relativo: true };
  if (claveISO === ayer) return { titulo: 'Ayer', relativo: true };
  // parseamos la clave como fecha local pura (sin corrimiento de zona)
  const [a, m, d] = claveISO.split('-').map(Number);
  const fecha = new Date(a, m - 1, d, 12);
  // MISMO formato que la fecha secundaria de un día relativo ("Martes 1 de
  // sep"): dos convenciones conviviendo en la misma lista es una costura.
  return {
    titulo: new Intl.DateTimeFormat('es-MX', {
      weekday: 'long', day: 'numeric', month: 'short',
    }).format(fecha).replace(/\.$/, ''),
    relativo: false,
  };
}

/** "lunes 1 de septiembre de 2026" — el detalle SIEMPRE lleva año. */
export function fechaCompleta(iso: string | Date, zona: string): string {
  return formatInTimeZone(new Date(iso), zona, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
}

/** "1h 30min" */
export function duracionHumana(minutos: number | null): string {
  const m = minutos ?? 60;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
}

/** "en 15 min", "en 2h 10min", "en 3 días" — para la cuenta regresiva. */
export function faltan(ms: number): string {
  if (ms <= 0) return 'ahora';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60), rm = min % 60;
  if (h < 24) return rm ? `en ${h}h ${rm}min` : `en ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'mañana' : `en ${d} días`;
}

/** Lee una RRULE y la dice en español: "cada miércoles". */
export function describirRegla(rrule: string | null): string | null {
  if (!rrule) return null;
  const p = Object.fromEntries(
    rrule.split(';').map((x) => x.split('=') as [string, string]).filter((x) => x.length === 2)
  );
  const dias: Record<string, string> = {
    MO: 'lunes', TU: 'martes', WE: 'miércoles', TH: 'jueves',
    FR: 'viernes', SA: 'sábado', SU: 'domingo',
  };
  const cada = p.INTERVAL && p.INTERVAL !== '1' ? `cada ${p.INTERVAL} ` : 'cada ';
  if (p.FREQ === 'WEEKLY') {
    const d = p.BYDAY?.split(',').map((x) => dias[x]).filter(Boolean).join(', ');
    return d ? `${cada}${d}` : `${cada}semana`;
  }
  if (p.FREQ === 'MONTHLY') return `${cada}mes`;
  if (p.FREQ === 'DAILY') return p.INTERVAL && p.INTERVAL !== '1' ? `cada ${p.INTERVAL} días` : 'todos los días';
  return 'recurrente';
}

/** "Martes 1 de sep" — solo la primera letra. `capitalize` de Tailwind ponia
 *  "Martes 1 De Sep": sube TODAS las palabras, incluidas las preposiciones. */
export function capitalizarFrase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
