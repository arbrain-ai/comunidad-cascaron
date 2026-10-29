// ============================================
// VIDEO CALLING - FEATURE ACCESS MATRIX
// ============================================
// Define quien puede hacer que basado en tier/role.
// Level restrictions REMOVED - all members have full media access.

import type { VideoPermissions, UserAccessContext, VideoRoomSettings } from '../types';

// ============================================
// TIER HIERARCHY
// ============================================

const TIER_HIERARCHY: Record<string, number> = {
  free: 0,
  standard: 1,
  vip: 2,
};

/** Verifica si un tier cumple el requisito minimo */
function meetsTierRequirement(userTier: string, requiredTier: string): boolean {
  return (TIER_HIERARCHY[userTier] ?? 0) >= (TIER_HIERARCHY[requiredTier] ?? 0);
}

// ============================================
// ADMIN / PRIVILEGED ROLES
// ============================================

const ADMIN_ROLES = new Set(['admin', 'owner']);
const MODERATOR_ROLES = new Set(['admin', 'owner', 'moderator']);

function isAdmin(role: string): boolean {
  return ADMIN_ROLES.has(role);
}

function isModerator(role: string): boolean {
  return MODERATOR_ROLES.has(role);
}

// ============================================
// PERMISSION CALCULATOR
// ============================================

/**
 * Calcula los permisos de un usuario para una sala de video.
 * Todos los miembros con tier valido tienen acceso completo a media.
 * Solo funciones admin (mute, kick, recording) estan restringidas por rol.
 */
export function calculatePermissions(
  user: UserAccessContext,
  roomSettings: VideoRoomSettings | null,
  /**
   * Anfitrion del evento de ESTA sala. Quien da la clase manda en SU clase:
   * puede grabar, mutear y moderar, sin volverse admin de toda la comunidad.
   * El poder es de la SALA, no del sistema.
   */
  eventHostId?: string | null,
  /**
   * Quien creo la sala. Cuando la sala NO cuelga de un evento (salas ad hoc,
   * salas de prueba), su creador es el anfitrion (5 sep 2026).
   */
  createdBy?: string | null,
): VideoPermissions {
  const settings = roomSettings;
  const userTier = user.tier;
  const anfitrionId = eventHostId ?? createdBy ?? null;
  const esAnfitrion = !!anfitrionId && anfitrionId === user.user_id;
  const userRole = esAnfitrion && !MODERATOR_ROLES.has(user.role) ? 'moderator' : user.role;

  // Admin/owner tiene acceso total
  if (isAdmin(userRole)) {
    return {
      can_join: true,
      can_activate_mic: true,
      can_activate_camera: true,
      can_screen_share: true,
      can_chat: true,
      can_raise_hand: true,
      can_view_recording: true,
      can_download_recording: true,
      can_start_call: true,
      can_mute_others: true,
      can_kick: true,
      can_create_breakout: true,
      can_start_recording: true,
      hand_raise_priority: 'vip',
    };
  }

  const requiredTier = settings?.required_tier ?? 'standard';
  const isVip = userTier === 'vip';
  const hasTierAccess = meetsTierRequirement(userTier, requiredTier);

  // All members with valid tier get full media access
  return {
    can_join: hasTierAccess,
    can_activate_mic: hasTierAccess,
    can_activate_camera: hasTierAccess,
    can_screen_share: hasTierAccess && (settings?.allow_screen_share ?? true),
    can_chat: hasTierAccess && (settings?.allow_chat ?? true),
    can_raise_hand: hasTierAccess && (settings?.allow_hand_raise ?? true),
    can_view_recording: hasTierAccess,
    can_download_recording: isVip,
    // LA SALA ABRE ANTES DEL ANFITRION: cualquiera con acceso puede abrirla
    // (si dependiera del rol, un anfitrion `member` veria "Esperando al
    // anfitrion" en su propia clase). La VENTANA (minutos antes de la hora
    // programada hasta el cierre) la aplica el servidor en
    // /api/video-calling/token, no este flag.
    can_start_call: hasTierAccess,
    can_mute_others: isModerator(userRole),
    can_kick: isModerator(userRole),
    can_create_breakout: false,
    can_start_recording: isModerator(userRole),
    hand_raise_priority: isVip ? 'vip' : 'normal',
  };
}

// ============================================
// GAMIFICATION POINTS
// ============================================

/** Puntos por asistir a una llamada */
export const POINTS_CALL_ATTENDANCE = 5;

/** Puntos por participar activamente (hablar) */
export const POINTS_CALL_ACTIVE_PARTICIPATION = 3;

/** Minutos minimos para contar como asistencia */
export const MIN_ATTENDANCE_MINUTES = 5;
