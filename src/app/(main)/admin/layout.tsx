import { redirect } from 'next/navigation';
import { ActionAuthorizationError, requireAdminActionActor } from '@/shared/lib/server-action-auth';
import { mfaLoginPath } from '@/shared/lib/mfa-flow';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdminActionActor();
  } catch (error) {
    if (!(error instanceof ActionAuthorizationError)) throw error;
    if (error.status === 401) redirect(mfaLoginPath('/admin'));
    if (error.code === 'MFA_REQUIRED') redirect('/auth/mfa?next=%2Fadmin');
    redirect('/community');
  }
  return children;
}
