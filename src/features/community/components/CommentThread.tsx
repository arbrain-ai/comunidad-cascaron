'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CommentWithReplies, UpdateCommentInput } from '../types';
import { CommentCard } from './CommentCard';

// Target para responder - se envía al parent (PostDetailModal)
interface ReplyTarget {
  commentId: string;      // ID del comentario padre (para parent_id)
  userId: string;         // ID del usuario a mencionar
  userName: string;       // Nombre para mostrar en header y mención
  isReplyToReply: boolean; // Si es reply a reply, pre-llenar mención
}

interface CommentThreadProps {
  comment: CommentWithReplies;
  postId: string;
  userId?: string;
  onLike: (commentId: string) => Promise<boolean>;
  onDelete?: (commentId: string) => Promise<void>;
  onEdit?: (commentId: string, input: UpdateCommentInput) => Promise<void>;
  onReplyTo: (target: ReplyTarget) => void;  // Sube evento al parent
  categoryId?: string | null;
}

export function CommentThread({
  comment,
  postId,
  userId,
  onLike,
  onDelete,
  onEdit,
  onReplyTo,
  categoryId = null,
}: CommentThreadProps) {
  const [showReplies, setShowReplies] = useState(false);

  const repliesCount = comment.replies?.length || 0;

  // Click en "Responder" del comentario padre
  const handleReplyToParent = () => {
    const authorInfo = comment.author || comment.agent;
    onReplyTo({
      commentId: comment.id,
      userId: authorInfo?.id || '',
      userName: authorInfo?.full_name || 'usuario',
      isReplyToReply: false, // Reply a padre = sin mención pre-llenada
    });
  };

  // Click en "Responder" de una reply
  const handleReplyToReply = (replyAuthorId: string, replyAuthorName: string) => {
    onReplyTo({
      commentId: comment.id, // parent_id siempre es el comentario padre
      userId: replyAuthorId,
      userName: replyAuthorName,
      isReplyToReply: true, // Reply a reply = con mención pre-llenada
    });
    setShowReplies(true); // Expandir para ver contexto
  };

  return (
    <div className="space-y-3">
      {/* Parent Comment */}
      <CommentCard
        comment={comment}
        onLike={onLike}
        onDelete={onDelete}
        onEdit={onEdit}
        onReply={userId ? handleReplyToParent : undefined}
        categoryId={categoryId}
      />

      {/* Replies Toggle & List */}
      {repliesCount > 0 && (
        <div className="ml-10">
          {/* Toggle Button */}
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover transition-colors py-2 font-medium"
          >
            {showReplies ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span>
              {showReplies ? 'Hide' : 'View'} {repliesCount} {repliesCount === 1 ? 'reply' : 'replies'}
            </span>
          </button>

          {/* Replies List with subtle animation */}
          <div
            className={`overflow-hidden transition-all duration-200 ease-out ${
              showReplies ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="space-y-3 pt-2">
              {comment.replies.map((reply) => {
                const replyAuthor = reply.author || reply.agent;
                return (
                  <CommentCard
                    key={reply.id}
                    comment={reply}
                    onLike={onLike}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onReply={userId ? () => handleReplyToReply(
                      replyAuthor?.id || '',
                      replyAuthor?.full_name || 'usuario'
                    ) : undefined}
                    isReply
                    categoryId={categoryId}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
