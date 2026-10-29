'use client';

import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, Shield } from 'lucide-react';
import { getUserIdentities, updatePassword, validatePassword } from '@/features/auth/services/passwordService';
import type { UserIdentity, PasswordValidation } from '@/features/auth/types';

interface PasswordSectionProps {
  className?: string;
}

export function PasswordSection({ className = '' }: PasswordSectionProps) {
  // Estado de identidad del usuario
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [isLoadingIdentity, setIsLoadingIdentity] = useState(true);

  // Estado del formulario
  const [isExpanded, setIsExpanded] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Estado de validacion y guardado
  const [validation, setValidation] = useState<PasswordValidation>({ isValid: false, errors: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Cargar identidad del usuario al montar
  useEffect(() => {
    const loadIdentity = async () => {
      setIsLoadingIdentity(true);
      const userIdentity = await getUserIdentities();
      setIdentity(userIdentity);
      setIsLoadingIdentity(false);
    };
    loadIdentity();
  }, []);

  // Validar password en tiempo real
  useEffect(() => {
    if (newPassword) {
      setValidation(validatePassword(newPassword));
    } else {
      setValidation({ isValid: false, errors: [] });
    }
  }, [newPassword]);

  // Manejar guardado
  const handleSave = async () => {
    setError(null);
    setSuccess(false);

    // Validar que las contrasenas coincidan
    if (newPassword !== confirmPassword) {
      setError('Las contrasenas no coinciden');
      return;
    }

    // Validar requisitos
    if (!validation.isValid) {
      setError(validation.errors[0]);
      return;
    }

    setIsSaving(true);

    const result = await updatePassword(newPassword);

    setIsSaving(false);

    if (result.success) {
      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setIsExpanded(false);
      // Recargar identidad para reflejar cambio
      const updatedIdentity = await getUserIdentities();
      setIdentity(updatedIdentity);
      // Auto-ocultar mensaje de exito
      setTimeout(() => setSuccess(false), 5000);
    } else {
      setError(result.error || 'Error al actualizar contrasena');
    }
  };

  // Loading state
  if (isLoadingIdentity) {
    return (
      <div className={`space-y-4 pt-4 border-t border-border/50 ${className}`}>
        <div className="flex items-center gap-2 text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Cargando configuracion de seguridad...</span>
        </div>
      </div>
    );
  }

  // No hay usuario autenticado
  if (!identity) {
    return null;
  }

  const isOAuthOnly = identity.provider === 'google' && !identity.hasPassword;
  const title = isOAuthOnly ? 'Agregar contrasena' : 'Cambiar contrasena';
  const description = isOAuthOnly
    ? 'Agrega una contrasena para poder entrar sin usar Google'
    : 'Actualiza tu contrasena de acceso';

  return (
    <div className={`space-y-4 pt-4 border-t border-border/50 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 text-foreground">
        <Shield className="w-5 h-5" />
        <span className="font-medium">Seguridad</span>
      </div>

      {/* Success Message */}
      {success && (
        <div className="p-3 bg-success/10 border border-success/30 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
          <span className="text-sm text-success">
            {isOAuthOnly ? 'Contrasena agregada correctamente' : 'Contrasena actualizada correctamente'}
          </span>
        </div>
      )}

      {/* Card */}
      <div className="p-4 bg-secondary/20 rounded-lg border border-border/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              {title}
            </h4>
            <p className="text-xs text-muted">{description}</p>

            {/* Provider info */}
            {identity.provider === 'google' && (
              <p className="text-xs text-muted mt-2 flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Conectado con Google ({identity.email})
              </p>
            )}
          </div>

          {!isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="btn-secondary text-sm"
            >
              {isOAuthOnly ? 'Agregar' : 'Cambiar'}
            </button>
          )}
        </div>

        {/* Expanded Form */}
        {isExpanded && (
          <div className="mt-4 space-y-4">
            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm text-muted mb-2">
                {isOAuthOnly ? 'Nueva contrasena' : 'Nueva contrasena'}
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Minimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Validation hints */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <ValidationItem
                    isValid={newPassword.length >= 8}
                    text="Al menos 8 caracteres"
                  />
                  <ValidationItem
                    isValid={/[A-Z]/.test(newPassword)}
                    text="Una letra mayuscula"
                  />
                  <ValidationItem
                    isValid={/[a-z]/.test(newPassword)}
                    text="Una letra minuscula"
                  />
                  <ValidationItem
                    isValid={/[0-9]/.test(newPassword)}
                    text="Un numero"
                  />
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm text-muted mb-2">
                Confirmar contrasena
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Repite la contrasena"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-error flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Las contrasenas no coinciden
                </p>
              )}
              {confirmPassword && newPassword === confirmPassword && validation.isValid && (
                <p className="mt-1 text-xs text-success flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Las contrasenas coinciden
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !validation.isValid || newPassword !== confirmPassword}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  setNewPassword('');
                  setConfirmPassword('');
                  setError(null);
                }}
                disabled={isSaving}
                className="px-4 py-2 bg-secondary/50 hover:bg-secondary text-foreground text-sm rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente auxiliar para items de validacion
function ValidationItem({ isValid, text }: { isValid: boolean; text: string }) {
  return (
    <p className={`text-xs flex items-center gap-1 ${isValid ? 'text-success' : 'text-muted'}`}>
      {isValid ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <span className="w-3 h-3 rounded-full border border-current" />
      )}
      {text}
    </p>
  );
}
