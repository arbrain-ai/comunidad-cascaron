// ============================================
// LevelDistribution Component
// ============================================
// Shows distribution of members across levels (like Skool)
// Datos: la misma FOTO del server que los Rankings (un solo fetch para
// ambos paneles, cero doble-RPC). Fallback al camino viejo si no hay server.

'use client';

import { useEffect, useState } from 'react';
import { LEVEL_THRESHOLDS } from '../types';
import { getMembersPerLevel, getTotalMembersCount } from '../services/gamificationService';
import { useGamificationSnapshot } from '../hooks/useGamificationSnapshot';
import { UserLevelBadge } from './UserLevelBadge';

export function LevelDistribution() {
  const { snapshot, isLoading: snapshotLoading, failed } = useGamificationSnapshot();

  // Fallback: solo si el snapshot del server no está disponible
  const [fallbackPerLevel, setFallbackPerLevel] = useState<Map<number, number>>(new Map());
  const [fallbackTotal, setFallbackTotal] = useState(0);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  useEffect(() => {
    if (!failed) return;
    let alive = true;
    setFallbackLoading(true);
    Promise.all([getMembersPerLevel(), getTotalMembersCount()])
      .then(([perLevel, total]) => {
        if (!alive) return;
        setFallbackPerLevel(perLevel);
        setFallbackTotal(total);
      })
      .catch((error) => console.error('Error fetching level distribution:', error))
      .finally(() => {
        if (alive) setFallbackLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [failed]);

  const membersPerLevel = snapshot
    ? new Map(snapshot.distribution.map((row) => [row.level, row.member_count]))
    : fallbackPerLevel;
  const totalMembers = snapshot ? snapshot.totalMembers : fallbackTotal;
  const isLoading = snapshot ? false : failed ? fallbackLoading : snapshotLoading;

  if (isLoading) {
    return (
      <div className="sup p-6 animate-pulse">
        <div className="h-6 w-32 bg-muted rounded mb-4"></div>
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-8 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="sup p-6">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Niveles</h3>

      <div className="space-y-3">
        {LEVEL_THRESHOLDS.map((levelInfo) => {
          const count = membersPerLevel.get(levelInfo.level) || 0;
          const percentage = totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0;

          return (
            <div key={levelInfo.level} className="flex items-center gap-3">
              <UserLevelBadge level={levelInfo.level} size="sm" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {levelInfo.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {percentage}% de miembros
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground text-center">
        {totalMembers} miembros totales
      </p>
    </div>
  );
}
