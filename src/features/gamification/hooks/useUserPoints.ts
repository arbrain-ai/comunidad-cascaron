// ============================================
// useUserPoints Hook
// ============================================
// Handles user points, level, and level-up detection
// Supports both offline (on next visit) and online (realtime) level-up detection

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { supabase } from '@/shared/lib/supabase';
import { UserPoints, getLevelProgress, getPointsForNextLevel, getLevelInfo } from '../types';
import { getUserPoints, getUserRank } from '../services/gamificationService';
import {
  checkLevelUp,
  clearPendingCelebration,
  getLastKnownLevel,
  saveCurrentLevel,
  savePendingCelebration,
  validateAndGetPendingCelebration,
  LevelUpData,
} from '../stores/levelUpStore';
import { getCached, setCached } from '@/shared/lib/queryCache';

interface PointsSnapshot {
  points: UserPoints | null;
  rank: number | null;
}

/**
 * Peticiones EN VUELO, compartidas entre todos los que monten este hook.
 *
 * ⚠️ El hook lo usan tres componentes a la vez (la página de leaderboard, la
 * escalera de niveles y el avisador de subida de nivel). Cada instancia salía
 * a la red por su cuenta: TRES lecturas del mismo perfil y TRES conteos de
 * ranking sobre toda la tabla de profiles, simultáneas y con los mismos
 * argumentos. En /leaderboard eso era la mitad de sus 15 viajes, y con esa
 * congestión las peticiones pasaban de ~170ms a 400-1300ms cada una.
 *
 * Ahora el primero que pregunta abre el viaje y los demás se suben al mismo.
 * Se limpia al terminar, así que un refetch posterior vuelve a salir de cero.
 */
const enVuelo = new Map<string, Promise<PointsSnapshot>>();

function traerPuntosCompartido(
  userId: string,
  known: { total_points?: number | null; role?: string | null }
): Promise<PointsSnapshot> {
  const existente = enVuelo.get(userId);
  if (existente) return existente;

  const viaje = Promise.all([getUserPoints(userId), getUserRank(userId, known)])
    .then(([points, rank]) => ({ points, rank }))
    .finally(() => {
      enVuelo.delete(userId);
    });

  enVuelo.set(userId, viaje);
  return viaje;
}

export function useUserPoints() {
  const { userProfile } = useUserProfile();
  // Paint-first: el último snapshot pinta al instante al volver a la página;
  // la revalidación (siempre, en silencio) corre el check de level-up sobre
  // data fresca como siempre lo hizo.
  const initialCache = getCached<PointsSnapshot>(userProfile?.id ? `user-points:${userProfile.id}` : null);
  const [points, setPoints] = useState<UserPoints | null>(initialCache?.data.points ?? null);
  const [rank, setRank] = useState<number | null>(initialCache?.data.rank ?? null);
  const [isLoading, setIsLoading] = useState(!initialCache);
  const [levelUpData, setLevelUpData] = useState<LevelUpData | null>(null);
  const currentLevelRef = useRef<number | null>(null);

  const fetchUserPoints = useCallback(async () => {
    if (!userProfile?.id) {
      setIsLoading(false);
      return;
    }

    try {
      // Sin skeleton si ya hay algo pintado (del caché o de un fetch previo)
      setIsLoading((prev) => prev && !getCached(`user-points:${userProfile.id}`));
      // El rango se calcula con los puntos y el rol que el contexto ya trae:
      // se ahorra una lectura en serie de la misma fila de profiles.
      const { points: pointsData, rank: rankData } = await traerPuntosCompartido(
        userProfile.id,
        { total_points: userProfile.total_points, role: userProfile.role }
      );
      setCached(`user-points:${userProfile.id}`, { points: pointsData, rank: rankData });
      setPoints(pointsData);
      setRank(rankData);

      // Check for level-up (offline case) or validate pending celebration
      if (pointsData) {
        currentLevelRef.current = pointsData.current_level;

        // First, check if there's a NEW level-up
        const levelUp = checkLevelUp(pointsData.current_level);
        if (levelUp) {
          setLevelUpData(levelUp);
        } else {
          // No new level-up, but check if there's a valid pending celebration
          // This handles the case where user leveled up but closed browser before dismissing
          const validPending = validateAndGetPendingCelebration(pointsData.current_level);
          if (validPending) {
            setLevelUpData(validPending);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching user points:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userProfile?.id]);

  // NOTE: We no longer blindly load pending celebration on mount.
  // Instead, we validate it in fetchUserPoints after we have the current level from DB.
  // This fixes the bug where stale celebrations would re-appear on every session.

  useEffect(() => {
    fetchUserPoints();
  }, [fetchUserPoints]);

  // Realtime subscription for online level-up detection
  useEffect(() => {
    if (!userProfile?.id) return;

    // Unique channel name per mount evita el bug de React strict mode donde
    // el segundo mount reutiliza la instancia subscribed del primer mount y
    // .on() falla con "cannot add postgres_changes callbacks after subscribe()"
    let isMounted = true;
    const channelName = `profile-level-${userProfile.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userProfile.id}`,
        },
        (payload) => {
          if (!isMounted) return;
          const newLevel = payload.new.current_level as number;
          const newPoints = payload.new.total_points as number;
          const lastKnownLevel = getLastKnownLevel() || currentLevelRef.current || 1;

          // Update local state
          setPoints((prev) =>
            prev
              ? { ...prev, current_level: newLevel, total_points: newPoints }
              : prev
          );

          // Check if leveled up in realtime
          if (newLevel > lastKnownLevel) {
            const levelUpData: LevelUpData = {
              previousLevel: lastKnownLevel,
              newLevel: newLevel,
            };
            savePendingCelebration(levelUpData);
            saveCurrentLevel(newLevel);
            setLevelUpData(levelUpData);
            currentLevelRef.current = newLevel;
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [userProfile?.id]);

  // Function to dismiss the level-up celebration
  const dismissLevelUp = useCallback(() => {
    // Save the current level BEFORE clearing, so the celebration is marked as "consumed"
    // This ensures validateAndGetPendingCelebration won't restore it
    if (currentLevelRef.current !== null) {
      saveCurrentLevel(currentLevelRef.current);
    }
    setLevelUpData(null);
    clearPendingCelebration();
  }, []);

  // QA SOLO EN DEV: `?qa_level=N` simula el nivel del espectador para verificar
  // candados por nivel sin escribir en la BD (guardrails v2: prod jamás se toca
  // para probar). En build de producción este bloque es inerte.
  let qaPoints = points;
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined' && points) {
    const qa = new URLSearchParams(window.location.search).get('qa_level');
    const qaLevel = qa ? parseInt(qa, 10) : NaN;
    if (!Number.isNaN(qaLevel) && qaLevel >= 1 && qaLevel <= 9) {
      qaPoints = { ...points, current_level: qaLevel };
    }
  }

  const levelInfo = qaPoints ? getLevelInfo(qaPoints.current_level) : null;
  const progress = qaPoints ? getLevelProgress(qaPoints.total_points, qaPoints.current_level) : 0;
  const pointsToNextLevel = qaPoints ? getPointsForNextLevel(qaPoints.total_points, qaPoints.current_level) : 0;

  return {
    points: qaPoints,
    rank,
    levelInfo,
    progress,
    pointsToNextLevel,
    isLoading,
    refetch: fetchUserPoints,
    // Level-up celebration
    levelUpData,
    dismissLevelUp,
  };
}
