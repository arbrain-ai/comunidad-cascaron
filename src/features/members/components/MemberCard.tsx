'use client';

import { useRouter } from 'next/navigation';
import { MapPin, Calendar } from 'lucide-react';
import { MemberProfile, isOnline, formatJoinDate } from '../types';
import { UserAvatarLink } from '@/shared/components/UserAvatarLink';

interface MemberCardProps {
  member: MemberProfile;
  onClick?: (member: MemberProfile) => void;
  showMessageButton?: boolean;
}

const roleLabels: Record<string, string> = {
  owner: 'Admin',
  admin: 'Admin',
  moderator: 'Mod',
  member: '',
};

const roleColors: Record<string, string> = {
  owner: 'bg-red-500 text-white border-red-600/60 font-semibold shadow-sm',
  admin: 'bg-red-500 text-white border-red-600/60 font-semibold shadow-sm',
  moderator: 'bg-blue-500 text-white border-blue-600/60 font-semibold shadow-sm',
  member: '',
};

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-gray-500',
  2: 'bg-green-500',
  3: 'bg-blue-500',
  4: 'bg-purple-500',
  5: 'bg-yellow-500',
  6: 'bg-orange-500',
  7: 'bg-red-500',
  8: 'bg-pink-500',
  9: 'bg-primary',
};

export function MemberCard({ member, onClick, showMessageButton = true }: MemberCardProps) {
  const online = isOnline(member.last_seen);
  const router = useRouter();

  const handleCardClick = () => {
    if (onClick) {
      onClick(member);
    } else {
      router.push(`/profile/${member.id}`);
    }
  };

  const level = member.current_level || 1;
  const levelColor = LEVEL_COLORS[level] || LEVEL_COLORS[1];

  // Build location string
  const location = member.location_visible !== false
    ? [member.location_city, member.location_country].filter(Boolean).join(', ')
    : '';

  return (
    <div
      onClick={handleCardClick}
      className="sup sup-i px-4 py-4 sm:px-5 sm:py-5 cursor-pointer"
    >
      <div className="flex items-start gap-4">
        {/* Avatar with level badge */}
        <div className="relative flex-shrink-0">
          <UserAvatarLink
            userId={member.id}
            avatarUrl={member.avatar_url}
            fullName={member.full_name || 'Sin nombre'}
            size="lg"
            showOnlineIndicator={false}
            badge={
              <>
                {/* Level badge - Skool style */}
                <span className={`absolute -top-1 -left-1 w-5 h-5 rounded-full ${levelColor} text-white text-3xs font-bold flex items-center justify-center border-2 border-card z-10`}>
                  {level}
                </span>
                {/* Role badge */}
                {member.role !== 'member' && roleLabels[member.role] ? (
                  <span className={`absolute -bottom-1 -right-1 text-3xs px-1 py-0.5 rounded border ${roleColors[member.role]}`}>
                    {roleLabels[member.role]}
                  </span>
                ) : null}
              </>
            }
          />
        </div>

        {/* Member info - takes remaining space */}
        <div className="flex-1 min-w-0">
          {/* Name */}
          <div className="flex items-center gap-2">
            <UserAvatarLink
              userId={member.id}
              avatarUrl={null}
              fullName={member.full_name || 'Sin nombre'}
              showName
              className="[&>a:first-child]:hidden"
            />
          </div>

          {/* Bio */}
          {member.bio && (
            <p className="text-sm text-muted line-clamp-1 mt-0.5">
              {member.bio}
            </p>
          )}

          {/* Meta row: online + join date + location */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted">
            {/* Online status — el punto y la etiqueta solo aparecen si está
                EN LÍNEA. Antes, quien llevaba meses sin
                entrar lo llevaba escrito en su tarjeta ("hace 3 meses", "Nunca"). */}
            {online && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500" />
                Online
              </span>
            )}

            {/* Join date */}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              {formatJoinDate(member.created_at)}
            </span>

            {/* Location */}
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {location}
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
