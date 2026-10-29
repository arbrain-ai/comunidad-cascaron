'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  CalendarBlank,
  Clock,
  Lightning,
  ArrowsClockwise,
  VideoCamera,
  Play,
  MusicNotes,
  Lock,
  ArrowUpRight,
} from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { EventWithCreator } from '../types';
import { formatDateLong, formatTime, formatDuration } from '../utils/dateHelpers';
import { getRecurrenceDescription } from '../utils/recurrenceHelpers';
import { getRoomForEvent, getOrCreateRoomForEvent } from '@/features/video-calling/services/eventBridgeService';
import { useToast } from '@/shared/hooks/useToast';
import type { VideoRoom } from '@/features/video-calling/types';

interface EventDetailProps {
  event: EventWithCreator;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  isAdmin?: boolean;
  userId?: string;
}

export function EventDetail({
  event,
  onClose,
  onEdit,
  onDelete,
  showActions = false,
  isAdmin = false,
  userId,
}: EventDetailProps) {
  const router = useRouter();
  const { showError } = useToast();

  // Gate por NIVEL: el evento se VE (el deseo se enseña) pero la foto lleva
  // candado y la sala no abre para quien no alcanza el nivel. Admin/owner pasan.
  // Los VIP pasan por grant: acceso a la sala SIN portar el nivel
  // — el leaderboard sigue siendo pura meritocracia.
  // `required_level` llega de la BD; los tipos generados aún no la conocen.
  const { userProfile } = useUserProfile();
  const nivelRequerido = ((event as unknown as { required_level?: number }).required_level) ?? 1;
  const esStaff = userProfile?.role === 'admin' || userProfile?.role === 'owner';
  const esVip = userProfile?.tier === 'vip';
  const bloqueadoPorNivel =
    nivelRequerido > 1 && !esStaff && !esVip &&
    (userProfile?.current_level ?? 1) < nivelRequerido;
  const [videoRoom, setVideoRoom] = useState<VideoRoom | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Join window: members can enter the room from 10 min before start_time
  // until the event end (start_time + duration_minutes). Matches banner copy.
  const JOIN_WINDOW_MINUTES = 10;
  const [isWithinCallWindow, setIsWithinCallWindow] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!event.start_time) return;

    let interval: ReturnType<typeof setInterval>;

    function formatCountdown(diffMs: number): string {
      if (diffMs <= 0) return 'ahora';
      const totalSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const hours = Math.floor(minutes / 60);
      if (minutes < JOIN_WINDOW_MINUTES) {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
      }
      if (minutes < 60) return `${minutes} min`;
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
    }

    function tick() {
      const now = Date.now();
      const eventStart = new Date(event.start_time!).getTime();
      const durationMs = (event.duration_minutes || 60) * 60 * 1000;
      const eventEnd = eventStart + durationMs;
      const windowStart = eventStart - JOIN_WINDOW_MINUTES * 60 * 1000;

      const live = now >= eventStart && now <= eventEnd;
      const ended = now > eventEnd;
      const within = now >= windowStart && now <= eventEnd;

      setIsLive(live);
      setHasEnded(ended);
      setIsWithinCallWindow(within);

      if (live) {
        setCountdownLabel(formatCountdown(eventEnd - now));
      } else if (ended) {
        setCountdownLabel(null);
      } else {
        setCountdownLabel(formatCountdown(eventStart - now));
      }

      // Adaptive tick: 1s when the join window is close, 60s otherwise.
      const msToStart = eventStart - now;
      const useFastTick =
        live || within || (msToStart > 0 && msToStart <= (JOIN_WINDOW_MINUTES + 1) * 60 * 1000);
      const desired = useFastTick ? 1000 : 60000;
      if (interval) clearInterval(interval);
      interval = setInterval(tick, desired);
    }

    tick();
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [event.start_time, event.duration_minutes]);

  // Check if event has a linked video room
  useEffect(() => {
    async function checkVideoRoom() {
      try {
        const room = await getRoomForEvent(event.id);
        setVideoRoom(room);
      } catch {
        // No room found, that's ok
      }
    }
    checkVideoRoom();
  }, [event.id]);

  // Admin: create video room for this event
  const handleCreateRoom = async () => {
    if (!userId || isCreatingRoom) return;
    setIsCreatingRoom(true);
    try {
      const room = await getOrCreateRoomForEvent(event.id);
      setVideoRoom(room);
    } catch (err) {
      console.error('Error creating video room:', err);
      showError(err instanceof Error ? err.message : 'No pudimos preparar la sala. Intenta de nuevo.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Navigate to call page. If the room doesn't exist yet, create it on the fly
  // (get-or-create is idempotent), so any user hitting "Entrar" for the first
  // time bootstraps the room.
  const handleJoinCall = async () => {
    let room = videoRoom;
    if (!room && userId) {
      try {
        setIsCreatingRoom(true);
        room = await getOrCreateRoomForEvent(event.id);
        setVideoRoom(room);
      } catch (err) {
        console.error('Error ensuring video room:', err);
        showError(err instanceof Error ? err.message : 'No pudimos abrir la sala. Intenta de nuevo.');
        return;
      } finally {
        setIsCreatingRoom(false);
      }
    }
    if (room) {
      router.push(`/call/${room.slug}`);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="titanium-panel rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover Image */}
        {event.cover_image_url && (
          <div className="relative w-full aspect-video">
            <img
              src={event.cover_image_url}
              alt={event.title}
              className={`w-full h-full object-cover ${bloqueadoPorNivel ? 'opacity-60 saturate-50' : ''}`}
            />
            {bloqueadoPorNivel && (
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center">
                <span className="flex items-center gap-2 px-4 py-2 rounded-full border border-gold/40 bg-black/70 text-gold text-sm font-bold uppercase tracking-wide">
                  <Lock size={16} weight="fill" />
                  Exclusiva Nivel {nivelRequerido}
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="icon-btn absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        )}

        <div className="p-6 space-y-4">
          {/* Close button if no cover */}
          {!event.cover_image_url && (
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="icon-btn p-2 rounded-lg text-muted"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
          )}

          {/* Title */}
          <h2 className="text-2xl font-bold text-foreground">
            {event.title}
          </h2>

          {/* Date & Time */}
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <span className="flex items-center gap-2">
              <CalendarBlank size={18} weight="duotone" />
              {formatDateLong(event.start_time)}
            </span>

            <span className="flex items-center gap-2">
              <Clock size={18} weight="duotone" />
              {formatTime(event.start_time)}
            </span>

            {event.duration_minutes && (
              <span className="flex items-center gap-2">
                <Lightning size={18} weight="duotone" />
                {formatDuration(event.duration_minutes)}
              </span>
            )}
          </div>

          {/* Recurrence Info */}
          {event.is_recurring && event.recurrence_pattern && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <ArrowsClockwise size={18} weight="duotone" />
              {getRecurrenceDescription(event.recurrence_pattern as unknown as import('../types').RecurrencePattern)}
            </div>
          )}

          {/* Session window notice: the room unlocks 10 min early. */}
          {(() => {
            if (!event.start_time) return null;
            const start = new Date(event.start_time);
            const windowStart = new Date(start.getTime() - 10 * 60 * 1000);
            const fmt = (d: Date) =>
              d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            return (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">🔔</span>
                  <span className="text-foreground/90">
                    La sala se abre a las{' '}
                    <strong className="text-primary">{fmt(windowStart)}</strong>{' '}
                    <span className="text-muted">(10 min antes)</span>
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Description */}
          {event.description && (
            <div className="prose prose-sm prose-invert max-w-none">
              <p className="text-muted whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* Videollamada nativa. Eventos SIN google_meet_link usan la sala propia;
              eventos CON link siguen saliendo por Meet (switch por evento).
              Mismo state machine: future → window_open (-10 min) → live → ended. */}
          {/* Bloqueado por nivel: la sala no existe para ti todavía — y se dice cómo subir */}
          {bloqueadoPorNivel && (
            <div className="w-full flex flex-col items-center gap-2 px-4 py-4 rounded-xl bg-surface/50 border border-gold/25 text-sm text-muted">
              <div className="flex items-center gap-2 text-foreground/90">
                <Lock size={18} weight="duotone" className="text-gold" />
                <span>
                  Esta clase es del <strong className="text-gold">Nivel {nivelRequerido}</strong> — grupo chico
                </span>
              </div>
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-1 text-xs font-medium text-gold/90 hover:text-gold transition-colors"
              >
                Se sube construyendo · ¿cómo subo?
                <ArrowUpRight size={12} />
              </Link>
            </div>
          )}

          {!bloqueadoPorNivel && !event.google_meet_link && (() => {
            if (hasEnded) {
              return (
                <div className="w-full flex items-center gap-3 justify-center px-4 py-3 rounded-xl bg-surface/50 border border-border text-sm text-muted">
                  <VideoCamera size={20} weight="duotone" />
                  <span>La clase terminó.</span>
                </div>
              );
            }

            if (isLive) {
              return (
                <button
                  onClick={handleJoinCall}
                  disabled={isCreatingRoom}
                  className="w-full flex items-center gap-3 justify-center px-6 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-semibold transition-colors"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                  </span>
                  <VideoCamera size={20} weight="duotone" />
                  EN VIVO · Entrar a la clase
                </button>
              );
            }

            if (isWithinCallWindow) {
              return (
                <button
                  onClick={handleJoinCall}
                  disabled={isCreatingRoom}
                  className="w-full flex items-center gap-2 justify-center px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold transition-colors"
                >
                  <VideoCamera size={20} weight="duotone" />
                  Entrar ahora
                  {countdownLabel && (
                    <span className="opacity-80 font-normal text-sm">
                      (inicia en {countdownLabel})
                    </span>
                  )}
                </button>
              );
            }

            return (
              <div className="w-full flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-surface/50 border border-border text-sm text-muted">
                <div className="flex items-center gap-3">
                  <VideoCamera size={20} weight="duotone" />
                  <span>
                    Podrás unirte en{' '}
                    <span className="text-primary font-semibold">
                      {countdownLabel ?? '—'}
                    </span>
                  </span>
                </div>
                <span className="text-xs">
                  La videollamada se activa 10 minutos antes
                </span>
              </div>
            );
          })()}

          {/* Meet join CTA with time-window gating.
              Same state machine as the legacy LiveKit flow: future → window
              opens 10 min before start → live during the event → ended after.
              Solo para eventos que SI tienen link de Meet (legacy / externos). */}
          {!bloqueadoPorNivel && event.google_meet_link && (() => {
            const meetLink = event.google_meet_link;

            if (hasEnded) {
              return (
                <div className="w-full flex items-center gap-3 justify-center px-4 py-3 rounded-xl bg-surface/50 border border-border text-sm text-muted">
                  <VideoCamera size={20} weight="duotone" />
                  <span>La clase terminó.</span>
                </div>
              );
            }

            if (isLive) {
              return meetLink ? (
                <a
                  href={meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 justify-center px-6 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                  </span>
                  <VideoCamera size={20} weight="duotone" />
                  EN VIVO · Entrar por Google Meet
                </a>
              ) : (
                <div className="w-full flex items-start gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 text-sm">
                  <VideoCamera size={20} weight="duotone" className="text-warning flex-shrink-0 mt-0.5" />
                  <span className="text-warning">
                    El evento ya empezó pero el organizador aún no agregó el link de Google Meet.
                    {isAdmin && ' Edita el evento y pega el link para habilitar el acceso.'}
                  </span>
                </div>
              );
            }

            if (isWithinCallWindow) {
              return meetLink ? (
                <a
                  href={meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 justify-center px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
                >
                  <VideoCamera size={20} weight="duotone" />
                  Entrar por Google Meet
                  {countdownLabel && (
                    <span className="opacity-80 font-normal text-sm">
                      (inicia en {countdownLabel})
                    </span>
                  )}
                </a>
              ) : (
                <div className="w-full flex items-start gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 text-sm">
                  <VideoCamera size={20} weight="duotone" className="text-warning flex-shrink-0 mt-0.5" />
                  <span className="text-warning">
                    El organizador aún no agregó el link de Google Meet.
                    {isAdmin && ' Edita el evento y pega el link para habilitar el acceso.'}
                  </span>
                </div>
              );
            }

            // Future: countdown chip, disabled. Mention the 10-min unlock.
            return (
              <div className="w-full flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-surface/50 border border-border text-sm text-muted">
                <div className="flex items-center gap-3">
                  <VideoCamera size={20} weight="duotone" />
                  <span>
                    Podrás unirte en{' '}
                    <span className="text-primary font-semibold">
                      {countdownLabel ?? '—'}
                    </span>
                  </span>
                </div>
                <span className="text-xs">
                  La videollamada se activa 10 minutos antes
                </span>
              </div>
            );
          })()}

          {/* Link a la grabacion (events.recording_url) */}
          {event.recording_url && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-primary-hover">
                <MusicNotes size={16} weight="duotone" />
                <span className="font-medium">Grabación disponible</span>
              </div>
              <a
                href={event.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-recording text-sm"
              >
                <Play size={18} weight="duotone" />
                Ver grabación
              </a>
            </div>
          )}

          {/* Creator Info */}
          {event.creator && (
            <div className="flex items-center gap-3 pt-4 border-t border-border/20">
              {event.creator.avatar_url ? (
                <img
                  src={event.creator.avatar_url}
                  alt={event.creator.full_name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-primary">
                    {event.creator.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {event.creator.full_name}
                </p>
                <p className="text-xs text-muted">Organizador</p>
              </div>
            </div>
          )}

          {/* Actions */}
          {showActions && (onEdit || onDelete) && (
            <div className="flex justify-end gap-3 pt-4 border-t border-border/20">
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="btn-danger text-sm"
                >
                  Eliminar
                </button>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="btn-primary text-sm"
                >
                  Editar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
