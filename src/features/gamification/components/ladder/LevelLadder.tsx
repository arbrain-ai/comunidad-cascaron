// ============================================
// LevelLadder — la escalera permanente (camino de luz)
// ============================================
// La progresión SIEMPRE a la vista: peldaño actual ENCENDIDO · siguiente en
// ORO con la acción · arriba en penumbra (premio visible).
// Config: ../../config/levels.ts

'use client';

import { useEffect, useRef } from 'react';
import { LEVEL_LADDER, getThreshold } from '../../config/levels';
import { useUserPoints } from '../../hooks/useUserPoints';
import { LadderRung, RungState } from './LadderRung';

export function LevelLadder() {
  const { points, progress, isLoading } = useUserPoints();

  if (isLoading || !points) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-card/60" />
        ))}
      </div>
    );
  }

  const level = points.current_level;

  return <LadderList level={level} totalPoints={points.total_points} progress={progress} />;
}

function LadderList({
  level,
  totalPoints,
  progress,
}: {
  level: number;
  totalPoints: number;
  progress: number;
}) {
  const listRef = useRef<HTMLOListElement>(null);

  // "ESTÁS AQUÍ" nunca enterrado: si tu peldaño quedó bajo el fold, la
  // página ancla ahí al cargar (una vez; los primeros niveles ya se ven).
  useEffect(() => {
    if (level < 4) return;
    const el = listRef.current?.querySelector('[data-state="current"]');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight * 0.85) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    }
  }, [level]);

  const stateFor = (rungLevel: number): RungState => {
    if (rungLevel < level) return 'conquered';
    if (rungLevel === level) return 'current';
    if (rungLevel === level + 1) return 'next';
    return 'locked';
  };

  return (
    <ol ref={listRef} className="relative list-none m-0 p-0" data-tour="escalera">
      {LEVEL_LADDER.map((rung, i) => {
        const state = stateFor(rung.level);
        const threshold = getThreshold(rung.level);
        return (
          <LadderRung
            key={rung.level}
            config={rung}
            threshold={threshold}
            state={state}
            isLast={i === LEVEL_LADDER.length - 1}
            defaultOpen={state === 'current' || state === 'next'}
            progress={state === 'current' ? progress : 0}
            pointsNeeded={Math.max(0, threshold - totalPoints)}
          />
        );
      })}
    </ol>
  );
}
