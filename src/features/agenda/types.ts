export type EstadoInstancia = 'programado' | 'cancelado';

/** Una clase concreta, con su serie y su anfitrion ya resueltos. */
export interface Clase {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  duration_minutes: number | null;
  timezone: string | null;
  status: EstadoInstancia;
  is_exception: boolean;
  cancel_reason?: string | null;
  cover_image_url: string | null;
  google_meet_link: string | null;   // vacio = sala propia
  required_level: number | null;
  visible_to_tier: string | null;
  series_id: string | null;
  serie?: { id: string; title: string; rrule: string; status: string } | null;
  anfitrion?: { id: string; full_name: string; avatar_url: string | null } | null;
  /** el miembro pidio que le avisen */
  recordatorio?: boolean;
  /** grabacion ya publicada (nativa o externa) */
  grabacion_url?: string | null;
  /** hay una sesion de la sala propia ABIERTA para esta clase: manda sobre el reloj */
  sala_viva?: { session_id: string; started_at: string } | null;
}

export interface Serie {
  id: string;
  title: string;
  description: string | null;
  rrule: string;
  timezone: string;
  duration_minutes: number;
  host_id: string;
  status: 'activa' | 'cerrada';
  use_native_room: boolean;
}

/** Un dia de la agenda, ya agrupado en la zona del miembro. */
export interface DiaAgenda {
  clave: string;        // YYYY-MM-DD en zona del miembro
  titulo: string;       // "Hoy" | "Mañana" | "lunes 8 de septiembre"
  relativo: boolean;
  esHoy: boolean;
  clases: Clase[];
}
