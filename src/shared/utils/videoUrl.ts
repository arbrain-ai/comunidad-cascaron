// ============================================
// videoUrl — detección de URLs de video embebible
// ============================================
// Fuente ÚNICA para reconocer video propio, YouTube, Vimeo y Loom. La usan el
// VideoEmbed (render), el modal "Añadir video" (validar ANTES de aceptar la
// URL) y la ficha del composer (etiqueta del proveedor). Antes vivía inline en
// VideoEmbed y el modal aceptaba cualquier texto: el error salía ya en la
// bandeja, como ficha rota.

import {
  SELF_VIDEO_URL_REGEX,
  selfVideoEmbedUrl,
  selfVideoThumbnailUrl,
  selfVideoViewerUrl,
} from '@/shared/utils/selfVideo';

export type VideoProvider = 'selfhosted' | 'youtube' | 'vimeo' | 'loom' | 'invalid';

export interface VideoInfo {
  type: VideoProvider;
  embedUrl: string;
  videoId: string;
  thumbnailUrl?: string;
  originalUrl?: string; // Para "Abrir video" / "Ver en Loom"
}

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

const VIMEO_PATTERNS = [
  /vimeo\.com\/([0-9]+)/,
  /vimeo\.com\/video\/([0-9]+)/,
];

const LOOM_PATTERNS = [
  /loom\.com\/share\/([a-zA-Z0-9]+)/,
  /loom\.com\/embed\/([a-zA-Z0-9]+)/,
];

function firstMatch(url: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

export function parseVideoUrl(videoUrl: string): VideoInfo {
  const url = (videoUrl || '').trim();

  // video propio: nuestro propio host de video. Va primero porque es el destino
  // de la migracion desde Loom y no depende de terceros.
  const selfVideoMatch = url.match(SELF_VIDEO_URL_REGEX);
  if (selfVideoMatch && selfVideoMatch[1]) {
    const id = selfVideoMatch[1];
    return {
      type: 'selfhosted',
      videoId: id,
      embedUrl: selfVideoEmbedUrl(id),
      thumbnailUrl: selfVideoThumbnailUrl(id),
      originalUrl: selfVideoViewerUrl(id),
    };
  }

  const youtubeId = firstMatch(url, YOUTUBE_PATTERNS);
  if (youtubeId) {
    return {
      type: 'youtube',
      videoId: youtubeId,
      embedUrl: `https://www.youtube.com/embed/${youtubeId}?modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      originalUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
    };
  }

  const vimeoId = firstMatch(url, VIMEO_PATTERNS);
  if (vimeoId) {
    return {
      type: 'vimeo',
      videoId: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0&playsinline=1`,
      originalUrl: `https://vimeo.com/${vimeoId}`,
    };
  }

  const loomId = firstMatch(url, LOOM_PATTERNS);
  if (loomId) {
    return {
      type: 'loom',
      videoId: loomId,
      embedUrl: `https://www.loom.com/embed/${loomId}`,
      // Loom CDN requires a unique hash in thumbnail URLs (403 without it).
      // VideoEmbed fetches the real URL via oEmbed after parsing.
      thumbnailUrl: undefined,
      originalUrl: `https://www.loom.com/share/${loomId}`,
    };
  }

  return { type: 'invalid', videoId: '', embedUrl: '' };
}

/** True si la URL es un video que sabemos embeber. */
export function isEmbeddableVideoUrl(url: string): boolean {
  return parseVideoUrl(url).type !== 'invalid';
}

/** Nombre del proveedor para la etiqueta de la ficha (video propio · YouTube · …). */
export function videoProviderLabel(url: string): string {
  switch (parseVideoUrl(url).type) {
    case 'selfhosted': return 'Video propio';
    case 'youtube': return 'YouTube';
    case 'vimeo': return 'Vimeo';
    case 'loom': return 'Loom';
    default: return 'Video';
  }
}
