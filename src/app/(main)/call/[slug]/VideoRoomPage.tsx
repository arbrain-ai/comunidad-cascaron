'use client';

// ============================================
// VIDEO ROOM PAGE - Client Component Wrapper
// ============================================
// Renders the VideoRoom component with user data from server

import { useRouter } from 'next/navigation';
import { VideoRoom } from '@/features/video-calling/components/VideoRoom';

interface VideoRoomPageProps {
  roomId: string;
  roomName: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
}

export function VideoRoomPage({ roomId, userId, userName, userAvatar }: VideoRoomPageProps) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-[60] bg-[#202124] overflow-hidden">
      <VideoRoom
        roomId={roomId}
        userId={userId}
        userName={userName}
        userAvatar={userAvatar}
        onExit={() => router.push('/calendar')}
      />
    </div>
  );
}
