'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { LikerProfile, getPostLikers, getCommentLikers } from '../services/communityService';
import { UserAvatarLink } from '@/shared/components/UserAvatarLink';

interface LikesModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'post' | 'comment';
  id: string;
  count: number;
}

export function LikesModal({ isOpen, onClose, type, id, count }: LikesModalProps) {
  const [likers, setLikers] = useState<LikerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !id) return;

    setIsLoading(true);
    const fetchLikers = type === 'post' ? getPostLikers : getCommentLikers;

    fetchLikers(id)
      .then(setLikers)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [isOpen, id, type]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 glass-panel-strong rounded-2xl border border-glass-strong depth-modal overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/20">
          <h3 className="text-base font-semibold text-foreground">
            {count} {count === 1 ? 'Me gusta' : 'Me gusta'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : likers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nadie ha dado me gusta aun
            </p>
          ) : (
            <div className="space-y-3">
              {likers.map((liker) => (
                <div key={liker.id} className="flex items-center gap-3">
                  <UserAvatarLink
                    userId={liker.id}
                    avatarUrl={liker.avatar_url}
                    fullName={liker.full_name}
                    size="md"
                    showName
                    nameClassName="text-sm font-medium"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
