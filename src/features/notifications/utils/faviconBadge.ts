// ============================================
// Favicon Badge
// ============================================
// Pinta una burbuja roja con el número de pendientes SOBRE el favicon
// (patrón Gmail / Slack / Linear). Se dibuja en un <canvas> del mismo origen
// y se inyecta como data URL en un <link rel="icon"> propio.
//
// Es best-effort: si el navegador no coopera (Safari ignora favicons
// dinámicos) el título de la pestaña sigue siendo el canal principal.

const BASE_ICON_URL = '/icons/icon-192x192.png';
const BADGE_LINK_ID = 'app-favicon-badge';
const CANVAS_SIZE = 64;
const BADGE_COLOR = '#ef4444';

let baseIconPromise: Promise<HTMLImageElement> | null = null;
let paintedFor: number | null = null;

function loadBaseIcon(): Promise<HTMLImageElement> {
  if (!baseIconPromise) {
    baseIconPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = BASE_ICON_URL;
    });
  }

  return baseIconPromise;
}

function getBadgeLink(): HTMLLinkElement {
  const existing = document.getElementById(BADGE_LINK_ID);

  if (existing instanceof HTMLLinkElement) return existing;

  const link = document.createElement('link');
  link.id = BADGE_LINK_ID;
  link.rel = 'icon';
  link.type = 'image/png';
  document.head.appendChild(link);

  return link;
}

/** Etiqueta del badge: 1-99 el número, más allá "99+" (igual que la campana). */
function badgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}

function drawBadge(ctx: CanvasRenderingContext2D, count: number): void {
  const label = badgeLabel(count);
  const radius = label.length > 2 ? 22 : 19;
  const cx = CANVAS_SIZE - radius - 1;
  const cy = CANVAS_SIZE - radius - 1;

  // Aro oscuro: separa la burbuja del ícono en temas claros y oscuros
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = BADGE_COLOR;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${label.length > 2 ? 22 : 30}px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + 1);
}

/**
 * Dibuja el favicon con la burbuja del contador.
 * Idempotente: no repinta si ya está pintado para ese mismo número.
 */
export async function paintFaviconBadge(count: number): Promise<void> {
  if (typeof document === 'undefined' || count <= 0) return;
  if (paintedFor === count) return;

  try {
    const base = await loadBaseIcon();
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(base, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawBadge(ctx, count);

    getBadgeLink().href = canvas.toDataURL('image/png');
    paintedFor = count;
  } catch {
    // Ícono no disponible o canvas bloqueado: el título ya comunica el estado.
  }
}

/** Quita la burbuja y devuelve el favicon original de la página. */
export function clearFaviconBadge(): void {
  if (typeof document === 'undefined') return;

  paintedFor = null;
  document.getElementById(BADGE_LINK_ID)?.remove();

  // Reasignar el href de los <link rel="icon"> originales fuerza al navegador
  // a releerlos; sin esto Chrome se queda con el data URL del badge.
  document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach((link) => {
    const original = link.getAttribute('href');
    if (original) link.setAttribute('href', original);
  });
}

/**
 * Badge en el ícono de la app instalada (PWA en iOS 16.4+, macOS, Windows).
 * Complementa al favicon: es lo único que se ve con la app cerrada.
 */
export function setAppBadge(count: number): void {
  if (typeof navigator === 'undefined') return;

  const nav = navigator as Navigator & {
    setAppBadge?: (contents?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };

  try {
    if (count > 0) {
      void nav.setAppBadge?.(count)?.catch(() => {});
    } else {
      void nav.clearAppBadge?.()?.catch(() => {});
    }
  } catch {
    // Badging API no soportada: se ignora en silencio.
  }
}
