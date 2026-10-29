// ============================================
// Notification Phrase
// ============================================
// Convierte una notificación (o un remitente de DM) en la frase corta que se
// alterna en el título de la pestaña, estilo Skool:
//   "(3) Mi Comunidad"  ⇄  "Ana te envió un mensaje"
//
// Forma de los datos en la tabla `notifications`:
//   - En los tipos "de persona" el campo `title` guarda SOLO EL NOMBRE
//     ("Ana López") y `body` el contenido. Aquí construimos la
//     oración.
//   - En los tipos "de sistema" (admin_post, new_lesson) el `title`
//     YA es una oración completa ("Ana López publicó un anuncio"), así que
//     se usa tal cual.

import { stripHtml } from '@/shared/utils/stripHtml';
import type { Notification, NotificationType } from '../types';

/** Ancho cómodo para una pestaña de navegador sin que el texto se corte feo. */
const MAX_PHRASE_LENGTH = 70;

/** Tipos donde `title` es el NOMBRE de una persona: la oración se arma aquí. */
const PERSON_PHRASE: Partial<Record<NotificationType, (name: string) => string>> = {
  message: (name) => `${name} te envió un mensaje`,
  mention: (name) => `${name} te mencionó`,
  reply: (name) => `${name} respondió tu comentario`,
  post_comment: (name) => `${name} comentó tu publicación`,
  like: (name) => `A ${name} le gustó tu publicación`,
  agent_response: (name) => `${name} te respondió`,
};

/** Último recurso cuando el `title` viene vacío o corrupto. */
const GENERIC_PHRASE: Partial<Record<NotificationType, string>> = {
  admin_post: 'Nuevo anuncio en la comunidad',
  new_course: 'Nuevo curso publicado',
  new_lesson: 'Nueva lección disponible',
  new_event: 'Nuevo evento en el calendario',
  event_reminder: 'Tienes un evento por comenzar',
  video_call_started: 'Videollamada en vivo',
};

const FALLBACK_PHRASE = 'Tienes una notificación nueva';

/**
 * Limpia y acota un texto para que quepa en el título de la pestaña:
 * sin HTML, sin saltos de línea, sin espacios dobles y con corte por palabra.
 */
export function tidyPhrase(text: string, maxLength = MAX_PHRASE_LENGTH): string {
  const clean = stripHtml(text).replace(/\s+/g, ' ').trim();

  if (clean.length <= maxLength) return clean;

  const cut = clean.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');

  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Frase de una notificación para el título de la pestaña.
 * Devuelve `null` si no hay nada legible que mostrar.
 */
export function describeNotification(notification: Notification): string | null {
  const rawTitle = tidyPhrase(notification.title || '');
  const buildPersonPhrase = PERSON_PHRASE[notification.type];

  if (buildPersonPhrase) {
    return rawTitle
      ? tidyPhrase(buildPersonPhrase(rawTitle))
      : GENERIC_PHRASE[notification.type] ?? FALLBACK_PHRASE;
  }

  return rawTitle || GENERIC_PHRASE[notification.type] || FALLBACK_PHRASE;
}

/**
 * Frase para mensajes directos sin leer, agrupados por remitente.
 * El plural evita el spam de "X te envió un mensaje" repetido 5 veces.
 */
export function describeUnreadMessages(name: string, count: number): string {
  const who = tidyPhrase(name) || 'Alguien';

  return tidyPhrase(
    count > 1 ? `${who} te envió ${count} mensajes` : `${who} te envió un mensaje`
  );
}
