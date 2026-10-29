'use client';

// ============================================
// SALA v2 - los controles del anfitrion (con texto, en todos los tamaños)
// ============================================
// Un solo componente en dos lugares: en escritorio dentro de la barra superior
// (a la derecha, junto a "Terminar para todos"); en movil, en una fila sobre la
// barra inferior. Dos botones OBVIOS para el modo (8 sep 2026: "yo quisiera
// botones obvios"): el activo va lleno de color con una palomita, el otro dice
// a que cambia. "Silenciar a todos" cierra micros y NO cambia el modo.

import { useState } from 'react';
import { VolumeX, GraduationCap, DoorOpen, Hand, Check } from 'lucide-react';
import type { Modo } from '../services/salaService';

interface Props {
  modo: Modo;
  onSilenciarTodos: () => Promise<void>;
  onModo: (modo: Modo) => Promise<void>;
  manosLevantadas: number;
  onGente?: () => void;
  /** Escritorio: botones mas bajos para caber en la barra superior. */
  compacto?: boolean;
}

/** Lo que significa cada modo, en una frase. Se reusa en la tarjeta y en los titulos. */
export const MODOS: Record<Modo, { nombre: string; frase: string; icono: typeof GraduationCap }> = {
  clase: { nombre: 'Clase', frase: 'los miembros hablan y comparten pantalla cuando tú les das la palabra', icono: GraduationCap },
  abierta: { nombre: 'Libre', frase: 'todos pueden hablar y compartir pantalla', icono: DoorOpen },
};

export function ControlesAnfitrion({ modo, onSilenciarTodos, onModo, manosLevantadas, onGente, compacto = false }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const correr = async (clave: string, fn: () => Promise<void>) => {
    if (ocupado) return;
    setOcupado(clave);
    try { await fn(); } finally { setOcupado(null); }
  };
  const alto = compacto ? 'py-1' : 'py-1.5';

  const BotonModo = ({ m }: { m: Modo }) => {
    const activo = modo === m;
    const Icono = MODOS[m].icono;
    const lleno = m === 'clase' ? 'bg-[var(--primary)] text-white' : 'bg-emerald-600 text-white';
    return (
      <button
        onClick={() => { if (!activo) correr('modo', () => onModo(m)); }}
        disabled={!!ocupado}
        aria-pressed={activo}
        className={`flex items-center gap-1.5 px-3 ${alto} text-xs font-semibold whitespace-nowrap ${activo ? lleno : 'text-white/75 hover:bg-white/10 hover:text-white'} disabled:opacity-60`}
        title={activo ? `Modo ${MODOS[m].nombre}: ${MODOS[m].frase}` : `Cambiar a ${MODOS[m].nombre}: ${MODOS[m].frase}`}
        data-testid={`modo-${m}`}
      >
        {activo ? <Check className="w-3.5 h-3.5" /> : <Icono className="w-3.5 h-3.5" />}
        {MODOS[m].nombre}
        <span className="hidden lg:inline font-normal opacity-80">{m === 'clase' ? '· con turno' : '· todos hablan'}</span>
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center" data-testid="controles-anfitrion">
      <button
        onClick={() => correr('todos', onSilenciarTodos)}
        disabled={!!ocupado}
        className={`flex items-center gap-1.5 px-3 ${alto} rounded-full text-xs font-semibold text-white/80 border border-white/15 hover:bg-white/5 hover:text-white disabled:opacity-60 whitespace-nowrap`}
        aria-label="Silenciar a todos"
        data-testid="silenciar-a-todos"
        title="Cierra todos los micrófonos de los miembros. No cambia el modo: en Libre pueden volver a abrirlo."
      >
        <VolumeX className="w-3.5 h-3.5" /><span className="sm:hidden">{ocupado === 'todos' ? 'Silenciando…' : 'Silenciar'}</span><span className="hidden sm:inline">{ocupado === 'todos' ? 'Silenciando…' : 'Silenciar a todos'}</span>
      </button>
      <div className="flex items-center rounded-full border border-white/15 overflow-hidden" data-testid="conmutador-modo" title="Modo de la sala. Clic para cambiarlo.">
        <span className="hidden sm:inline pl-3 pr-1 text-2xs uppercase tracking-wide text-white/45 select-none">Modo</span>
        <BotonModo m="clase" />
        <BotonModo m="abierta" />
      </div>
      {manosLevantadas > 0 && onGente && (
        <button onClick={onGente} className={`hidden sm:flex items-center gap-1.5 px-3 ${alto} rounded-full text-xs font-semibold bg-amber-400/90 text-black hover:bg-amber-300 whitespace-nowrap`} data-testid="manos-levantadas">
          <Hand className="w-3.5 h-3.5" />{manosLevantadas} {manosLevantadas === 1 ? 'mano' : 'manos'}
        </button>
      )}
    </div>
  );
}
