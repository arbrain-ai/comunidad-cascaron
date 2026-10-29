'use client';

// ============================================
// SALA v2 - una celda 16:9 de la rejilla
// ============================================
// Video (o avatar) + nombre + estado del microfono + turno + mano. El menu del
// anfitrion vive aqui (dar/quitar la palabra, regalar tiempo, silenciar,
// expulsar) con TEXTO, y funciona en todos los tamaños.

import { memo, useEffect, useRef, useState } from 'react';
import { VideoTrack } from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Hand, MicOff, MoreVertical, Pin, ShieldCheck, Timer, UserX, Volume2, VolumeX, Clock3, PlusCircle, MessageSquareOff } from 'lucide-react';
import { avatarColorFor } from '../utils/avatarColor';

export interface CeldaDatos {
  identity: string;
  nombre: string;
  avatarUrl: string | null;
  esLocal: boolean;
  /** 'anfitrion' | 'moderador' | 'miembro' */
  rol: 'anfitrion' | 'moderador' | 'miembro';
  micAbierto: boolean;
  camaraAbierta: boolean;
  hablando: boolean;
  manoPosicion: number | null;
  /** Turno activo (vence_at ISO) o null */
  turnoVence: string | null;
  presupuestoRestante: number | null;
  trackRef?: TrackReferenceOrPlaceholder;
  /** Dimensiones del video publicado, si se conocen (para no deformar verticales). */
  dimensiones?: { width: number; height: number } | null;
}

export interface AccionesCelda {
  onFijarTodos?: (identity: string) => void;
  focoComunId?: string | null;
  onFijar?: (identity: string) => void;
  fijado?: boolean;
  gobierna: boolean;
  onDarPalabra?: (identity: string) => void;
  onQuitarPalabra?: (identity: string) => void;
  onRegalarTiempo?: (identity: string) => void;
  onSilenciar?: (identity: string) => void;
  onExpulsar?: (identity: string) => void;
  volumenLocal?: number;
  onVolumenLocal?: (identity: string, v: number) => void;
}

export function formatoMMSS(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function useCuentaRegresiva(venceIso: string | null, ahora: () => number): number | null {
  const [restante, setRestante] = useState<number | null>(null);
  useEffect(() => {
    if (!venceIso) { setRestante(null); return; }
    const tick = () => setRestante(Math.max(0, (Date.parse(venceIso) - ahora()) / 1000));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [venceIso, ahora]);
  return restante;
}

function Menu({ datos, acciones, onClose }: { datos: CeldaDatos; acciones: AccionesCelda; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [onClose]);
  const item = (icon: React.ReactNode, texto: string, fn?: () => void, peligro = false) => fn ? (
    <button
      onClick={() => { fn(); onClose(); }}
      className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 text-sm transition-colors ${peligro ? 'text-red-300 hover:bg-red-500/10' : 'text-white/85 hover:bg-white/5'}`}
    >
      {icon}<span>{texto}</span>
    </button>
  ) : null;
  const tieneTurno = !!datos.turnoVence;
  return (
    <div ref={ref} className="titanium-panel absolute top-10 right-2 w-56 rounded-xl z-30 overflow-hidden text-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
      {!datos.esLocal && item(<Pin className="w-3.5 h-3.5 text-white/50" />, acciones.fijado ? 'Quitar de fijo' : 'Fijar para mí', acciones.onFijar ? () => acciones.onFijar!(datos.identity) : undefined)}
      {acciones.gobierna && item(<Pin className="w-3.5 h-3.5 text-amber-200" />, acciones.focoComunId === datos.identity ? 'Quitar foco para todos' : 'Fijar para todos', acciones.onFijarTodos ? () => acciones.onFijarTodos!(datos.identity) : undefined)}
      {!datos.esLocal && acciones.onVolumenLocal && (
        <div className="px-3 py-2 border-t border-white/5">
          <div className="flex items-center justify-between text-xs text-white/70 mb-1">
            <span className="flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5 text-white/50" />Volumen para mí</span>
            <span className="font-mono text-white/50">{Math.round((acciones.volumenLocal ?? 1) * 100)}%</span>
          </div>
          <input type="range" min={0} max={200} step={5} value={Math.round((acciones.volumenLocal ?? 1) * 100)}
            onChange={(e) => acciones.onVolumenLocal!(datos.identity, Number(e.target.value) / 100)} onClick={(e) => e.stopPropagation()}
            className="w-full h-1 accent-[var(--primary)] cursor-pointer" />
        </div>
      )}
      {acciones.gobierna && !datos.esLocal && datos.rol === 'miembro' && (
        <div className="border-t border-white/5">
          {!tieneTurno && item(<Timer className="w-3.5 h-3.5 text-emerald-300" />, 'Dar la palabra', acciones.onDarPalabra ? () => acciones.onDarPalabra!(datos.identity) : undefined)}
          {tieneTurno && item(<MessageSquareOff className="w-3.5 h-3.5 text-amber-300" />, 'Quitar la palabra', acciones.onQuitarPalabra ? () => acciones.onQuitarPalabra!(datos.identity) : undefined)}
          {tieneTurno && item(<PlusCircle className="w-3.5 h-3.5 text-emerald-300" />, 'Regalar 3 minutos', acciones.onRegalarTiempo ? () => acciones.onRegalarTiempo!(datos.identity) : undefined)}
          {datos.micAbierto && item(<VolumeX className="w-3.5 h-3.5 text-white/60" />, 'Silenciar micrófono', acciones.onSilenciar ? () => acciones.onSilenciar!(datos.identity) : undefined)}
          {item(<UserX className="w-3.5 h-3.5" />, 'Expulsar de la clase', acciones.onExpulsar ? () => acciones.onExpulsar!(datos.identity) : undefined, true)}
        </div>
      )}
    </div>
  );
}

export const Celda = memo(function Celda({ datos, acciones, ahora, ancho, alto }: {
  datos: CeldaDatos;
  acciones: AccionesCelda;
  ahora: () => number;
  ancho?: number;
  alto?: number;
}) {
  const [menu, setMenu] = useState(false);
  const restante = useCuentaRegresiva(datos.turnoVence, ahora);
  const paleta = avatarColorFor(datos.identity);
  const iniciales = datos.nombre.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const hayVideo = !!datos.trackRef?.publication?.track && datos.camaraAbierta;
  const vertical = !!datos.dimensiones && datos.dimensiones.height > datos.dimensiones.width;
  const ultimos = restante !== null && restante <= 20;
  // El avatar escala con la celda (en telefono las celdas son verticales y angostas).
  const avatarPx = ancho && alto ? Math.round(Math.min(ancho * 0.42, alto * 0.5, 112)) : undefined;

  return (
    <div
      className={`relative w-full h-full rounded-[14px] overflow-hidden group select-none transition-shadow duration-200 bg-[#0e0e10] ${
        datos.hablando ? 'ring-2 ring-[var(--primary)]' : acciones.fijado ? 'ring-2 ring-amber-400/60' : 'ring-1 ring-white/[0.06]'
      }`}
      style={ancho && alto ? { width: ancho, height: alto } : undefined}
      onClick={() => acciones.onFijar?.(datos.identity)}
      data-identity={datos.identity}
    >
      {hayVideo ? (
        <VideoTrack
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          trackRef={datos.trackRef as Parameters<typeof VideoTrack>[0]['trackRef']}
          className={`w-full h-full ${vertical ? 'object-contain bg-[#0e0e10]' : 'object-cover'}`}
          style={datos.esLocal ? { transform: 'scaleX(-1)' } : undefined}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#1b1b1f]">
          {/* Fondo NEUTRO en todas las celdas (critico ciego, ronda 1): el color
              distingue a la persona en su avatar, no en un mosaico de retazos. */}
          {datos.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={datos.avatarUrl} alt={datos.nombre} className="w-[32%] max-w-28 aspect-square rounded-full object-cover" style={avatarPx ? { width: avatarPx, height: avatarPx } : undefined} />
          ) : (
            <div className="w-[32%] max-w-28 aspect-square rounded-full flex items-center justify-center font-semibold" style={{ backgroundColor: paleta.avatar, color: paleta.letter, fontSize: avatarPx ? Math.round(avatarPx * 0.36) : 'clamp(14px, 3.5cqw, 32px)', ...(avatarPx ? { width: avatarPx, height: avatarPx } : {}) }}>
              {iniciales}
            </div>
          )}
        </div>
      )}

      {/* Turno: la cuenta regresiva la ve TODA la sala, no solo quien habla */}
      {restante !== null && (
        <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold tabular-nums backdrop-blur-sm ${ultimos ? 'bg-amber-500/90 text-black' : 'bg-emerald-500/85 text-black'}`}>
          <Timer className="w-3 h-3" />
          <span>{datos.esLocal ? 'Tu palabra' : 'Con la palabra'} · {formatoMMSS(restante)}</span>
        </div>
      )}

      {/* Mano levantada: numero = lugar en la fila */}
      {datos.manoPosicion != null && datos.manoPosicion > 0 && !restante && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/90 text-black text-2xs font-semibold">
          <Hand className="w-3 h-3" /><span>{datos.manoPosicion}º</span>
        </div>
      )}

      {/* Nombre */}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0 pr-7">
          {datos.rol !== 'miembro' && <ShieldCheck className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />}
          <span data-cell-name className="text-white text-sm font-medium truncate drop-shadow">{datos.nombre}{datos.esLocal ? ' (tú)' : ''}</span>
          {datos.rol === 'anfitrion' && <span data-cell-role className="text-3xs font-semibold text-amber-200/90 bg-amber-400/15 px-1 rounded flex-shrink-0">Anfitrión</span>}
          {acciones.gobierna && datos.rol === 'miembro' && datos.presupuestoRestante != null && (
            <span data-cell-budget className="ml-auto flex items-center gap-1 text-3xs text-white/60 tabular-nums flex-shrink-0" title="Palabra que le queda en esta clase">
              <Clock3 className="w-3 h-3" />{formatoMMSS(datos.presupuestoRestante)}
            </span>
          )}
        </div>
      </div>

      {!datos.micAbierto && (
        <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-black/55 flex items-center justify-center pointer-events-none" title="Micrófono cerrado">
          <MicOff className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Menu */}
      {(acciones.gobierna || !datos.esLocal) && (
        <div className={`absolute top-2 right-2 transition-opacity ${acciones.gobierna ? 'opacity-80' : 'opacity-60 md:opacity-0 md:group-hover:opacity-100'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenu((v) => !v); }}
            className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
            title="Opciones"
            aria-label={`Opciones de ${datos.nombre}`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      )}
      {menu && <Menu datos={datos} acciones={acciones} onClose={() => setMenu(false)} />}
    </div>
  );
});
