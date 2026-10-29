import { supabase } from '@/shared/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export interface UserCardData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  current_level: number | null;
  total_points: number | null;
  last_seen: string | null;
  location_city: string | null;
  location_country: string | null;
  created_at: string;
  is_agent?: boolean;
}

// In-memory cache to avoid duplicate fetches
const cache = new Map<string, UserCardData | null>();

/**
 * Fetch user profile data for the hover card.
 * Results are cached per session.
 */
export async function getUserCardData(userId: string): Promise<UserCardData | null> {
  if (cache.has(userId)) return cache.get(userId) ?? null;

  const { data: user } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, bio, role, current_level, total_points, last_seen, location_city, location_country, created_at')
    .eq('id', userId)
    .single();

  if (user) {
    const result: UserCardData = { ...user, is_agent: false };
    cache.set(userId, result);
    return result;
  }

  cache.set(userId, null);
  return null;
}

/**
 * Generate the unified hover card HTML for Tippy.js contexts.
 * Used by: sidebar avatars, mention hover, and any future Tippy popover.
 */
export function generateUserCardHTML(data: UserCardData): string {
  const esc = escapeHTML;

  // Online status
  const isOnline = data.last_seen
    ? Date.now() - new Date(data.last_seen).getTime() < 5 * 60 * 1000
    : false;

  const lastSeenText = data.last_seen
    ? formatDistanceToNow(new Date(data.last_seen), { addSuffix: true, locale: es })
    : '';

  // Avatar
  const initial = data.full_name?.charAt(0).toUpperCase() || '?';
  const avatarHTML = data.avatar_url
    ? `<img src="${esc(data.avatar_url)}" alt="${esc(data.full_name)}" class="w-14 h-14 rounded-full object-cover ring-2 ring-primary/30" />`
    : `<div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
         <span class="font-semibold text-primary text-xl">${initial}</span>
       </div>`;

  // Online dot
  const onlineDot = !data.is_agent
    ? `<span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2" style="border-color: var(--card); background-color: ${isOnline ? '#22c55e' : '#9ca3af'};"></span>`
    : '';

  // Role badge
  const roleBadge = data.role !== 'member' && !data.is_agent
    ? `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full" style="background-color: ${
        data.role === 'owner' ? 'rgba(168,85,247,0.3)' : data.role === 'admin' ? 'rgba(234,179,8,0.3)' : 'rgba(59,130,246,0.3)'
      }; color: ${
        data.role === 'owner' ? '#c084fc' : data.role === 'admin' ? '#fcd34d' : '#93c5fd'
      };">${data.role === 'owner' ? 'OWNER' : data.role === 'admin' ? 'ADMIN' : 'MOD'}</span>`
    : '';

  // Level badge
  const levelBadge = !data.is_agent
    ? `<span class="px-2 py-0.5 text-[10px] font-medium rounded-full" style="background-color: rgba(var(--primary-rgb),0.2); color: var(--primary); border: 1px solid rgba(var(--primary-rgb),0.3);">Nivel ${data.current_level || 1}</span>`
    : '';

  // AI badge
  const aiBadge = data.is_agent
    ? `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded" style="background-color: rgba(var(--primary-rgb),0.3); color: var(--primary);">AI</span>`
    : '';

  // Online status line
  const statusHTML = data.is_agent
    ? ''
    : isOnline
    ? `<p class="text-xs mt-0.5" style="color: #22c55e; font-weight: 500;">Online ahora</p>`
    : lastSeenText
    ? `<p class="text-xs mt-0.5" style="color: var(--muted);">Activo ${esc(lastSeenText)}</p>`
    : '';

  // Location
  const locationHTML = data.location_city && data.location_country
    ? `<p class="text-xs flex items-center gap-1 mt-0.5" style="color: var(--primary);">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
         ${esc(data.location_city)}, ${esc(data.location_country)}
       </p>`
    : '';

  // Bio
  const bioHTML = data.bio
    ? `<p class="text-xs mt-3" style="color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.6;">${esc(data.bio)}</p>`
    : '';

  // Stats (level + points)
  const statsHTML = !data.is_agent
    ? `<div class="flex items-center gap-3 text-xs mt-3" style="color: var(--muted);">
         <span>${(data.total_points || 0).toLocaleString()} puntos</span>
         <span style="opacity: 0.4;">·</span>
         <span>Se unió ${esc(formatDistanceToNow(new Date(data.created_at), { addSuffix: true, locale: es }))}</span>
       </div>`
    : '';

  // Ver perfil button
  const profileBtn = `<a href="/profile/${data.id}" class="user-card-profile-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; text-decoration: none; transition: background 0.2s; background-color: rgba(var(--primary-rgb),0.1); color: var(--primary);">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    Ver perfil
  </a>`;

  return `
    <div class="mention-popover-content" style="min-width: 280px; max-width: 320px;">
      <div class="flex items-start gap-3 mb-1">
        <div class="relative flex-shrink-0">
          ${avatarHTML}
          ${onlineDot}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold truncate" style="color: var(--foreground);">${esc(data.full_name)}</h3>
            ${aiBadge}
          </div>
          <div class="flex items-center gap-1.5 mt-1 flex-wrap">
            ${roleBadge}
            ${levelBadge}
          </div>
          ${statusHTML}
          ${locationHTML}
        </div>
      </div>
      ${bioHTML}
      ${statsHTML}
      ${profileBtn}
    </div>
  `;
}

function escapeHTML(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
