import { BRAND } from '@/shared/config/brand';

/**
 * Helper para obtener la URL de redirección correcta según el entorno
 * Evita problemas de redirección entre localhost y producción
 *
 * IMPORTANTE: Siempre detecta dinámicamente el entorno actual
 * NO depende de NEXT_PUBLIC_SITE_URL para evitar problemas de caché
 */
export function getRedirectUrl(): string {
  // Solo funciona en el cliente (browser)
  if (typeof window !== 'undefined') {
    // Usar window.location.origin que ya incluye protocol + hostname + port
    // Ejemplo: http://localhost:3001 o https://tu-dominio.com
    return window.location.origin;
  }

  // Fallback para SSR: NEXT_PUBLIC_SITE_URL (o localhost) vía BRAND
  return BRAND.siteUrl;
}

/**
 * Obtiene la URL de callback para OAuth con ruta específica
 * Por defecto redirige a la raíz "/"
 *
 * Ejemplos:
 * - getAuthCallbackUrl() → http://localhost:3001/
 * - getAuthCallbackUrl('/community') → http://localhost:3001/community
 */
export function getAuthCallbackUrl(path: string = '/'): string {
  const baseUrl = getRedirectUrl();

  // Asegurar que path empiece con "/"
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${cleanPath}`;
}
