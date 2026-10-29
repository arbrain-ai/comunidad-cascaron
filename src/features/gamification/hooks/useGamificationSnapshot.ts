// ============================================
// useGamificationSnapshot — la foto compartida de rankings + distribución
// ============================================
// UN fetch trae los 3 periodos del ranking Y la distribución de niveles,
// computados en el server cada 3 min (/api/gamification/snapshot). Cambiar
// de tab 7d/30d/histórico es instantáneo: los datos ya están aquí.
// El caché de módulo (queryCache) hace que volver a la página sea 0ms de red.

'use client';

import { useEffect, useState } from 'react';
import { getCached, setCached } from '@/shared/lib/queryCache';
import { LeaderboardEntry, LeaderboardPeriod } from '../types';

export interface GamificationSnapshot {
  periods: Record<LeaderboardPeriod, LeaderboardEntry[]>;
  distribution: { level: number; member_count: number }[];
  totalMembers: number;
  generatedAt: string;
}

const KEY = 'gamification:snapshot';

// Dedupe: si el panel de rankings y el de niveles montan a la vez, viaja UN fetch
let inflight: Promise<GamificationSnapshot | null> | null = null;

function fetchSnapshot(): Promise<GamificationSnapshot | null> {
  if (!inflight) {
    inflight = fetch('/api/gamification/snapshot')
      .then((res) => (res.ok ? (res.json() as Promise<GamificationSnapshot>) : null))
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useGamificationSnapshot() {
  const initial = getCached<GamificationSnapshot>(KEY);
  const [snapshot, setSnapshot] = useState<GamificationSnapshot | null>(initial?.data ?? null);
  const [isLoading, setIsLoading] = useState(!initial);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const entry = getCached<GamificationSnapshot>(KEY);
    if (entry) {
      setSnapshot(entry.data);
      setIsLoading(false);
      if (!entry.isStale) return; // fresco: cero red
    }
    let alive = true;
    fetchSnapshot().then((data) => {
      if (!alive) return;
      if (data) {
        setCached(KEY, data);
        setSnapshot(data);
        setFailed(false);
      } else if (!entry) {
        // Sin caché y sin server: los componentes caen a su camino viejo
        setFailed(true);
      }
      setIsLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { snapshot, isLoading, failed };
}
