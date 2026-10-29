'use client';

import { useUserProfile } from '@/contexts/UserProfileContext';
import { supabase } from '@/shared/lib/supabase';

/**
 * Hook personalizado que combina funcionalidad de autenticación
 *
 * @example
 * const { user, isAuthenticated, signOut } = useAuth();
 */
export function useAuth() {
  const {
    userProfile,
    isLoading,
    isAuthenticated,
    currentSession,
    refetchUserProfile
  } = useUserProfile();

  /**
   * Cerrar sesión
   */
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return {
    user: currentSession?.user ?? null,
    userProfile,
    isLoading,
    isAuthenticated,
    session: currentSession,
    signOut,
    refetchProfile: refetchUserProfile,
  };
}
