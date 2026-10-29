// ============================================
// useLeaderboard Hook
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { LeaderboardEntry, LeaderboardPeriod } from '../types';
import { getLeaderboard } from '../services/gamificationService';

export function useLeaderboard(initialPeriod: LeaderboardPeriod = 'all') {
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getLeaderboard(period);
      setEntries(data);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Error al cargar el leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const changePeriod = useCallback((newPeriod: LeaderboardPeriod) => {
    setPeriod(newPeriod);
  }, []);

  return {
    entries,
    period,
    isLoading,
    error,
    changePeriod,
    refetch: fetchLeaderboard,
  };
}
