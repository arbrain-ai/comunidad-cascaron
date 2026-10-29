import Link from 'next/link';
import { BRAND } from '@/shared/config/brand';

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />

      <div className="relative z-10 text-center max-w-lg">
        {/* Glitch-style 404 number */}
        <div className="relative mb-8">
          <span className="text-[180px] sm:text-[220px] font-bold leading-none tracking-tighter bg-gradient-to-b from-primary via-primary/60 to-transparent bg-clip-text text-transparent select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[180px] sm:text-[220px] font-bold leading-none tracking-tighter text-primary/5 select-none blur-sm">
              404
            </span>
          </div>
        </div>

        {/* Glass card */}
        <div className="backdrop-blur-xl bg-surface/60 border border-border/30 rounded-2xl p-8 shadow-2xl shadow-primary/5">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 font-[var(--font-space-grotesk)]">
            Pagina no encontrada
          </h1>
          <p className="text-muted text-base mb-8 leading-relaxed">
            El contenido que buscas no existe o fue movido.
            <br />
            Vuelve a la comunidad y sigue construyendo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/community"
              className="btn-primary inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Ir a la comunidad
            </Link>
            <Link
              href="/calendar"
              className="btn-secondary inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendario
            </Link>
          </div>
        </div>

        {/* Subtle branding */}
        <p className="mt-8 text-xs text-muted/50">
          {BRAND.name} &middot; {BRAND.tagline}
        </p>
      </div>
    </div>
  );
}
