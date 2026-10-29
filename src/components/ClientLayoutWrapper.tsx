'use client';

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { UserProfileProvider, useUserProfile } from '@/contexts/UserProfileContext';
import { NotificationProvider } from '@/features/notifications/contexts';
import { TabTitleBadge } from '@/features/notifications/components/TabTitleBadge';
import { ToastProvider } from '@/shared/contexts/ToastContext';
import { FocusModeProvider } from '@/shared/contexts/FocusModeContext';
import { CookieCleaner } from './CookieCleaner';
import PWARegister from './PWARegister';

// SIMPLIFICADO: Este componente ya NO toma decisiones de autorización
// El Server Layout (src/app/(main)/layout.tsx) verifica acceso con datos frescos de DB
// Este componente solo maneja: loading UI + providers para features
const AppContent = ({ children }: { children: React.ReactNode }) => {
  const { isLoading, isLoadingProfile, currentSession, userProfile } = useUserProfile();
  const pathname = usePathname();

  // Paths que no necesitan auth - deben coincidir con middleware
  const publicPaths = useMemo(() => ['/login', '/reset-password', '/auth/mfa', '/sin-acceso'], []);
  const isPublicPath = publicPaths.some(p => pathname === p || pathname.startsWith(`${p}/`));

    // Debug logging - only in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ClientLayoutWrapper]', {
        pathname,
        isLoading,
        isLoadingProfile,
        hasProfile: !!userProfile
      });
    }
  }, [pathname, isLoading, isLoadingProfile, userProfile]);

  // Rutas públicas - renderizar directamente sin esperar auth
  if (isPublicPath) {
    return <>{children}</>;
  }

  // Loading solo cuando no hay perfil alguno (primera visita, sin cache).
  // La autorizacion real ya la hizo el Server Layout.
  if (isLoading && !userProfile) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  // Los providers se montan SIEMPRE en rutas protegidas; sin sesion del
  // cliente reciben userId null y no hacen red.
  const providersUserId = currentSession ? userProfile?.id || null : null;

  return (
    <NotificationProvider userId={providersUserId}>
      <TabTitleBadge />
      {children}
    </NotificationProvider>
  );
};

const ClientLayoutWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <PWARegister />
      <CookieCleaner />
      <FocusModeProvider>
        <UserProfileProvider>
          <ToastProvider>
            <AppContent>{children}</AppContent>
          </ToastProvider>
        </UserProfileProvider>
      </FocusModeProvider>
    </>
  );
};

export default ClientLayoutWrapper;
