// Shared media-type helpers for community posts.
//
// Why this exists: media_urls items can be plain strings OR objects with
// { url, name, size, type }. Image grids must render ONLY real images; any
// non-image attachment (html, md, pdf, doc...) belongs in the download cards.
//
// We use an ALLOWLIST (not a blocklist). A blocklist of document extensions
// silently treats unknown types like .html/.md as images, which renders broken
// <img> tiles ("Media 2/3/4"). Allowlist guarantees only known image formats
// ever reach an image grid, so future file types never regress this UX.
//
// Desde el 1 sep 2026 un VIDEO EMBEBIDO (video propio/YouTube/Vimeo/Loom) tambien
// viaja dentro de media_urls como { url, type: 'video/embed', name, size: 0 }.
// Asi el video es una ficha mas de la bandeja del composer (se arrastra y se
// reordena junto a las imagenes) y el post lo pinta EN ESA POSICION. La columna
// `video_embed_url` sigue escribiendose (= el primer video de la lista) para
// todo lo que ya la lee: feed, correos, webhook, agentes. Los posts viejos solo
// traen la columna: `buildMediaBlocks` los sigue pintando con el video primero.

const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg',
  '.avif', '.bmp', '.ico', '.heic', '.heif', '.tiff',
];

/** MIME sintetico de un video embebido dentro de media_urls. */
export const VIDEO_EMBED_TYPE = 'video/embed';

export type MediaItem =
  | string
  | { url?: string | null; type?: string | null; name?: string | null; size?: number | null }
  | null
  | undefined;

function hasImageExtension(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.toLowerCase().split('?')[0].split('#')[0];
  return IMAGE_EXTENSIONS.some((ext) => clean.endsWith(ext));
}

/**
 * True only when the media item is a real image.
 * Prefers the MIME `type` when present (source of truth from upload),
 * falls back to the URL extension allowlist otherwise.
 */
export function isImageMedia(item: MediaItem): boolean {
  if (!item) return false;
  if (typeof item === 'object') {
    if (item.type) return item.type.startsWith('image/');
    return hasImageExtension(item.url);
  }
  return hasImageExtension(item);
}

/** True when the media item is an embedded video (video propio/YouTube/Vimeo/Loom). */
export function isVideoEmbedMedia(item: MediaItem): boolean {
  return !!item && typeof item === 'object' && item.type === VIDEO_EMBED_TYPE && typeof item.url === 'string';
}

/**
 * True for archivos descargables (PDF, zip, código…): ni imagen ni video.
 * Es el filtro de las fichas de descarga; sin excluir el video, una URL de
 * YouTube salía como "archivo" para bajar.
 */
export function isFileMedia(item: MediaItem): boolean {
  return !!item && !isImageMedia(item) && !isVideoEmbedMedia(item);
}

/** Extract the URL from a media item (string or object), or null. */
export function getMediaUrl(item: MediaItem): string | null {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.url ?? null;
}

/** Ficha de video para la bandeja del composer / media_urls. */
export function videoEmbedAttachment(url: string, name = 'Video'): { url: string; name: string; size: number; type: string } {
  return { url: url.trim(), name, size: 0, type: VIDEO_EMBED_TYPE };
}

/** El primer video de la lista (lo que se espeja en `video_embed_url`), o null. */
export function firstVideoEmbedUrl(items: MediaItem[] | null | undefined): string | null {
  if (!items) return null;
  for (const item of items) {
    if (isVideoEmbedMedia(item)) return getMediaUrl(item);
  }
  return null;
}

/**
 * Bloques de render de un post/comentario, EN EL ORDEN en que el autor los
 * acomodo en la bandeja: cada video es un bloque; las imagenes consecutivas se
 * agrupan en una rejilla. `offset` es el indice de la primera imagen del grupo
 * dentro de la lista plana de imagenes (para el lightbox).
 *
 * `legacyVideoUrl`: la columna `video_embed_url`. Si la lista no trae ningun
 * video (post anterior a la bandeja unificada) el video va primero, como
 * siempre se pinto.
 */
export type MediaBlock =
  | { kind: 'video'; url: string }
  | { kind: 'images'; urls: string[]; offset: number };

export function buildMediaBlocks(
  items: MediaItem[] | null | undefined,
  legacyVideoUrl?: string | null,
  imageFilter: (url: string) => boolean = () => true,
): { blocks: MediaBlock[]; images: string[] } {
  const blocks: MediaBlock[] = [];
  const images: string[] = [];
  const list = Array.isArray(items) ? items : [];

  const hasVideoInList = list.some(isVideoEmbedMedia);
  if (!hasVideoInList && legacyVideoUrl) {
    blocks.push({ kind: 'video', url: legacyVideoUrl });
  }

  for (const item of list) {
    if (isVideoEmbedMedia(item)) {
      blocks.push({ kind: 'video', url: getMediaUrl(item) as string });
      continue;
    }
    if (!isImageMedia(item)) continue;
    const url = getMediaUrl(item);
    if (!url || !imageFilter(url)) continue;
    const last = blocks[blocks.length - 1];
    if (last && last.kind === 'images') {
      last.urls.push(url);
    } else {
      blocks.push({ kind: 'images', urls: [url], offset: images.length });
    }
    images.push(url);
  }

  return { blocks, images };
}
