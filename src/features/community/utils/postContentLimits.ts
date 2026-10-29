/**
 * Límites de caracteres para posts de la comunidad.
 *
 * Se validan al publicar/guardar (PostForm y PostEditModal) y se muestran en vivo
 * con el contador del editor. El editor NUNCA trunca en silencio: o el contenido
 * entra completo dentro del límite, o no deja publicar. Esto evita el bug donde
 * un post (y su email de anuncio) salían cortados sin aviso.
 */

export const TITLE_MAX_LENGTH = 200;
export const CONTENT_MAX_LENGTH = 20000;

/**
 * Longitud de texto plano de un HTML de TipTap (para validar contra el límite).
 * Coincide con lo que el editor cuenta vía editor.getText().
 */
export function htmlTextLength(html: string): number {
  if (!html) return 0;
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim().length;
  }
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent || '').trim().length;
}
