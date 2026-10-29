// ============================================
// VIDEO CALLING - LIVEKIT CONFIGURATION
// ============================================
// Configuracion de conexion a LiveKit server (self-hosted o LiveKit Cloud).
// Todas las URLs vienen de variables de entorno; no hay hosts por defecto.

// ============================================
// ENVIRONMENT VARIABLES
// ============================================

/**
 * URL WebSocket del servidor LiveKit que usa el navegador.
 * Ej: wss://livekit.tu-dominio.com
 */
export const LIVEKIT_WS_URL = (process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || '').trim();

/**
 * URL HTTP del servidor LiveKit (para API calls server-side).
 * Ej: https://livekit.tu-dominio.com
 */
export const LIVEKIT_API_URL = (process.env.LIVEKIT_API_URL || '').trim();

/**
 * API Key de LiveKit (server-side only).
 * Se genera al configurar el servidor LiveKit.
 */
export const LIVEKIT_API_KEY = (process.env.LIVEKIT_API_KEY || '').trim();

/**
 * API Secret de LiveKit (server-side only, NEVER expose to client).
 */
export const LIVEKIT_API_SECRET = (process.env.LIVEKIT_API_SECRET || '').trim();

// ============================================
// ROOM DEFAULTS
// ============================================

/** Tiempo maximo de un token de LiveKit (segundos) */
export const TOKEN_TTL_SECONDS = 6 * 60 * 60; // 6 horas

/** Tiempo antes de expiracion para refrescar token (segundos) */
export const TOKEN_REFRESH_BEFORE_SECONDS = 10 * 60; // 10 minutos

/** Maximo de participantes por sala (ajustalo a la capacidad de tu servidor) */
export const MAX_ROOM_PARTICIPANTS = 200;

/** Timeout para conexion WebSocket (ms) */
export const WS_CONNECT_TIMEOUT_MS = 15000;

/** Intervalo de reconnect (ms) */
export const WS_RECONNECT_INTERVAL_MS = 3000;

/** Maximo intentos de reconnect */
export const WS_MAX_RECONNECT_ATTEMPTS = 10;

// ============================================
// MEDIA DEFAULTS
// ============================================

/** Resolucion de video por defecto */
export const DEFAULT_VIDEO_RESOLUTION = {
  width: 640,
  height: 360,
} as const;

/** FPS de video por defecto */
export const DEFAULT_VIDEO_FPS = 24;

/** Bitrate maximo de video (kbps) */
export const MAX_VIDEO_BITRATE_KBPS = 1200;

/** Resolucion de screen share */
export const SCREEN_SHARE_RESOLUTION = {
  width: 1920,
  height: 1080,
} as const;

/** FPS de screen share */
export const SCREEN_SHARE_FPS = 15;

// ============================================
// RECORDING DEFAULTS
// ============================================

/** Supabase Storage bucket para grabaciones */
export const RECORDINGS_BUCKET = 'video-recordings';

/** Formato de grabacion por defecto */
export const DEFAULT_RECORDING_FORMAT = 'mp4';

/**
 * Presets de calidad de grabacion. El preset default '480p' prioriza
 * estabilidad del egress sobre calidad visual en sesiones largas.
 */
export const RECORDING_PRESETS = {
  '480p': {
    width: 854,
    height: 480,
    framerate: 24,
    videoBitrate: 1000,
    audioBitrate: 128,
  },
  '720p': {
    width: 1280,
    height: 720,
    framerate: 24,
    videoBitrate: 1800,
    audioBitrate: 128,
  },
  '1080p': {
    width: 1920,
    height: 1080,
    framerate: 24,
    videoBitrate: 3000,
    audioBitrate: 192,
  },
} as const;

/** Preset por defecto: 480p consume ~50% menos CPU del egress que 720p. */
export const DEFAULT_RECORDING_QUALITY: keyof typeof RECORDING_PRESETS = '480p';

// ============================================
// REALTIME CHANNELS
// ============================================
// Consolidated: room + chat + reactions share a single broadcast channel per room.
// Hand raises use a separate postgres_changes channel (requires DB subscription).
// This reduces from 4 channels to 2 per participant (saves WebSocket connections).

/** Prefijo para canales de Supabase Realtime de video */
export const REALTIME_CHANNEL_PREFIX = 'video:';

/** Canal consolidado para broadcast (room state, chat, reactions) */
export function getRoomChannel(roomId: string): string {
  return `${REALTIME_CHANNEL_PREFIX}room:${roomId}`;
}

/**
 * @deprecated Use getRoomChannel() with event 'chat_message' instead.
 * Kept for backward compatibility during migration.
 */
export function getChatChannel(sessionId: string): string {
  return `${REALTIME_CHANNEL_PREFIX}chat:${sessionId}`;
}

/** Canal para hand raises (postgres_changes - requires separate channel) */
export function getHandRaiseChannel(sessionId: string): string {
  return `${REALTIME_CHANNEL_PREFIX}hands:${sessionId}`;
}
