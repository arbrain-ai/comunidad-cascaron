import type { Metadata } from 'next';
import { BRAND } from '@/shared/config/brand';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { mfaLoginPath, safeMfaNext } from '@/shared/lib/mfa-flow';
import MfaForm from './mfa-form';

export const metadata: Metadata = {
  title: `Verificación de seguridad | ${BRAND.name}`,
  robots: { index: false, follow: false }, referrer: 'no-referrer',
};

export default async function MfaPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeMfaNext((await searchParams).next);
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect(mfaLoginPath(next));
  // This page deliberately requires AAL1 only; AAL2 guards must lead here.
  return <MfaForm next={next} />;
}
