// ============================================
// API Route: las acciones de gobierno de la sala
// ============================================
// POST /api/video-calling/sala/accion  { session_id, accion, ...params }
//
//   anfitrion_entro            (solo el anfitrion)   → la sala toma el modo del evento, o CLASE
//   modo {modo}                (gobierna)            → abierta ("Libre") | clase
//   silenciar_todos            (gobierna)            → micros cerrados, el modo NO cambia
//   silenciar {identity}       (gobierna)            → SOLO el microfono de uno
//   dar_palabra {identity}     (gobierna)            → turno con presupuesto
//   quitar_palabra {identity}  (gobierna)            → termina su turno
//   regalar_tiempo {identity, segundos} (gobierna)   → extiende su turno
//   expulsar {identity}        (gobierna)            → fuera de la sala
//   terminar                   (gobierna)            → la clase termina para todos
//   ceder_palabra              (el que tiene turno)  → termina su propio turno
//   mudanza {url|null}         (gobierna)            → la clase se mueve a otro link; null la quita
//
// Todo lo que cambia el estado sube `estado_version`; los clientes lo ven por
// Realtime y vuelven a pedir /estado.

import { priorizarCamaraGrabada } from '@/features/video-calling/services/recordingService';
import { usuarioDeIdentity } from '@/features/video-calling/lib/identidad';
import { NextRequest, NextResponse, after } from 'next/server';
import { quienLlama } from '../_auth';
import { persistRoomFocus, persistSessionMetadata } from '@/features/video-calling/services/roomFocusService';
import { validarMudanza } from '@/features/video-calling/sala/mudanzaPolicy';
import { speakerController } from '@/features/video-calling/sala/sharedComposition';
import { RoomServiceClient } from 'livekit-server-sdk';
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_API_URL } from '@/features/video-calling/config/livekit';
import {
  anfitrionEntro,
  cambiarModo,
  cargarSesion,
  cerrarSesion,
  concederTurno,
  estadoParaCliente,
  expulsar,
  gobierna,
  regalarTiempo,
  rolEnSala,
  nombreSala,
  silenciarTodos,
  silenciarUno,
  terminarTurno,
  type Modo,
} from '@/features/video-calling/services/salaService';

export const dynamic = 'force-dynamic';

type Cuerpo = {
  session_id?: string;
  accion?: string;
  identity?: string | null;
  /** La identity de la conexión que llama (varios dispositivos por persona). */
  yo?: string | null;
  modo?: Modo;
  segundos?: number;
  url?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const quien = await quienLlama(request);
    if (!quien) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: Cuerpo;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const { session_id: sessionId, accion } = body;
    if (!sessionId || !accion) return NextResponse.json({ error: 'session_id y accion son requeridos' }, { status: 400 });

    const cargada = await cargarSesion(sessionId);
    if (!cargada) return NextResponse.json({ error: 'Sesion no encontrada' }, { status: 404 });
    if (cargada.sesion.ended_at && accion !== 'terminar') {
      return NextResponse.json({ error: 'La clase ya termino' }, { status: 409 });
    }

    const rol = rolEnSala(quien.id, quien.role, cargada.sala);
    const exige = (ok: boolean, msg = 'Solo el anfitrion o un moderador puede hacer esto') =>
      ok ? null : NextResponse.json({ error: msg }, { status: 403 });
    const conIdentity = () => (body.identity ? null : NextResponse.json({ error: 'identity required' }, { status: 400 }));

    let resultado: unknown = null;
    switch (accion) {
      case 'orador': {
        if (typeof body.identity !== 'string' || body.identity.length > 128) return NextResponse.json({ error: 'identity invalida' }, { status: 400 });
        const people = (await new RoomServiceClient(LIVEKIT_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
          .listParticipants(nombreSala(cargada.sala))).filter(p => Number(p.kind ?? 0) === 0);
        const controlador = speakerController(people.map(p => p.identity), cargada.sala.anfitrion_id);
        if (!controlador || usuarioDeIdentity(controlador) !== quien.id) {
          return NextResponse.json({ error: 'Otro participante sincroniza el orador' }, { status: 403 });
        }
        const speaker = people.find(p => p.identity === body.identity);
        if (!speaker?.tracks.some(t => Number(t.source) === 2 && !t.muted)) {
          return NextResponse.json({ error: 'El orador no tiene micrófono activo' }, { status: 409 });
        }
        await persistRoomFocus(sessionId, body.identity, 'room_speaker');
        resultado = { orador_identity: body.identity };
        break;
      }
      case 'foco': {
        const e = exige(gobierna(rol)); if (e) return e;
        if (body.identity !== null && (typeof body.identity !== 'string' || body.identity.length === 0 || body.identity.length > 128)) {
          return NextResponse.json({ error: 'identity invalida' }, { status: 400 });
        }
        if (body.identity !== null) {
          const participant = await new RoomServiceClient(LIVEKIT_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .getParticipant(nombreSala(cargada.sala), body.identity);
          if (Number(participant.kind ?? 0) !== 0) return NextResponse.json({ error: 'Participante no disponible' }, { status: 400 });
        }
        await persistRoomFocus(sessionId, body.identity);
        resultado = { foco_identity: body.identity };
        break;
      }
      case 'mudanza': {
        const e = exige(gobierna(rol), 'Solo el anfitrion o un moderador puede mover la clase'); if (e) return e;
        if (body.url === null) { await persistSessionMetadata(sessionId, 'mudanza', null); resultado = { mudanza: null }; break; }
        const destino = validarMudanza(body.url);
        if (!destino.ok) return NextResponse.json({ error: destino.error }, { status: 400 });
        const mudanza = { url: destino.url, host: destino.host, at: new Date().toISOString(), por: quien.id };
        await persistSessionMetadata(sessionId, 'mudanza', mudanza);
        resultado = { mudanza };
        break;
      }
      case 'anfitrion_entro': {
        const e = exige(rol === 'anfitrion', 'Solo el anfitrion abre la clase');
        if (e) return e;
        resultado = await anfitrionEntro(sessionId, quien.id);
        break;
      }
      case 'modo': {
        const e = exige(gobierna(rol)); if (e) return e;
        if (body.modo !== 'abierta' && body.modo !== 'clase') return NextResponse.json({ error: 'modo invalido' }, { status: 400 });
        await cambiarModo(sessionId, body.modo, quien.id, 'manual');
        resultado = { modo: body.modo };
        break;
      }
      case 'silenciar_todos': {
        const e = exige(gobierna(rol)); if (e) return e;
        resultado = await silenciarTodos(sessionId, quien.id);
        break;
      }
      case 'silenciar': {
        const e = exige(gobierna(rol)) ?? conIdentity(); if (e) return e;
        resultado = { silenciado: await silenciarUno(sessionId, body.identity!, quien.id) };
        break;
      }
      case 'dar_palabra': {
        const e = exige(gobierna(rol)) ?? conIdentity(); if (e) return e;
        resultado = await concederTurno(sessionId, body.identity!, quien.id);
        if (cargada.sesion.recording_status === 'recording') {
          const identity = body.identity!;
          after(async () => { await priorizarCamaraGrabada(nombreSala(cargada.sala), sessionId, identity); });
        }
        break;
      }
      case 'quitar_palabra': {
        const e = exige(gobierna(rol)) ?? conIdentity(); if (e) return e;
        resultado = { terminado: await terminarTurno(sessionId, body.identity!, 'quitado', quien.id) };
        break;
      }
      case 'regalar_tiempo': {
        const e = exige(gobierna(rol)) ?? conIdentity(); if (e) return e;
        const segundos = Math.max(15, Math.min(600, Number(body.segundos) || 180));
        resultado = await regalarTiempo(sessionId, body.identity!, segundos, quien.id);
        break;
      }
      case 'expulsar': {
        const e = exige(gobierna(rol)) ?? conIdentity(); if (e) return e;
        await expulsar(sessionId, body.identity!, quien.id);
        resultado = { expulsado: body.identity };
        break;
      }
      case 'terminar': {
        const e = exige(gobierna(rol)); if (e) return e;
        await cerrarSesion(sessionId, 'anfitrion', quien.id);
        resultado = { terminada: true };
        break;
      }
      case 'ceder_palabra': {
        resultado = { terminado: await terminarTurno(sessionId, quien.id, 'cedido', quien.id) };
        break;
      }
      default:
        return NextResponse.json({ error: `accion desconocida: ${accion}` }, { status: 400 });
    }

    const fresca = await cargarSesion(sessionId);
    const estado = fresca ? await estadoParaCliente(fresca, quien.id, quien.role, [], typeof body.yo === 'string' ? body.yo : null) : null;
    return NextResponse.json({ success: true, data: resultado, estado });
  } catch (error) {
    console.error('[sala/accion] error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
