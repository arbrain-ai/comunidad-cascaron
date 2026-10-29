'use client';

import { MemberProfile } from '../types';
import { MemberCard } from './MemberCard';

interface MembersListProps {
  members: MemberProfile[];
  isLoading: boolean;
  onMemberClick?: (member: MemberProfile) => void;
}

export function MembersList({ members, isLoading, onMemberClick }: MembersListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="sup p-12 text-center">
        <div className="text-4xl mb-4">👥</div>
        <p className="text-muted">No se encontraron miembros</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {members.map((member) => (
        <MemberCard
          key={member.id}
          member={member}
          onClick={onMemberClick}
        />
      ))}
    </div>
  );
}
