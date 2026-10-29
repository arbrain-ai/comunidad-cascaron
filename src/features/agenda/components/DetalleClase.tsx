'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X, Clock, ArrowsClockwise, VideoCamera, Play, Lock,
  Bell, BellRinging, Globe, ArrowUpRight, LinkSimple, Check,
} from '@phosphor-icons/react/dist/ssr';
import type { Clase } from '../types';
import {
  fechaCompleta, rangoHorario, etiquetaCortaZona, duracionHumana,
  describirRegla, faltan, nombreDeZona, capitalizarFrase,
} from '../lib/tiempo';
import { leerReloj, cadenciaTick, MINUTOS_ANTES_DE_ABRIR } from '../lib/estado';

interface Props {
  clase: Clase;
  zona: string;
  bloqueada: boolean;
  onCerrar: () => void;
  onEntrar: () => void;
  onRecordar: (on: boolean) => void;
}

export function DetalleClase({ clase, zona, bloqueada, onCerrar, onEntrar, onRecordar }: Props) {
  const cancelada = clase.status === 'cancelado';
  const salaViva = !!clase.sala_viva;
  const [reloj, setReloj] = useState(() => leerReloj(clase.start_time, clase.duration_minutes, cancelada, Date.now(), salaViva));

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const r = leerReloj(clase.start_time, clase.duration_minutes, cancelada, Date.now(), salaViva);
      setReloj(r); t = setTimeout(tick, cadenciaTick(r));
    };
    tick(); return () => clearTimeout(t);
  }, [clase.start_time, clase.duration_minutes, cancelada, salaViva]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCerrar]);

  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/calendar?event=${clase.id}` : '';

  // COPIAR EL ENLACE — el caso de "¿me pasas el link?" en un chat.
  // Se comparte el enlace del EVENTO, no el de la sala (/call/<slug>), a
  // proposito: el del evento explica QUE es y CUANDO, existe aunque la sala
  // todavia no se haya creado, y a quien no es miembro le enseña la puerta en
  // vez de darle un 403 pelon. El candado sigue siendo la membresia: /call
  // exige sesion + has_community_access, asi que nadie entra por tener el link.
  const [copiado, setCopiado] = useState(false);
  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch { /* el navegador puede negar el portapapeles sin gesto */ }
  };

  const regla = describirRegla(clase.serie?.rrule ?? null);
  const enVivo = reloj.estado === 'en_vivo';

  return (
    <div className="pb-barra-movil fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-4"
         onClick={onCerrar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="titanium-panel max-h-[calc(100vh-140px)] w-full overflow-y-auto rounded-t-3xl
                   sm:max-h-[92vh] sm:max-w-[520px] sm:rounded-2xl"
      >
        {clase.cover_image_url && (
          <div className="relative aspect-[16/9] w-full">
            <img src={clase.cover_image_url} alt=""
                 className={`h-full w-full object-cover ${bloqueada ? 'opacity-55 saturate-50' : ''}`} />
            {bloqueada && (
              <div className="absolute inset-0 grid place-items-center bg-black/45 backdrop-blur-[2px]">
                <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-black/70 px-4 py-2 text-sm font-bold uppercase tracking-wide text-gold">
                  <Lock size={15} weight="fill" /> Nivel {clase.required_level}
                </span>
              </div>
            )}
            <button onClick={onCerrar} aria-label="Cerrar"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75">
              <X size={16} weight="bold" />
            </button>
          </div>
        )}

          <div className="flex flex-col gap-4 p-5 pb-8 sm:p-6">
          {!clase.cover_image_url && (
            <div className="flex justify-end">
              <button onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-muted hover:text-foreground">
                <X size={18} weight="bold" />
              </button>
            </div>
          )}

          <h2 className="text-[22px] font-bold leading-tight text-foreground">{clase.title}</h2>

          {/* Fecha COMPLETA con año, hora con RANGO y ZONA nombrada. */}
          <div className="flex flex-col gap-1.5 text-[14px]">
            <p className="text-foreground/90">{capitalizarFrase(fechaCompleta(clase.start_time, zona))}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
              <Clock size={15} weight="duotone" />
              <span className="tabular-nums text-foreground/90">
                {rangoHorario(clase.start_time, clase.duration_minutes, zona)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-card/70 px-1.5 py-0.5 text-[12px]">
                <Globe size={11} weight="duotone" />
                {nombreDeZona(zona)} {etiquetaCortaZona(zona)}
              </span>
              <span className="opacity-60">· {duracionHumana(clase.duration_minutes)}</span>
            </p>
            {regla && (
              <p className="flex items-center gap-1.5 text-[13px] text-primary">
                <ArrowsClockwise size={14} weight="duotone" /> Se repite {regla}
              </p>
            )}
          </div>

          {clase.anfitrion && (
            <div className="flex items-center gap-3 border-b border-border/25 pb-4">
              {clase.anfitrion.avatar_url ? (
                <img src={clase.anfitrion.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                  {clase.anfitrion.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{clase.anfitrion.full_name}</p>
                <p className="text-xs text-muted">Anfitrión</p>
              </div>
            </div>
          )}

          {/* La accion principal, segun el reloj */}
          {bloqueada ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-gold/25 bg-surface/50 px-4 py-4 text-sm">
              <span className="flex items-center gap-2 text-foreground/90">
                <Lock size={16} weight="duotone" className="text-gold" />
                Esta clase es del <strong className="text-gold">Nivel {clase.required_level}</strong>
              </span>
              <Link href="/leaderboard" className="inline-flex items-center gap-1 text-xs font-medium text-gold/90 hover:text-gold">
                Se sube construyendo · ¿cómo subo? <ArrowUpRight size={11} />
              </Link>
            </div>
          ) : cancelada ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              Esta clase fue cancelada{clase.cancel_reason ? `: ${clase.cancel_reason}` : '.'}
            </div>
          ) : reloj.puedeEntrar ? (
            <div className="flex flex-col gap-1.5">
              <button onClick={onEntrar} className="btn-primary w-full !py-3">
                {enVivo && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                  </span>
                )}
                <VideoCamera size={19} weight="duotone" />
                {enVivo ? 'EN VIVO · Entrar a la clase' : `Entrar ahora · empieza ${faltan(reloj.msAlInicio)}`}
              </button>
              {/* La sesion manda sobre el reloj: si la clase se alarga, se dice. */}
              {salaViva && reloj.msAlFin < 0 && (
                <p className="text-center text-[12px] text-muted/80">
                  La clase sigue en curso, más allá de su horario. Puedes entrar.
                </p>
              )}
            </div>
          ) : reloj.estado === 'terminado' ? (
            clase.grabacion_url ? (
              <a href={clase.grabacion_url} target="_blank" rel="noopener noreferrer"
                 className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/15 px-6 py-3 font-semibold text-primary transition-colors hover:bg-primary/25">
                <Play size={18} weight="duotone" /> Ver la grabación
              </a>
            ) : (
              <div className="sup px-4 py-3 text-center text-sm text-muted">
                La clase terminó. La grabación aparecerá aquí cuando el anfitrión la publique.
              </div>
            )
          ) : (
            <div className="flex flex-col gap-2">
              <button onClick={() => onRecordar(!clase.recordatorio)} aria-pressed={!!clase.recordatorio}
                className={clase.recordatorio
                  ? 'flex w-full items-center justify-center gap-2 rounded-xl border border-primary/45 bg-primary/12 px-6 py-3 font-semibold text-primary transition-colors hover:bg-primary/20'
                  : 'btn-primary w-full !py-3'}>
                {clase.recordatorio
                  ? <><BellRinging size={18} weight="fill" /> Te aviso 15 min antes</>
                  : <><Bell size={18} weight="duotone" /> Recordarme</>}
              </button>
              <p className="text-center text-[12px] text-muted/70">
                La sala abre {MINUTOS_ANTES_DE_ABRIR} minutos antes · empieza {faltan(reloj.msAlInicio)}
              </p>
            </div>
          )}

          {/* Copiar el enlace: sirve tambien para clases pasadas (mandar la grabación) */}
          {!bloqueada && (
            <button onClick={copiarEnlace}
              className={copiado
                ? 'flex w-full items-center justify-center gap-1.5 rounded-xl border border-success/45 bg-success/10 px-3 py-2 text-[13px] font-medium text-success'
                : 'btn-secondary w-full !px-3 !py-2 !text-[13px]'}>
              {copiado
                ? <><Check size={15} weight="bold" /> ¡Enlace copiado!</>
                : <><LinkSimple size={15} weight="duotone" /> Copiar enlace para compartir</>}
            </button>
          )}

          {clase.description && (
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-muted">{clase.description}</p>
          )}

        </div>
      </div>
    </div>
  );
}
