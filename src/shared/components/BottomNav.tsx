// ============================================
// BottomNav Component
// ============================================
// Bottom navigation bar for mobile with quick access to:
// - Home, Notifications, Calendar, Profile

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useFocusModeSafe } from '@/shared/contexts/FocusModeContext';
import { Home, CalendarDays } from 'lucide-react';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { UserDropdown } from './UserDropdown';

export function BottomNav() {
  const pathname = usePathname();
  const { userProfile } = useUserProfile();
  const { isFocusMode } = useFocusModeSafe();
  if (!userProfile || isFocusMode) return null;

  const isActive = (href: string) => {
    if (href === '/community') {
      return pathname === '/community';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel-strong sup-2-arriba">
      <div className="flex items-center justify-around px-2 py-2 safe-area-bottom">
        {/* Home */}
        <Link
          prefetch={true}
          href="/community"
          className="flex items-center justify-center flex-1 p-2 rounded-xl transition-all duration-200 active:scale-95"
          aria-label="Inicio"
        >
          <Home
            className={`w-6 h-6 transition-colors duration-200 ${
              isActive('/community') ? 'text-primary' : 'text-muted'
            }`}
            strokeWidth={isActive('/community') ? 2.5 : 2}
          />
        </Link>

        {/* Notifications */}
        <div className="flex items-center justify-center flex-1">
          <NotificationBell />
        </div>

        {/* Calendar */}
        <Link
          prefetch={true}
          href="/calendar"
          className="flex items-center justify-center flex-1 p-2 rounded-xl transition-all duration-200 active:scale-95"
          aria-label="Calendario"
        >
          <CalendarDays
            className={`w-6 h-6 transition-colors duration-200 ${
              isActive('/calendar') ? 'text-primary' : 'text-muted'
            }`}
            strokeWidth={isActive('/calendar') ? 2.5 : 2}
          />
        </Link>

        {/* Profile */}
        <div className="flex items-center justify-center flex-1">
          <UserDropdown />
        </div>
      </div>
    </nav>
  );
}
