import { DisconnectReason } from 'livekit-client';

/**
 * Why someone left the room. A leave can show up as CLIENT_REQUEST_LEAVE on the
 * SFU with no trace in our telemetry if the page dies first. Every exit declares
 * one motive, first writer wins (the button before the resulting page/SDK events).
 */
export type MotivoSalida =
  | 'boton' | 'pagina_cerrada' | 'red' | 'expulsado' | 'fin_clase' | 'identidad_duplicada' | 'cliente';

export function motivoDeDesconexion(reason?: DisconnectReason): MotivoSalida {
  switch (reason) {
    case DisconnectReason.CLIENT_INITIATED: return 'cliente';
    case DisconnectReason.DUPLICATE_IDENTITY: return 'identidad_duplicada';
    case DisconnectReason.PARTICIPANT_REMOVED: return 'expulsado';
    case DisconnectReason.ROOM_DELETED:
    case DisconnectReason.ROOM_CLOSED: return 'fin_clase';
    default: return 'red';
  }
}

/** Automatic rejoin: only for losses nobody chose. Never after leaving, removal, end or a second window. */
export const MAX_RECONEXIONES = 3;
const NO_REINTENTAR = new Set<DisconnectReason | undefined>([
  DisconnectReason.CLIENT_INITIATED, DisconnectReason.DUPLICATE_IDENTITY, DisconnectReason.PARTICIPANT_REMOVED,
  DisconnectReason.ROOM_DELETED, DisconnectReason.ROOM_CLOSED, DisconnectReason.USER_REJECTED,
]);

export function debeReconectar(reason: DisconnectReason | undefined, estuvoConectado: boolean, intentosPrevios: number): boolean {
  return estuvoConectado && intentosPrevios < MAX_RECONEXIONES && !NO_REINTENTAR.has(reason);
}

/** While the browser reports no network, the rejoin waits (without spending attempts) up to this long. */
export const ESPERA_SIN_RED_MS = 120_000;

/** 1 s, 3 s, 6 s once the network is back: fast for a blip. */
export function esperaReconexion(intento: number): number {
  return [1000, 3000, 6000][Math.min(Math.max(intento, 0), 2)];
}

/** Leaving costs something for the presenter, the host or whoever holds the floor. */
export function salidaRequiereConfirmacion(s: { compartiendoPantalla: boolean; soyAnfitrion: boolean; conTurno: boolean }): boolean {
  return s.compartiendoPantalla || s.soyAnfitrion || s.conTurno;
}
