'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getPollOptionVoters } from '../services/communityService';
import { VoterProfile } from '../types';
import { UserAvatarLink } from '@/shared/components/UserAvatarLink';

interface PollVotersModalProps {
  isOpen: boolean;
  onClose: () => void;
  optionId: string;
  optionText: string;
  count: number;
}

export function PollVotersModal({ isOpen, onClose, optionId, optionText, count }: PollVotersModalProps) {
  const [voters, setVoters] = useState<VoterProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !optionId) return;

    setIsLoading(true);
    getPollOptionVoters(optionId)
      .then(setVoters)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [isOpen, optionId]);

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
        <div className="flex items-start justify-between p-4 border-b border-border/20">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">
              {count} {count === 1 ? 'voto' : 'votos'}
            </h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{optionText}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors flex-shrink-0"
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
          ) : voters.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nadie ha votado esta opcion aun
            </p>
          ) : (
            <div className="space-y-3">
              {voters.map((voter) => (
                <div key={voter.id} className="flex items-center gap-3">
                  <UserAvatarLink
                    userId={voter.id}
                    avatarUrl={voter.avatar_url}
                    fullName={voter.full_name}
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
