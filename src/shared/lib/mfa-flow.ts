import type { SupabaseClient } from '@supabase/supabase-js';
import { BRAND } from '@/shared/config/brand';

export type MfaAuth = SupabaseClient['auth'];
export type MfaFactor = { id: string; friendly_name?: string };
export type MfaState =
  | { kind: 'signed_out' }
  | { kind: 'ready'; userId: string }
  | { kind: 'setup'; userId: string }
  | { kind: 'challenge'; userId: string; factors: MfaFactor[] };
export type MfaEnrollment = { factorId: string; qr: string; secret: string };

/** Returns a local UI destination, never a scheme, authority or auth/API loop. */
export function safeMfaNext(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') ||
      value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return '/community';
  try {
    const url = new URL(value, 'https://mfa.invalid');
    let path = url.pathname;
    for (let i = 0; i < 3; i++) path = decodeURIComponent(path);
    if (url.origin !== 'https://mfa.invalid' || /[\\\u0000-\u0020\u007f]/.test(path) || path.startsWith('//') ||
        /^\/(?:auth|api|login|go)(?:\/|$)/i.test(path)) return '/community';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/community'; }
}

export function mfaLoginPath(next: string): string {
  return `/login?redirect=${encodeURIComponent(`/auth/mfa?next=${encodeURIComponent(safeMfaNext(next))}`)}`;
}

export async function loadMfaState(auth: MfaAuth): Promise<MfaState> {
  const user = await auth.getUser();
  if (user.error || !user.data.user) return { kind: 'signed_out' };
  const [factors, assurance] = await Promise.all([auth.mfa.listFactors(), auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (factors.error || assurance.error || !factors.data || !assurance.data) throw new Error('MFA_UNAVAILABLE');
  const userId = user.data.user.id;
  if (assurance.data.currentLevel === 'aal2' && assurance.data.nextLevel === 'aal2') return { kind: 'ready', userId };
  const verified = factors.data.totp.filter(factor => factor.status === 'verified');
  if (verified.length) return { kind: 'challenge', userId, factors: verified };
  // Do not replace a verified phone/security-key factor with a new TOTP factor.
  if (factors.data.all.some(factor => factor.status === 'verified')) throw new Error('MFA_OTHER_FACTOR');
  return { kind: 'setup', userId };
}

/** Called only after the person presses "Configurar". Never from an effect. */
export async function beginMfaEnrollment(auth: MfaAuth): Promise<MfaEnrollment> {
  const factors = await auth.mfa.listFactors();
  if (factors.error || !factors.data) throw new Error('MFA_UNAVAILABLE');
  if (factors.data.all.some(factor => factor.status === 'verified')) throw new Error('MFA_RELOAD');
  // Never unenroll factors, even abandoned ones: another tab may have verified
  // one since listFactors. A fresh name permits an interrupted setup to restart.
  const result = await auth.mfa.enroll({ factorType: 'totp',
    friendlyName: `${BRAND.shortName} ${crypto.randomUUID().slice(0, 8)}`, issuer: BRAND.name });
  if (result.error || !result.data) throw new Error('MFA_UNAVAILABLE');
  const qr = result.data.totp.qr_code;
  if (!qr.startsWith('data:image/svg+xml;')) throw new Error('MFA_UNAVAILABLE');
  return { factorId: result.data.id, qr, secret: result.data.totp.secret };
}

export async function verifyMfaCode(auth: MfaAuth, factorId: string, code: string): Promise<void> {
  if (!/^\d{6}$/.test(code) || !factorId) throw new Error('MFA_INVALID_CODE');
  const result = await auth.mfa.challengeAndVerify({ factorId, code });
  if (result.error) throw new Error('MFA_INVALID_CODE');
  // The SDK stores the upgraded session and notifies the existing cookie client.
  const assurance = await auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== 'aal2' || assurance.data.nextLevel !== 'aal2') {
    throw new Error('MFA_SESSION_NOT_READY');
  }
}

export function mfaErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'MFA_INVALID_CODE') return 'El código no es válido o ya venció. Espera el siguiente e inténtalo de nuevo.';
  if (code === 'MFA_OTHER_FACTOR') return 'Esta cuenta usa otro tipo de segundo factor. Contacta al administrador para recuperar el acceso.';
  if (code === 'MFA_RELOAD') return 'La configuración cambió en otra pestaña. Recarga esta página para continuar.';
  if (code === 'MFA_SESSION_NOT_READY') return 'No se confirmó la sesión segura. Recarga la página e inténtalo de nuevo.';
  return 'No pudimos completar la verificación. Inténtalo de nuevo en unos momentos.';
}
