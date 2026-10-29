'use client';

import { useMemo } from 'react';
import type { VisibleReaction } from '../hooks/useReactions';

interface FloatingReactionsProps {
  reactions: VisibleReaction[];
}

export function FloatingReactions({ reactions }: FloatingReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="absolute bottom-20 right-4 pointer-events-none z-30 overflow-hidden" style={{ height: '300px', width: '120px' }}>
      {reactions.map((reaction) => (
        <FloatingEmoji key={reaction.id} reaction={reaction} />
      ))}
    </div>
  );
}

function FloatingEmoji({ reaction }: { reaction: VisibleReaction }) {
  // Stable random offset derived from reaction ID (deterministic per reaction)
  const offsetX = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < reaction.id.length; i++) {
      hash = ((hash << 5) - hash + reaction.id.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 60;
  }, [reaction.id]);

  return (
    <div
      className="absolute bottom-0 animate-float-up"
      style={{
        left: `${offsetX}px`,
        animationDuration: '3s',
        animationTimingFunction: 'ease-out',
        animationFillMode: 'forwards',
      }}
    >
      <div className="flex flex-col items-center">
        <span className="text-3xl drop-shadow-lg">{reaction.emoji}</span>
        <span className="text-[9px] text-white/70 font-medium bg-black/30 px-1.5 py-0.5 rounded-full whitespace-nowrap mt-0.5">
          {reaction.userName.split(' ')[0]}
        </span>
      </div>
    </div>
  );
}
