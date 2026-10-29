import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizador de CONTENIDO DE LECCIÓN (content_format = 'html').
 *
 * Es una función SEPARADA de `sanitizeHtml()` (shared/utils/sanitize.ts) a propósito:
 * aquella la usan posts, comments y knowledge cards, y su comportamiento no debe cambiar.
 *
 * Decisiones de seguridad (deliberadas, no accidentales):
 *  - NO se permite <script> ni handlers on* → DOMPurify los quita por defecto.
 *  - NO se permite <iframe>. Los videos NO viajan como iframe dentro del HTML: viajan como
 *    marcador `<div data-lx-video="<id>">` y LessonHtml los hidrata con un componente React.
 *    Así evitamos hooks globales de DOMPurify, que contaminarían al sanitizador compartido.
 *  - NO se permite <style>. La piel Luminorphism vive en globals.css bajo `.lx-root`; el
 *    contenido solo trae clases semánticas. Esto evita CSS inyectado (overlays fixed, etc.)
 *    y mantiene el HTML liviano y indexable.
 *  - SÍ se permite <svg> y sus hijos: los diagramas vectoriales son parte de la didáctica.
 */

/** Etiquetas SVG permitidas para los diagramas de las lecciones. */
const SVG_TAGS = [
  'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect',
  'text', 'tspan', 'defs', 'linearGradient', 'radialGradient', 'stop', 'marker',
  'clipPath', 'mask', 'use', 'symbol', 'title', 'desc',
];

const ALLOWED_TAGS = [
  // estructura y texto
  'div', 'section', 'article', 'aside', 'figure', 'figcaption', 'header', 'footer',
  'p', 'span', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark', 'small', 'sup', 'sub',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'blockquote', 'q', 'cite',
  'pre', 'code', 'kbd', 'samp', 'var',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'a', 'img',
  ...SVG_TAGS,
];

const ALLOWED_ATTR = [
  'class', 'id', 'title', 'lang', 'dir',
  'href', 'target', 'rel',
  'src', 'alt', 'width', 'height', 'loading', 'decoding',
  'colspan', 'rowspan', 'scope',
  'start', 'type', 'value',
  // data-* de nuestro catálogo de bloques
  'data-lx', 'data-lx-video', 'data-lx-kicker', 'data-lx-label', 'data-lx-seek',
  'data-lx-enact', 'data-lx-demo',
  'data-size', 'data-type', 'data-platform',
  // SVG
  'viewBox', 'xmlns', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'd', 'cx', 'cy', 'r',
  'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'opacity',
  'fill-opacity', 'stroke-opacity', 'offset', 'stop-color', 'stop-opacity',
  'text-anchor', 'font-size', 'font-family', 'font-weight', 'dominant-baseline',
  'gradientUnits', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient',
  'preserveAspectRatio',
  // pathLength normaliza la longitud de CUALQUIER trazo a 1: es lo que permite
  // animar el dibujado con CSS puro (stroke-dashoffset 1 → 0) sin SMIL ni JS.
  'pathLength',
];

export function sanitizeLessonHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Bloquea javascript:, data: ejecutables, etc. en href/src
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    // Sin `style=` inline: la piel manda, el contenido no impone.
    FORBID_ATTR: ['style'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    KEEP_CONTENT: true,
  });
}

/**
 * Marcador que el transformador emite donde iba un video.
 * Lleva la PLATAFORMA y el ID, nunca una URL: el renderer construye la URL desde una
 * plantilla fija, así el host queda en whitelist por construcción y no por validación.
 */
export const LX_VIDEO_RE =
  /<div\s+data-lx-video="([A-Za-z0-9_-]{6,})"\s+data-lx-platform="(selfhosted|youtube)"\s*><\/div>/gi;

export type LessonVideoPlatform = 'selfhosted' | 'youtube';

/**
 * Marcador de CÁPSULA SOBERANA (fase 2): un mecanismo interactivo completo
 * (HTML + CSS + JS propios) que se renderiza en un <iframe sandbox="allow-scripts">
 * SIN allow-same-origin. El payload viaja en base64 a propósito:
 *  - el alfabeto base64 no contiene `>` ni comillas → la extracción por regex es
 *    robusta sin importar qué HTML anidado contenga la cápsula;
 *  - vive en un ATRIBUTO, así que stripHtml() (indexación de búsqueda) lo ignora
 *    por construcción: el código no contamina el texto plano. El texto buscable de
 *    una lección-cápsula vive en la columna espejo `lessons.search_text`.
 * El payload NUNCA pasa por DOMPurify: se extrae antes y se ejecuta en un origen
 * opaco donde no puede tocar cookies, sesión ni el DOM de la app.
 */
export const LX_CAPSULA_RE =
  /<div\s+data-lx-capsula="([A-Za-z0-9+/=]+)"(?:\s+data-lx-alto="(\d{2,5})")?\s*><\/div>/gi;

/**
 * Marcador de LECCIÓN NARRADA: una página propia, servida desde `public/`, con
 * narración y el texto resaltándose palabra por palabra.
 *
 * Va por iframe con URL de PLANTILLA FIJA, igual que el marcador de video y por
 * la misma razón: el host queda en whitelist por construcción, no por validación.
 * El contenido de la lección solo aporta un slug de `[a-z0-9-]`, así que no hay
 * forma de que apunte el marco a un tercero.
 *
 * ¿Por qué no una cápsula (base64, origen opaco)? Porque si la página usa WebGL
 * sus texturas cruzarían de origen (`texImage2D` exige CORS). Aparte, el mismo
 * origen permite que los assets pesados se cacheen UNA vez para todas las
 * lecciones en vez de viajar en cada columna `content`.
 */
export const LX_NARRADOR_RE =
  /<div\s+data-lx-narrador="([a-z0-9-]{3,64})"(?:\s+data-lx-alto="(\d{2,5})")?(?:\s+data-lx-curso="([a-z0-9-]{3,40})")?\s*><\/div>/gi;

/**
 * Marcador de CARRUSEL DE LÁMINAS: `<div data-images='["url", ...]'></div>`.
 *
 * No nació con el prefijo `data-lx-` como los demás porque no lo emite nuestro transformador:
 * lo escribe el editor de POSTS (extensión TipTap `carousel`) y llega a `lessons.content` cuando
 * una lección se arma copiando un post. Nueve lecciones publicadas en cinco cursos lo usan.
 *
 * Hasta el 1 sep 2026 esas nueve se veían VACÍAS: `data-images` no estaba en ALLOWED_ATTR, así
 * que DOMPurify borraba el atributo y dejaba un `<div></div>` sin nada. Se arregla aquí, del lado
 * del lector, y no migrando el contenido: las filas publicadas no se tocan (regla R2 de la v2).
 *
 * El payload es JSON delimitado por comillas SIMPLES, así que `[^']*` lo captura entero sin
 * ambigüedad. Las URLs se validan una por una en `urlsDeCarrusel`: solo https, nada más.
 */
export const LX_CARRUSEL_RE =
  /<div\s+data-images='(\[[^']*\])'(?:\s+data-size="(?:small|medium|large)")?\s*><\/div>/gi;

/**
 * Parsea y FILTRA el payload del carrusel. Devuelve solo URLs https.
 *
 * El contenido de una lección lo escriben admins, no cualquiera, pero estas URLs terminan en el
 * `src` de un `<img>` sin pasar por DOMPurify (el componente las pone desde React), así que la
 * validación va aquí y no se delega. JSON inválido → carrusel vacío, nunca una excepción que
 * tumbe el render de toda la lección.
 */
export function urlsDeCarrusel(payload: string): string[] {
  try {
    const crudo: unknown = JSON.parse(payload);
    if (!Array.isArray(crudo)) return [];
    return crudo.filter((u): u is string => typeof u === 'string' && /^https:\/\//i.test(u));
  } catch {
    return [];
  }
}

export interface LessonSegment {
  kind: 'html' | 'video' | 'capsula' | 'narrador' | 'carrusel';
  /** HTML sanitizado (html) · id del video (video) · payload base64 (capsula) · slug (narrador). */
  value: string;
  platform?: LessonVideoPlatform;
  /** Altura inicial en px de la cápsula, antes de que el puente reporte la real. */
  alto?: number;
  /** Carpeta del curso narrado bajo `public/curso-<curso>/` (narrador). Sin valor = `default`. */
  curso?: string;
  /** Láminas ya parseadas y validadas (carrusel). */
  imagenes?: string[];
}

/**
 * Parte el contenido en segmentos alternando HTML, videos, cápsulas, narradores y carruseles.
 * El HTML se sanitiza aquí; los demás se entregan como marcadores para que React monte el
 * componente correspondiente (whitelist por construcción).
 */
export function splitLessonContent(content: string): LessonSegment[] {
  if (!content) return [];
  const segments: LessonSegment[] = [];
  let last = 0;
  // Alternancia de los cuatro marcadores. Grupos: 1-2 video · 3-4 cápsula · 5-7 narrador
  // (slug, alto, curso) · 8 carrusel (payload JSON de láminas).
  const re = new RegExp(
    `${LX_VIDEO_RE.source}|${LX_CAPSULA_RE.source}|${LX_NARRADOR_RE.source}|${LX_CARRUSEL_RE.source}`,
    'gi'
  );
  let m: RegExpExecArray | null;

  while ((m = re.exec(content)) !== null) {
    const before = content.slice(last, m.index);
    if (before.trim()) segments.push({ kind: 'html', value: sanitizeLessonHtml(before) });
    if (m[1]) {
      segments.push({ kind: 'video', value: m[1], platform: m[2] as LessonVideoPlatform });
    } else if (m[3]) {
      const alto = m[4] ? parseInt(m[4], 10) : undefined;
      segments.push({ kind: 'capsula', value: m[3], alto });
    } else if (m[5]) {
      const alto = m[6] ? parseInt(m[6], 10) : undefined;
      segments.push({ kind: 'narrador', value: m[5], alto, curso: m[7] || undefined });
    } else if (m[8]) {
      const imagenes = urlsDeCarrusel(m[8]);
      // Un carrusel sin láminas válidas no deja rastro: mejor nada que un marco vacío.
      if (imagenes.length > 0) segments.push({ kind: 'carrusel', value: m[8], imagenes });
    }
    last = m.index + m[0].length;
  }

  const tail = content.slice(last);
  if (tail.trim()) segments.push({ kind: 'html', value: sanitizeLessonHtml(tail) });
  return segments;
}
