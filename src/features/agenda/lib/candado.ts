/**
 * EL CANDADO DE NIVEL — una sola regla para la vitrina y para la puerta.
 *
 * 1 sep 2026: el calendario pintaba "Nivel 7" y la puerta (/api/video-calling/token)
 * dejaba entrar a miembros de Nivel 1 y 2. La vitrina prometia una exclusividad
 * que la puerta no aplicaba. Desde hoy los dos lados llaman a ESTA funcion:
 * si cambia la regla, cambia en un solo lugar.
 *
 * Bypass (identico al que ya usaba el calendario): staff (admin/owner) y los
 * los VIP pasan siempre.
 */
export interface PerfilCandado {
  role?: string | null;
  tier?: string | null;
  current_level?: number | null;
}

export function esStaff(role?: string | null): boolean {
  return role === 'admin' || role === 'owner';
}

/** true = el miembro NO alcanza el nivel que pide la clase. */
export function nivelBloquea(perfil: PerfilCandado, requiredLevel: number | null | undefined): boolean {
  const req = requiredLevel ?? 1;
  if (req <= 1 || esStaff(perfil.role) || perfil.tier === 'vip') return false;
  return (perfil.current_level ?? 1) < req;
}

/** true = la clase es solo VIP y el miembro no lo es (ni staff). */
export function tierOculta(perfil: PerfilCandado, visibleToTier: string | null | undefined): boolean {
  if (visibleToTier !== 'vip') return false;
  return !(esStaff(perfil.role) || perfil.tier === 'vip');
}

/** El mensaje que ve el miembro en la puerta. Sin siglas, con el camino para subir. */
export function mensajeCandado(perfil: PerfilCandado, requiredLevel: number | null | undefined): string {
  const req = requiredLevel ?? 1;
  const actual = perfil.current_level ?? 1;
  return `Esta clase es del Nivel ${req} y tu nivel actual es ${actual}. Se sube construyendo: publica tus avances en la comunidad.`;
}
