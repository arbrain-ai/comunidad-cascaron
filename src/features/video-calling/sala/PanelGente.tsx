'use client';

// ============================================
// SALA v2 - el panel de la gente: manos, palabra, presupuestos
// ============================================
// Arriba, las manos levantadas en orden (el anfitrion da la palabra de un
// toque). Abajo, todos los presentes con su estado. Nada de toasts de
// "X se unio": este panel ES la fuente.
//
// Critico ciego, ronda 1: tres iconos sueltos por fila no se entendian y las
// acciones masivas no se distinguian de las individuales. Ahora cada fila
// lleva UNA accion principal con texto ("Dar la palabra" / "Quitar") y un
// menu "..." para el resto; las acciones sobre TODOS viven en un pie fijo.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Hand, MicOff, Mic, Search, ShieldCheck, Timer, X, Clock3, VolumeX, UserX, PlusCircle, MessageSquareOff, MoreHorizontal } from 'lucide-react';
import type { Modo } from '../services/salaPolicy';
import type { CeldaDatos } from './Celda';
import { formatoMMSS } from './Celda';

interface Props {
  modo: Modo;
  celdas: CeldaDatos[];
  manos: { user_id: string; nombre: string; posicion: number }[];
  gobierna: boolean;
  onDarPalabra: (identity: string) => void;
  onQuitarPalabra: (identity: string) => void;
  onRegalarTiempo: (identity: string) => void;
  onSilenciar: (identity: string) => void;
  onExpulsar: (identity: string) => void;
  onSilenciarTodos: () => Promise<void> | void;
  onBajarTodasLasManos: () => void;
  onCerrar: () => void;
}

function MenuFila({ c, onRegalarTiempo, onSilenciar, onExpulsar, onQuitarPalabra, onClose }: {
  c: CeldaDatos;
  onRegalarTiempo: (id: string) => void;
  onSilenciar: (id: string) => void;
  onExpulsar: (id: string) => void;
  onQuitarPalabra: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [onClose]);
  const item = (icon: React.ReactNode, texto: string, fn: () => void, peligro = false, testid?: string) => (
    <button onClick={() => { fn(); onClose(); }} data-testid={testid} className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm ${peligro ? 'text-red-300 hover:bg-red-500/10' : 'text-white/85 hover:bg-white/5'}`}>
      {icon}<span>{texto}</span>
    </button>
  );
  return (
    <div ref={ref} className="titanium-panel absolute right-2 top-9 w-52 rounded-xl z-30 overflow-hidden shadow-2xl">
      {c.turnoVence && item(<PlusCircle className="w-3.5 h-3.5 text-emerald-300" />, 'Regalar 3 minutos', () => onRegalarTiempo(c.identity))}
      {c.turnoVence && item(<MessageSquareOff className="w-3.5 h-3.5 text-amber-300" />, 'Quitar la palabra', () => onQuitarPalabra(c.identity), false, `quitar-palabra-${c.identity}`)}
      {c.micAbierto && item(<VolumeX className="w-3.5 h-3.5 text-white/60" />, 'Silenciar micrófono', () => onSilenciar(c.identity), false, `silenciar-${c.identity}`)}
      {item(<UserX className="w-3.5 h-3.5" />, 'Expulsar de la clase', () => onExpulsar(c.identity), true)}
    </div>
  );
}

export function PanelGente({ modo, celdas, manos, gobierna, onDarPalabra, onQuitarPalabra, onRegalarTiempo, onSilenciar, onExpulsar, onSilenciarTodos, onBajarTodasLasManos, onCerrar }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [menuDe, setMenuDe] = useState<string | null>(null);
  const [silenciando, setSilenciando] = useState(false);
  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = q ? celdas.filter((c) => c.nombre.toLowerCase().includes(q)) : celdas;
    return [...base].sort((a, b) => {
      const peso = (c: CeldaDatos) => (c.rol !== 'miembro' ? 0 : c.turnoVence ? 1 : c.manoPosicion ? 2 : 3);
      return peso(a) - peso(b) || a.nombre.localeCompare(b.nombre);
    });
  }, [celdas, busqueda]);
  const conMicro = celdas.filter((c) => c.rol === 'miembro' && c.micAbierto).length;

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="panel-gente">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
        <span className="text-sm font-semibold text-white">Gente · {celdas.length}</span>
        <button onClick={onCerrar} className="w-8 h-8 rounded-full hover:bg-white/10 text-white/60 flex items-center justify-center" aria-label="Cerrar panel"><X className="w-4 h-4" /></button>
      </div>

      {manos.length > 0 && (
        <div className="border-b border-white/[0.06] bg-amber-400/5 shrink-0 max-h-[35%] overflow-y-auto">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
            <span className="text-2xs font-semibold uppercase tracking-wide text-amber-200 flex items-center gap-1.5"><Hand className="w-3.5 h-3.5" />Piden la palabra · {manos.length}</span>
          </div>
          <ul className="pb-2">
            {manos.map((m) => (
              <li key={m.user_id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-400 text-black text-2xs font-bold flex items-center justify-center flex-shrink-0">{m.posicion}</span>
                <span className="text-sm text-white line-clamp-2 leading-snug flex-1 min-w-0" title={m.nombre}>{m.nombre}</span>
                {gobierna && (
                  <button onClick={() => onDarPalabra(m.user_id)} aria-label={`Dar la palabra a ${m.nombre}`} className="flex shrink-0 items-center gap-1 whitespace-nowrap px-3 min-h-9 rounded-full bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400" data-testid={`cola-dar-palabra-${m.user_id}`}>
                    <Timer className="w-3 h-3" />Dar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
          <Search className="w-3.5 h-3.5 text-white/40" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar" className="bg-transparent text-sm text-white placeholder:text-white/35 outline-none flex-1 min-w-0" />
        </div>
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto">
        {lista.map((c) => (
          <li key={c.identity} className="relative border-b border-white/[0.035] px-3 py-2.5 hover:bg-white/[0.03]" data-testid={`gente-${c.identity}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#2a2a2e] overflow-hidden flex items-center justify-center text-2xs font-bold text-white/80 shrink-0">
                {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" /> : c.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm text-white line-clamp-2 leading-snug min-w-0" title={c.nombre}>{c.nombre}{c.esLocal ? ' (tú)' : ''}</span>
                  {c.rol !== 'miembro' && <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50 mt-0.5">
                  {c.rol === 'anfitrion' ? <span className="text-amber-200/90 whitespace-nowrap">Anfitrión</span> : c.rol === 'moderador' ? <span className="text-amber-200/90 whitespace-nowrap">Moderador</span> : null}
                  {c.turnoVence ? <span className="text-emerald-300 flex items-center gap-1 whitespace-nowrap"><Timer className="w-3 h-3 shrink-0" />Con la palabra</span> : c.manoPosicion ? <span className="text-amber-200 flex items-center gap-1 whitespace-nowrap"><Hand className="w-3 h-3 shrink-0" />{c.manoPosicion}º en la fila</span> : null}
                  {modo === 'clase' && gobierna && c.rol === 'miembro' && c.presupuestoRestante != null && <span className="flex items-center gap-1 whitespace-nowrap tabular-nums" title="Palabra que le queda en esta clase"><Clock3 className="w-3 h-3 shrink-0" />{formatoMMSS(c.presupuestoRestante)}</span>}
                </div>
              </div>
              <span className="shrink-0" title={c.micAbierto ? 'Micrófono abierto' : 'Micrófono cerrado'}>{c.micAbierto ? <Mic className="w-3.5 h-3.5 text-emerald-300" /> : <MicOff className="w-3.5 h-3.5 text-white/30" />}</span>
              {gobierna && !c.esLocal && c.rol === 'miembro' && <button onClick={()=>setMenuDe(m=>m===c.identity?null:c.identity)} className="w-8 h-8 shrink-0 rounded-full hover:bg-white/10 text-white/60 flex items-center justify-center" aria-label={`Más opciones de ${c.nombre}`} data-testid={`mas-${c.identity}`}><MoreHorizontal className="w-4 h-4" /></button>}
            </div>
            {gobierna && !c.esLocal && c.rol === 'miembro' && (modo === 'clase' || c.manoPosicion || c.turnoVence) && <div className="pl-[42px] mt-2">
              {c.turnoVence ? <button onClick={()=>onQuitarPalabra(c.identity)} className="min-h-9 px-3 rounded-full text-xs font-semibold bg-amber-400/15 text-amber-200 border border-amber-400/30 hover:bg-amber-400/25 whitespace-nowrap" data-testid={`quitar-palabra-${c.identity}`}>Quitar la palabra</button>
              : <button onClick={()=>onDarPalabra(c.identity)} className="min-h-9 px-3 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-200 border border-emerald-400/30 hover:bg-emerald-500/25 whitespace-nowrap" data-testid={`dar-palabra-${c.identity}`}>Dar la palabra</button>}
            </div>}
            {menuDe === c.identity && <MenuFila c={c} onRegalarTiempo={onRegalarTiempo} onSilenciar={onSilenciar} onExpulsar={onExpulsar} onQuitarPalabra={onQuitarPalabra} onClose={()=>setMenuDe(null)} />}
          </li>
        ))}
        {lista.length === 0 && <li className="px-3 py-6 text-center text-sm text-white/40">Nadie con ese nombre</li>}
      </ul>

      {gobierna && (
        <div className="flex flex-wrap shrink-0 items-center gap-2 px-3 py-2.5 border-t border-white/[0.06] bg-[#141416]" data-testid="pie-gente">
          <button
            onClick={async () => { setSilenciando(true); try { await onSilenciarTodos(); } finally { setSilenciando(false); } }}
            disabled={silenciando}
            className="flex-1 whitespace-nowrap flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-200 border border-amber-400/35 hover:bg-amber-500/25 disabled:opacity-60"
            title={conMicro > 0 ? `${conMicro} con micrófono abierto` : 'Nadie tiene el micrófono abierto'}
          >
            <VolumeX className="w-3.5 h-3.5" />{silenciando ? 'Silenciando…' : `Silenciar a todos${conMicro > 0 ? ` (${conMicro})` : ''}`}
          </button>
          {manos.length > 0 && (
            <button onClick={onBajarTodasLasManos} className="px-3 py-2 rounded-xl text-xs font-medium text-white/70 hover:bg-white/5 border border-white/10">Bajar manos</button>
          )}
        </div>
      )}
    </div>
  );
}
