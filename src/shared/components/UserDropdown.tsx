'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Moon,
  Sun,
  UserCircle,
  Gear,
  SignOut,
  Bell,
  BellSlash,
} from '@phosphor-icons/react/dist/ssr';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/shared/lib/supabase';
import { Sheet } from './Sheet';
import { useIsMobile, useIsPWA } from '@/shared/hooks/useMediaQuery';
import { usePushSubscription } from '@/features/notifications/hooks';
import { useToast } from '@/shared/hooks/useToast';
import { hasAdminAccess } from '@/shared/constants/roles';
import { sbAvatar } from '@/shared/lib/sbImage';

export function UserDropdown() {
  const { userProfile } = useUserProfile();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isMobile = useIsMobile();
  const isPWA = useIsPWA();

  // Push notifications — la identidad la deriva el server de la sesión
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe, requestPermission, loading: pushLoading } = usePushSubscription();
  const { showSuccess, showError } = useToast();
  const showPushOption = isMobile && isPWA && isSupported && permission !== 'denied';

  // Handler para activar/desactivar notificaciones — con feedback REAL
  // (antes cualquier error se tragaba en console.error y el miembro creía
  // que activó/desactivó cuando la BD no cambió nada)
  const handleToggleNotifications = async () => {
    try {
      if (isSubscribed) {
        const ok = await unsubscribe();
        if (ok) {
          showSuccess('Notificaciones desactivadas');
        } else {
          showError('No se pudieron desactivar las notificaciones');
        }
      } else {
        const granted = await requestPermission();
        if (granted === 'granted') {
          // Pass permission directly to avoid stale state issue
          const ok = await subscribe(granted);
          if (ok) {
            showSuccess('Notificaciones activadas 🔔');
          } else {
            showError('No se pudieron activar las notificaciones. Intenta de nuevo.');
          }
        } else if (granted === 'denied') {
          showError('Permiso denegado. Actívalo en Ajustes de tu dispositivo.');
        }
      }
    } catch (err) {
      console.error('[Push] Error:', err);
      showError('Error con las notificaciones. Intenta de nuevo.');
    }
  };

  // Close dropdown when clicking outside (desktop only)
  useEffect(() => {
    if (isMobile) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, isMobile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleClose = () => setIsOpen(false);

  if (!userProfile) {
    return null;
  }

  const initial = userProfile.full_name?.charAt(0).toUpperCase() || 'U';
  const roleColors: Record<string, string> = {
    owner: 'bg-purple-500/20 text-purple-400',
    admin: 'bg-error/20 text-error',
    moderator: 'bg-muted/20 text-muted', // badge de ROL, no de logro — LEY §1.1: neutro, no ámbar
    member: 'bg-primary/20 text-primary',
  };

  // Menu items
  const menuContent = (
    <>
      {/* User Info */}
      <div className="p-4 border-b border-border-accent">
        <div className="flex items-start gap-3">
          {userProfile.avatar_url ? (
            <img
              src={sbAvatar(userProfile.avatar_url, 96)}
              alt={userProfile.full_name || 'User'}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">
              {userProfile.full_name}
            </p>
            <p className="text-sm text-muted truncate">{userProfile.email}</p>
            <span
              className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                roleColors[userProfile.role as keyof typeof roleColors]
              }`}
            >
              {userProfile.role}
            </span>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="py-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="titanium-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-foreground hover:text-primary"
        >
          {resolvedTheme === 'dark' ? (
            <Sun size={20} weight="duotone" />
          ) : (
            <Moon size={20} weight="duotone" />
          )}
          {resolvedTheme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
        </button>

        {/* Push Notifications - Solo en PWA movil */}
        {showPushOption && (
          <button
            onClick={handleToggleNotifications}
            disabled={pushLoading}
            className={`titanium-menu-item w-full flex items-center gap-3 px-4 py-2.5 disabled:opacity-50 ${
              isSubscribed ? 'text-primary' : 'text-foreground hover:text-primary'
            }`}
          >
            {isSubscribed ? <Bell size={20} weight="duotone" /> : <BellSlash size={20} weight="duotone" />}
            {pushLoading ? (isSubscribed ? 'Desactivando...' : 'Activando...') : (isSubscribed ? 'Desactivar Notificaciones' : 'Activar Notificaciones')}
          </button>
        )}

        <div className="border-t border-border-accent my-1" />

        {/* Mi Perfil */}
        <Link
          href={`/profile/${userProfile.id}`}
          onClick={handleClose}
          className="titanium-menu-item flex items-center gap-3 px-4 py-2.5 text-foreground hover:text-primary"
        >
          <UserCircle size={20} weight="duotone" />
          Mi Perfil
        </Link>

        {/* Security setup is available before a second factor exists. */}
        <Link
          href="/auth/mfa"
          prefetch={false}
          onClick={handleClose}
          className="titanium-menu-item flex items-center gap-3 px-4 py-2.5 text-foreground hover:text-primary"
        >
          <Gear size={20} weight="duotone" />
          Verificación en dos pasos
        </Link>

        {/* Admin Panel - Visible for owner and admin */}
        {hasAdminAccess(userProfile.role) && (
          <Link
            href="/admin"
            onClick={handleClose}
            className="titanium-menu-item flex items-center gap-3 px-4 py-2.5 text-foreground hover:text-primary"
          >
            <Gear size={20} weight="duotone" />
            Admin Panel
          </Link>
        )}

        <div className="border-t border-border-accent my-1" />

        {/* Cerrar Sesion */}
        <button
          onClick={handleLogout}
          className="titanium-menu-item titanium-menu-item-danger w-full flex items-center gap-3 px-4 py-2.5 text-error"
        >
          <SignOut size={20} weight="duotone" />
          Cerrar Sesion
        </button>
      </div>
    </>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-primary/10 transition-colors"
        aria-label="User menu"
      >
        {userProfile.avatar_url ? (
          <img
            src={sbAvatar(userProfile.avatar_url, 80)}
            alt={userProfile.full_name || 'User'}
            className="w-8 h-8 rounded-full object-cover border-2 border-primary/30"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border-2 border-primary/30">
            {initial}
          </div>
        )}
      </button>

      {/* Mobile: Sheet */}
      {isMobile && (
        <Sheet isOpen={isOpen} onClose={handleClose} showCloseButton={false}>
          {menuContent}
        </Sheet>
      )}

      {/* Desktop: Dropdown */}
      {!isMobile && isOpen && (
        <div className="titanium-panel absolute right-0 mt-2 w-64 rounded-xl overflow-hidden z-[9999]">
          {menuContent}
        </div>
      )}
    </div>
  );
}
