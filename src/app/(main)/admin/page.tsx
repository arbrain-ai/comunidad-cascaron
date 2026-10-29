'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { UserManagement } from '@/features/admin/components/UserManagement';
import { CategoryManagement } from '@/features/admin/components/CategoryManagement';
import { LeaderboardManagement } from '@/features/admin/components/LeaderboardManagement';
import { VideoRoomsAdmin } from '@/features/admin/components/VideoRoomsAdmin';
import { AnalyticsDashboard } from '@/features/admin/components/analytics';
import { AdminSidebar, AdminMobileNav } from '@/features/admin/components/AdminSidebar';
import { TabType, getActiveTab, saveActiveTab } from '@/features/admin/stores/adminPreferencesStore';
import { hasAdminAccess } from '@/shared/constants/roles';

export default function AdminPage() {
  const { userProfile } = useUserProfile();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('analytics');

  // Load active tab from localStorage on mount (SSR-safe)
  useEffect(() => {
    setActiveTab(getActiveTab());
  }, []);

  useEffect(() => {
    if (userProfile && !hasAdminAccess(userProfile.role)) {
      router.push('/community');
    }
  }, [userProfile, router]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    saveActiveTab(tab);
  };

  if (!userProfile || !hasAdminAccess(userProfile.role)) {
    return null;
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
      <div className="md:hidden">
        <AdminMobileNav activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      <div className="hidden md:block shrink-0">
        <AdminSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      <div className="flex-1 min-w-0">
        {activeTab === 'analytics' && (
          <AnalyticsDashboard onNavigateToUsers={() => handleTabChange('users')} />
        )}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'categories' && <CategoryManagement />}
        {activeTab === 'leaderboard' && <LeaderboardManagement />}
        {activeTab === 'video' && <VideoRoomsAdmin />}
      </div>
    </div>
  );
}
