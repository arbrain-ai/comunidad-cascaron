// ============================================
// VIDEO CALLING - TYPE DEFINITIONS (CONTRACT)
// ============================================
// Este archivo es el CONTRATO compartido entre todos los agentes.
// Backend, Frontend, Database - todos importan de aqui.
// Cuando las tablas se creen en Supabase, estos tipos se pueden
// reemplazar por Tables<'video_rooms'> etc.

// ============================================
// ENUMS / UNIONS
// ============================================

/** Tipo de sala de video */
export type RoomType = 'event' | 'adhoc' | 'breakout';

/** Estado de la sala */
export type RoomStatus = 'idle' | 'active' | 'ended';

/** Rol del participante en la llamada */
export type ParticipantRole = 'host' | 'co_host' | 'speaker' | 'participant' | 'viewer';

/** Estado de grabacion de la sesion */
export type SessionRecordingStatus = 'none' | 'recording' | 'processing' | 'ready' | 'failed';

/** Estado del archivo de grabacion */
export type RecordingFileStatus = 'recording' | 'uploading' | 'ready' | 'failed';

/** Tipo de grabacion */
export type RecordingType = 'composite' | 'individual' | 'screen_only';

/** Calidad de grabacion */
export type RecordingQuality = '480p' | '720p' | '1080p';

/** Estado de transcripcion */
export type TranscriptStatus = 'pending' | 'processing' | 'ready' | 'failed';

/** Prioridad de hand raise */
export type HandRaisePriority = 'normal' | 'vip';

/** Estado de breakout room */
export type BreakoutStatus = 'pending' | 'active' | 'closed';

/** Layout de video */
export type VideoLayoutMode = 'gallery' | 'speaker' | 'presentation';

/** Calidad de conexion */
export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'lost';

// ============================================
// DATABASE ROW TYPES
// ============================================

/** video_rooms - Definicion permanente de salas (reutilizable) */
export interface VideoRoom {
  id: string;
  event_id: string | null;
  name: string;
  slug: string;
  created_by: string;
  room_type: RoomType;
  max_participants: number;
  settings: Record<string, unknown>;
  status: RoomStatus;
  livekit_room_name: string | null;
  created_at: string;
  updated_at: string;
}

/** video_sessions - Cada activacion de una sala (historial) */
export interface VideoSession {
  id: string;
  room_id: string;
  started_at: string;
  ended_at: string | null;
  peak_participants: number;
  total_unique_participants: number;
  recording_status: SessionRecordingStatus;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** video_participants - Quien entro a cada sesion */
export interface VideoParticipant {
  id: string;
  session_id: string;
  user_id: string;
  role: ParticipantRole;
  joined_at: string;
  left_at: string | null;
  had_video: boolean;
  had_audio: boolean;
  had_screen_share: boolean;
  device_info: Record<string, unknown>;
  connection_quality_avg: number | null;
  points_awarded: number;
  created_at: string;
  /** Conexion de LiveKit (una fila por conexion desde el 2 sep 2026). */
  participant_sid?: string | null;
  /** true en las filas historicas cuyo left_at no es confiable (no se inventa duracion). */
  left_at_unreliable?: boolean | null;
  nota_calidad?: string | null;
}

/** Estado del procesamiento AI */
export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

/** video_recordings - Archivos de grabacion */
export interface VideoRecording {
  id: string;
  session_id: string;
  storage_path: string | null;
  storage_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  summary_text: string | null;
  transcript_text: string | null;
  diarized_transcript: string | null;
  action_items: TranscriptActionItem[];
  community_post_id: string | null;
  processing_status: ProcessingStatus;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  format: string;
  recording_type: RecordingType;
  egress_id: string | null;
  status: RecordingFileStatus;
  created_at: string;
}

/** video_transcripts - Transcripciones procesadas por AI */
export interface VideoTranscript {
  id: string;
  recording_id: string | null;
  session_id: string;
  raw_transcript: string | null;
  diarized_transcript: string | null;
  summary: string | null;
  summary_short: string | null;
  topics: string[];
  action_items: TranscriptActionItem[];
  sentiment_score: number | null;
  language: string;
  model_used: string | null;
  processing_time_ms: number | null;
  auto_published_post_id: string | null;
  status: TranscriptStatus;
  created_at: string;
}

/** Recording con datos de sesion y sala para la galeria */
export interface RecordingWithDetails extends VideoRecording {
  session: {
    id: string;
    started_at: string;
    ended_at: string | null;
    peak_participants: number;
    room: {
      id: string;
      name: string;
      slug: string;
    };
  };
  participant_count: number;
}

/** video_hand_raises - Historial de manos levantadas */
export interface VideoHandRaise {
  id: string;
  session_id: string;
  user_id: string;
  raised_at: string;
  acknowledged_at: string | null;
  lowered_at: string | null;
  was_addressed: boolean;
  position_in_queue: number | null;
  priority: HandRaisePriority;
  created_at: string;
}

/** video_breakout_rooms - Salas de breakout */
export interface VideoBreakoutRoom {
  id: string;
  parent_session_id: string;
  name: string;
  topic: string | null;
  max_participants: number | null;
  livekit_room_name: string | null;
  auto_return_seconds: number | null;
  status: BreakoutStatus;
  created_at: string;
}

/** video_breakout_assignments - Asignacion a breakout rooms */
export interface VideoBreakoutAssignment {
  id: string;
  breakout_room_id: string;
  user_id: string;
  assigned_at: string;
  joined_at: string | null;
  returned_at: string | null;
}

/** video_room_settings - Configuracion por sala */
export interface VideoRoomSettings {
  id: string;
  room_id: string;
  allow_hand_raise: boolean;
  allow_chat: boolean;
  allow_screen_share: boolean;
  allow_recording: boolean;
  require_recording_consent: boolean;
  auto_record: boolean;
  max_duration_minutes: number | null;
  min_level_for_camera: number;
  min_level_for_mic: number;
  min_level_for_screen_share: number;
  required_tier: string;
  layout_default: VideoLayoutMode;
  waiting_room_enabled: boolean;
  mute_on_join: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// JOINED / ENRICHED TYPES
// ============================================

/** Sala con su configuracion y datos del creador */
export interface VideoRoomWithDetails extends VideoRoom {
  creator: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  room_settings: VideoRoomSettings | null;
  active_session: VideoSession | null;
  participant_count: number;
}

/** Participante con datos de perfil */
export interface VideoParticipantWithProfile extends VideoParticipant {
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    current_level: number | null;
    tier: string;
    role: string;
  };
}

/** Sesion con datos completos */
export interface VideoSessionWithDetails extends VideoSession {
  room: VideoRoom;
  participants: VideoParticipantWithProfile[];
  recordings: VideoRecording[];
  transcript: VideoTranscript | null;
}

/** Hand raise con datos de perfil (para la cola visible) */
export interface VideoHandRaiseWithProfile extends VideoHandRaise {
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    current_level: number | null;
    tier: string;
  };
}

// ============================================
// INPUT TYPES (Service Layer)
// ============================================

/** Input para crear una sala */
export interface CreateRoomInput {
  name: string;
  event_id?: string;
  room_type?: RoomType;
  max_participants?: number;
  settings?: Partial<Omit<VideoRoomSettings, 'id' | 'room_id' | 'created_at' | 'updated_at'>>;
}

/** Input para unirse a una sala */
export interface JoinRoomInput {
  room_id: string;
  user_id: string;
}

/** Input para crear breakout rooms */
export interface CreateBreakoutInput {
  session_id: string;
  rooms: {
    name: string;
    topic?: string;
    max_participants?: number;
    auto_return_seconds?: number;
    assigned_user_ids?: string[];
  }[];
}

/** Input para iniciar grabacion */
export interface StartRecordingInput {
  session_id: string;
  recording_type?: RecordingType;
}

// ============================================
// LIVEKIT TOKEN TYPES
// ============================================

/** Payload para generar token de LiveKit */
export interface LiveKitTokenPayload {
  room_name: string;
  participant_identity: string;
  participant_name: string;
  participant_metadata?: string;
  can_publish: boolean;
  can_subscribe: boolean;
  can_publish_data: boolean;
  /** Fuentes permitidas (camara, microfono, pantalla). Vacio/undefined = todas. */
  can_publish_sources?: import('livekit-server-sdk').TrackSource[];
}

/** Respuesta del endpoint de token */
export interface LiveKitTokenResponse {
  entry_attempt_id?: string | null;
  token: string;
  ws_url: string;
  room_name: string;
}

// ============================================
// REALTIME / UI STATE TYPES
// ============================================

/** Categories of file we render specially in the chat. */
export type InCallAttachmentType = 'image' | 'document';

/** Attachment payload appended to a chat message. The file lives in the
 * `post-attachments` bucket (public + UUID filename = unguessable). */
export interface InCallChatAttachment {
  url: string;
  type: InCallAttachmentType;
  name: string;
  size: number;
  mime: string;
}

/** Estado del chat en la llamada (Supabase Realtime) */
export interface InCallChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  content: string;
  timestamp: string;
  /** True for the pinned welcome message (not broadcastable) */
  is_pinned?: boolean;
  /** Optional file attached. Image renders inline, document as card. */
  attachment?: InCallChatAttachment;
}

/** Estado de la sala en tiempo real */
export interface RoomRealtimeState {
  room_id: string;
  session_id: string | null;
  status: RoomStatus;
  participant_count: number;
  is_recording: boolean;
  active_speaker_id: string | null;
  active_screen_share_id: string | null;
  hand_raise_queue: VideoHandRaiseWithProfile[];
}

/** Estado local del UI de video */
export interface VideoUIState {
  layout: VideoLayoutMode;
  is_sidebar_open: boolean;
  sidebar_tab: 'participants' | 'chat' | 'hand_raises';
  is_fullscreen: boolean;
  pinned_participant_id: string | null;
  show_recording_consent: boolean;
  connection_quality: ConnectionQuality;
}

/** Estado de los dispositivos locales del usuario */
export interface LocalMediaState {
  is_audio_enabled: boolean;
  is_video_enabled: boolean;
  is_screen_sharing: boolean;
  selected_audio_input: string | null;
  selected_video_input: string | null;
  selected_audio_output: string | null;
  available_audio_inputs: MediaDeviceInfo[];
  available_video_inputs: MediaDeviceInfo[];
  available_audio_outputs: MediaDeviceInfo[];
}

// ============================================
// PERMISSION TYPES
// ============================================

/** Permisos calculados para un usuario en una sala */
export interface VideoPermissions {
  can_join: boolean;
  can_activate_mic: boolean;
  can_activate_camera: boolean;
  can_screen_share: boolean;
  can_chat: boolean;
  can_raise_hand: boolean;
  can_view_recording: boolean;
  can_download_recording: boolean;
  can_start_call: boolean;
  can_mute_others: boolean;
  can_kick: boolean;
  can_create_breakout: boolean;
  can_start_recording: boolean;
  hand_raise_priority: HandRaisePriority;
}

/** Datos del usuario necesarios para calcular permisos */
export interface UserAccessContext {
  user_id: string;
  role: string;       // 'admin' | 'owner' | 'moderator' | 'member'
  tier: string;       // 'standard' | 'vip'
  current_level: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/** Respuesta estandar de API */
export interface VideoApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Respuesta del webhook de LiveKit */
export interface LiveKitWebhookEvent {
  event: string;
  room?: {
    sid: string;
    name: string;
    num_participants: number;
  };
  participant?: {
    sid: string;
    identity: string;
    state: string;
  };
  egress_info?: {
    egress_id: string;
    status: string;
    room_name: string;
    file?: {
      filename: string;
      duration: number;
      size: number;
    };
  };
}

// ============================================
// TRANSCRIPT AI TYPES
// ============================================

/** Action item extraido por AI */
export interface TranscriptActionItem {
  text: string;
  assignee?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
}

/** Resultado del procesamiento AI de transcripcion */
export interface TranscriptAIResult {
  summary: string;
  summary_short: string;
  topics: string[];
  action_items: TranscriptActionItem[];
  sentiment_score: number;
  language: string;
}
