import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { BRAND } from '@/shared/config/brand';
import { createServerSupabaseClient } from '@/shared/lib/supabase-server';

export const metadata: Metadata = {
  title: `Sin acceso | ${BRAND.name}`,
};

async function cerrarSesion(): Promise<void> {
  'use server';
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// Destino del layout (main) cuando profiles.has_community_access es false.
export default function SinAccesoPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border/30 bg-surface/60 p-8 text-center backdrop-blur-xl">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.png" alt={BRAND.name} width={56} height={56} className="rounded-xl" />
          <p className="text-sm text-muted">{BRAND.name}</p>
          <h1 className="text-xl font-semibold text-foreground">Aún no tienes acceso</h1>
        </div>
        <p className="text-base leading-relaxed text-muted">
          Tu cuenta aún no tiene acceso a la comunidad. Pídele a un administrador que te lo active.
        </p>
        <form action={cerrarSesion} className="flex flex-col gap-3">
          <button type="submit" className="btn-primary w-full">
            Cerrar sesión y volver al login
          </button>
        </form>
        <p className="text-xs text-muted/70">
          ¿Dudas? Escríbenos a{' '}
          <a href={`mailto:${BRAND.supportEmail}`} className="underline">
            {BRAND.supportEmail}
          </a>
        </p>
      </div>
    </div>
  );
}
