import { TrackSource } from 'livekit-server-sdk';
export type Modo = 'abierta' | 'clase';
export type RolSala = 'anfitrion' | 'moderador' | 'miembro';
export const SALA_CHICA_MAX_PARTICIPANTES = 10;

/** One policy shared by the admission token and permission reconciliation. */
export function fuentesPermitidas(rol: RolSala, modo: Modo, conTurno: boolean, allowScreenShare = true): TrackSource[] {
  if (rol === 'anfitrion' || rol === 'moderador') {
    return [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];
  }
  if (modo === 'abierta' || conTurno) return [TrackSource.CAMERA, TrackSource.MICROPHONE, ...(allowScreenShare ? [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : [])];
  return [TrackSource.CAMERA];
}


/** Explicit event mode wins; preserve the small-room default. */
export function modoAlEntrar(sala: { max_participants: number | null; evento: { modo_sala: Modo | null } | null }): { modo: Modo; origen: 'evento' | 'default' } {
  const preset = sala.evento?.modo_sala;
  if (preset === 'abierta' || preset === 'clase') return { modo: preset, origen: 'evento' };
  return { modo: sala.max_participants !== null && sala.max_participants > 0 && sala.max_participants <= SALA_CHICA_MAX_PARTICIPANTES ? 'abierta' : 'clase', origen: 'default' };
}
