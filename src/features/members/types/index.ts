import { UserProfile } from '@/shared/types/user.types';

/**
 * Extended UserProfile with last_seen for online status
 */
export interface MemberProfile extends Omit<UserProfile, 'email'> {
  last_seen: string | null;
  current_level: number | null;
  location_city: string | null;
  location_country: string | null;
  location_visible: boolean | null;
}

/**
 * Filters for the members list
 */
export interface MembersFilter {
  search?: string;
  role?: 'all' | 'admin' | 'moderator' | 'member';
  sortBy?: 'recent' | 'name' | 'online';
  onlineOnly?: boolean;
}

/**
 * Check if user is "online" (active in last 5 minutes)
 */
export function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return new Date(lastSeen).getTime() > fiveMinutesAgo;
}

/**
 * Format last seen time for display
 */
export function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'Nunca';

  const now = Date.now();
  const lastSeenTime = new Date(lastSeen).getTime();
  const diffMs = now - lastSeenTime;

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 5) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 7) return `Hace ${days}d`;

  return new Date(lastSeen).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format join date for display
 */
export function formatJoinDate(createdAt: string | null): string {
  if (!createdAt) return 'Desconocido';

  return new Date(createdAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
