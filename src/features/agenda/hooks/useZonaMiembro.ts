'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { guardarZona } from '../services/agendaService';
import { zonaDelNavegador, ZONA_CASA } from '../lib/tiempo';

const LS = 'app.agenda.zona';

/**
 * La zona del miembro: la del perfil SIEMBRA, el miembro MANDA.
 *
 * Bug encontrado en la prueba del 1 sep 2026: la primera version re-aplicaba
 * `profiles.timezone` en cada render en que `zona` cambiaba, asi que en cuanto
 * el miembro elegia otra zona en el selector el efecto la revertia. El perfil
 * ganaba siempre y la zona era, en la practica, inmutable. El arreglo es que la
 * siembra ocurra UNA sola vez (`sembrada`), y de ahi en adelante mande la
 * eleccion del miembro.
 */
export function useZonaMiembro() {
  const { userProfile } = useUserProfile();
  const [zona, setZona] = useState<string>(() => {
    if (typeof window === 'undefined') return ZONA_CASA;
    try { return localStorage.getItem(LS) || zonaDelNavegador(); } catch { return zonaDelNavegador(); }
  });
  const sembrada = useRef(false);

  useEffect(() => {
    if (sembrada.current || !userProfile?.id) return;
    sembrada.current = true;

    const guardada = (userProfile as { timezone?: string | null }).timezone;
    let elegida: string | null = null;
    try { elegida = localStorage.getItem(LS); } catch { /* modo privado */ }

    // lo que el miembro ya eligio en este dispositivo gana sobre el perfil
    if (elegida) {
      if (elegida !== guardada) guardarZona(userProfile.id, elegida).catch(() => {});
      return;
    }
    if (guardada) {
      setZona(guardada);
      try { localStorage.setItem(LS, guardada); } catch { /* noop */ }
      return;
    }
    // primera vez: sembramos el perfil con lo que dice el navegador, para que
    // el CRON de recordatorios y el agente hablen en la MISMA hora que la pantalla
    const z = zonaDelNavegador();
    setZona(z);
    try { localStorage.setItem(LS, z); } catch { /* noop */ }
    guardarZona(userProfile.id, z).catch(() => {});
  }, [userProfile]);

  const cambiar = useCallback((z: string) => {
    setZona(z);
    try { localStorage.setItem(LS, z); } catch { /* noop */ }
    if (userProfile?.id) guardarZona(userProfile.id, z).catch(() => {});
  }, [userProfile?.id]);

  return { zona, cambiar };
}
