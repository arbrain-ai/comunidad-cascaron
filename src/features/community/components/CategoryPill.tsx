// ============================================
// CategoryPill — la etiqueta de categoría como pill de color
// ============================================
// Antes la categoría del post era texto plano coloreado inline ("· 💬 General").
// Ahora es un pill con fondo tenue del color de la categoría + su emoji, así el
// feed se escanea de un vistazo por tipo (patrón universal de comunidades).
// El color sale del dato de la categoría (categories.color); si falta, cae al
// morado de marca. Sin gradientes: fondo plano al 14%, borde al 30% — dentro de
// la paleta de restricción.

'use client';

import type { Category } from '../types';

interface Props {
  category: Pick<Category, 'name' | 'color'> & { emoji?: string | null };
  /** 'sm' para el header del post, 'xs' para espacios apretados */
  size?: 'xs' | 'sm';
  className?: string;
}

/**
 * Devuelve el color tal cual, salvo que caiga en la familia del ámbar de marca:
 * en ese caso devuelve null y quien llama usa el morado del sistema.
 *
 * La franja se define en HSL para atrapar también los dorados que no son
 * exactamente `--gold`: tono 25-55° con saturación alta es "esto se ve dorado"
 * para el ojo, aunque el hex sea otro.
 */
function sinAmbar(hex?: string | null): string | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.18) return hex;                    // gris: no compite con nada
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const esDorado = h >= 25 && h <= 55 && d > 0.45 && max > 0.6;
  return esDorado ? null : hex;
}

export function CategoryPill({ category, size = 'sm', className = '' }: Props) {
  // El ámbar está reservado: significa "es tuyo, o está vivo ahora". Una
  // categoría no es ninguna de las dos, así que aunque un admin le ponga un
  // tono dorado desde el panel, la interfaz lo desvía al morado.
  //
  // Esto no es terquedad: el color de una categoría es un dato de la base, no
  // código, y sin esta guarda el significado del ámbar se erosiona solo cada
  // vez que alguien elige un color bonito en un formulario. Medido hoy: la
  // categoría "Videollamadas" era el ÚNICO ámbar indebido que quedaba en el
  // feed, y venía justo de ahí.
  const color = sinAmbar(category.color) || 'var(--primary)';
  const pad = size === 'xs' ? 'px-1.5 py-px text-3xs' : 'px-2 py-0.5 text-2xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide leading-none ${pad} ${className}`}
      style={{
        color,
        // color-mix mantiene UN solo color (el de la categoría) en dos
        // opacidades: fondo tenue + borde. Nada de gradiente bicolor.
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
      }}
    >
      {category.emoji && <span className="not-italic">{category.emoji}</span>}
      <span className="truncate max-w-[110px] md:max-w-none">{category.name}</span>
    </span>
  );
}
