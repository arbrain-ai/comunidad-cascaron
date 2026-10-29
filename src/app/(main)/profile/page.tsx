'use client';

import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { ProfileForm } from '@/features/profile/components/ProfileForm';

export default function ProfilePage() {
  const router = useRouter();
  const { userProfile, isLoading, isAuthenticated } = useUserProfile();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Redirect to landing if not authenticated (ClientLayoutWrapper handles this)
  if (!isAuthenticated || !userProfile) {
    router.push('/');
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto py-2 md:py-4">
      <div className="sup p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Editar Perfil</h2>
        <ProfileForm
          profile={userProfile}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}
