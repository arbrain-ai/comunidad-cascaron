'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Bookmark, Link2 } from 'lucide-react';
import { PostWithAuthor, PostAttachment, Category } from '../types';
import { CategoryPill } from './CategoryPill';
import { VideoEmbed } from '@/shared/components/VideoEmbed';
import { UserAvatarLink } from '@/shared/components/UserAvatarLink';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useToast } from '@/shared/hooks/useToast';
import { hasAdminAccess } from '@/shared/constants/roles';
import { hasUserLikedPost } from '../services/communityService';
import { AttachmentPreview } from './AttachmentPreview';
import { PollIndicator } from './PollIndicator';
import { LikesModal } from './LikesModal';
import { formatRelativeDate } from '@/shared/utils/dates';
import { useMentionHover } from '@/shared/hooks/useMentionHover';
import { sanitizeHtml } from '@/shared/utils/sanitize';
import { linkifyHtml } from '@/shared/utils/linkify';
import { buildMediaBlocks } from '@/shared/utils/mediaType';
import { sbAvatar } from '@/shared/lib/sbImage';

// Helper to check if user has viewed a post
const VIEWED_POSTS_KEY = 'app_viewed_posts';

function hasViewedPost(postId: string): boolean {
  if (typeof window === 'undefined') return false;
  const viewed = localStorage.getItem(VIEWED_POSTS_KEY);
  if (!viewed) return false;
  try {
    const viewedPosts: string[] = JSON.parse(viewed);
    return viewedPosts.includes(postId);
  } catch {
    return false;
  }
}

function markPostAsViewed(postId: string): void {
  if (typeof window === 'undefined') return;
  const viewed = localStorage.getItem(VIEWED_POSTS_KEY);
  let viewedPosts: string[] = [];
  try {
    viewedPosts = viewed ? JSON.parse(viewed) : [];
  } catch {
    viewedPosts = [];
  }
  if (!viewedPosts.includes(postId)) {
    viewedPosts.push(postId);
    // Keep only last 500 posts to avoid localStorage bloat
    if (viewedPosts.length > 500) {
      viewedPosts = viewedPosts.slice(-500);
    }
    localStorage.setItem(VIEWED_POSTS_KEY, JSON.stringify(viewedPosts));
  }
}

interface PostCardProps {
  post: PostWithAuthor;
  onLike: (postId: string) => Promise<boolean>;
  onDelete?: (postId: string) => Promise<void>;
  onEdit?: (post: PostWithAuthor) => void;
  onTogglePin?: (postId: string, pinned: boolean) => Promise<void>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToCategory?: (postId: string, categoryId: string) => Promise<void>;
  categories?: Category[];
  showComments?: boolean;
  commentsCount?: number;
  onOpenModal?: (postId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (postId: string) => Promise<void>;
}

function PostCardComponent({
  post,
  onLike,
  onDelete,
  onEdit,
  onTogglePin,
  onMoveUp,
  onMoveDown,
  onMoveToCategory,
  categories,
  showComments = true,
  commentsCount,
  onOpenModal,
  isFavorite = false,
  onToggleFavorite,
}: PostCardProps) {
  const { userProfile } = useUserProfile();
  const { showError, showSuccess } = useToast();
  const [isLiked, setIsLiked] = useState((post as any).liked_by_me || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [hasViewed, setHasViewed] = useState(true); // Default true to avoid flash
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isFavorited, setIsFavorited] = useState(isFavorite);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const spotlightRaf = useRef<number | null>(null);
  // Menú de opciones: se renderiza por PORTAL a document.body para que no lo
  // recorte el overflow:hidden de la card ni quede atrapado en su stacking
  // context (antes el menú y el submenú "Mover a categoría" se cortaban).
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
      if (!next) setShowCategoryMenu(false);
      return next;
    });
  }, []);

  // Cerrar el menú al click afuera, scroll o resize (es fixed, no sigue al scroll).
  useEffect(() => {
    if (!showMenu) return;
    const close = () => { setShowMenu(false); setShowCategoryMenu(false); };
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

  // Spotlight mouse tracking — coalesced con requestAnimationFrame para no
  // forzar reflow (getBoundingClientRect) ni repintar el gradiente en CADA
  // mousemove. En desktop esto era el cuello de botella del scroll.
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const { clientX, clientY } = e;
    if (spotlightRaf.current !== null) return; // ya hay un frame agendado
    spotlightRaf.current = requestAnimationFrame(() => {
      spotlightRaf.current = null;
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--spotlight-x', `${clientX - rect.left}px`);
      el.style.setProperty('--spotlight-y', `${clientY - rect.top}px`);
    });
  }, []);

  // Cancelar cualquier frame pendiente al desmontar
  useEffect(() => {
    return () => {
      if (spotlightRaf.current !== null) cancelAnimationFrame(spotlightRaf.current);
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    cardRef.current?.style.setProperty('--spotlight-opacity', '1');
  }, []);

  const handleMouseLeave = useCallback(() => {
    cardRef.current?.style.setProperty('--spotlight-opacity', '0');
  }, []);

  // Enable mention hover previews for title
  useMentionHover(titleRef);

  const isOwnPost = userProfile?.id === post.author_id;
  const canEdit = isOwnPost; // Solo el autor puede editar
  const canDelete = isOwnPost || hasAdminAccess(userProfile?.role || '');
  const canPin = hasAdminAccess(userProfile?.role || '');
  const canMove = hasAdminAccess(userProfile?.role || '') && onMoveToCategory && categories && categories.length > 1;
  const isDraft = (post as any).is_draft === true;


  const displayAuthor = post.author;

  // Check if post has been viewed on mount
  useEffect(() => {
    setHasViewed(hasViewedPost(post.id));
  }, [post.id]);

  // Sync favorite state with prop
  useEffect(() => {
    setIsFavorited(isFavorite);
  }, [isFavorite]);

  // No longer need to check like state individually on mount
  // It's pre-fetched in getPosts for performance (N+1 fix)

  const handleCardClick = () => {
    if (onOpenModal) {
      markPostAsViewed(post.id);
      setHasViewed(true);
      onOpenModal(post.id);
    }
  };

  const handleLike = async () => {
    if (!userProfile || isLiking) return;

    // OPTIMISTA: pinta el flip al instante, el servidor confirma en fondo.
    const prevLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? Math.max(prevCount - 1, 0) : prevCount + 1);
    setIsLiking(true);
    try {
      const liked = await onLike(post.id);
      // Reconciliar con la verdad del servidor (cubre doble-tap en otra tab)
      if (liked !== !prevLiked) {
        setIsLiked(liked);
        setLikesCount(liked ? prevCount + 1 : Math.max(prevCount - 1, 0));
      }
    } catch (error) {
      // Revert en error
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
      console.error('Error liking post:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;

    if (confirm('¿Estás seguro de que quieres eliminar este post?')) {
      setIsDeleting(true);
      try {
        await onDelete(post.id);
      } catch (error) {
        console.error('Error deleting post:', error);
        showError('Error al eliminar el post');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleTogglePin = async () => {
    if (!onTogglePin || isToggling) return;

    setIsToggling(true);
    try {
      await onTogglePin(post.id, !post.pinned);
    } catch (error) {
      console.error('Error toggling pin:', error);
      showError('Error al fijar/desfijar el post');
    } finally {
      setIsToggling(false);
    }
  };

  const handleMoveToCategory = async (categoryId: string) => {
    if (!onMoveToCategory || isMoving) return;

    setIsMoving(true);
    try {
      await onMoveToCategory(post.id, categoryId);
      setShowCategoryMenu(false);
      setShowMenu(false);
    } catch (error) {
      console.error('Error moving post:', error);
      showError('Error al mover el post');
    } finally {
      setIsMoving(false);
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

  // HTML sanitizado/linkificado memoizado: sanitizeHtml + linkifyHtml son caros
  // y antes corrian en CADA render (incluidos los re-renders por realtime).
  const cleanTitle = useMemo(
    () => (post.title ? sanitizeHtml(post.title) : ''),
    [post.title]
  );
  const cleanContent = useMemo(
    () =>
      linkifyHtml(
        sanitizeHtml(
          post.content.replace(/<\/p><p>/gi, '</p> <p>').replace(/<br\s*\/?>/gi, ' ')
        )
      ),
    [post.content]
  );

  return (
    <article
      ref={cardRef}
      onClick={handleCardClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`cursor-pointer ${
        isDraft
          ? 'card-spotlight border-gold/60 border-dashed'
          : post.pinned
          ? 'card-spotlight border-gold/60 pinned-glow'
          : 'card-spotlight'
      }`}
    >
      {/* Content wrapper — z-10 lifts above spotlight ::before/::after layers */}
      <div className="relative z-10 p-3 md:p-5 space-y-2.5 md:space-y-4">

      {/* Draft Banner — "Revisar y publicar" ABRE la pantalla de pre-envío, no publica.
          Antes este botón mandaba el post de un solo clic: push a ~570 personas sin
          poder ver antes cómo quedaba ni decidir el correo. Publicar es irreversible;
          un clic accidental no puede ser suficiente. */}
      {isDraft && hasAdminAccess(userProfile?.role || '') && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="es-tuyo text-xs font-semibold uppercase tracking-wider">
              Sin publicar
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(post);
              }}
              className="btn-primary text-xs px-4 py-1.5"
            >
              Revisar y publicar
            </button>
          </div>
          <hr className="sup-div" />
        </>
      )}

      {/* Header - Compacto estilo Skool */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar sin nombre (nombre va en otra línea) */}
          <UserAvatarLink
            userId={displayAuthor.id}
            avatarUrl={displayAuthor.avatar_url}
            fullName={displayAuthor.full_name}
            size="md"
          />
          {/* Info del autor: nombre arriba, metadata abajo */}
          <div className="min-w-0 flex-1">
            {/* Nombre del autor */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground text-sm truncate">
                {displayAuthor.full_name}
              </span>
            </div>
            {/* Metadata: timestamp + categoría (estilo Skool) */}
            <div className="flex items-center gap-1.5 text-2xs text-muted">
              <span>
                {formatRelativeDate(post.created_at || '')}
                {post.updated_at && post.created_at && new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60000 && (
                  <span className="italic opacity-70 ml-1">(editado)</span>
                )}
              </span>
              {/* Category como pill de color (patrón de comunidad) */}
              {post.category && (
                <>
                  <span>·</span>
                  <CategoryPill
                    category={{
                      name: post.category.name,
                      color: post.category.color,
                      emoji: (post.category as any).emoji,
                    }}
                    size="xs"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Menu */}
        {(canEdit || canDelete || canPin || !!userProfile) && (
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
              className="w-48 glass-panel-strong rounded-xl border border-glass-strong depth-modal"
            >
              {canPin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePin();
                    setShowMenu(false);
                  }}
                  disabled={isToggling}
                  className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-primary/10 rounded-t-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isToggling ? 'Procesando...' : post.pinned ? 'Desfijar post' : 'Fijar post'}
                </button>
              )}
              {/* Move to category - Admin only */}
              {canMove && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCategoryMenu(!showCategoryMenu);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-primary/10 transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Mover a categoría
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${showCategoryMenu ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {/* Category submenu */}
                  {showCategoryMenu && (
                    <div className="absolute right-full top-0 mr-1 w-48 glass-panel-strong rounded-xl border border-glass-strong depth-modal z-20">
                      {categories
                        ?.filter(cat => cat.id !== post.category_id)
                        .map((category, idx, arr) => (
                          <button
                            key={category.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveToCategory(category.id);
                            }}
                            disabled={isMoving}
                            className={`w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center gap-2 ${idx === 0 ? 'rounded-t-xl' : ''} ${idx === arr.length - 1 ? 'rounded-b-xl' : ''}`}
                          >
                            {(category as any).emoji && <span>{(category as any).emoji}</span>}
                            <span style={{ color: category.color || 'var(--primary)' }}>{category.name}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
              {/* Move up/down buttons for pinned posts */}
              {onMoveUp && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveUp();
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-primary/10 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  Mover arriba
                </button>
              )}
              {onMoveDown && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveDown();
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-primary/10 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Mover abajo
                </button>
              )}
              {canEdit && onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                    setShowMenu(false);
                  }}
                  disabled={isDeleting}
                  className={`w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-b-xl`}
                >
                  {isDeleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              )}
            </div>,
            document.body
          )}
        </div>
      )}
    </div>

      {/* Content Row - Title/Content on left, Media thumbnail on right (Skool style) */}
      <div className="flex gap-4">
        {/* Left side - Title and Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Title - Skool style: single line, truncate if long */}
          {post.title && (
            <h3
              ref={titleRef}
              className="text-xl [font-weight:660] tracking-[-0.017em] text-foreground truncate [&_.mention]:text-primary [&_.mention]:font-semibold"
              dangerouslySetInnerHTML={{ __html: cleanTitle }}
            />
          )}

          {/* Content - Skool style: 2 lines max, hard cut (no ellipsis) */}
          <div
            className="text-foreground text-[13.5px] leading-normal line-clamp-2 [&_p]:m-0 [&_p]:inline [&_br]:hidden [&_.mention]:text-primary [&_.mention]:font-semibold [&_h2]:text-sm [&_h2]:font-bold [&_h2]:inline [&_h2]:m-0 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:inline [&_h3]:m-0 [&_pre]:hidden [&_blockquote]:inline [&_blockquote]:m-0 [&_blockquote]:border-0 [&_blockquote]:p-0 [&_blockquote]:not-italic [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono"
            dangerouslySetInnerHTML={{ __html: cleanContent }}
          />
        </div>

        {/* Right side - Media thumbnail (Skool style: small, right-aligned) */}
        {/* La PORTADA es el PRIMER medio en el orden que el autor dejo en la
            bandeja: si puso el video en cuarto lugar, la portada es la primera
            imagen, no el video. Un post viejo (video solo en la columna) sigue con el
            video de portada, como siempre. Click opens post modal. */}
        {(() => {
          const media = buildMediaBlocks(
            post.media_urls as Array<string | { url: string; type?: string }> | null,
            post.video_embed_url,
          );
          const first = media.blocks[0];
          if (!first) return null;
          if (first.kind === 'video') {
            return (
              <div className="flex-shrink-0">
                <VideoEmbed url={first.url} compact disablePlay />
              </div>
            );
          }
          const imageUrls = media.images;
          return (
            <div className="relative w-[76px] h-[43px] rounded-lg overflow-hidden bg-surface-elevated flex-shrink-0 opacity-[.72] hover:opacity-100 transition-opacity">
              <Image
                src={first.urls[0]}
                alt="Post media"
                fill
                sizes="76px"
                className="object-cover"
                loading="lazy"
              />
              {/* Badge for multiple images */}
              {imageUrls.length > 1 && (
                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-3xs font-medium px-1.5 py-0.5 rounded">
                  +{imageUrls.length - 1}
                </div>
              )}
            </div>
          );
        })()}
      </div>

  {/* Attachments - Only show non-image files (images are shown as thumbnail above) */ }
  {(() => {
    const attachments = (post as any).attachments as PostAttachment[] | undefined;
    // Filter out images since they're already displayed as thumbnail from media_urls
    const nonImageAttachments = attachments?.filter(a => !a.type?.startsWith('image/')) || [];
    return nonImageAttachments.length > 0 && (
      <div>
        {/* Una ficha y el resto en "+N": la tarjeta del feed es una fila, no
            un contenedor de archivos. Dentro del post se listan todos. */}
        <AttachmentPreview attachments={nonImageAttachments} maxVisible={1} />
      </div>
    );
  })()}

  {/* Poll Indicator - Collapsed badge (Skool style) */}
  {post.poll && <PollIndicator poll={post.poll} />}

  {/* Actions - Skool Style Compacto */}
  <div className="flex items-center gap-2 md:gap-4 pt-0.5 md:pt-1">
    {/* Like Button + Count - Inline compacto */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleLike();
      }}
      disabled={!userProfile}
      className={`inline-flex items-center gap-1 text-xs md:text-sm transition-colors disabled:opacity-50 btn-icon-inline ${
        isLiked ? 'text-primary' : 'text-muted hover:text-foreground'
      }`}
    >
      <svg
        className="w-4 h-4 md:w-[18px] md:h-[18px]"
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
      <span
        onClick={(e) => {
          if (likesCount > 0) {
            e.stopPropagation();
            setShowLikesModal(true);
          }
        }}
        className={likesCount > 0 ? 'hover:underline cursor-pointer' : ''}
      >
        {likesCount}
      </span>
    </button>

    {/* Comments Button */}
    {showComments && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          markPostAsViewed(post.id);
          setHasViewed(true);
          onOpenModal?.(post.id);
        }}
        className="inline-flex items-center gap-1 text-xs md:text-sm text-muted hover:text-foreground transition-colors btn-icon-inline"
      >
        <svg className="w-4 h-4 md:w-[18px] md:h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span>{post.comments_count || 0}</span>
      </button>
    )}

    {/* Favorite Button - Solo para usuarios autenticados */}
    {userProfile && onToggleFavorite && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleToggleFavorite();
        }}
        disabled={isFavoriting}
        title={isFavorited ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        className={`inline-flex items-center gap-1 transition-all duration-200 disabled:opacity-50 btn-icon-inline ${
          isFavorited
            ? 'text-primary hover:text-primary-hover scale-110'
            : 'text-muted hover:text-foreground'
        }`}
      >
        <Bookmark
          className={`w-4 h-4 md:w-5 md:h-5 transition-all duration-200 ${
            isFavorited ? 'fill-current' : ''
          }`}
        />
      </button>
    )}

    {/* Share / Copy Link Button */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        const url = `${window.location.origin}/community?post=${post.id}`;
        navigator.clipboard.writeText(url).then(() => {
          showSuccess('Link copiado');
        });
      }}
      title="Copiar link"
      className="inline-flex items-center transition-colors btn-icon-inline text-muted hover:text-foreground"
    >
      <Link2 className="w-4 h-4 md:w-[18px] md:h-[18px]" />
    </button>

    {/* Recent Commenters + Last Comment Time */}
    {post.comment_activity && post.comment_activity.recent_commenters.length > 0 && (
      <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0">
        {/* Stacked Avatars - Solo en desktop */}
        <div className="hidden md:flex -space-x-1.5">
          {post.comment_activity.recent_commenters.slice(0, 4).map((commenter, idx) => (
            <div
              key={commenter.id}
              className="w-5 h-5 md:w-6 md:h-6 rounded-full border-[1.5px] border-card overflow-hidden bg-surface"
              style={{ zIndex: 4 - idx }}
              title={commenter.full_name}
            >
              {commenter.avatar_url ? (
                <img
                  src={sbAvatar(commenter.avatar_url, 48)}
                  alt={commenter.full_name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xs font-medium text-muted">
                  {commenter.full_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Last Comment Time - Compacto en móvil */}
        {post.comment_activity.last_comment_at && (
          <span className={`text-2xs md:text-sm truncate ${
            hasViewed ? 'text-muted' : 'text-primary font-medium'
          }`}>
            <span className="hidden md:inline">{hasViewed ? 'Último comentario ' : 'Nuevo '}</span>
            <span className="md:hidden">{hasViewed ? '' : '● '}</span>
            {formatRelativeDate(post.comment_activity.last_comment_at)}
          </span>
        )}
      </div>
    )}
  </div>

  {/* Likes Modal */ }
  <LikesModal
    isOpen={showLikesModal}
    onClose={() => setShowLikesModal(false)}
    type="post"
    id={post.id}
    count={likesCount}
  />
      </div>{/* Close content wrapper z-10 */}
    </article >
  );
}

// Memoizado: evita re-renderizar las ~30 tarjetas del feed cuando cambia el
// estado de un solo post (like/comentario via realtime). Nota: para que el memo
// rinda al 100%, los handlers del padre (onLike, onDelete...) deben estar
// estabilizados con useCallback; aun sin eso, el memo + useMemo del HTML reduce
// notablemente el costo por render.
export const PostCard = memo(PostCardComponent);
