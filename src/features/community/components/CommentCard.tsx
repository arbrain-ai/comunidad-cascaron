'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';
import { CommentWithAuthor, PostAttachment, UpdateCommentInput } from '../types';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useToast } from '@/shared/hooks/useToast';
import { hasAdminAccess } from '@/shared/constants/roles';
import { hasUserLikedComment } from '../services/communityService';
import { enrichPlainMentions } from '../services/mentionEnrichment';
import { VideoEmbed } from '@/shared/components/VideoEmbed';
import { buildMediaBlocks } from '@/shared/utils/mediaType';
import { UserAvatarLink } from '@/shared/components/UserAvatarLink';
import { AttachmentPreview } from './AttachmentPreview';
import { ImageLightbox } from '@/shared/components/ImageLightbox';
import { formatRelativeDate } from '@/shared/utils/dates';
import { MarkdownRenderer } from '@/shared/components/MarkdownRenderer';
import { linkifyHtml } from '@/shared/utils/linkify';
import { LikesModal } from './LikesModal';
import { MentionEditor, MentionEditorRef } from '@/shared/components/MentionEditor';

interface CommentCardProps {
  comment: CommentWithAuthor;
  onLike: (commentId: string) => Promise<boolean>;
  onDelete?: (commentId: string) => Promise<void>;
  onEdit?: (commentId: string, input: UpdateCommentInput) => Promise<void>;
  onReply?: () => void;
  isReply?: boolean;
  categoryId?: string | null;
}

export function CommentCard({
  comment,
  onLike,
  onDelete,
  onEdit,
  onReply,
  isReply = false,
  categoryId,
}: CommentCardProps) {
  const { userProfile } = useUserProfile();
  const { showError } = useToast();
  // liked_by_me viene prefetcheado en batch desde getCommentsByPostId
  const [isLiked, setIsLiked] = useState(
    (comment as unknown as { liked_by_me?: boolean }).liked_by_me ?? false
  );
  const [likesCount, setLikesCount] = useState(comment.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const editorRef = useRef<MentionEditorRef>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);

  // Medios en el orden en que el autor los dejo en la bandeja (video y
  // rejillas de imagenes intercalados). Comentario viejo: video de la columna.
  const media = useMemo(
    () => buildMediaBlocks(comment.media_urls as PostAttachment[] | undefined, comment.video_embed_url),
    [comment.media_urls, comment.video_embed_url]
  );

  // Copy comment to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(comment.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Determine if this is an agent comment
  const isAgentComment = !comment.author && comment.agent;
  const authorInfo = comment.author || comment.agent;

  const isOwnComment = userProfile?.id === comment.author_id;
  const canEdit = isOwnComment && !comment.agent; // Solo el autor puede editar (no agentes)
  const canDelete = isOwnComment || hasAdminAccess(userProfile?.role || '');

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!onEdit || !editContent.trim()) return;

    setIsSaving(true);
    try {
      const enrichedContent = await enrichPlainMentions(editContent.trim());
      await onEdit(comment.id, {
        content: enrichedContent,
        media_urls: comment.media_urls as PostAttachment[],
        video_embed_url: comment.video_embed_url || null,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating comment:', error);
      showError('Error al actualizar el comentario');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  // Load initial like state — fallback SOLO si el caller no prefetcheó
  // liked_by_me (getCommentsByPostId ya lo trae en batch; esto mata el N+1).
  useEffect(() => {
    if (!userProfile?.id) return;
    if ((comment as unknown as { liked_by_me?: boolean }).liked_by_me !== undefined) return;
    hasUserLikedComment(userProfile.id, comment.id).then(setIsLiked);
  }, [userProfile?.id, comment.id]);

  const handleLike = async () => {
    if (!userProfile || isLiking) return;

    // OPTIMISTA: flip inmediato, revert en error.
    const prevLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? Math.max(prevCount - 1, 0) : prevCount + 1);
    setIsLiking(true);
    try {
      const liked = await onLike(comment.id);
      if (liked !== !prevLiked) {
        setIsLiked(liked);
        setLikesCount(liked ? prevCount + 1 : Math.max(prevCount - 1, 0));
      }
    } catch (error) {
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
      console.error('Error liking comment:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;

    if (confirm('¿Estás seguro de que quieres eliminar este comentario?')) {
      setIsDeleting(true);
      try {
        await onDelete(comment.id);
      } catch (error) {
        console.error('Error deleting comment:', error);
        showError('Error al eliminar el comentario');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className={`p-3 md:p-4 solid-card space-y-2 md:space-y-3 ${isReply ? 'ml-6 md:ml-10 mt-2 md:mt-3' : ''}`}>
      {/* Header - Compacto estilo Skool */}
      <div className="flex items-center justify-between">
        {authorInfo ? (
          <div className="flex items-center gap-2">
            <UserAvatarLink
              userId={authorInfo.id}
              avatarUrl={authorInfo.avatar_url}
              fullName={authorInfo.full_name}
              size="sm"
              showName
              nameClassName="text-sm"
              isAgent={!!isAgentComment}
            />
            <span className="text-muted">·</span>
            <span className="text-xs text-muted">
              {formatRelativeDate(comment.created_at || '')}
              {comment.updated_at && comment.created_at && new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() > 60000 && (
                <span className="italic text-muted/70 ml-1">(editado)</span>
              )}
            </span>
          </div>
        ) : (
          // Fallback for missing author
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-muted/20 flex items-center justify-center">
              <span className="text-muted text-xs">?</span>
            </div>
            <span className="text-sm text-muted">Usuario desconocido</span>
          </div>
        )}

        {/* Menu de 3 puntos */}
        {(canEdit || canDelete) && !isEditing && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-surface rounded transition-colors"
            >
              <svg className="w-4 h-4 text-muted" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-1 w-36 glass-panel-strong rounded-lg border border-glass-strong shadow-purple-glow z-10">
                {canEdit && onEdit && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                      // Scroll edit textarea into view on mobile after render
                      requestAnimationFrame(() => {
                        editContainerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                      });
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-primary/10 rounded-t-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => {
                      handleDelete();
                      setShowMenu(false);
                    }}
                    disabled={isDeleting}
                    className={`w-full px-3 py-2 text-left text-sm text-error hover:bg-error/10 transition-colors flex items-center gap-2 disabled:opacity-50 ${!canEdit ? 'rounded-t-lg' : ''} rounded-b-lg`}
                  >
                    {isDeleting ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                    {isDeleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content - Modo normal o edición */}
      {isEditing ? (
        <div ref={editContainerRef} className="space-y-2">
          <MentionEditor
            ref={editorRef}
            content={editContent}
            onChange={setEditContent}
            placeholder="Escribe tu comentario..."
            minHeight="60px"
            maxLength={2000}
            categoryId={categoryId || null}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="px-3 py-1 text-xs text-muted hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={isSaving || !editContent.trim()}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                isSaving || !editContent.trim()
                  ? 'bg-muted/30 text-muted cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <MarkdownRenderer
          content={linkifyHtml(comment.content)}
          allowHtml
          enableMentions
          className="text-foreground text-sm leading-relaxed"
        />
      )}

      {/* Medios en el orden del autor */}
      {media.blocks.map((block, blockIndex) => {
        if (block.kind === 'video') {
          return <VideoEmbed key={`video-${blockIndex}-${block.url}`} url={block.url} />;
        }
        if (block.urls.length === 1) {
          return (
            <button
              key={`images-${blockIndex}`}
              onClick={() => { setLightboxIndex(block.offset); setLightboxOpen(true); }}
              className="block overflow-hidden rounded-lg bg-surface-elevated cursor-zoom-in"
              style={{ maxWidth: '400px' }}
            >
              <img
                src={block.urls[0]}
                alt="Comment image"
                className="rounded-lg hover:opacity-90 transition-opacity"
                style={{ maxHeight: '250px', maxWidth: '100%', width: 'auto', objectFit: 'contain' }}
                loading="lazy"
              />
            </button>
          );
        }
        return (
          <div key={`images-${blockIndex}`} className="grid grid-cols-2 gap-2">
            {block.urls.map((url, index) => (
              <button
                key={url}
                onClick={() => { setLightboxIndex(block.offset + index); setLightboxOpen(true); }}
                className="relative aspect-video overflow-hidden rounded-lg bg-surface-elevated cursor-zoom-in"
              >
                <img
                  src={url}
                  alt="Comment image"
                  className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        );
      })}

      {/* Image Lightbox */}
      {media.images.length > 0 && (
        <ImageLightbox
          images={media.images}
          initialIndex={lightboxIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* Non-image Attachments (PDFs, docs, etc.) */}
      {comment.media_urls && (comment.media_urls as PostAttachment[]).length > 0 && (
        <AttachmentPreview attachments={comment.media_urls as PostAttachment[]} />
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-0.5 md:pt-1">
        {/* Left side: Like + Reply */}
        <div className="flex items-center gap-0.5 md:gap-1">
          {/* Like Button */}
          <button
            onClick={handleLike}
            disabled={!userProfile}
            className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-full transition-all text-xs md:text-sm ${
              isLiked
                ? 'text-primary bg-primary/10'
                : 'text-muted hover:bg-surface-elevated hover:text-foreground'
            }`}
          >
            <svg
              className="w-3.5 h-3.5 md:w-4 md:h-4"
              fill={isLiked ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
              />
            </svg>
          </button>
          {/* Like Count - Separate clickable element */}
          {likesCount > 0 && (
            <button
              onClick={() => setShowLikesModal(true)}
              className="text-xs font-medium hover:underline text-muted"
            >
              {likesCount}
            </button>
          )}

          {/* Reply Button (for parent comments and replies) */}
          {onReply && (
            <button
              onClick={onReply}
              className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 text-muted hover:bg-surface-elevated hover:text-foreground rounded-full transition-all text-xs md:text-sm"
            >
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
              <span className="font-medium">Reply</span>
            </button>
          )}
        </div>

        {/* Right side: Copy + Audio */}
        <div className="flex items-center gap-0.5 md:gap-1">
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 p-1.5 md:p-2 text-muted hover:bg-surface-elevated hover:text-foreground rounded-full transition-all"
            title={copied ? 'Copiado' : 'Copiar'}
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Likes Modal */}
      <LikesModal
        isOpen={showLikesModal}
        onClose={() => setShowLikesModal(false)}
        type="comment"
        id={comment.id}
        count={likesCount}
      />
    </div>
  );
}
