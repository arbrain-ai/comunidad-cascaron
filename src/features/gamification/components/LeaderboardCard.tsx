// ============================================
// LeaderboardCard Component
// ============================================
// Compact leaderboard card showing top users for a specific period
// Used in both /leaderboard page and community sidebar

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LeaderboardEntry, LeaderboardPeriod } from '../types';
import { getLeaderboard } from '../services/gamificationService';
import { useGamificationSnapshot } from '../hooks/useGamificationSnapshot';
import { UserLevelBadge } from './UserLevelBadge';
import { sbAvatar } from '@/shared/lib/sbImage';

interface LeaderboardCardProps {
  period: LeaderboardPeriod;
  limit?: number;
  showTitle?: boolean;
  showLevel?: boolean;
  className?: string;
}

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  '7d': 'Leaderboard (7-day)',
  '30d': 'Leaderboard (30-day)',
  'all': 'Leaderboard (all-time)',
};

const RANK_STYLES: Record<number, string> = {
  1: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white',
  2: 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800',
  3: 'bg-gradient-to-br from-amber-600 to-amber-700 text-white',
};

export function LeaderboardCard({
  period,
  limit = 5,
  showTitle = true,
  showLevel = false,
  className = '',
}: LeaderboardCardProps) {
  // La FOTO compartida del server: mismo fetch que Rankings/Niveles (cero
  // RPC extra por sidebar). Fallback al camino viejo si no hay snapshot.
  const { snapshot, isLoading: snapshotLoading, failed } = useGamificationSnapshot();
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
      .catch((error) => console.error(`Error fetching ${period} leaderboard:`, error))
      .finally(() => {
        if (alive) setFallbackLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [failed, period, limit]);

  const entries = snapshot ? snapshot.periods[period].slice(0, limit) : fallbackEntries;
  const isLoading = snapshot ? false : failed ? fallbackLoading : snapshotLoading;

  return (
    <div className={`titanium-bezel ${className}`}>
      <div className="titanium-screen p-4">
        {showTitle && (
          <h4 className="font-semibold text-foreground mb-3">
            {PERIOD_LABELS[period]}
          </h4>
        )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : entries.length > 0 ? (
        <div className="space-y-2">
          {entries.map((entry) => {
            const rankStyle = RANK_STYLES[entry.rank] || 'bg-muted text-muted-foreground';

            return (
              <Link
                key={entry.user_id}
                href={`/profile/${entry.user_id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5 transition-colors"
              >
                {/* Rank Badge */}
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${rankStyle}`}
                >
                  {entry.rank}
                </span>

                {/* Avatar with optional level badge */}
                <div className="relative">
                  {entry.avatar_url ? (
                    <div className="relative w-8 h-8 rounded-full overflow-hidden">
                      <Image
                        src={sbAvatar(entry.avatar_url, 32)}
                        alt={entry.full_name}
                        fill
                        sizes="32px"
                        className="object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                      {entry.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  {showLevel && (
                    <div className="absolute -bottom-1 -right-1">
                      <UserLevelBadge level={entry.current_level} size="xs" />
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {entry.full_name}
                  </p>
                </div>

                {/* Points */}
                <span className="text-sm font-semibold text-primary">
                  {period !== 'all' && entry.points_in_period !== undefined
                    ? `+${entry.points_in_period}`
                    : entry.total_points.toLocaleString()}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          {period === 'all'
            ? 'No hay datos aun'
            : `No hay actividad en los ultimos ${period === '7d' ? '7' : '30'} dias`}
        </p>
      )}
      </div>
    </div>
  );
}
