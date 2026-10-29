'use client';

// ============================================
// SALA v2 - el estado de la sala, tal como lo dice el SERVIDOR
// ============================================
// Fuente de verdad: GET /api/video-calling/sala/estado. Se pide al entrar,
// cada 5 s (el heartbeat que ademas dispara el arbitro en el servidor) y al
// instante cuando Realtime avisa que `estado_version` cambio o que hubo un
// turno nuevo. Nada del gobierno de la sala vive en un broadcast entre
// clientes: quien entra tarde ve exactamente lo mismo que quien estaba.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/shared/lib/supabase';
import type { EstadoSala, Modo } from '../services/salaService';

export type AccionSala =
  | { accion: 'foco'; identity: string | null }
  | { accion: 'mudanza'; url: string | null }
  | { accion: 'orador'; identity: string }
  | { accion: 'anfitrion_entro' }
  | { accion: 'modo'; modo: Modo }
  | { accion: 'silenciar_todos' }
  | { accion: 'silenciar'; identity: string }
  | { accion: 'dar_palabra'; identity: string }
  | { accion: 'quitar_palabra'; identity: string }
  | { accion: 'regalar_tiempo'; identity: string; segundos?: number }
  | { accion: 'expulsar'; identity: string }
  | { accion: 'terminar' }
  | { accion: 'ceder_palabra' };

export interface ResultadoAccion {
  ok: boolean;
  status?: number;
  error?: string;
  data?: unknown;
}

const CADA_MS = 5_000;

interface Opciones {
  sessionId: string | null;
  /** Identidades vivas en la sala (para traer sus presupuestos). */
  identidades?: string[];
  inicial?: EstadoSala | null;
  /** La identity de ESTA conexión (user.id o user.id~dispositivo). */
  yo?: string | null;
}

export function useSala({ sessionId, identidades = [], inicial = null, yo = null }: Opciones) {
  const yoRef = useRef<string | null>(yo);
  yoRef.current = yo;
  const [estado, setEstado] = useState<EstadoSala | null>(inicial);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identidadesRef = useRef<string[]>(identidades);
  identidadesRef.current = identidades;
  const enVuelo = useRef(false);
  const offsetServidor = useRef(0);

  const token = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const refrescar = useCallback(async () => {
    if (!sessionId || enVuelo.current) return;
    enVuelo.current = true;
    try {
      const t = await token();
      if (!t) return;
      const ids = identidadesRef.current.slice(0, 80).join(',');
      const r = await fetch(`/api/video-calling/sala/estado?session_id=${encodeURIComponent(sessionId)}&identidades=${encodeURIComponent(ids)}${yoRef.current ? `&yo=${encodeURIComponent(yoRef.current)}` : ''}`, {
        headers: { Authorization: `Bearer ${t}` },
        cache: 'no-store',
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setError(e.error || `estado ${r.status}`);
        return;
      }
      const { data } = await r.json() as { data: EstadoSala };
      offsetServidor.current = Date.parse(data.servidor_ahora) - Date.now();
      setEstado(prev => prev && prev.sesion.id === data.sesion.id && prev.sesion.estado_version > data.sesion.estado_version ? prev : data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sin estado');
    } finally {
      enVuelo.current = false;
      setCargando(false);
    }
  }, [sessionId, token]);

  // Heartbeat + primera lectura
  useEffect(() => {
    if (!sessionId) return;
    setCargando(true);
    refrescar();
    const id = setInterval(refrescar, CADA_MS);
    return () => clearInterval(id);
  }, [sessionId, refrescar]);

  // Realtime: cualquier cambio de version o de turno → releer YA (con un respiro de 250 ms)
  useEffect(() => {
    if (!sessionId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pronto = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refrescar, 250);
    };
    const canal = supabase
      .channel(`sala:estado:${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'video_sessions', filter: `id=eq.${sessionId}` }, pronto)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_turnos', filter: `session_id=eq.${sessionId}` }, pronto)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(canal);
    };
  }, [sessionId, refrescar]);

  const accion = useCallback(async (a: AccionSala): Promise<ResultadoAccion> => {
    if (!sessionId) return { ok: false, error: 'sin sesion' };
    try {
      const t = await token();
      if (!t) return { ok: false, error: 'sin sesion de usuario' };
      const r = await fetch('/api/video-calling/sala/accion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ session_id: sessionId, yo: yoRef.current, ...a }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, status: r.status, error: cuerpo.error || `accion ${r.status}` };
      if (cuerpo.estado) {
        const nuevo = cuerpo.estado as EstadoSala;
        offsetServidor.current = Date.parse(nuevo.servidor_ahora) - Date.now();
        // La respuesta de una accion trae solo MI presupuesto; los de los demas se
        // conservan hasta el siguiente latido (si no, los relojes parpadean).
        setEstado((prev) => prev && prev.sesion.id === nuevo.sesion.id && prev.sesion.estado_version > nuevo.sesion.estado_version
          ? prev : ({ ...nuevo, presupuestos: { ...(prev?.presupuestos ?? {}), ...nuevo.presupuestos } }));
      }
      return { ok: true, data: cuerpo.data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'fallo la accion' };
    }
  }, [sessionId, token]);

  /** Reloj alineado al servidor (para cuentas regresivas honestas). */
  const ahora = useCallback(() => Date.now() + offsetServidor.current, []);

  const derivado = useMemo(() => {
    const s = estado;
    const gobierna = s ? s.mi_rol === 'anfitrion' || s.mi_rol === 'moderador' : false;
    return {
      gobierna,
      soyAnfitrion: s?.mi_rol === 'anfitrion',
      modo: s?.sesion.modo ?? 'abierta',
      /** Lo que el evento dice del modo (null = el anfitrion decide al entrar). */
      modoEvento: s?.modo_evento ?? null,
      terminada: !!s?.sesion.ended_at,
      grabando: s?.sesion.recording_status === 'recording',
      anfitrionPresente: !!s?.sesion.anfitrion_entro_at,
      turnosActivos: new Map((s?.turnos_activos ?? []).map((t) => [t.identity, t])),
    };
  }, [estado]);

  return { estado, cargando, error, refrescar, accion, ahora, ...derivado };
}
