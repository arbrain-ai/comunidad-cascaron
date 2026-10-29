// ─────────────────────────────────────────────────────────────
// BRAND: punto unico de marca del cascaron.
// Cambia estos valores (o sus variables NEXT_PUBLIC_BRAND_*) y se
// propagan a metadata, header, login, emails y PWA.
// ─────────────────────────────────────────────────────────────

export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'Mi Comunidad',
  shortName: process.env.NEXT_PUBLIC_BRAND_SHORT || 'Comunidad',
  tagline:
    process.env.NEXT_PUBLIC_BRAND_TAGLINE ||
    'Aprende, comparte y crece con tu comunidad',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@example.com',
} as const;

export type Brand = typeof BRAND;
