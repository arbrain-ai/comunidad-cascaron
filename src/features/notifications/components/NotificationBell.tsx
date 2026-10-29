// ============================================
// NotificationBell Component
// ============================================
// Desktop: Dropdown inline (sin navegar)
// Mobile: Link a /notifications (mantener UX actual)

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Bell } from '@phosphor-icons/react/dist/ssr';
import { useNotificationContextSafe } from '../contexts';
import { NotificationDropdown } from './NotificationDropdown';
import { useIsMobile } from '@/shared/hooks/useMediaQuery';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const {
    notifications,
    unreadCount,
    loading,
    hasMore,
    markRead,
    markAllRead,
    deleteOne,
    loadMore,
  } = useNotificationContextSafe();

  // Close dropdown on click outside or Escape key (desktop only)
  // Uses pointerdown + pointerdown on toggle to prevent flicker race condition
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (isMobile || !isOpen) return;

    function handleClickOutside(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        isClosingRef.current = true;
        setIsOpen(false);
        // Reset flag after the click event would have fired
        requestAnimationFrame(() => { isClosingRef.current = false; });
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isMobile]);

  const badge = unreadCount > 0 && (
    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-3xs font-bold text-white bg-red-500 rounded-full">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );

  // Mobile: Link to /notifications
  if (isMobile) {
    return (
      <Link
        href="/notifications"
        className="icon-btn relative p-2 rounded-lg text-muted-foreground hover:text-foreground"
        aria-label={`Notificaciones ${unreadCount > 0 ? `(${unreadCount} no leídas)` : ''}`}
      >
        <Bell size={20} weight="duotone" />
        {badge}
      </Link>
    );
  }

  // Desktop: Dropdown
  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => {
          // Prevent re-opening if we just closed via outside click
          if (isClosingRef.current) return;
          setIsOpen(!isOpen);
        }}
        className="icon-btn relative p-2 rounded-lg text-muted-foreground hover:text-foreground"
        aria-label={`Notificaciones ${unreadCount > 0 ? `(${unreadCount} no leídas)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell size={20} weight="duotone" />
        {badge}
      </button>

      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          hasMore={hasMore}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onDelete={deleteOne}
          onLoadMore={loadMore}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
