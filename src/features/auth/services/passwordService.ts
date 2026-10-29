/**
 * Password Service - Gestion de contrasenas
 *
 * Permite a usuarios OAuth agregar contrasena y a usuarios existentes cambiarla.
 */

import { supabase } from '@/shared/lib/supabase';
import type { PasswordUpdateResult, PasswordValidation, UserIdentity, AuthProvider } from '../types';

/**
 * Valida que la contrasena cumpla requisitos minimos
 */
export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('La contrasena debe tener al menos 8 caracteres');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Debe contener al menos una mayuscula');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Debe contener al menos una minuscula');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Debe contener al menos un numero');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Obtiene informacion sobre las identidades del usuario actual
 * Detecta si tiene Google, email con password, etc.
 */
export async function getUserIdentities(): Promise<UserIdentity | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('Error getting user:', error);
      return null;
    }

    // Supabase almacena las identidades vinculadas en user.identities
    const identities = user.identities || [];

    // Determinar el provider principal
    let provider: AuthProvider = 'email';
    const hasGoogleIdentity = identities.some(id => id.provider === 'google');
    const hasEmailIdentity = identities.some(id => id.provider === 'email');

    if (hasGoogleIdentity && !hasEmailIdentity) {
      provider = 'google';
    } else if (hasGoogleIdentity && hasEmailIdentity) {
      // Usuario tiene ambos - considerar como email (tiene password)
      provider = 'email';
    }

    // Detectar si tiene password configurado
    // Un usuario tiene password si:
    // 1. Tiene identidad 'email' (se registro con email/password)
    // 2. O si uso updateUser({ password }) despues de OAuth
    // La forma mas fiable es verificar si encrypted_password existe (no accesible desde cliente)
    // Usamos la presencia de identidad 'email' como proxy
    const hasPassword = hasEmailIdentity;

    return {
      provider,
      hasPassword,
      email: user.email || '',
    };
  } catch (err) {
    console.error('Error in getUserIdentities:', err);
    return null;
  }
}

/**
 * Establece o actualiza la contrasena del usuario actual
 *
 * Para usuarios OAuth: Agrega contrasena como metodo adicional de login
 * Para usuarios email: Cambia la contrasena existente
 */
export async function updatePassword(newPassword: string): Promise<PasswordUpdateResult> {
  // Validar contrasena
  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors[0],
    };
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('Error updating password:', error);

      // Manejar errores comunes
      if (error.message.includes('same_password')) {
        return {
          success: false,
          error: 'La nueva contrasena debe ser diferente a la actual',
        };
      }

      return {
        success: false,
        error: error.message || 'Error al actualizar la contrasena',
      };
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error updating password:', err);
    return {
      success: false,
      error: 'Error inesperado. Intenta de nuevo.',
    };
  }
}

/**
 * Verifica si la contrasena actual es correcta
 * Util para flujo de "cambiar contrasena" donde se pide la actual primero
 */
export async function verifyCurrentPassword(email: string, currentPassword: string): Promise<boolean> {
  try {
    // Intentar hacer sign in con las credenciales
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    return !error;
  } catch {
    return false;
  }
}
