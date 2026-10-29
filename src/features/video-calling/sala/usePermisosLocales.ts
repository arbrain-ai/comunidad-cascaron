'use client';

// ============================================
// SALA v2 - lo que el SERVIDOR me deja publicar, visto desde mi navegador
// ============================================
// LiveKit manda `ParticipantPermissionsChanged` cuando el servidor cambia mis
// fuentes permitidas (modo de la sala, turno concedido o quitado). Aqui se
// traduce a dos booleanos y a dos reflejos:
//   · me dan la palabra (microfono permitido + turno activo) → abro el micro
//     solo, sin que tenga que buscar el boton;
//   · me la quitan (microfono ya no permitido) → cierro el micro en mi lado
//     tambien, para que el boton no mienta mientras el SFU lo despublica.

import { useEffect, useRef, useState } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import type { ParticipantPermission } from '@livekit/protocol';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import type { MediaDevice } from './mediaDeviceError';

// TrackSource del protocolo: CAMERA=1 · MICROPHONE=2 · SCREEN_SHARE=3
const CAMERA = 1;
const MICROPHONE = 2;
const SCREEN_SHARE = 3;

/** Copia plana de lo que importa: LiveKit muta el mismo objeto y React no lo veria. */
interface PermisosLeidos {
  canPublish: boolean;
  fuentes: number[];
}

function leerPermisos(p: ParticipantPermission | undefined): PermisosLeidos | undefined {
  if (!p) return undefined;
  return { canPublish: !!p.canPublish, fuentes: [...((p.canPublishSources ?? []) as unknown as number[])] };
}

function permite(p: PermisosLeidos | undefined, fuente: number): boolean {
  if (!p) return false; // esperar la autorizacion inicial del servidor
  if (!p.canPublish) return false;
  return p.fuentes.length === 0 || p.fuentes.includes(fuente);
}

interface Opciones {
  /** Tengo un turno activo segun el servidor. */
  conTurno: boolean;
  registrar?: (event: string, detail?: Record<string, unknown>) => void;
  onMediaError?: (error: unknown, device: MediaDevice) => void;
}

export function usePermisosLocales({ conTurno, registrar, onMediaError }: Opciones) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [permisos, setPermisos] = useState<PermisosLeidos | undefined>(() => leerPermisos(localParticipant?.permissions));
  const abiertoPorTurno = useRef<string | null>(null);

  useEffect(() => {
    if (!room) return;
    setPermisos(leerPermisos(room.localParticipant.permissions));
    const onCambio = (_prev: ParticipantPermission | undefined, participant?: { identity?: string }) => {
      if (participant && participant.identity !== room.localParticipant.identity) return;
      const p = leerPermisos(room.localParticipant.permissions);
      setPermisos(p);
      registrar?.('permisos_cambiados', { fuentes: p?.fuentes ?? [], canPublish: p?.canPublish ?? null });
    };
    const alConectar = () => setPermisos(leerPermisos(room.localParticipant.permissions));
    room.on(RoomEvent.Connected, alConectar);
    room.on(RoomEvent.Reconnected, alConectar);
    room.on(RoomEvent.ParticipantPermissionsChanged, onCambio);
    return () => {
      room.off(RoomEvent.Connected, alConectar);
      room.off(RoomEvent.Reconnected, alConectar);
      room.off(RoomEvent.ParticipantPermissionsChanged, onCambio);
    };
  }, [room, registrar]);

  const puedoMicrofono = permite(permisos, MICROPHONE);
  const puedoCamara = permite(permisos, CAMERA);
  const puedoPantalla = permite(permisos, SCREEN_SHARE);

  // Reflejo 1: me dieron la palabra → micro abierto solo (una vez por turno)
  useEffect(() => {
    if (!room) return;
    const lp = room.localParticipant;
    const clave = conTurno ? 'turno' : null;
    if (conTurno && puedoMicrofono && abiertoPorTurno.current !== clave) {
      abiertoPorTurno.current = clave;
      const yaAbierto = lp.getTrackPublication(Track.Source.Microphone)?.track && !lp.getTrackPublication(Track.Source.Microphone)?.isMuted;
      if (!yaAbierto) {
        lp.setMicrophoneEnabled(true).then(() => registrar?.('micro_abierto_por_turno')).catch((err) => {
          registrar?.('micro_abierto_por_turno', { error: String(err).slice(0, 120) });
          onMediaError?.(err, 'microphone');
        });
      }
    }
    if (!conTurno) abiertoPorTurno.current = null;
  }, [room, conTurno, puedoMicrofono, registrar, onMediaError]);

  // Reflejo 2: ya no puedo publicar micro → lo cierro en mi lado tambien
  useEffect(() => {
    if (!room || puedoMicrofono) return;
    const lp = room.localParticipant;
    const pub = lp.getTrackPublication(Track.Source.Microphone);
    if (pub?.track && !pub.isMuted) {
      lp.setMicrophoneEnabled(false).then(() => registrar?.('micro_cerrado_sin_turno')).catch(() => {});
    }
  }, [room, puedoMicrofono, registrar]);

  // Stop capture as well as publication when the host withdraws presentation rights.
  useEffect(() => {
    if (!room || puedoPantalla || !room.localParticipant.isScreenShareEnabled) return;
    room.localParticipant.setScreenShareEnabled(false)
      .then(() => registrar?.('pantalla_retirada'))
      .catch(() => registrar?.('pantalla_error', { name: 'StopCaptureError' }));
  }, [room, puedoPantalla, registrar]);

  return { permisos, puedoMicrofono, puedoCamara, puedoPantalla };
}
