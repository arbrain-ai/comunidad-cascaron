import { BRAND } from '@/shared/config/brand';

/**
 * "Mover la clase": when a class has to move, the host pastes the new link ONCE and
 * everyone who is inside, or arrives late to the original room, sees it.
 * Stored in video_sessions.metadata.mudanza (existing jsonb, no migration).
 */
export interface Mudanza { url: string; host: string; at: string }

/** Meeting services a class plausibly moves to. A link outside this list is refused, so a
 * mistaken or malicious paste cannot send 60 members to an arbitrary site. */
const DESTINOS = ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'teams.live.com', 'whereby.com', 'meet.jit.si', sitioPropio()].filter(Boolean);

/** Host del propio sitio (BRAND.siteUrl): mover la clase a otra sala de la app. */
function sitioPropio(): string {
  try { return new URL(BRAND.siteUrl).hostname.toLowerCase(); } catch { return ''; }
}

export function validarMudanza(entrada: unknown): { ok: true; url: string; host: string } | { ok: false; error: string } {
  if (typeof entrada !== 'string' || entrada.trim().length === 0 || entrada.length > 500) {
    return { ok: false, error: 'Pega el link completo de la nueva sala.' };
  }
  let url: URL;
  try { url = new URL(entrada.trim()); } catch { return { ok: false, error: 'Ese texto no es un link. Cópialo completo, empezando por https://' }; }
  if (url.protocol !== 'https:' || url.username || url.password) return { ok: false, error: 'El link debe empezar por https://' };
  const host = url.hostname.toLowerCase();
  if (!DESTINOS.some((d) => host === d || host.endsWith(`.${d}`))) {
    return { ok: false, error: `Solo se aceptan links de Google Meet, Zoom, Teams, Whereby, Jitsi o ${BRAND.name}.` };
  }
  return { ok: true, url: url.toString(), host };
}

export function readMudanza(metadata: Record<string, unknown> | null | undefined): Mudanza | null {
  const m = metadata?.mudanza as Partial<Mudanza> | null | undefined;
  if (!m || typeof m !== 'object' || typeof m.url !== 'string' || typeof m.at !== 'string') return null;
  const valid = validarMudanza(m.url);
  return valid.ok ? { url: valid.url, host: valid.host, at: m.at } : null;
}
