'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useMembers } from '@/features/members/hooks';
import { MembersList, MembersFilter } from '@/features/members/components';
import { updateLastSeen } from '@/features/members/services/membersService';
import { CommunitySidebar } from '@/features/community/components/CommunitySidebar';
import type { MembersFilter as MembersFilterType } from '@/features/members/types';

function MembersPageInner() {
  const { userProfile } = useUserProfile();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');

  const initialFilters = useMemo<MembersFilterType>(() => {
    if (filterParam === 'admins') return { role: 'admin', onlineOnly: false, sortBy: 'online' };
    if (filterParam === 'online') return { role: 'all', onlineOnly: true, sortBy: 'online' };
    return { role: 'all', onlineOnly: false, sortBy: 'online' };
  }, [filterParam]);

  const {
    members,
    counts,
    countsAvailable,
    isLoading,
    error,
    filters,
    updateFilters,
  } = useMembers(initialFilters);

  // Sync state with URL when ?filter= changes via client-side navigation
  // (useState init in useMembers only runs once, so swapping admins<->online
  // via sidebar links wouldn't re-apply without this).
  useEffect(() => {
    updateFilters(initialFilters);
  }, [initialFilters, updateFilters]);

  useEffect(() => {
    if (userProfile?.id) {
      updateLastSeen(userProfile.id);
    }
  }, [userProfile?.id]);

  return (
    <div className="sf-page-grid">
      <div className="sf-page-main">
        {error && (
          <div className="mb-6 p-4 bg-error/10 border border-error/30 rounded-xl text-error">
            {error}
          </div>
        )}

        <div className="mb-5">
          <MembersFilter
            filters={filters}
            onFilterChange={updateFilters}
            counts={counts}
            countsAvailable={countsAvailable}
            userRole={userProfile?.role}
          />
        </div>

        <MembersList
          members={members}
          isLoading={isLoading}
        />
      </div>

      <CommunitySidebar />
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={null}>
      <MembersPageInner />
    </Suspense>
  );
}
