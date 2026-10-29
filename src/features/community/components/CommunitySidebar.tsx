'use client';

import { BRAND } from '@/shared/config/brand';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { hasAdminAccess } from '@/shared/constants/roles';
import {
  CommunitySettings,
  getCommunitySettings,
} from '../services/communitySettingsService';
import { CommunitySettingsModal } from './CommunitySettingsModal';
import { LeaderboardCard } from '@/features/gamification/components';
import { getUserCardData, generateUserCardHTML } from '@/shared/services/userCardService';
import { getCached, setCached } from '@/shared/lib/queryCache';
import { useMemberDirectory } from '@/features/members/hooks/useMemberDirectory';

interface OnlineMember {
  id: string;
  avatar_url: string | null;
  full_name: string;
}

export function CommunitySidebar() {
  const { userProfile } = useUserProfile();
  const isAdmin = hasAdminAccess(userProfile?.role || '');

  const [settings, setSettings] = useState<CommunitySettings | null>(null);
  const directory = useMemberDirectory();
  const stats = { totalMembers: directory.counts.total, onlineMembers: directory.counts.online, admins: directory.counts.admins };
  const onlineAvatars = directory.onlineAvatars;
  const statsAvailable = directory.updatedAt > 0;
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = getCached<CommunitySettings>('community:settings');
    if (cached) setSettings(cached.data);
    getCommunitySettings().then(value => {
      if (!active) return;
      setSettings(value);
      setCached('community:settings', value);
    }).catch(error => console.error('Error fetching community settings:', error));
    return () => { active = false; };
  }, []);

  const handleSettingsSave = (updated: CommunitySettings) => {
    setSettings(updated);
  };

  return (
    <>
      <aside className="hidden lg:flex flex-col gap-4 w-80 flex-shrink-0">
        {/* Community Info Card — Titaniumorphism bezel + screen (chassis premium) */}
        <div className="titanium-bezel">
          <div className="titanium-screen overflow-hidden">
          {/* Cover Image - 16:9 Aspect Ratio */}
          <div
            className="relative aspect-video bg-gradient-to-r from-primary/30 to-primary/5 cursor-pointer group"
            onClick={() => isAdmin && setShowSettingsModal(true)}
          >
            {settings?.cover_image_url ? (
              <Image
                src={settings.cover_image_url}
                alt={settings.name || 'Community'}
                fill
                sizes="320px"
                className="object-cover"
                priority={true}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt={BRAND.name}
                  width={80}
                  height={80}
                  className="rounded-xl"
                  priority={true}
                />
              </div>
            )}

            {/* Edit overlay for admins */}
            {isAdmin && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Settings className="w-8 h-8 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="py-4 px-4 text-center">
            <h3 className="font-bold text-foreground">
              {settings?.name || BRAND.name}
            </h3>
            <p className="text-sm text-muted mt-1">
              {settings?.description || 'Velocidad y Apalancamiento con IA es nuestra Filosofia.'}
            </p>

            {/* Stats */}
            <div className="flex justify-center gap-2 mt-4 text-center items-center">
              <Link
                href="/members"
                className="flex-1 cursor-pointer hover:bg-primary/10 rounded-lg py-2 px-1 transition-colors duration-fast group"
              >
                <div className="font-bold text-foreground group-hover:text-primary transition-colors">{statsAvailable ? stats.totalMembers : '—'}</div>
                <div className="text-3xs uppercase tracking-wider text-muted font-medium">Members</div>
              </Link>

              <Link
                href="/members?filter=online"
                className="flex-1 cursor-pointer hover:bg-primary/10 rounded-lg py-2 px-1 transition-colors duration-fast group"
              >
                <div className="font-bold text-foreground group-hover:text-primary transition-colors">{statsAvailable ? stats.onlineMembers : '—'}</div>
                <div className="text-3xs uppercase tracking-wider text-muted font-medium">Online</div>
              </Link>

              <Link
                href="/members?filter=admins"
                className="flex-1 cursor-pointer hover:bg-primary/10 rounded-lg py-2 px-1 transition-colors duration-fast group"
              >
                <div className="font-bold text-foreground group-hover:text-primary transition-colors">{statsAvailable ? stats.admins : '—'}</div>
                <div className="text-3xs uppercase tracking-wider text-muted font-medium">Admins</div>
              </Link>
            </div>

            {/* Online Member Avatars with hover cards */}
            {onlineAvatars.length > 0 && (
              <div className="flex justify-center items-center mt-3 pt-3 border-t border-border/50">
                <div className="flex -space-x-2">
                  {onlineAvatars.map((member) => (
                    <SidebarAvatar key={member.id} member={member} />
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Leaderboard Card - uses shared component for consistency */}
        <div>
          <LeaderboardCard period="30d" limit={5} />
          {/* See all link */}
          <Link
            href="/leaderboard"
            className="block text-center text-sm text-primary hover:text-primary-hover mt-3 font-medium"
          >
            See all leaderboards
          </Link>
        </div>
      </aside>

      {/* Settings Modal */}
      {settings && (
        <CommunitySettingsModal
          settings={settings}
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onSave={handleSettingsSave}
        />
      )}
    </>
  );
}

/**
 * Individual avatar with Tippy.js hover card.
 * Lazy-loads full profile data on first hover.
 */
function SidebarAvatar({ member }: { member: OnlineMember }) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const instance: TippyInstance = tippy(ref.current, {
      content: 'Cargando...',
      allowHTML: true,
      interactive: true,
      placement: 'bottom',
      delay: [300, 0],
      arrow: true,
      theme: 'mention-preview',
      maxWidth: 320,
      appendTo: document.body,
      onShow: (inst) => {
        (async () => {
          const data = await getUserCardData(member.id);
          if (data) {
            inst.setContent(generateUserCardHTML(data));
          } else {
            inst.setContent('Usuario no encontrado');
          }
        })();
      },
    });

    return () => instance.destroy();
  }, [member.id]);

  return (
    <a
      ref={ref}
      href={`/profile/${member.id}`}
      className="relative w-8 h-8 rounded-full border-2 border-card overflow-hidden hover:opacity-80 transition-opacity hover:z-10"
    >
      {member.avatar_url ? (
        <img
          src={member.avatar_url}
          alt={member.full_name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-primary/20 flex items-center justify-center">
          <span className="text-xs font-semibold text-primary">
            {member.full_name?.charAt(0).toUpperCase() || '?'}
          </span>
        </div>
      )}
    </a>
  );
}
