/**
 * Deterministic warm-tone palette for avatar fallback tiles. Matches the
 * Google Meet look: cada participante siempre cae en el mismo color a
 * traves de renders/sesiones porque el hash es estable.
 *
 * Returns both the full background + a softer tile-sized background so el
 * tile sin video no sea gris uniforme.
 */

const AVATAR_PALETTE: Array<{
  /** Full-saturation background for the avatar circle */
  avatar: string;
  /** Muted tile background (behind the circle) */
  tile: string;
  /** Letter color on top of avatar circle */
  letter: string;
}> = [
  // Terracota
  { avatar: '#b94b2e', tile: '#3a1f16', letter: '#ffe4d6' },
  // Oliva
  { avatar: '#6b7f3a', tile: '#2b321d', letter: '#eef3d7' },
  // Azul pizarra
  { avatar: '#355a8b', tile: '#162235', letter: '#d9e6f5' },
  // Borgoña
  { avatar: '#7a2d46', tile: '#2b1019', letter: '#ffd8e4' },
  // Arena dorada
  { avatar: '#a07a2d', tile: '#2e2310', letter: '#ffecc7' },
  // Verde bosque
  { avatar: '#2f6a52', tile: '#11281f', letter: '#cdebe0' },
  // Malva
  { avatar: '#6e4878', tile: '#241a2a', letter: '#eedef5' },
  // Cobre
  { avatar: '#a05331', tile: '#321a10', letter: '#ffdcc6' },
];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function avatarColorFor(identity: string) {
  if (!identity) return AVATAR_PALETTE[0];
  return AVATAR_PALETTE[hash(identity) % AVATAR_PALETTE.length];
}
