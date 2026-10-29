// ============================================
// LadderRung — un peldaño del camino de luz
// ============================================
// Estados: conquered (tu estela, iluminado suave) · current (ENCENDIDO) ·
// next (en ORO, con LA ACCIÓN) · locked (penumbra, premio visible).
// Cada peldaño es un TOGGLE: cabecera siempre visible con mini-previews de
// los premios; abierto = premios GRANDES y clic que te lleva al premio.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Lock,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
} from 'lucide-react';
import type { LadderPrize, LadderRungConfig } from '../../config/levels';
import { sbImage } from '@/shared/lib/sbImage';
import { useGlobo } from '@/shared/hooks/useGlobo';

export type RungState = 'conquered' | 'current' | 'next' | 'locked';

interface LadderRungProps {
  config: LadderRungConfig;
  threshold: number;
  state: RungState;
  isLast?: boolean;
  /** Abierto por default (current y next); el usuario puede plegarlo */
  defaultOpen?: boolean;
  /** Solo para current: progreso 0-100 hacia el siguiente */
  progress?: number;
  /** Solo para next/locked: puntos que faltan desde donde está el usuario */
  pointsNeeded?: number;
}

/** La cara del premio: imagen real, o el ícono lucide mientras no la tenga */
function PrizeFace({
  prize,
  locked,
  size,
}: {
  prize: LadderPrize;
  locked: boolean;
  size: 'mini' | 'full';
}) {
  const cls =
    size === 'mini'
      ? 'w-7 h-7 rounded-lg'
      : 'w-14 h-14 md:w-16 md:h-16 rounded-xl';
  if (prize.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={sbImage(prize.image, { width: 160, quality: 78 })}
        alt={prize.title}
        loading="lazy"
        className={`${cls} object-cover border border-border-subtle flex-shrink-0 bg-card ${
          locked ? 'opacity-50 saturate-50' : ''
        }`}
      />
    );
  }
  const Icon = prize.fallback;
  return (
    <span
      className={`${cls} flex items-center justify-center flex-shrink-0 border ${
        locked
          ? 'bg-card border-border text-muted/50'
          : 'bg-primary/15 border-primary/25 text-primary-hover'
      }`}
    >
      <Icon size={size === 'mini' ? 14 : 26} strokeWidth={1.8} />
    </span>
  );
}

/** Un premio a lo grande: clickeable si tiene destino y ya es tuyo/alcanzable */
function PrizeRow({ prize, locked }: { prize: LadderPrize; locked: boolean }) {
  const body = (
    <>
      <PrizeFace prize={prize} locked={locked} size="full" />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm md:text-base font-semibold leading-tight flex items-center gap-1.5 ${
            locked ? 'text-muted' : 'text-foreground'
          }`}
        >
          <span className="truncate">{prize.title}</span>
          {prize.href && !locked && (
            <ArrowUpRight size={14} className="text-muted/50 group-hover/prize:text-gold flex-shrink-0 transition-colors" />
          )}
          {!prize.href && prize.nota && (
            <span className="flex-shrink-0 rounded-full border border-border-subtle px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted/70">
              {prize.nota}
            </span>
          )}
        </p>
        <p className={`text-xs mt-1 leading-relaxed ${locked ? 'text-muted/60' : 'text-muted'}`}>
          {prize.description}
        </p>
      </div>
    </>
  );

  // Bloqueado = sin link (el destino tiene su propio candado; no invitamos a chocar con él)
  if (prize.href && !locked) {
    const cls =
      'group/prize flex items-center gap-3.5 rounded-xl px-2 py-2 -mx-2 transition-colors hover:bg-primary/[0.07]';
    return prize.external ? (
      <a href={prize.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {body}
      </a>
    ) : (
      <Link href={prize.href} className={cls}>
        {body}
      </Link>
    );
  }
  return <div className="flex items-center gap-3.5 px-2 py-2 -mx-2">{body}</div>;
}

export function LadderRung({
  config,
  threshold,
  state,
  isLast = false,
  defaultOpen = false,
  progress = 0,
  pointsNeeded = 0,
}: LadderRungProps) {
  const conquered = state === 'conquered';
  const current = state === 'current';
  const next = state === 'next';
  const locked = state === 'locked';
  const [open, setOpen] = useState(defaultOpen);
  const globo = useGlobo<HTMLDivElement>();

  return (
    <li className="relative pl-16 md:pl-20 pb-3" data-rung={config.level} data-state={state}>
      {/* Segmento del riel (continuo): la luz acumulada queda ENCENDIDA
          detrás de ti; en tu peldaño la luz se desvanece — adelante es
          penumbra. El nodo lo cubre por z-index. */}
      <span
        aria-hidden
        className={`absolute left-[21px] md:left-[23px] w-[2px] ${
          config.level === 1 ? 'top-6' : '-top-1'
        } ${isLast ? 'h-8' : 'bottom-0'} ${
          conquered
            ? 'bg-primary/50 shadow-[0_0_10px_rgba(139,92,246,0.45)]'
            : current
            ? 'bg-gradient-to-b from-primary/60 via-primary/25 to-transparent'
            : 'bg-border/70'
        }`}
      />
      {/* Nodo sobre el riel. La regla del ámbar: pleno para el peldaño donde
          estás parado (.es-vivo-punto), atenuado para lo ya conquistado
          (fondo dorado suave + check en .es-tuyo) — nunca morado: el morado
          es el sistema, el ámbar eres tú. */}
      <div
        className={`absolute left-0 top-4 w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-base z-10 transition-all ${
          current
            ? 'es-vivo-punto text-black'
            : next
            ? 'bg-background border-2 border-gold text-gold shadow-[0_0_18px_rgba(255,145,1,0.35)]'
            : conquered
            ? 'bg-gold/15 border border-gold/35'
            : 'bg-card border border-border text-muted/60'
        }`}
      >
        {conquered ? <Check size={20} strokeWidth={3} className="es-tuyo" /> : config.level}
      </div>

      {/* Tarjeta del peldaño (la fila completa). Conquistado se reconoce por
          la tarjeta entera (.es-tuyo-filo), no solo por dos elementos
          diminutos. */}
      <div
        ref={globo.ref}
        onMouseMove={globo.onMouseMove}
        onMouseEnter={globo.onMouseEnter}
        onMouseLeave={globo.onMouseLeave}
        className={`globo rounded-2xl border transition-all ${
          current
            ? 'es-vivo-fondo shadow-[var(--glow-gold)]'
            : next
            ? 'border-gold/60 bg-gold/[0.06] shadow-[var(--glow-gold)]'
            : conquered
            ? 'es-tuyo-filo bg-card/60 shadow-[0_0_16px_rgba(255,145,1,0.07)]'
            : 'border-border bg-card/40 opacity-75'
        }`}
      >
        {/* Cabecera = el toggle (siempre visible, con mini-preview de premios) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full text-left p-4 md:p-5 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h3
                className={`text-base md:text-lg font-bold tracking-tight ${
                  locked ? 'es-pendiente' : 'text-foreground'
                }`}
              >
                {config.name}
              </h3>
              <span className="text-xs text-muted/80 font-medium">
                Nivel {config.level} · {threshold.toLocaleString()} pts
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
              {current && (
                <span className="es-vivo text-2xs font-bold uppercase tracking-wider bg-gold/15 border border-gold/40 px-2.5 py-1 rounded-full whitespace-nowrap">
                  Estás aquí
                </span>
              )}
              {next && (
                <span className="text-2xs font-bold uppercase tracking-wider text-gold border border-gold/50 px-2.5 py-1 rounded-full whitespace-nowrap">
                  Tu siguiente peldaño
                </span>
              )}
              {conquered && (
                <span className="es-tuyo text-2xs font-medium uppercase tracking-wider whitespace-nowrap">
                  Conquistado
                </span>
              )}
              {locked && <Lock size={14} className="es-pendiente" />}
              <ChevronDown
                size={16}
                className={`text-muted/60 transition-transform duration-200 ${
                  open ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>

          {/* Plegado: los premios asoman igual (el deseo nunca se esconde) */}
          {!open && (
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {config.prizes.slice(0, 3).map((prize) => (
                  <PrizeFace key={prize.title} prize={prize} locked={locked} size="mini" />
                ))}
              </div>
              <span className={`text-xs truncate ${locked ? 'text-muted/60' : 'text-muted'}`}>
                {config.prizes.map((p) => p.title).join(' · ')}
              </span>
            </div>
          )}
        </button>

        {/* Cuerpo desplegado */}
        {open && (
          <div className="px-4 md:px-5 pb-4 md:pb-5 -mt-1">
            <div className="space-y-1">
              {config.prizes.map((prize) => (
                <PrizeRow key={prize.title} prize={prize} locked={locked} />
              ))}
            </div>

            {/* Current: barra de luz hacia el siguiente */}
            {current && (
              <div className="mt-4">
                <div className="h-2 rounded-full bg-background/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Next: LA ACCIÓN, nunca solo el número */}
            {next && (
              <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                <Link href={config.cta.href} className="btn-gold text-sm inline-flex items-center gap-1.5">
                  {config.cta.label}
                  <ArrowRight size={15} />
                </Link>
                <span className="text-xs text-muted">
                  {pointsNeeded > 0 ? (
                    <>
                      te faltan{' '}
                      <span className="text-gold font-semibold">{pointsNeeded.toLocaleString()} pts</span>
                    </>
                  ) : (
                    <span className="text-gold font-semibold">tus puntos ya lo alcanzan</span>
                  )}
                </span>
              </div>
            )}

            {/* Locked (más arriba): qué hacer para llegar */}
            {locked && !next && (
              <p className="mt-3 text-xs text-muted/70">
                <span className="text-muted">{config.cta.label}</span>
                {' · '}te faltan {pointsNeeded.toLocaleString()} pts
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
