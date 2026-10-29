import { PollWithOptionsAndVotes } from '../types';

interface PollIndicatorProps {
  poll: PollWithOptionsAndVotes;
}

/**
 * PollIndicator - Collapsed poll badge for the feed (Skool pattern)
 * Only shows "Poll" badge + vote count. Full poll visible in detail modal.
 */
export function PollIndicator({ poll }: PollIndicatorProps) {
  const voteCount = poll.total_votes || 0;
  const voteText = voteCount === 1 ? '1 member has voted' : `${voteCount} members have voted`;

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/15 text-rose-500 rounded font-medium text-xs">
        Poll
      </span>
      <span className="text-muted text-xs">
        {voteText}
      </span>
    </div>
  );
}
