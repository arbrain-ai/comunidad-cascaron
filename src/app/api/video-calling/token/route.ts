// ============================================
// API Route: Generate LiveKit Token — LA PUERTA de la sala
// ============================================
// POST /api/video-calling/token
//
// 5 sep 2026 (sala v2):
//  · La sala ABRE ANTES del anfitrion: cualquiera con acceso puede abrir la
//    sesion dentro de la ventana (20 min antes de la hora programada hasta el
//    cierre). "A la racita le gusta hablar antes de que yo llegue."
//  · QUE puede publicar cada quien viaja en el token (canPublishSources) segun
//    el MODO de la sala: en 'abierta' todos tienen microfono; en 'clase' el
//    miembro entra callado (solo camara) y habla solo con turno.
//  · Quien crea una sala sin evento es su anfitrion.
// Sala propia:
//  · El candado de nivel se aplica AQUI con la misma regla que pinta el
//    calendario (`nivelBloquea`, `tierOculta`).
//  · Esta ruta YA NO escribe en `video_participants`: la asistencia la escribe
//    el webhook de LiveKit.

import { startEntryAttempt, finishEntryAttempt } from '@/features/video-calling/services/entryAudit';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateToken } from '@/features/video-calling/services/tokenService';
import { calculatePermissions } from '@/features/video-calling/config/features';
import { mensajeCandado, nivelBloquea, tierOculta } from '@/features/agenda/lib/candado';
import {
  abrirSesion,
  cargarSalaPorId,
  estadoParaCliente,
  identityParaDispositivo,
  fuentesPermitidas,
  reconciliar,
  rolEnSala,
  sesionAbiertaDe,
  turnosActivos,
  ventanaAbierta,
} from '@/features/video-calling/services/salaService';
import { limpiarDispositivo } from '@/features/video-calling/lib/identidad';
import type { UserAccessContext, VideoRoomSettings } from '@/features/video-calling/types';

const crearSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
let _supabaseAdmin: ReturnType<typeof crearSupabaseAdmin> | null = null;
const supabaseAdmin = () => (_supabaseAdmin ??= crearSupabaseAdmin());

const crearSupabaseAuth = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
let _supabaseAuth: ReturnType<typeof crearSupabaseAuth> | null = null;
const supabaseAuth = () => (_supabaseAuth ??= crearSupabaseAuth());

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let attemptId: string | null = null;
  const reply = async (payload: Record<string, any>, init?: {status:number}) => {
    const status=init?.status??200;
    await finishEntryAttempt(attemptId,status,payload.data?.session_id,payload.code ?? (status>=400?'token_rejected':undefined));
    if(payload.data) payload.data.entry_attempt_id=attemptId;
    return NextResponse.json(payload,init);
  };
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return reply({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAuth().auth.getUser(token);
    if (authError || !user) return reply({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { room_id } = body;
    const dispositivo = limpiarDispositivo(body.dispositivo);
    attemptId = await startEntryAttempt(user.id, room_id);
    if (!room_id) return reply({ error: 'room_id is required' }, { status: 400 });

    const { data: room, error: roomError } = await supabaseAdmin()
      .from('video_rooms')
      .select('*, room_settings:video_room_settings(*)')
      .eq('id', room_id)
      .single();
    if (roomError || !room) return reply({ error: 'Room not found' }, { status: 404 });

    const { data: profile, error: profileError } = await supabaseAdmin()
      .from('profiles')
      .select('id, full_name, avatar_url, role, tier, current_level, has_community_access')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) return reply({ error: 'Profile not found' }, { status: 404 });

    if (!['owner','admin'].includes(profile.role) && !profile.has_community_access) return reply({error:'Tu acceso a la comunidad no está vigente.',code:'community_access_required'},{status:403});

    const sala = await cargarSalaPorId(room_id);
    if (!sala) return reply({ error: 'Room not found' }, { status: 404 });

    const userContext: UserAccessContext = {
      user_id: profile.id,
      role: profile.role,
      tier: profile.tier,
      current_level: profile.current_level || 1,
    };
    const roomSettings = Array.isArray(room.room_settings) ? room.room_settings[0] || null : room.room_settings;

    const permissions = calculatePermissions(
      userContext,
      roomSettings as VideoRoomSettings | null,
      sala.evento?.host_id ?? null,
      sala.created_by,
    );
    if (!permissions.can_join) {
      return reply({ error: 'Insufficient access level' }, { status: 403 });
    }

    // EL CANDADO DE NIVEL — la puerta aplica lo que la vitrina promete.
    if (room.event_id) {
      const { data: evento } = await supabaseAdmin()
        .from('events')
        .select('required_level, visible_to_tier')
        .eq('id', room.event_id)
        .maybeSingle();
      if (evento) {
        const perfil = { role: profile.role, tier: profile.tier, current_level: profile.current_level };
        if (tierOculta(perfil, evento.visible_to_tier)) {
          return reply({ error: 'Esta clase es solo para miembros VIP.', code: 'candado_tier' }, { status: 403 });
        }
        if (nivelBloquea(perfil, evento.required_level)) {
          return reply(
            { error: mensajeCandado(perfil, evento.required_level), code: 'candado_nivel', required_level: evento.required_level, current_level: profile.current_level ?? 1 },
            { status: 403 },
          );
        }
      }
    }

    const rol = rolEnSala(profile.id, profile.role, sala);

    // Sesion viva, o abrirla si la ventana lo permite
    let sesion = await sesionAbiertaDe(room_id);
    if (!sesion) {
      const ventana = ventanaAbierta(sala);
      if (!ventana.abierta && rol === 'miembro') {
        return reply(
          { error: ventana.motivo ?? 'La sala todavia no abre.', code: 'sala_cerrada', abre_en: ventana.abreEn?.toISOString() ?? null },
          { status: 403 },
        );
      }
      sesion = await abrirSesion(sala, profile.id);
    }

    // El arbitro pasa antes de dar el token (cierre por reloj, turnos vencidos)
    const cargada = await reconciliar({ sesion, sala }, { forzarSFU: false });
    if (cargada.sesion.ended_at) {
      return reply({ error: 'Esta clase ya termino.', code: 'sala_terminada' }, { status: 403 });
    }

    // Varios dispositivos por persona: el segundo recibe user.id~dispositivo (ver lib/identidad).
    const identity = await identityParaDispositivo(cargada.sala, profile.id, dispositivo);
    const conTurno = (await turnosActivos(cargada.sesion.id)).some((t) => t.identity === identity);
    const fuentes = fuentesPermitidas(rol, cargada.sesion.modo, conTurno, cargada.sala.ajustes.allow_screen_share);

    const tokenResponse = await generateToken({
      room_name: room.livekit_room_name || room.slug,
      participant_identity: identity,
      participant_name: profile.full_name,
      participant_metadata: JSON.stringify({
        avatar_url: profile.avatar_url,
        role: profile.role,
        tier: profile.tier,
        level: profile.current_level,
        rol_sala: rol,
        dispositivo,
      }),
      can_publish: permissions.can_activate_mic || permissions.can_activate_camera,
      can_subscribe: true,
      can_publish_data: permissions.can_chat,
      can_publish_sources: fuentes,
    });

    const estado = await estadoParaCliente(cargada, profile.id, profile.role, [], identity);

    return reply({
      success: true,
      data: {
        ...tokenResponse,
        permissions,
        session_id: cargada.sesion.id,
        session_started_at: cargada.sesion.started_at,
        sala: estado,
      },
    });
  } catch (error) {
    console.error('Token generation error:', error);
    return reply({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
