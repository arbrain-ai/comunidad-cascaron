'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef
} from 'react';
import { UserProfile } from '@/shared/types/user.types';
import { supabase } from '@/shared/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { logger } from '@/shared/utils/logger';

interface UserProfileContextType {
  userProfile: UserProfile | null;
  isLoading: boolean;
  isLoadingProfile: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  currentSession: Session | null;
  refetchUserProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(
  undefined
);

export const UserProfileProvider: React.FC<{ children: ReactNode }> = ({
  children
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const hasProcessedSignIn = useRef<boolean>(false);
  const isProcessingProfile = useRef<boolean>(false);
  // Espejo del userProfile para leerlo dentro de processAuthState sin stale
  // closure (el listener de onAuthStateChange captura el primer render).
  const userProfileRef = useRef<UserProfile | null>(null);
  // ¿Ya se refrescó el perfil contra la DB en ESTA carga? El caché optimista
  // pinta al instante, pero no releva al refresco: sin esta marca, sembrar
  // desde caché haría que el perfil nunca se re-lea y un cambio de rol o tier
  // tardaría en aparecer.
  const hasRefreshedFromDb = useRef<boolean>(false);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  const handleProfileUpdate = useCallback(async (session: Session | null) => {
    if (session?.user) {
      // Prevent race condition - only one profile update at a time
      if (isProcessingProfile.current) {
        return;
      }
      isProcessingProfile.current = true;
      setIsLoadingProfile(true);
      setError(null);

      try {
        // Fetch profile from profiles table
        // El trigger handle_new_user() en la DB crea el perfil automáticamente
        // Solo necesitamos leerlo (con retry por si el trigger aún no terminó)
        let profile = null;
        let attempts = 0;
        const maxAttempts = 2; // Reduced to 2 attempts for better UX

        while (!profile && attempts < maxAttempts) {
          const { data, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (data) {
            profile = data;
          } else if (fetchError?.code === 'PGRST116') {
            // Profile not found yet - trigger might still be running
            attempts++;
            if (attempts < maxAttempts) {
              // Wait 1 segundo (trigger puede tardar en ejecutarse)
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } else if (fetchError) {
            throw fetchError;
          }
        }

        if (profile) {
          setUserProfile(profile);

          // Cache profile in localStorage (Optimistic Auth)
          // This prevents DB queries on page reload
          try {
            localStorage.setItem('cached_user_profile', JSON.stringify(profile));
          } catch {
            // localStorage might be full or disabled
          }

          // Update last_seen for online status tracking (non-blocking)
          supabase
            .from('profiles')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', session.user.id)
            .then(() => {
              // Silent update
            });
        } else {
          // Fallback: crear perfil si el trigger falló
          logger.warn('[UserProfileContext] Profile not found - creating fallback profile');

          const fallbackProfile = {
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email?.split('@')[0] ||
              'Usuario',
            avatar_url: session.user.user_metadata?.avatar_url ||
              session.user.user_metadata?.picture || null,
            // role / tier / onboarding_completed / has_community_access /
            // current_level / total_points los pone la tabla por default
            // ('member', 'no-paid', false, false, 1, 0). Desde el 3 sep el
            // navegador ya no tiene permiso de escribirlos: eran las mismas
            // columnas con las que un miembro podia hacerse owner
            // (migracion 20260903_rls_profiles_columnas).
          };

          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert(fallbackProfile)
            .select()
            .single();

          if (insertError) {
            // Si falla porque ya existe (race condition con trigger), intentar leer de nuevo
            // Códigos: 23505 = unique_violation, PGRST409 = conflict
            if (insertError.code === '23505' || insertError.code === 'PGRST409' || insertError.message?.includes('duplicate')) {
              logger.info('[UserProfileContext] Profile already exists (race condition), fetching...');
              const { data: existingProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (existingProfile) {
                setUserProfile(existingProfile);
                return;
              }
            }
            logger.error('[UserProfileContext] Failed to create fallback profile:', insertError.message || insertError);
            setError(new Error('Could not create profile'));
            setUserProfile(null);
          } else {
            logger.info('[UserProfileContext] Fallback profile created successfully');
            setUserProfile(newProfile);
          }
        }
      } catch (err) {
        logger.error("[UserProfileContext] Error:", err);
        setError(err as Error);
        setUserProfile(null);
      } finally {
        setIsLoadingProfile(false);
        isProcessingProfile.current = false;
      }
    } else {
      setUserProfile(null);
      setIsLoadingProfile(false);

      // Clear cached profile on logout
      try {
        localStorage.removeItem('cached_user_profile');
      } catch {
        // localStorage might be disabled
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let hasInitialized = false;

    // ============================================
    // OPTIMISTIC AUTH: ver si YA hay sesión antes de tocar la red
    // Evita que la UI se quede bloqueada en "Verificando sesión..."
    //
    // IMPORTANTE: Este cache es SOLO para UI (nombre, avatar, loading state)
    // Las decisiones de ACCESO (has_community_access) las hace el Server Layout
    // con datos frescos de DB. Ver: src/app/(main)/layout.tsx
    //
    // ⚠️ Esto llevaba tiempo SIN DISPARAR NUNCA y nadie se enteró: buscaba la
    // sesión en localStorage, pero la app usa @supabase/ssr y ahí la sesión
    // vive en COOKIES — y además FRAGMENTADA en `...auth-token.0` / `.1`
    // cuando no cabe en una. Como la llave nunca aparecía, el camino rápido
    // devolvía false siempre, el perfil cacheado jamás se usaba y cada carga
    // se comía la espera completa. Una optimización escrita, documentada y
    // muerta. Ahora se mira el cajón correcto.
    // ============================================
    const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
      .replace(/^https?:\/\//, '')
      .split('.')[0];
    const SESSION_COOKIE_PREFIX = `sb-${projectRef}-auth-token`;

    const hasSessionCookie = (): boolean => {
      if (typeof document === 'undefined' || !projectRef) return false;
      return document.cookie
        .split(';')
        .some(c => c.trim().startsWith(SESSION_COOKIE_PREFIX));
    };

    const checkLocalSession = (): boolean => {
      if (typeof window === 'undefined') return false;

      try {
        if (!hasSessionCookie()) return false;

        // Hay sesión: no bloquees la UI. La cookie NO se decodifica ni se usa
        // para autorizar (eso es del server) — solo dice "no arranques de cero".
        setIsAuthenticated(true);
        setIsLoading(false);
        hasInitialized = true;

        // Perfil cacheado SOLO para pintar (nombre, avatar, nivel).
        // El refresco contra DB sigue corriendo detrás en processAuthState.
        const cachedProfile = localStorage.getItem('cached_user_profile');
        if (cachedProfile) {
          try {
            const profile = JSON.parse(cachedProfile);
            if (profile?.id) {
              setUserProfile(profile);
            }
          } catch {
            // Invalid cache, will be refreshed from DB
          }
        }

        return true;
      } catch {
        // Invalid token, continue normal flow
      }
      return false;
    };

    // Check localStorage IMMEDIATELY (synchronous)
    const hasLocalSession = checkLocalSession();
    // ============================================

    const processAuthState = async (event: string, session: Session | null) => {
      if (!isMounted) return;

      setCurrentSession(session);
      let newIsAuthenticated = false;

      if (event === 'SIGNED_IN') {
        newIsAuthenticated = true;
        hasProcessedSignIn.current = true;
      } else if (event === 'SIGNED_OUT') {
        newIsAuthenticated = false;
        hasProcessedSignIn.current = false;
      } else {
        newIsAuthenticated = !!session?.user;
      }

      setIsAuthenticated(newIsAuthenticated);

      // Skip profile reload if we already initialized and have a valid session
      // This prevents "Verificando sesión..." flash and unnecessary DB queries on tab switch
      //
      // FIX (7 jul 2026, Goal 3): SOLO saltar si ya tenemos perfil cargado.
      // Race real: en login SPA, INITIAL_SESSION(null) puede llegar ANTES que
      // SIGNED_IN(session) → hasInitialized=true sin perfil → el SIGNED_IN se
      // saltaba el load y userProfile quedaba null hasta recargar la página
      // (like/comentar/publicar deshabilitados justo después del login).
      // El perfil pintado desde el caché optimista es para VER, no la verdad:
      // el refresco contra DB corre siempre una vez por carga. Después de eso
      // sí se puede saltar (cambio de pestaña, re-emisión de token).
      const seededOnly = !hasRefreshedFromDb.current;
      const skipProfileReload = hasInitialized &&
        event !== 'SIGNED_OUT' &&
        session !== null &&
        userProfileRef.current !== null &&
        !seededOnly;

      if (!skipProfileReload && session !== null) {
        hasRefreshedFromDb.current = true;
      }

      if (!skipProfileReload) {
        await handleProfileUpdate(newIsAuthenticated ? session : null);
      }

      hasInitialized = true;
      setIsLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        processAuthState(_event, session);
      }
    );

    // If we already have local session, getSession() runs in background (non-blocking)
    // If no local session, this will block but that's expected for unauthenticated users
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;

      // Log auth errors only (not session state - too verbose for production)
      if (error && process.env.NODE_ENV === 'development') {
        console.log('[Auth Debug] Session error:', error.message);
      }

      // Si hay error de refresh token, limpiar sesión automáticamente
      // Captura variantes: "refresh_token_not_found", "Invalid Refresh Token", etc.
      const isRefreshTokenError = error && (
        error.message?.toLowerCase().includes('refresh_token') ||
        error.message?.toLowerCase().includes('invalid token') ||
        error.name === 'AuthApiError'
      );

      if (isRefreshTokenError) {
        console.log('[Auth] Invalid session, signing out locally...');
        supabase.auth.signOut({ scope: 'local' }).then(() => {
          processAuthState('SIGNED_OUT', null);
        });
        return;
      }

      // Log critical auth errors only
      if (error) {
        logger.error('[Auth Error]:', error.message);
      }

      processAuthState('INITIAL_SESSION', session);
    }).catch((err) => {
      // Manejar errores de autenticación sin romper la app
      logger.error('[Auth Session Error]:', err.message || err);
      if (isMounted) {
        processAuthState('SIGNED_OUT', null);
      }
    });

    return () => {
      isMounted = false;
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [handleProfileUpdate]);

  // Periodic last_seen update (every 5 minutes while active)
  useEffect(() => {
    if (!userProfile?.id) return;

    const updateLastSeen = () => {
      supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', userProfile.id)
        .then(() => {
          // Silent update
        });
    };

    // Update every 15 minutes (optimized for scalability - reduces DB load by 66%)
    const interval = setInterval(updateLastSeen, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userProfile?.id]);

  // Keep session alive - refresh token periodically (best practice)
  // Supabase tokens expire in 1 hour by default, refresh every 45 min
  useEffect(() => {
    if (!currentSession) return;

    const refreshSession = async () => {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        logger.warn('[Auth] Session refresh failed:', error.message);
      }
    };

    const interval = setInterval(refreshSession, 45 * 60 * 1000); // 45 minutes

    return () => clearInterval(interval);
  }, [currentSession]);

  const refetchUserProfile = async () => {
    if (currentSession) {
      await handleProfileUpdate(currentSession);
    }
  };

  return (
    <UserProfileContext.Provider
      value={{
        userProfile,
        isLoading,
        isLoadingProfile,
        error,
        isAuthenticated,
        currentSession,
        refetchUserProfile
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile debe usarse dentro de UserProfileProvider');
  }
  return context;
};
