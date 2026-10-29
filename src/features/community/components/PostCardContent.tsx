'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { Bookmark } from 'lucide-react';
import { PostWithAuthor, PostAttachment } from '../types';
import { VideoEmbed } from '@/shared/components/VideoEmbed';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { hasAdminAccess } from '@/shared/constants/roles';
import { hasUserLikedPost } from '../services/communityService';
import { AttachmentPreview } from './AttachmentPreview';
import { PollDisplay } from './PollDisplay';
import { LikesModal } from './LikesModal';
import { ImageLightbox } from '@/shared/components/ImageLightbox';
import { formatRelativeDate } from '@/shared/utils/dates';
import { useToast } from '@/shared/hooks/useToast';
import { useMentionHover } from '@/shared/hooks/useMentionHover';
import { sanitizeHtml } from '@/shared/utils/sanitize';
import { linkifyHtml } from '@/shared/utils/linkify';
import { buildMediaBlocks } from '@/shared/utils/mediaType';

// Helper to extract image URLs from HTML content
function extractImagesFromHtml(html: string): string[] {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    if (match[1]) {
      images.push(match[1]);
    }
  }
  return images;
}

interface PostCardContentProps {
  post: PostWithAuthor;
  onLike: (postId: string) => Promise<boolean>;
  onDelete?: (postId: string) => Promise<void>;
  onEdit?: (post: PostWithAuthor) => void;
  onTogglePin?: (postId: string, pinned: boolean) => Promise<void>;
  showComments?: boolean;
  commentsCount?: number;
  onCommentsClick?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (postId: string) => Promise<void>;
}

export function PostCardContent({
  post,
  onLike,
  onDelete,
  onEdit,
  onTogglePin,
  showComments = true,
  commentsCount,
  onCommentsClick,
  isFavorite = false,
  onToggleFavorite,
}: PostCardContentProps) {
  const { userProfile } = useUserProfile();
  const { showError, showSuccess } = useToast();
  // liked_by_me viene prefetcheado en getPostById → cero flash de "no like"
  const [isLiked, setIsLiked] = useState(
    (post as unknown as { liked_by_me?: boolean }).liked_by_me ?? false
  );
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Menú de opciones por PORTAL a body (evita recorte por overflow del modal de detalle).
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu((open) => {
      const next = !open;
      if (next && menuButtonRef.current) {
        const rect = menuButtonRef.current.getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    const onPointerDown = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (menuButtonRef.current?.contains(t) || menuPortalRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [showMenu]);

  const [isFavorited, setIsFavorited] = useState(isFavorite);
  const [isFavoriting, setIsFavoriting] = useState(false);

  // Extract images from HTML content and combine with media_urls
  // Filter out non-image files (PDFs, docs, etc.) from media_urls
  const contentImages = useMemo(() => extractImagesFromHtml(post.content || ''), [post.content]);

  // Bloques de medios EN EL ORDEN que el autor los dejo en la bandeja: cada
  // video es un bloque, las imagenes consecutivas se agrupan en rejilla. Solo
  // entran imagenes reales (allowlist MIME/extension) que no esten ya dentro
  // del contenido; los archivos (pdf, md...) van a las fichas de descarga.
  // Un post viejo (video solo en la columna) sigue pintando el video primero.
  const media = useMemo(
    () => buildMediaBlocks(
      post.media_urls as Array<string | { url: string; type?: string }> | null,
      post.video_embed_url,
      (url) => !contentImages.includes(url),
    ),
    [post.media_urls, post.video_embed_url, contentImages]
  );
  const mediaImages = media.images;

  const allImages = useMemo(() => [...contentImages, ...mediaImages], [contentImages, mediaImages]);

  // Handle click on inline images in content
  const handleContentImageClick = useCallback((imageUrl: string) => {
    const index = allImages.indexOf(imageUrl);
    if (index !== -1) {
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  }, [allImages]);

  // Attach click handlers to inline images after render
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const images = contentEl.querySelectorAll('img');
    const handlers: Array<{ img: HTMLImageElement; handler: (e: Event) => void }> = [];

    images.forEach((img) => {
      const handler = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const src = img.getAttribute('src');
        if (src) {
          handleContentImageClick(src);
        }
      };
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', handler);
      handlers.push({ img, handler });
    });

    return () => {
      handlers.forEach(({ img, handler }) => {
        img.removeEventListener('click', handler);
      });
    };
  }, [post.content, handleContentImageClick]);

  // Enable mention hover previews (Facebook/Skool-style)
  // El título también lleva menciones (mismo hook que usa PostCard en el feed).
  useMentionHover(contentRef);
  useMentionHover(titleRef);

  const isOwnPost = userProfile?.id === post.author_id;
  const canEdit = isOwnPost; // Solo el autor puede editar
  const canDelete = isOwnPost || hasAdminAccess(userProfile?.role || '');
  const canPin = hasAdminAccess(userProfile?.role || '');

  const displayAuthor = post.author;
  const authorProfileUrl = `/profile/${post.author.id}`;

  // Load initial like state — SOLO como fallback si el caller no prefetcheó
  // liked_by_me (getPostById ya lo trae; esto evita el flash de "no like").
  useEffect(() => {
    if (!userProfile?.id) return;
    if ((post as unknown as { liked_by_me?: boolean }).liked_by_me !== undefined) return;
    hasUserLikedPost(userProfile.id, post.id).then(setIsLiked);
  }, [userProfile?.id, post.id]);

  // Sync favorite state with prop
  useEffect(() => {
    setIsFavorited(isFavorite);
  }, [isFavorite]);

  const handleLike = async () => {
    if (!userProfile || isLiking) return;

    // OPTIMISTA: flip inmediato, servidor confirma en fondo, revert en error.
    const prevLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? Math.max(prevCount - 1, 0) : prevCount + 1);
    setIsLiking(true);
    try {
      const liked = await onLike(post.id);
      if (liked !== !prevLiked) {
        setIsLiked(liked);
        setLikesCount(liked ? prevCount + 1 : Math.max(prevCount - 1, 0));
      }
    } catch (error) {
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
      console.error('Error liking post:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    if (confirm('¿Estás seguro de que quieres eliminar este post?')) {
      try {
        await onDelete(post.id);
      } catch (error) {
        console.error('Error deleting post:', error);
        alert('Error al eliminar el post');
      }
    }
  };

  const handleTogglePin = async () => {
    if (!onTogglePin) return;

    try {
      await onTogglePin(post.id, !post.pinned);
    } catch (error) {
      console.error('Error toggling pin:', error);
      alert('Error al fijar/desfijar el post');
    }
  };

  const handleToggleFavorite = async () => {
    if (!userProfile || !onToggleFavorite || isFavoriting) return;

    // Optimistic UI update
    const previousState = isFavorited;
    setIsFavorited(!isFavorited);
    setIsFavoriting(true);

    try {
      await onToggleFavorite(post.id);
      showSuccess(
        !previousState ? 'Post guardado en favoritos' : 'Post eliminado de favoritos'
      );
    } catch (error) {
      // Revert on error
      setIsFavorited(previousState);
      console.error('Error toggling favorite:', error);
      showError('Error al actualizar favoritos');
    } finally {
      setIsFavoriting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-3 md:space-y-4">
      {/* Header - Compacto estilo Skool */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={authorProfileUrl}
            className="flex-shrink-0"
          >
            {displayAuthor.avatar_url ? (
              <img
                src={displayAuthor.avatar_url}
                alt={displayAuthor.full_name}
                className="w-10 h-10 rounded-full object-cover hover:opacity-80 transition-opacity"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center hover:opacity-80 transition-opacity">
                <span className="text-primary font-semibold">
                  {displayAuthor.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={authorProfileUrl}
                className="font-semibold text-foreground hover:underline truncate"
              >
                {displayAuthor.full_name}
              </Link>
              <span className="text-muted">·</span>
              <span className="text-xs text-muted">
                {formatRelativeDate(post.created_at || '')}
                {post.updated_at && post.created_at && new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60000 && (
                  <span className="italic text-muted/70 ml-1">(editado)</span>
                )}
              </span>
              <span className="text-muted">·</span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `color-mix(in srgb, ${post.category.color || 'var(--primary)'} 14%, transparent)`,
                  color: post.category.color || 'var(--primary)',
                }}
              >
                {(post.category as any).emoji && <span className="mr-1">{(post.category as any).emoji}</span>}
                {post.category.name}
              </span>
              {post.pinned && (
                <span className="text-gold text-xs">📌</span>
              )}
            </div>
          </div>
        </div>

        {/* Menu */}
        {(canEdit || canDelete || canPin) && (
          <div className="relative flex-shrink-0">
            <button
              ref={menuButtonRef}
              onClick={toggleMenu}
              className="p-2 hover:bg-surface rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-muted" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {showMenu && menuPos && typeof document !== 'undefined' && createPortal(
              <div
                ref={menuPortalRef}
                onClick={(e) => e.stopPropagation()}
                style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                className="w-48 glass-panel-strong rounded-xl border border-glass-strong shadow-purple-glow"
              >
                {canPin && (
                  <button
                    onClick={() => {
                      handleTogglePin();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-primary/10 rounded-t-xl transition-colors"
                  >
                    {post.pinned ? 'Desfijar' : 'Fijar'} post
                  </button>
                )}
                {canEdit && onEdit && (
                  <button
                    onClick={() => {
                      onEdit(post);
                      setShowMenu(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-primary/10 transition-colors flex items-center gap-2 ${!canPin ? 'rounded-t-xl' : ''}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className={`w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error/10 transition-colors ${!canPin && !canEdit ? 'rounded-t-xl' : ''} rounded-b-xl`}
                  >
                    Eliminar
                  </button>
                )}
              </div>,
              document.body
            )}
          </div>
        )}
      </div>

      {/* Title */}
      {post.title && (
        <h3
          ref={titleRef}
          className="text-lg md:text-xl font-bold text-foreground leading-tight [&_.mention]:text-primary [&_.mention]:font-semibold"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.title) }}
        />
      )}

      {/* Content */}
      <div
        ref={contentRef}
        className="max-w-prose text-foreground text-base leading-normal break-words [&_.mention]:text-primary [&_.mention]:font-semibold [&_.mention]:bg-primary/10 [&_.mention]:px-1 [&_.mention]:py-0.5 [&_.mention]:rounded [&_p]:mb-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_ol]:my-3 [&_li]:my-0.5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/40 hover:[&_a]:decoration-primary [&_a]:break-all [&_img]:rounded-lg [&_img]:max-w-full [&_img]:max-h-[300px] [&_img]:h-auto [&_img]:transition-opacity [&_img]:hover:opacity-90 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_pre]:bg-black/30 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:text-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:my-3 [&_blockquote]:text-muted [&_blockquote]:italic"
        dangerouslySetInnerHTML={{ __html: linkifyHtml(sanitizeHtml(post.content)) }}
      />

      {/* Medios en el orden del autor: video · rejilla de imagenes · video… */}
      {media.blocks.map((block, blockIndex) => {
        if (block.kind === 'video') {
          return <VideoEmbed key={`video-${blockIndex}-${block.url}`} url={block.url} className="mt-3" />;
        }
        if (block.urls.length === 1) {
          return (
            <button
              key={`images-${blockIndex}`}
              onClick={() => {
                setLightboxIndex(contentImages.length + block.offset);
                setLightboxOpen(true);
              }}
              className="block overflow-hidden rounded-lg bg-surface-elevated cursor-zoom-in"
              style={{ maxWidth: '400px' }}
            >
              <img
                src={block.urls[0]}
                alt="Post media"
                className="rounded-lg hover:opacity-90 transition-opacity"
                style={{
                  maxHeight: '250px',
                  maxWidth: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain'
                }}
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
                onClick={() => {
                  setLightboxIndex(contentImages.length + block.offset + index);
                  setLightboxOpen(true);
                }}
                className="relative aspect-video w-full overflow-hidden rounded-lg bg-surface-elevated cursor-zoom-in group"
              >
                <Image
                  src={url}
                  alt={`Media ${block.offset + index + 1}`}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                  priority={false}
                />
              </button>
            ))}
          </div>
        );
      })}

      {/* Single Lightbox for all images (content + media) */}
      {allImages.length > 0 && (
        <ImageLightbox
          images={allImages}
          initialIndex={lightboxIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* Attachments */}
      {(post as any).attachments && (post as any).attachments.length > 0 && (
        <AttachmentPreview attachments={(post as any).attachments as PostAttachment[]} />
      )}

      {/* Poll */}
      {post.poll && (
        <PollDisplay
          poll={post.poll}
          userId={userProfile?.id}
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 md:gap-2 pt-3 border-t border-border">
        {/* Like Button */}
        <button
          onClick={handleLike}
          disabled={!userProfile}
          className={`flex items-center gap-1 px-2.5 py-1.5 md:gap-1.5 md:px-3 md:py-2 rounded-full transition-all text-sm font-medium ${
            isLiked
              ? 'text-primary bg-primary/10 hover:bg-primary/15'
              : 'text-muted hover:bg-surface hover:text-foreground'
          }`}
        >
          <svg
            className="w-4 h-4"
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
          <span className="hidden sm:inline">Like</span>
          {likesCount > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setShowLikesModal(true);
              }}
              className="text-muted-foreground hover:underline cursor-pointer"
            >
              {likesCount}
            </span>
          )}
        </button>

        {/* Comments Count */}
        {showComments && (
          <button
            onClick={onCommentsClick}
            className="flex items-center gap-1 px-2.5 py-1.5 md:gap-1.5 md:px-3 md:py-2 text-muted hover:bg-surface hover:text-foreground rounded-full transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span>{(commentsCount ?? post.comments_count ?? 0)} <span className="hidden sm:inline">{(commentsCount ?? post.comments_count ?? 0) === 1 ? 'comment' : 'comments'}</span></span>
          </button>
        )}

        {/* Favorite Button - Solo para usuarios autenticados */}
        {userProfile && onToggleFavorite && (
          <button
            onClick={handleToggleFavorite}
            disabled={isFavoriting}
            title={isFavorited ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            className={`flex items-center gap-1 px-2.5 py-1.5 md:gap-1.5 md:px-3 md:py-2 rounded-full transition-all text-sm font-medium disabled:opacity-50 ${
              isFavorited
                ? 'text-primary bg-primary/10 hover:bg-primary/15'
                : 'text-muted hover:bg-surface hover:text-foreground'
            }`}
          >
            <Bookmark
              className={`w-4 h-4 transition-all duration-200 ${
                isFavorited ? 'fill-current' : ''
              }`}
            />
            <span className="hidden sm:inline">{isFavorited ? 'Guardado' : 'Guardar'}</span>
          </button>
        )}
      </div>

      {/* Likes Modal */}
      <LikesModal
        isOpen={showLikesModal}
        onClose={() => setShowLikesModal(false)}
        type="post"
        id={post.id}
        count={likesCount}
      />
    </div>
  );
}
