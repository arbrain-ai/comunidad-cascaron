// ============================================
// Video propio (self-hosted), opcional
// ============================================
// Si publicas tus videos en tu propio host (por ejemplo un bucket R2/S3 con
// paginas /embed/<id>/ y /media/<id>/), define NEXT_PUBLIC_SELF_VIDEO_HOST con
// el dominio (sin https://). Sin esa variable el modulo queda inerte y el
// classroom usa YouTube, Vimeo o Loom.

const HOST = (process.env.NEXT_PUBLIC_SELF_VIDEO_HOST || '').trim();

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Captura el ID desde /v/<id>/ o /embed/<id>/ del host configurado. */
export const SELF_VIDEO_URL_REGEX: RegExp = HOST
  ? new RegExp(`${escapeRegex(HOST)}\\/(?:v|embed)\\/([a-z0-9]{6,})`, 'i')
  : /a^/;

export function selfVideoEmbedUrl(id: string): string {
  return `https://${HOST}/embed/${id}/index.html`;
}

export function selfVideoViewerUrl(id: string): string {
  return `https://${HOST}/v/${id}/`;
}

export function selfVideoThumbnailUrl(id: string): string {
  return `https://${HOST}/media/${id}/thumb.jpg`;
}

/** Portada para correo (un email no puede llevar iframe). */
export function selfVideoCardUrl(id: string): string {
  return `https://${HOST}/media/${id}/thumb.jpg`;
}

export function parseSelfVideoId(url: string): string | null {
  if (!HOST || !url || typeof url !== 'string') return null;
  return url.match(SELF_VIDEO_URL_REGEX)?.[1] ?? null;
}
