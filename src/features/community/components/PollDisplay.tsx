'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { PollWithOptionsAndVotes } from '../types';
import { votePollOption, unvotePollOption } from '../services/communityService';
import { PollVotersModal } from './PollVotersModal';

interface PollDisplayProps {
  poll: PollWithOptionsAndVotes;
  userId?: string;
  onVoteChange?: () => void;
}

export function PollDisplay({ poll, userId, onVoteChange }: PollDisplayProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [localPoll, setLocalPoll] = useState(poll);
  const [votersModalOption, setVotersModalOption] = useState<{ id: string; text: string; count: number } | null>(null);

  const handleVote = useCallback(async (optionId: string) => {
    if (!userId || isVoting) return;

    const option = localPoll.options.find(o => o.id === optionId);
    if (!option) return;

    // OPTIMISTA: la barra se mueve al instante; el RPC confirma en fondo y
    // ante error se revierte al snapshot previo. (Antes el await iba primero
    // y la encuesta se sentía congelada el round-trip completo.)
    const snapshot = localPoll;
    const isUnvote = option.has_voted;

    if (isUnvote) {
      setLocalPoll(prev => ({
        ...prev,
        total_votes: prev.total_votes - 1,
        user_votes: prev.user_votes.filter(id => id !== optionId),
        options: prev.options.map(o =>
          o.id === optionId
            ? { ...o, votes_count: o.votes_count - 1, has_voted: false }
            : o
        ),
      }));
    } else if (!localPoll.allow_multiple && localPoll.user_votes.length > 0) {
      const prevOptionId = localPoll.user_votes[0];
      setLocalPoll(prev => ({
        ...prev,
        total_votes: prev.total_votes,
        user_votes: [optionId],
        options: prev.options.map(o => {
          if (o.id === optionId) {
            return { ...o, votes_count: o.votes_count + 1, has_voted: true };
          }
          if (o.id === prevOptionId) {
            return { ...o, votes_count: o.votes_count - 1, has_voted: false };
          }
          return o;
        }),
      }));
    } else {
      setLocalPoll(prev => ({
        ...prev,
        total_votes: prev.total_votes + 1,
        user_votes: [...prev.user_votes, optionId],
        options: prev.options.map(o =>
          o.id === optionId
            ? { ...o, votes_count: o.votes_count + 1, has_voted: true }
            : o
        ),
      }));
    }

    setIsVoting(true);
    try {
      if (isUnvote) {
        await unvotePollOption(optionId);
      } else {
        await votePollOption(optionId);
      }
      onVoteChange?.();
    } catch (error) {
      // Revert al snapshot previo
      setLocalPoll(snapshot);
      console.error('Error voting:', error);
    } finally {
      setIsVoting(false);
    }
  }, [userId, isVoting, localPoll, onVoteChange]);

  const getPercentage = (votes: number) => {
    if (localPoll.total_votes === 0) return 0;
    return Math.round((votes / localPoll.total_votes) * 100);
  };

  return (
    <div className="border border-border/30 rounded-lg p-3 space-y-2">
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
        {localPoll.options.map((option) => {
          const percentage = getPercentage(option.votes_count);
          const isSelected = option.has_voted;

          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={!userId}
              className={`
                relative w-full text-left px-3 py-2 rounded-md overflow-hidden transition-all
                ${!userId ? 'cursor-default' : 'cursor-pointer hover:bg-secondary/30'}
                ${isSelected ? 'border-2 border-primary' : 'border border-border/30'}
              `}
            >
              {/* Background bar */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                  isSelected ? 'bg-primary/20' : 'bg-secondary/50'
                }`}
                style={{ width: `${percentage}%` }}
              />

              {/* Content */}
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`
                    w-4 h-4 flex-shrink-0 flex items-center justify-center
                    ${localPoll.allow_multiple ? 'rounded' : 'rounded-full'}
                    border ${isSelected ? 'border-primary bg-primary' : 'border-muted'}
                  `}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-foreground truncate">{option.text}</span>
                </div>

                {/* Right: voter avatars + count (click to see all voters) */}
                <div
                  className={`flex items-center gap-2 flex-shrink-0 rounded-md transition-colors ${
                    option.votes_count > 0 ? 'cursor-pointer hover:bg-foreground/5 -mx-1 px-1 py-0.5' : ''
                  }`}
                  onClick={(e) => {
                    if (option.votes_count === 0) return;
                    e.stopPropagation();
                    setVotersModalOption({ id: option.id, text: option.text, count: option.votes_count });
                  }}
                  title={option.votes_count > 0 ? 'Ver quien voto' : undefined}
                >
                  {option.voters && option.voters.length > 0 && (
                    <div className="flex -space-x-1.5">
                      {option.voters.map((voter) => (
                        <div
                          key={voter.id}
                          className="w-5 h-5 rounded-full border border-card overflow-hidden bg-surface-elevated"
                          title={voter.full_name}
                        >
                          {voter.avatar_url ? (
                            <Image
                              src={voter.avatar_url}
                              alt={voter.full_name}
                              width={20}
                              height={20}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xs font-bold text-muted">
                              {voter.full_name?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="text-xs font-medium text-muted whitespace-nowrap">
                    {option.votes_count > 0 && `${option.votes_count} `}{percentage}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted pt-1">
        <span>{localPoll.total_votes} {localPoll.total_votes === 1 ? 'voto' : 'votos'}</span>
        {localPoll.allow_multiple && <span>Selección múltiple</span>}
      </div>

      {!userId && (
        <p className="text-xs text-muted text-center">
          Inicia sesión para votar
        </p>
      )}

      {votersModalOption && (
        <PollVotersModal
          isOpen={!!votersModalOption}
          onClose={() => setVotersModalOption(null)}
          optionId={votersModalOption.id}
          optionText={votersModalOption.text}
          count={votersModalOption.count}
        />
      )}
    </div>
  );
}
