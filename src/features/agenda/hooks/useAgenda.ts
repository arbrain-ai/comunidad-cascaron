'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { traerAgenda, misRecordatorios, traerSalasVivas, conSalasVivas } from '../services/agendaService';
import { claveDia, etiquetaDia } from '../lib/tiempo';
import { formatInTimeZone } from 'date-fns-tz';
import type { Clase, DiaAgenda } from '../types';
import { getCached, setCached } from '@/shared/lib/queryCache';

export function useAgenda(zona: string) {
  const { userProfile } = useUserProfile();
  const tier = userProfile?.tier ?? null;
  const [clases, setClases] = useState<Clase[]>(() => getCached<Clase[]>('agenda')?.data ?? []);
  const [avisos, setAvisos] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(clases.length === 0);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const d = await traerAgenda({ tier });
      setCached('agenda', d);
      setClases(d);
      setError(null);
    } catch (e) {
      if (clases.length === 0) setError(e instanceof Error ? e.message : 'No pude leer la agenda');
    } finally { setCargando(false); }
  }, [tier, clases.length]);

  useEffect(() => { recargar(); /* eslint-disable-next-line */ }, [tier]);

  // LAS SALAS VIVAS SE REFRESCAN SOLAS (cada 30 s, con la pestaña visible): una
  // clase que se alarga sigue mostrando "Entrar" mientras la sesion este abierta,
  // y al cerrarse el anfitrion la sesion, el reloj vuelve a mandar.
  useEffect(() => {
    let vivo = true;
    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const vivas = await traerSalasVivas();
        if (vivo) setClases((prev) => conSalasVivas(prev, vivas));
      } catch { /* sin red, el reloj sigue solo */ }
    };
    const id = setInterval(tick, 30_000);
    return () => { vivo = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!userProfile?.id) return;
    misRecordatorios(userProfile.id).then(setAvisos).catch(() => {});
  }, [userProfile?.id]);

  /** Agrupado por dia LOCAL DEL MIEMBRO — no por UTC ni por la zona del anfitrion. */
  const dias: DiaAgenda[] = useMemo(() => {
    const hoy = formatInTimeZone(new Date(), zona, 'yyyy-MM-dd');
    const mapa = new Map<string, Clase[]>();
    for (const c of clases) {
      const k = claveDia(c.start_time, zona);
      // no arrastramos dias pasados a la agenda: solo hoy en adelante
      if (k < hoy) continue;
      (mapa.get(k) ?? mapa.set(k, []).get(k)!).push({ ...c, recordatorio: avisos.has(c.id) });
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, cs]) => {
        const { titulo, relativo } = etiquetaDia(clave, zona);
        return {
          clave, titulo, relativo, esHoy: clave === hoy,
          clases: cs.sort((x, y) => x.start_time.localeCompare(y.start_time)),
        };
      });
  }, [clases, zona, avisos]);

  const marcarAviso = useCallback((id: string, on: boolean) => {
    setAvisos((prev) => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; });
  }, []);

  return { dias, clases, cargando, error, recargar, marcarAviso };
}
