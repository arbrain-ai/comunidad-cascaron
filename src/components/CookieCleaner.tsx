'use client';

import { useEffect } from 'react';

/**
 * Componente que limpia cookies viejas de Supabase auth-helpers-react
 * para evitar conflictos con @supabase/ssr
 */
export function CookieCleaner() {
  useEffect(() => {
    // Solo ejecuta en el cliente
    if (typeof window === 'undefined') return;

    try {
      // Lista de cookies viejas de @supabase/auth-helpers-react que causan conflictos
      const oldCookies = [
        'sb-access-token',
        'sb-refresh-token',
        'supabase-auth-token',
        'sb-auth-token'
      ];

      // Limpiar cada cookie vieja
      oldCookies.forEach(cookieName => {
        // Eliminar para el dominio actual
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        // Eliminar para localhost explícitamente
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost;`;
      });

      console.log('🧹 Cookies viejas de Supabase limpiadas');
    } catch (error) {
      console.error('Error limpiando cookies:', error);
    }
  }, []);

  return null;
}
