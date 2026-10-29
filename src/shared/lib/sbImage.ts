// ============================================
// sbImage — Supabase Image Transformations para Storage
// ============================================
// El bucket sirve originales enormes (un thumbnail de curso pesa 1.8 MB) y
// los pintamos en avatares de 28px. Supabase trae un CDN de transformación
// YA HABILITADO en el proyecto: la misma URL cambiando /object/ → /render/image/
// devuelve la imagen re-dimensionada y re-codificada (webp si el browser
// acepta). Medido: 1.8 MB → 157 KB con width=120, sin tocar el original.
//
// Regla: SOLO se transforman URLs de Storage público del proyecto configurado
// en NEXT_PUBLIC_SUPABASE_URL (o de cualquier *.supabase.co si no hay env).
// Todo lo demás (Google avatars, GitHub og-images, /assets locales) pasa
// intacto. Idempotente: una URL ya transformada no se vuelve a envolver.

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

function supabaseOriginPattern(): string {
  try {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (raw) return escapeRe(new URL(raw).origin);
  } catch {
    // URL inválida: cae al patrón genérico
  }
  return 'https:\\/\\/[a-z0-9]+\\.supabase\\.co';
}

const SB_OBJECT_RE = new RegExp(`^(${supabaseOriginPattern()})\\/storage\\/v1\\/object\\/public\\/`);

export interface SbImageOptions {
  width?: number;
  height?: number;
  /** 20-100. Default del CDN: 80 */
  quality?: number;
  /**
   * Cómo encaja la imagen en la caja pedida. Default nuestro: `contain`.
   *
   * ⚠️ El default del CDN es `cover`, y con `cover` + solo `width` Supabase
   * NO conserva el aspecto: mantiene el ALTO ORIGINAL y recorta a lo ancho.
   * Medido sobre una miniatura de curso de 1280x720:
   *   width=800                  → 800x720  (se come 480px = 37% del ancho)
   *   width=800&resize=contain   → 800x450  (correcta, y 35 KB vs 66 KB)
   * Por eso las miniaturas se veían "más grandes": estaban recortadas al
   * centro, y encima el `object-cover` del CSS recortaba una segunda vez.
   */
  resize?: 'contain' | 'cover' | 'fill';
}

export function sbImage(url: string | null | undefined, opts: SbImageOptions = {}): string {
  if (!url) return '';
  const match = url.match(SB_OBJECT_RE);
  if (!match) return url; // externa, local o ya /render/: intacta
  // Los avatares JAMÁS se transforman: ya vienen optimizados (~5 KB) y
  // recomprimirlos webp→webp los degrada sin ahorrar peso (ver sbAvatar).
  // Esto protege incluso los avatares que llegan por sbImage.
  if (url.includes('/avatars/')) return url;

  const [path, existingQuery] = url.split('?');
  const rendered = path.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');

  const params = new URLSearchParams(existingQuery || '');
  if (opts.width) params.set('width', String(opts.width));
  if (opts.height) params.set('height', String(opts.height));
  if (opts.quality) params.set('quality', String(opts.quality));
  // Siempre explícito: el default del CDN (cover) recorta. Ver SbImageOptions.
  params.set('resize', opts.resize || 'contain');

  const qs = params.toString();
  return qs ? `${rendered}?${qs}` : rendered;
}

/**
 * Avatar: se sirve el ORIGINAL sin transformar.
 *
 * Medición: los avatares se suben ya optimizados — el avatar
 * real de un usuario pesa ~5.6 KB (webp 512px muy comprimido). Pasarlo por
 * /render/image a quality 75 daba 5.7 KB (CERO ahorro) y lo RECOMPRIMÍA
 * webp→webp, degradándolo visiblemente en pantallas retina. El transform sólo
 * vale la pena en imágenes que de verdad pesan (miniaturas de curso 1.8 MB →
 * usar sbImage ahí). Para un rostro chiquito no hay peso que ganar y sí
 * calidad que perder, así que devolvemos la URL intacta.
 *
 * Se conserva la firma (displayPx) para no tocar los llamadores y por si un
 * día queremos reactivar el resize sólo cuando el origen sea grande.
 */
export function sbAvatar(url: string | null | undefined, _displayPx: number = 40): string {
  return url || '';
}
