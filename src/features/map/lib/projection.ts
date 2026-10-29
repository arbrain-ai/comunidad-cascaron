/**
 * La misma proyección que corre en scripts/build-map-geometry.py.
 *
 * La geometría de los países llega pre-proyectada desde el build (por eso el
 * navegador no carga d3-geo ni topojson-client), pero las coordenadas de los
 * miembros llegan crudas de la base en lon/lat y hay que proyectarlas aquí.
 * Si las dos fórmulas divergen, los puntos caen en el mar: los parámetros los
 * manda el propio archivo de geometría, no una copia hardcodeada.
 */

export interface Projection {
  type: string;
  lonCenter: number;
  latMax: number;
  latMin: number;
  width: number;
  height: number;
}

export interface CountryShape {
  /** nombre en inglés, como viene de Natural Earth */
  n: string;
  /** path SVG con comandos relativos */
  d: string;
  /** centroide aproximado [lon, lat] */
  c: [number, number];
}

export interface WorldGeometry {
  projection: Projection;
  source: string;
  countries: CountryShape[];
}

export interface Point {
  x: number;
  y: number;
}

const mercatorY = (lat: number): number => {
  const clamped = Math.max(Math.min(lat, 89.5), -89.5);
  return (Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 180 / 2)) * 180) / Math.PI;
};

const mercatorX = (lon: number, lonCenter: number): number => {
  let d = lon - lonCenter;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
};

/** lon/lat -> coordenadas del lienzo SVG. */
export function projectPoint(lon: number, lat: number, p: Projection): Point {
  const yMax = mercatorY(p.latMax);
  const scale = p.width / 360;
  return {
    x: (mercatorX(lon, p.lonCenter) + 180) * scale,
    y: (yMax - mercatorY(lat)) * scale,
  };
}

/**
 * Encuadre por defecto: el corredor España–América (comunidades
 * hispanohablantes). Un mapamundi completo dejaría ~70% del lienzo en océano
 * vacío; esto lo llena. Ajusta HOME_BOUNDS a donde viva tu comunidad.
 */
export const HOME_BOUNDS = {
  lonMin: -122,
  lonMax: 14,
  latMin: -47,
  latMax: 46,
};

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Convierte un rectángulo lon/lat en viewBox, ajustado al aspecto del contenedor. */
export function boundsToViewBox(
  bounds: typeof HOME_BOUNDS,
  p: Projection,
  aspect: number,
  padding = 0.04
): ViewBox {
  const a = projectPoint(bounds.lonMin, bounds.latMax, p);
  const b = projectPoint(bounds.lonMax, bounds.latMin, p);
  let w = Math.abs(b.x - a.x);
  let h = Math.abs(b.y - a.y);
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;

  w *= 1 + padding * 2;
  h *= 1 + padding * 2;

  // Cubrir, no recortar: el encuadre pedido siempre cabe entero.
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;

  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Mantiene el viewBox dentro del mundo y entre los límites de zoom. */
export function clampViewBox(v: ViewBox, p: Projection, minW: number, maxW: number): ViewBox {
  const w = Math.max(minW, Math.min(maxW, v.w));
  const h = (w / v.w) * v.h;
  return {
    w,
    h,
    x: Math.max(-w * 0.15, Math.min(p.width - w * 0.85, v.x)),
    y: Math.max(-h * 0.15, Math.min(p.height - h * 0.85, v.y)),
  };
}
