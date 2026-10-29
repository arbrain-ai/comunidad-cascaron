// ============================================
// Identidad en la sala: una persona, varios dispositivos
// ============================================
// 3 oct 2026: LiveKit expulsa la conexión anterior cuando entra otra con la
// MISMA identity. Como la identity era el user.id, una cuenta solo podía estar
// en un dispositivo (caso real: una pareja que comparte la cuenta y cada uno
// entra desde su computadora).
//
// Regla: el primer dispositivo conserva `user.id` (todo lo histórico sigue
// igual: asistencia, anfitrión, turnos). Cada dispositivo ADICIONAL recibe
// `user.id~<dispositivo>`. Lo que necesita a la PERSONA (rol, perfil, mano
// alzada) usa `usuarioDeIdentity`; lo que necesita a la CONEXIÓN (turno,
// micrófono, expulsar, "soy yo") usa la identity completa.

export const SEPARADOR_DISPOSITIVO = '~';

/** La persona detrás de una identity de LiveKit (quita el sufijo de dispositivo). */
export function usuarioDeIdentity(identity: string): string {
  const i = identity.indexOf(SEPARADOR_DISPOSITIVO);
  return i < 0 ? identity : identity.slice(0, i);
}

/** Identity de un dispositivo adicional de la misma persona. */
export function identityDeDispositivo(userId: string, dispositivo: string): string {
  return `${userId}${SEPARADOR_DISPOSITIVO}${dispositivo}`;
}

/** Saneado del id de dispositivo que manda el navegador: [a-z0-9], 6 a 32. */
export function limpiarDispositivo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const v = valor.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
  return v.length >= 6 ? v : null;
}

const CLAVE_DISPOSITIVO = 'app-sala-dispositivo';

/** Id estable de ESTE navegador (cliente). Sin localStorage, uno por pestaña. */
export function dispositivoLocal(): string {
  const nuevo = () =>
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`)
      .replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase();
  try {
    const guardado = limpiarDispositivo(window.localStorage.getItem(CLAVE_DISPOSITIVO));
    if (guardado) return guardado;
    const id = nuevo();
    window.localStorage.setItem(CLAVE_DISPOSITIVO, id);
    return id;
  } catch {
    return nuevo();
  }
}
