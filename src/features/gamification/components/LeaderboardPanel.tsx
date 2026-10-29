// ============================================
// LeaderboardPanel — los rankings, ahora elemento secundario
// ============================================
// Un solo panel con tabs (7d / 30d / histórico) en vez de tres tarjetas:
// la protagonista de la página es la escalera, no la tabla.
// Datos: la FOTO compartida del server (useGamificationSnapshot) — cambiar
// de tab es instantáneo porque los 3 periodos llegan juntos. Si el snapshot
// no está disponible, cae al camino viejo (RPC por periodo desde el cliente).

'use client';

import Image from 'next/image';
import { useGlobo } from '@/shared/hooks/useGlobo';
import { useEffect, useState } from 'react';
import { LeaderboardEntry, LeaderboardPeriod } from '../types';
import { getLeaderboard } from '../services/gamificationService';
import { useGamificationSnapshot } from '../hooks/useGamificationSnapshot';
import { UserLevelBadge } from './UserLevelBadge';
import { sbAvatar } from '@/shared/lib/sbImage';

const TABS: { id: LeaderboardPeriod; label: string }[] = [
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'all', label: 'Histórico' },
];

const RANK_STYLES: Record<number, string> = {
  1: 'bg-gradient-to-br from-gold-bright to-gold-dark text-white shadow-[0_0_10px_rgba(255,145,1,0.4)]',
  2: 'bg-gradient-to-br from-zinc-300 to-zinc-400 text-zinc-800',
  3: 'bg-gradient-to-br from-amber-600 to-amber-700 text-white',
};

export function LeaderboardPanel({ limit = 8 }: { limit?: number }) {
  const globo = useGlobo<HTMLDivElement>();
  const [period, setPeriod] = useState<LeaderboardPeriod>('30d');
  const { snapshot, isLoading: snapshotLoading, failed } = useGamificationSnapshot();

  // Fallback: solo si el snapshot del server no está disponible
  const [fallbackEntries, setFallbackEntries] = useState<LeaderboardEntry[]>([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  useEffect(() => {
    if (!failed) return;
    let alive = true;
    setFallbackLoading(true);
    getLeaderboard(period, limit)
      .then((data) => {
        if (alive) setFallbackEntries(data);
      })
      .finally(() => {
        if (alive) setFallbackLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [failed, period, limit]);

  const entries = snapshot ? snapshot.periods[period].slice(0, limit) : fallbackEntries;
  const isLoading = snapshot ? false : failed ? fallbackLoading : snapshotLoading;

  const updatedLabel = snapshot
    ? new Date(snapshot.generatedAt).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div ref={globo.ref} onMouseMove={globo.onMouseMove} onMouseEnter={globo.onMouseEnter} onMouseLeave={globo.onMouseLeave} className="sup globo p-5" data-tour="rankings">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-base font-bold text-foreground">Rankings</h3>
        <div className="flex rounded-lg bg-background/60 border border-border-subtle p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                period === tab.id
                  ? 'bg-primary/20 text-foreground'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2.5 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-card-hover" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted text-center py-4">Sin actividad en este periodo.</p>
      ) : (
        <ol className="space-y-1">
          {entries.map((entry) => (
            <li key={entry.user_id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-card-hover transition-colors">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold flex-shrink-0 ${
                  RANK_STYLES[entry.rank] || 'bg-card-hover text-muted'
                }`}
              >
                {entry.rank}
              </span>
              <div className="relative flex-shrink-0">
                {entry.avatar_url ? (
                  <Image
                    src={sbAvatar(entry.avatar_url, 28)}
                    alt={entry.full_name}
                    width={28}
                    height={28}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-2xs font-semibold text-primary-hover">
                    {entry.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 scale-[0.8] origin-bottom-right">
                  <UserLevelBadge level={entry.current_level} size="xs" />
                </span>
              </div>
              <span className="text-sm text-foreground/90 truncate flex-1">{entry.full_name}</span>
              <span className="text-sm font-semibold text-primary-hover flex-shrink-0">
                {period === 'all'
                  ? (entry.total_points ?? 0).toLocaleString()
                  : `+${entry.points_in_period ?? 0}`}
              </span>
            </li>
          ))}
        </ol>
      )}

      {updatedLabel && (
        <p className="mt-3 text-2xs text-muted/70 text-center">
          Última actualización: {updatedLabel}
        </p>
      )}
    </div>
  );
}
