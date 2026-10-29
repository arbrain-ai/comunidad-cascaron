// ============================================
// Resend Email Client - Singleton Instance
// ============================================

import { Resend } from 'resend';
import { BRAND } from '@/shared/config/brand';

let resendInstance: Resend | null = null;

/**
 * Get or create Resend client singleton
 * @throws Error if RESEND_API_KEY is not configured
 */
export function getResend(): Resend {
  if (!resendInstance) {
    // .trim() blinda contra whitespace/newlines pegados en la env var (Vercel).
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('[Resend] RESEND_API_KEY environment variable is not configured');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

/**
 * Formatted "From" address for emails.
 * SIEMPRE .trim(): un salto de linea pegado en la env var produce un "From"
 * invalido y Resend rechaza el envio completo.
 */
const RESEND_FROM_NAME = (process.env.RESEND_FROM_NAME || BRAND.name).trim();
const RESEND_FROM_EMAIL = (process.env.RESEND_FROM_EMAIL || BRAND.supportEmail).trim();
export const EMAIL_FROM = `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`;

/**
 * Site URL for building links in emails
 */
export const SITE_URL = BRAND.siteUrl.trim();
