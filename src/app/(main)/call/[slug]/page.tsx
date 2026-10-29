// ============================================
// VIDEO CALL PAGE - /call/[slug]
// ============================================
// Server component that loads room data and renders VideoRoom client component

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/shared/lib/supabase-server';
import { VideoRoomPage } from './VideoRoomPage';

interface CallPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CallPage({ params }: CallPageProps) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  // 1. Verify authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // 2. Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, tier, current_level, has_community_access')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // 3. Check community access
  const isPowerUser = profile.role === 'owner' || profile.role === 'admin';
  if (!isPowerUser && !profile.has_community_access) {
    redirect('/sin-acceso');
  }

  // 4. Find room by slug
  const { data: room } = await supabase
    .from('video_rooms')
    .select('id, name, slug, status')
    .eq('slug', slug)
    .single();

  if (!room) {
    redirect('/calendar');
  }

  return (
    <VideoRoomPage
      roomId={room.id}
      roomName={room.name}
      userId={profile.id}
      userName={profile.full_name}
      userAvatar={profile.avatar_url}
    />
  );
}
