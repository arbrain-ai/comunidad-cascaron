// ============================================
// HowToEarn — "Cómo se gana" (acción antes que número)
// ============================================
// Lee POINT_ACTIONS del config en código. Cada acción que depende de ti
// lleva su link: el panel invita a actuar, no solo informa.

'use client';

import Link from 'next/link';
import { useGlobo } from '@/shared/hooks/useGlobo';
import { ArrowUpRight, SealCheck } from '@phosphor-icons/react/dist/ssr';
import { POINT_ACTIONS } from '../../config/levels';

export function HowToEarn() {
  const globo = useGlobo<HTMLDivElement>();
  return (
    <div ref={globo.ref} onMouseMove={globo.onMouseMove} onMouseEnter={globo.onMouseEnter} onMouseLeave={globo.onMouseLeave} className="sup globo p-5" data-tour="como-se-gana">
      <h3 className="text-base font-bold text-foreground mb-1">Cómo se gana</h3>
      <p className="text-xs text-muted mb-4">
        Sumas puntos cuando lo que aportas le sirve a otros.
      </p>

      <div className="space-y-2.5">
        {POINT_ACTIONS.map((action) => {
          const row = (
            <div className="flex items-center justify-between gap-3 group">
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-sm text-foreground/90 group-hover:text-foreground leading-snug">
                  {action.label}
                </span>
                {action.verified && (
                  <SealCheck size={14} weight="fill" className="text-gold flex-shrink-0" />
                )}
                {action.href && (
                  <ArrowUpRight
                    size={12}
                    className="text-muted/50 group-hover:text-gold flex-shrink-0 transition-colors"
                  />
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <span
                  className={`text-sm font-bold ${
                    action.points >= 50 ? 'text-gold' : 'text-primary-hover'
                  }`}
                >
                  +{action.points}
                </span>
                {action.note && (
                  <span className="block text-3xs text-muted/60 leading-tight">
                    {action.note}
                  </span>
                )}
              </div>
            </div>
          );
          return action.href ? (
            <Link key={action.label} href={action.href} className="block">
              {row}
            </Link>
          ) : (
            <div key={action.label}>{row}</div>
          );
        })}
      </div>

      <p className="mt-4 pt-3 border-t border-border-subtle text-2xs text-muted/70 leading-relaxed">
        Dar likes y comentar no suman puntos: premiamos lo escaso y verificable,
        nunca lo infinito y barato.
      </p>
    </div>
  );
}
