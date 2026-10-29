import contract from './layout-contract.json';
// ============================================
// SALA v2 - la matematica de la rejilla (pura, testeable)
// ============================================
// Celdas 16:9 FIJAS: la rejilla elige columnas y filas para que las celdas
// sean lo mas grandes posible sin deformarse, y lo que no cabe va a otra
// pagina. Nada de filas "auto" que crecen con un telefono en vertical
// (defecto medido el 5 sep 2026 con 12 tiles).

export const RELACION = 16 / 9;

/**
 * Relaciones de aspecto permitidas para una celda. Todas las celdas de una
 * pagina son IDENTICAS (eso es lo que mata el caos de filas desiguales); lo que
 * se flexiona es la proporcion, para que la rejilla LLENE la pantalla como Meet:
 * · pantalla apaisada (escritorio): entre 16:9 y 4:3 — el video se recorta un
 *   poco por los lados (object-cover), jamas se deforma;
 * · pantalla vertical (telefono): celdas cuadradas o verticales (hasta 3:4),
 *   que es como caben 12 caras en un telefono (critico ciego de objeto, ronda 2).
 */
export const RELACIONES_APAISADA = contract.grid.landscapeRatios;
export const RELACIONES_VERTICAL = contract.grid.portraitRatios;

export interface Rejilla {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  /** Relacion de aspecto elegida (ancho / alto). */
  relacion: number;
}

/** Cuantas celdas por pagina: 12 en escritorio (⚑ G del spec) y 12 en telefono (3x4 con celdas verticales). */
export function celdasPorPagina(anchoViewport: number, alto = 800): number {
  if (anchoViewport < 600) return 6;
  if (anchoViewport < 1000) return alto < 400 ? 6 : 9;
  return 16;
}

/**
 * Para `n` celdas en un area `w`x`h` con `gap` entre ellas, devuelve la
 * distribucion cols x rows y la relacion de aspecto que maximizan el AREA de
 * cada celda (todas iguales) dentro de las relaciones permitidas.
 */
export function calcularRejilla(n: number, w: number, h: number, gap = 8): Rejilla {
  if (n <= 0 || w <= 0 || h <= 0) return { cols: 1, rows: 1, cellW: 0, cellH: 0, relacion: RELACION };
  const relaciones = h > w ? RELACIONES_VERTICAL : RELACIONES_APAISADA;
  let mejor: Rejilla = { cols: 1, rows: n, cellW: 0, cellH: 0, relacion: relaciones[0] };
  for (const relacion of relaciones) {
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const anchoDisponible = (w - gap * (cols - 1)) / cols;
      const altoDisponible = (h - gap * (rows - 1)) / rows;
      const cellW = Math.floor(Math.min(anchoDisponible, altoDisponible * relacion));
      const cellH = Math.floor(cellW / relacion);
      if (cellW * cellH > mejor.cellW * mejor.cellH) mejor = { cols, rows, cellW, cellH, relacion };
    }
  }
  return mejor;
}

export interface Paginado<T> {
  pagina: number;
  totalPaginas: number;
  visibles: T[];
  ocultos: number;
}

/** Corta la lista en paginas de `porPagina`, y devuelve la pagina pedida (acotada). */
export function paginar<T>(items: T[], porPagina: number, pagina: number): Paginado<T> {
  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina));
  const p = Math.min(Math.max(0, pagina), totalPaginas - 1);
  const visibles = items.slice(p * porPagina, (p + 1) * porPagina);
  return { pagina: p, totalPaginas, visibles, ocultos: Math.max(0, items.length - visibles.length) };
}

/** En que pagina cae el indice `i`. */
export function paginaDe(i: number, porPagina: number): number {
  return i < 0 ? 0 : Math.floor(i / porPagina);
}

/** The live stage and recorded stage use the same sidebar proportions. */
export function presentacion(w: number, h: number, n: number) {
  const lateral = w >= 700 || (w >= 560 && w > h);
  const gap = w < 600 ? 8 : contract.gutter;
  const ancho = Math.round(Math.min(contract.sidebar.maxWidth, Math.max(contract.sidebar.minWidth, w * contract.sidebar.fraction)));
  const porPagina = lateral
    ? Math.max(1, Math.min(contract.sidebar.maxTiles, Math.floor((h - 48 + gap) / (ancho / contract.sidebar.ratio + gap))))
    : w >= 480 ? 3 : h >= w / (16/9) + (w-gap) / (4/3) + 70 ? 4 : 2;
  return { lateral, gap, ancho, porPagina, columnas: w >= 480 ? 3 : 2, totalPaginas: Math.max(1, Math.ceil(n / porPagina)) };
}

/** Keep a stable page, inserting a sustained speaker only when they are outside it. */
export function incluirOrador<T extends { identity: string }>(visible: T[], all: T[], identity: string | null): T[] {
  if (!identity || visible.some(p => p.identity === identity) || visible.length === 0) return visible;
  const speaker = all.find(p => p.identity === identity);
  return speaker ? [...visible.slice(0, -1), speaker] : visible;
}
