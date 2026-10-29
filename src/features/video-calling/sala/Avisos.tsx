'use client';

// ============================================
// SALA v2 - lo que la sala te DICE: barra superior, banners, turno, fin
// ============================================
// Todo con texto, en español, sin siglas. La barra superior lleva el modo
// (Abierta / Clase), si se graba o no, y el reloj de cierre. Los banners
// explican el estado ("el anfitrion no ha llegado", "levanta la mano").

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { BRAND } from '@/shared/config/brand';
import { ArrowRightLeft, Circle, Clock3, Hand, LogOut, Mic, Users, DoorOpen, GraduationCap, CircleStop, VolumeX, X } from 'lucide-react';
import type { Modo } from '../services/salaService';
import { formatoMMSS } from './Celda';
import { ControlesAnfitrion, MODOS } from './ControlesAnfitrion';

export function useReloj(iso: string | null, ahora: () => number): number | null {
  const [restante, setRestante] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) { setRestante(null); return; }
    const tick = () => setRestante((Date.parse(iso) - ahora()) / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iso, ahora]);
  return restante;
}

function horaLocal(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

export function BarraSuperior({
  personas, modo, grabando, cierreAt, ahora, puedeGrabar, grabacionOcupada, onGrabar, onDetenerGrabacion, compartiendo, gobierna, onTerminar, sinConexion,
  onSilenciarTodos, onModo, manosLevantadas, onGente, onMover,
}: {
  personas: number;
  modo: Modo;
  grabando: boolean;
  cierreAt: string | null;
  ahora: () => number;
  puedeGrabar: boolean;
  grabacionOcupada: boolean;
  onGrabar: () => void;
  onDetenerGrabacion: () => void;
  compartiendo: string | null;
  gobierna: boolean;
  onTerminar: () => void;
  sinConexion: boolean;
  onSilenciarTodos?: () => Promise<void>;
  onModo?: (modo: Modo) => Promise<void>;
  manosLevantadas?: number;
  onGente?: () => void;
  /** Host: move the class to another link (Mudanza). */
  onMover?: () => void;
}) {
  const restante = useReloj(cierreAt, ahora);
  const [confirmarFin, setConfirmarFin] = useState(false);
  const [confirmarStop, setConfirmarStop] = useState(false);
  const urgente = restante !== null && restante <= 120;
  const pronto = restante !== null && restante <= 600;

  return (
    <div className="bg-[#161618] border-b border-white/[0.06] px-2.5 md:px-4 py-1.5 md:py-2 flex items-center justify-between gap-2 flex-shrink-0">
      <div className="flex items-center gap-2 md:gap-3 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Image src="/logo.png" alt={BRAND.name} width={26} height={26} className="rounded-md flex-shrink-0" />
        <span className="hidden md:inline text-sm font-semibold text-white/80 tracking-wide">{BRAND.shortName}</span>
        <span className="flex items-center gap-1 text-white/50 text-xs flex-shrink-0"><Users className="w-3.5 h-3.5" /><span data-testid="personas">{personas}</span></span>

        {/* MODO */}
        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold flex-shrink-0 border ${
          modo === 'clase' ? 'bg-[var(--primary)]/15 text-violet-200 border-violet-400/30' : 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
        } ${gobierna && onSilenciarTodos && onModo ? 'hidden' : ''}`} data-testid="chip-modo">
          {modo === 'clase' ? <GraduationCap className="w-3.5 h-3.5" /> : <DoorOpen className="w-3.5 h-3.5" />}
          {modo === 'clase' ? 'Clase' : 'Libre'}
        </span>

        {/* GRABACION: lo que es, no lo que se supone */}
        {grabando ? (
          puedeGrabar ? (
            <button onClick={() => setConfirmarStop(true)} className="flex min-h-9 items-center gap-1.5 px-2 rounded-full border border-red-400/40 bg-red-500/15 text-red-200 text-2xs font-semibold flex-shrink-0" data-testid="grabando-pill">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Grabando<CircleStop className="w-3 h-3 opacity-80" />
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-red-400/30 bg-red-500/15 text-red-200 text-2xs font-semibold flex-shrink-0" data-testid="grabando-pill">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Grabando
            </span>
          )
        ) : puedeGrabar ? (
          <button onClick={onGrabar} disabled={grabacionOcupada} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 text-2xs font-medium flex-shrink-0 disabled:opacity-50" title="Iniciar la grabación de la clase">
            <Circle className="w-3 h-3" /><span>{grabacionOcupada ? 'Iniciando…' : 'Grabar'}</span>
          </button>
        ) : (
          <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-white/10 text-white/45 text-2xs flex-shrink-0">No se está grabando</span>
        )}

        {/* RELOJ DE CIERRE */}
        {restante !== null && (
          <span className={`items-center gap-1 px-2 py-0.5 rounded-full text-2xs tabular-nums flex-shrink-0 border whitespace-nowrap ${pronto ? 'flex' : 'hidden sm:flex'} ${
            urgente ? 'bg-red-500/20 text-red-200 border-red-400/40 animate-pulse' : pronto ? 'bg-amber-500/15 text-amber-200 border-amber-400/30' : 'text-white/55 border-white/10'
          }`} title={`La clase se apaga a las ${horaLocal(cierreAt)}`} data-testid="reloj-cierre">
            <Clock3 className="w-3 h-3" />
            {restante > 0 ? (pronto ? `Se apaga en ${formatoMMSS(restante)}` : `Termina ${horaLocal(cierreAt)}`) : 'Cerrando…'}
          </span>
        )}

        {sinConexion && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-3xs flex-shrink-0">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />Conectando…
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {compartiendo && <span className="hidden md:inline text-xs text-emerald-300 bg-emerald-400/10 px-2 py-1 rounded-full">{compartiendo}</span>}
        {/* Escritorio: los controles del anfitrion viven AQUI (una banda menos apilada
            abajo; critico de objeto, ronda 1). En movil van sobre la barra inferior. */}
        {gobierna && onSilenciarTodos && onModo && (
          <div className="hidden md:flex">
            <ControlesAnfitrion modo={modo} onSilenciarTodos={onSilenciarTodos} onModo={onModo} manosLevantadas={manosLevantadas ?? 0} onGente={onGente} compacto />
          </div>
        )}
        {gobierna && onMover && (
          <button onClick={onMover} className="flex min-h-9 items-center gap-1.5 px-2.5 rounded-full text-xs text-white/70 border border-white/15 hover:bg-white/10" title="Si hay que cambiarse a otra sala, avisa a todos con el link nuevo" data-testid="boton-mover-clase">
            <ArrowRightLeft className="w-3.5 h-3.5" /><span className="sm:hidden">Mover</span><span className="hidden sm:inline">Mover la clase</span>
          </button>
        )}
        {gobierna && (
          <button onClick={() => setConfirmarFin(true)} className="flex min-h-9 items-center gap-1.5 px-2.5 rounded-full text-xs text-white/70 border border-white/15 hover:bg-white/10" title="Terminar la clase para todos" data-testid="terminar-para-todos">
            <LogOut className="w-3.5 h-3.5" /><span className="sm:hidden">Terminar</span><span className="hidden sm:inline">Terminar para todos</span>
          </button>
        )}
      </div>
      {(confirmarFin || confirmarStop) && <div className="fixed inset-0 z-[80] bg-black/65 flex items-end sm:items-center justify-center p-3" onClick={()=>{setConfirmarFin(false);setConfirmarStop(false)}}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="sala-confirm-title" className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#1a1a1e] p-5 shadow-2xl" onClick={e=>e.stopPropagation()} onKeyDown={e=>{
            if(e.key==='Escape'){setConfirmarFin(false);setConfirmarStop(false);return;}
            if(e.key!=='Tab')return;
            const buttons=e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
            const first=buttons[0],last=buttons[buttons.length-1];
            if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
            else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
          }}>
          <h2 id="sala-confirm-title" className="text-lg font-semibold text-white">{confirmarFin?'¿Terminar para todos?':'¿Detener la grabación?'}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">{confirmarFin?(grabando?'Todos saldrán de esta sala. La grabación se guardará y comenzará a procesarse.':'Todos saldrán de esta sala.'):'La llamada continúa. Lo grabado hasta ahora se guardará.'}</p>
          <div className="mt-5 flex flex-col gap-2">
            <button disabled={grabacionOcupada} className="min-h-11 rounded-xl bg-[#ea4335] text-white text-sm font-semibold disabled:opacity-50" onClick={()=>{if(confirmarFin)onTerminar();else onDetenerGrabacion();setConfirmarFin(false);setConfirmarStop(false)}}>{confirmarFin?'Terminar para todos':'Detener grabación'}</button>
            <button autoFocus className="min-h-11 rounded-xl bg-white/5 text-white text-sm" onClick={()=>{setConfirmarFin(false);setConfirmarStop(false)}}>Cancelar</button>
          </div>
        </div>
      </div>}

    </div>
  );
}

/** El banner que explica en que esta la sala. Uno solo a la vez. */
export function BannerEstado({ modo, anfitrionPresente, gobierna, grabando, puedoMicrofono, conTurno, manoLevantada }: {
  modo: Modo;
  anfitrionPresente: boolean;
  gobierna: boolean;
  grabando: boolean;
  puedoMicrofono: boolean;
  conTurno: boolean;
  manoLevantada: boolean;
}) {
  let texto: string | null = null;
  let icono = <DoorOpen className="w-4 h-4" />;
  if (modo === 'abierta' && !anfitrionPresente) {
    texto = `El anfitrión no ha llegado. La sala está abierta${grabando ? '' : ' y no se está grabando'}.`;
  } else if (modo === 'clase' && !gobierna && !conTurno && !puedoMicrofono) {
    icono = <Hand className="w-4 h-4" />;
    texto = manoLevantada ? 'Tu mano está levantada. El anfitrión te dará la palabra.' : 'Estás en clase: el micrófono se abre cuando el anfitrión te da la palabra. Levanta la mano para pedirla.';
  } else if (gobierna) {
    // El anfitrion siempre ve en que modo esta y donde se cambia (8 sep 2026).
    icono = modo === 'clase' ? <GraduationCap className="w-4 h-4" /> : <Mic className="w-4 h-4" />;
    texto = modo === 'clase'
      ? 'Modo Clase · Los miembros participan cuando les das la palabra.'
      : 'Modo Libre · Todos pueden hablar y compartir pantalla.';
  }
  if (!texto && !grabando) return null;
  return (
    <div className="flex flex-col flex-shrink-0 items-center justify-center gap-1 px-4 pt-2 text-white/60 text-[11px] leading-relaxed pointer-events-none" data-testid="banner-estado">
      {texto && <div className="flex items-center gap-2"><span className="text-white/60 flex-shrink-0">{icono}</span><span className="text-center">{texto}</span></div>}
      {grabando && <span role="status" data-testid="grabacion-contenido" className="text-center text-white/75">{modo === 'clase' ? 'MP4: pantalla, anfitrión y audio' : 'MP4: pantalla, cámaras y audio'}</span>}
    </div>
  );
}

/**
 * La tarjeta que ve el anfitrion al entrar (8 sep 2026): dos botones grandes y
 * obvios para elegir como va a ser la sesion. Si el evento ya traia modo, lo
 * dice y ofrece cambiarlo. Aparece UNA vez por sesion y por navegador.
 */
export function TarjetaAnfitrion({ modo, modoEvento, personas, ocupado, onElegir, onCerrar }: {
  modo: Modo;
  modoEvento: Modo | null;
  personas: number;
  ocupado: boolean;
  onElegir: (m: Modo) => void;
  onCerrar: () => void;
}) {
  const Opcion = ({ m }: { m: Modo }) => {
    const activo = modo === m;
    const Icono = MODOS[m].icono;
    const color = m === 'clase' ? 'border-violet-400/60 bg-[var(--primary)]/20' : 'border-emerald-400/60 bg-emerald-500/15';
    return (
      <button
        onClick={() => onElegir(m)}
        disabled={ocupado}
        className={`flex-1 min-w-0 text-left rounded-2xl border-2 p-4 transition ${activo ? color : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'} disabled:opacity-60`}
        data-testid={`tarjeta-modo-${m}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <Icono className={`w-5 h-5 ${m === 'clase' ? 'text-violet-300' : 'text-emerald-300'}`} />
          <span className="text-base font-bold text-white">{MODOS[m].nombre}</span>
          {activo && <span className="ml-auto text-2xs font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white/90">{modoEvento === m ? 'así está programada' : 'así está ahora'}</span>}
        </div>
        <p className="text-sm text-white/70 leading-snug">{m === 'clase' ? 'Tú hablas. Los demás levantan la mano y tú les das la palabra para hablar y compartir pantalla.' : 'Como una llamada normal: todos pueden hablar y compartir pantalla.'}</p>
        <p className="mt-2 text-xs font-semibold text-white/85">{activo ? 'Seguir así' : `Cambiar a ${MODOS[m].nombre}`}</p>
      </button>
    );
  };
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/60" data-testid="tarjeta-anfitrion">
      <div className="titanium-panel w-full max-w-xl rounded-3xl p-5 md:p-6 shadow-2xl relative">
        <button onClick={onCerrar} className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center" title="Cerrar" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        <p className="text-2xs uppercase tracking-wide text-white/50 mb-1">Eres el anfitrión · {personas} {personas === 1 ? 'persona' : 'personas'} en la sala</p>
        <h2 className="text-lg md:text-xl font-bold text-white mb-3">¿Cómo va a ser esta sesión?</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Opcion m="clase" />
          <Opcion m="abierta" />
        </div>
        <ul className="mt-4 space-y-1.5 text-xs text-white/60">
          <li className="flex items-start gap-2"><GraduationCap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span>Lo cambias cuando quieras con los botones <b className="text-white/85">Clase / Libre</b> (arriba a la derecha en computadora, sobre la barra en teléfono).</span></li>
          <li className="flex items-start gap-2"><VolumeX className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span><b className="text-white/85">Silenciar a todos</b> calla la sala un momento sin cambiar el modo. Para que nadie pueda hablar, pon Clase.</span></li>
          <li className="flex items-start gap-2"><Hand className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span>En Clase, las manos levantadas aparecen en <b className="text-white/85">Gente</b>: ahí das y quitas la palabra.</span></li>
          <li className="flex items-start gap-2"><Circle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span><b className="text-white/85">Grabar</b> guarda un solo MP4: en Clase aparece solo la cámara del anfitrión; en Libre, también los participantes. El audio continúa en ambos modos.</span></li>
        </ul>
      </div>
    </div>
  );
}

/** Lo que ve quien tiene la palabra: cuenta regresiva grande y un boton para ceder. */
export function OverlayTurno({ venceAt, ahora, onCeder }: { venceAt: string | null; ahora: () => number; onCeder: () => void }) {
  const restante = useReloj(venceAt, ahora);
  if (!venceAt || restante === null) return null;
  const ultimos = restante <= 20;
  return (
    <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 rounded-full shadow-2xl ${ultimos ? 'bg-amber-400 text-black' : 'bg-emerald-500 text-black'}`} data-testid="overlay-turno">
      <Mic className="w-4 h-4" />
      <span className="text-sm font-semibold tabular-nums">{ultimos ? `Te quedan ${formatoMMSS(Math.max(0, restante))}` : `Tienes la palabra · ${formatoMMSS(Math.max(0, restante))}`}</span>
      <button onClick={onCeder} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/15 hover:bg-black/25">Ceder</button>
    </div>
  );
}

export function PantallaFin({ motivo, onSalir }: { motivo: string | null; onSalir: () => void }) {
  const texto = motivo === 'reloj'
    ? 'La clase llegó a su tiempo máximo y se cerró sola.'
    : motivo === 'anfitrion'
    ? 'El anfitrión terminó la clase.'
    : motivo === 'expulsado'
    ? 'El anfitrión te sacó de la sala.'
    : 'La sala se cerró.';
  return (
    <div className="h-dvh bg-[#161618] flex items-center justify-center p-6" data-testid="pantalla-fin">
      <div className="card-spotlight max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--primary)]/15 border border-violet-400/30 flex items-center justify-center"><GraduationCap className="w-7 h-7 text-violet-300" /></div>
        <h2 className="text-xl font-bold text-white mb-2">La clase terminó</h2>
        <p className="text-sm text-white/60 mb-6">{texto} La grabación, si la hubo, aparece en la lección del curso cuando esté lista.</p>
        <button onClick={onSalir} className="btn-primary w-full">Volver al calendario</button>
      </div>
    </div>
  );
}

/**
 * Leaving costs something here: a host can leave by accident mid-presentation and
 * the whole class moves elsewhere. One deliberate step,
 * with the consequence spelled out; Escape or clicking outside keeps you in.
 */
export function ConfirmarSalida({ compartiendo, soyAnfitrion, conTurno, onQuedarme, onSalir }: {
  compartiendo: boolean;
  soyAnfitrion: boolean;
  conTurno: boolean;
  onQuedarme: () => void;
  onSalir: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onQuedarme(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onQuedarme]);
  const consecuencias = [
    compartiendo && 'Estás presentando: tu pantalla deja de verse para todos.',
    soyAnfitrion && 'Eres el anfitrión: la clase sigue sin ti. Para cerrarla para todos usa «Terminar para todos».',
    conTurno && !soyAnfitrion && 'Tienes la palabra: la pierdes al salir.',
  ].filter(Boolean) as string[];
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/60" onClick={onQuedarme} data-testid="confirmar-salida">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirmar-salida-titulo" className="titanium-panel w-full max-w-md rounded-3xl p-5 md:p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirmar-salida-titulo" className="text-lg md:text-xl font-bold text-white mb-2 flex items-center gap-2"><LogOut className="w-5 h-5 text-red-300" />¿Salir de la clase?</h2>
        <ul className="space-y-1.5 text-sm text-white/75 mb-5">
          {consecuencias.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button autoFocus onClick={onQuedarme} className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold" data-testid="salida-quedarme">Quedarme</button>
          <button onClick={onSalir} className="px-4 py-2.5 rounded-xl bg-[#ea4335] hover:bg-[#d33426] text-white font-semibold" data-testid="salida-confirmar">Salir de la clase</button>
        </div>
      </div>
    </div>
  );
}
