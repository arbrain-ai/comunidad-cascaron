'use client';

import { useState, useEffect } from 'react';
import { MemberLocation } from '../types';
import { getMembersWithLocation } from '../services/mapService';
import { getCached, setCached } from '@/shared/lib/queryCache';

const KEY = 'map:members';

export function useMapMembers() {
  // Paint-first: al volver al mapa los pines aparecen al instante desde el
  // caché de módulo y se revalidan en silencio (los miembros del mapa cambian
  // lento; cero pantalla en blanco de Leaflet al volver).
  const initial = getCached<MemberLocation[]>(KEY);
  const [members, setMembers] = useState<MemberLocation[]>(initial?.data ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      setError(null);
      const data = await getMembersWithLocation();
      setCached(KEY, data);
      setMembers(data);
    } catch (err) {
      console.error('Error fetching map members:', err);
      if (!opts?.silent) setError('Error al cargar los miembros del mapa');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    const entry = getCached<MemberLocation[]>(KEY);
    if (entry) {
      setMembers(entry.data);
      setLoading(false);
      if (entry.isStale) fetchMembers({ silent: true });
    } else {
      fetchMembers();
    }
  }, []);

  return {
    members,
    loading,
    error,
    refetch: fetchMembers,
  };
}
