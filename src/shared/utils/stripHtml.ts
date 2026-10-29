/**
 * Strip HTML tags from a string, producing clean plain text.
 *
 * Usado para cuerpos de notificaciones (push) donde el markup NUNCA debe
 * mostrarse crudo. Quita etiquetas <...>, colapsa whitespace y recorta.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
