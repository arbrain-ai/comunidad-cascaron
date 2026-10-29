/**
 * Auth Types - Sistema de autenticacion
 */

export type AuthProvider = 'email' | 'google' | 'github';

export interface UserIdentity {
  provider: AuthProvider;
  hasPassword: boolean;
  email: string;
}

export interface PasswordUpdateResult {
  success: boolean;
  error?: string;
}

export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}
