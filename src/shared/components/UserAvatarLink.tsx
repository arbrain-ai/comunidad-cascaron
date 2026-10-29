'use client';

import Link from 'next/link';
import { sbAvatar } from '@/shared/lib/sbImage';

interface Props {
  userId: string;
  avatarUrl?: string | null;
  fullName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  nameClassName?: string;
  showOnlineIndicator?: boolean;
  isOnline?: boolean;
  badge?: React.ReactNode;
  className?: string;
  isAgent?: boolean;
  customHref?: string; // Override the default /profile/{userId} link
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl'
};

/**
 * Clickable avatar + name that links directly to user profile page.
 * Both avatar and name are hyperlinks to /profile/{userId}
 */
export function UserAvatarLink({
  userId,
  avatarUrl,
  fullName,
  size = 'md',
  showName = false,
  nameClassName = '',
  showOnlineIndicator = false,
  isOnline = false,
  badge,
  className = '',
  isAgent = false,
  customHref
}: Props) {
  const initial = fullName?.charAt(0).toUpperCase() || '?';
  const sizeClass = SIZE_CLASSES[size];
  const profileUrl = customHref || `/profile/${userId}`;

  // For agents, show avatar without link (agents don't have profile pages)
  if (isAgent) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className="relative flex-shrink-0">
          {avatarUrl ? (
            <img
              src={sbAvatar(avatarUrl, 64)}
              alt={fullName}
              loading="lazy"
              className={`${sizeClass} rounded-full object-cover ring-2 ring-primary-500`}
            />
          ) : (
            <div className={`${sizeClass} rounded-full bg-primary-600 flex items-center justify-center ring-2 ring-primary-500`}>
              <span className="font-semibold text-white">{initial}</span>
            </div>
          )}
          {badge}
        </div>
        {showName && (
          <span className={`font-medium text-foreground ${nameClassName}`}>
            {fullName}
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-primary-500/20 text-primary">
              AI
            </span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Avatar Link */}
      <Link href={profileUrl} className="relative flex-shrink-0 hover:opacity-80 transition-opacity">
        {avatarUrl ? (
          <img
            src={sbAvatar(avatarUrl, 64)}
            alt={fullName}
            loading="lazy"
            className={`${sizeClass} rounded-full object-cover`}
          />
        ) : (
          <div className={`${sizeClass} rounded-full bg-primary/20 flex items-center justify-center`}>
            <span className="font-semibold text-primary">{initial}</span>
          </div>
        )}

        {/* Online indicator */}
        {showOnlineIndicator && (
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-dark-900 ${
              isOnline ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />
        )}

        {/* Custom badge */}
        {badge}
      </Link>

      {/* Name Link */}
      {showName && (
        <Link
          href={profileUrl}
          className={`font-semibold text-foreground hover:underline ${nameClassName}`}
        >
          {fullName}
        </Link>
      )}
    </div>
  );
}
