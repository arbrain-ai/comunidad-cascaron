'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import {
  getPostById,
  getCommentsByPostId,
  createComment,
  deleteComment,
  updateComment,
  toggleCommentLike,
  togglePostLike,
  deletePost,
  togglePinPost,
  updatePost,
  markPostAsViewed,
} from '../services/communityService';
import {
  PostWithAuthor,
  CommentWithReplies,
  CreateCommentInput,
  UpdateCommentInput,
  UpdatePostInput,
} from '../types';
import { CommentForm } from './CommentForm';
import { CommentThread } from './CommentThread';
import { PostCardContent } from './PostCardContent';
import { PostEditModal } from './PostEditModal';
import { hasAdminAccess } from '@/shared/constants/roles';
import { useToast } from '@/shared/hooks/useToast';
import { supabase } from '@/shared/lib/supabase';
import { toggleFavorite, isFavorite } from '../services/favoritesService';
import { markPostNotificationsAsRead } from '@/features/notifications/services/notificationService';

// Target para responder a un comentario/reply (estado centralizado)
interface ReplyTarget {
  commentId: string;      // ID del comentario padre (para parent_id)
  userId: string;         // ID del usuario a mencionar
  userName: string;       // Nombre para mostrar en header y mención
  isReplyToReply: boolean; // Si es reply a reply, pre-llenar mención
}

interface PostDetailModalProps {
  postId: string;
  onClose: () => void;
  onPostDeleted?: () => void;
  onPostUpdated?: () => void;
  initialPinned?: boolean; // Para evitar flash de color durante carga
}

export function PostDetailModal({
  postId,
  onClose,
  onPostDeleted,
  onPostUpdated,
  initialPinned = false,
}: PostDetailModalProps) {
  const { userProfile } = useUserProfile();
  const { showError } = useToast();

  const [post, setPost] = useState<PostWithAuthor | null>(null);
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  // Track visual viewport for mobile keyboard adaptation
  const [keyboardStyle, setKeyboardStyle] = useState<React.CSSProperties>({});
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Estado centralizado para reply (sticky bar)
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const lastCommentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showJumpButton, setShowJumpButton] = useState(false);

  // Handler para cuando se hace click en "Responder"
  const handleReplyTo = (target: ReplyTarget) => {
    setReplyTarget(target);
    // Focus en el form después de un tick
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  // Handler para cancelar reply
  const handleCancelReply = () => {
    setReplyTarget(null);
  };

  // Handler para saltar al último comentario
  const handleJumpToLatestComment = () => {
    lastCommentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Detectar scroll para mostrar/ocultar botón "Jump to latest"
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || comments.length === 0) {
      setShowJumpButton(false);
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      // Mostrar botón si hay más de 200px de scroll restante
      setShowJumpButton(distanceFromBottom > 200);
    };

    // Check inicial
    handleScroll();

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [comments.length]);

  // Fetch post and comments
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [postData, commentsData] = await Promise.all([
        getPostById(postId, userProfile?.id),
        getCommentsByPostId(postId, userProfile?.id),
      ]);
      setPost(postData);
      setComments(commentsData);

      // Mark post as viewed for Unread filter + auto-mark notifications (fire and forget)
      if (userProfile?.id) {
        markPostAsViewed(userProfile.id, postId);
        markPostNotificationsAsRead(userProfile.id, postId);
        // Check if post is favorited
        const favorited = await isFavorite(userProfile.id, postId);
        setIsFavorited(favorited);
      }
    } catch (err) {
      console.error('Error fetching post:', err);
      setError('Error al cargar el post');
    } finally {
      setIsLoading(false);
    }
  }, [postId, userProfile?.id]);

  useEffect(() => {
    if (postId) {
      fetchData();
    }
  }, [postId, fetchData]);

  // Lock body scroll when modal is open (iOS-safe approach)
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Adapt modal height to visual viewport (mobile keyboard)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let frame: number | null = null;

    const handleViewport = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }

      frame = requestAnimationFrame(() => {
        const keyboardInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        const isKeyboardOpen = keyboardInset > 80 || vv.height < window.innerHeight * 0.85;

        if (isKeyboardOpen) {
          const availableHeight = Math.max(320, vv.height - 16);
          setKeyboardStyle({
            height: `${availableHeight}px`,
            maxHeight: `${availableHeight}px`,
            marginTop: `${Math.max(8, vv.offsetTop + 8)}px`,
            marginBottom: '8px',
          });
        } else {
          setKeyboardStyle({});
        }
      });
    };

    handleViewport();
    vv.addEventListener('resize', handleViewport);
    vv.addEventListener('scroll', handleViewport);
    window.addEventListener('orientationchange', handleViewport);

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      vv.removeEventListener('resize', handleViewport);
      vv.removeEventListener('scroll', handleViewport);
      window.removeEventListener('orientationchange', handleViewport);
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Supabase Realtime subscription for new comments
  useEffect(() => {
    if (!postId) return;

    // Unique channel name per mount (anti React strict mode double-mount bug)
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(`modal-post-${postId}-comments-${uniqueId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        async () => {
          try {
            const updatedComments = await getCommentsByPostId(postId, userProfile?.id);
            setComments(updatedComments);
          } catch (error) {
            console.error('Error refreshing comments:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, userProfile?.id]);

  // Handle post like
  const handlePostLike = async (id: string): Promise<boolean> => {
    if (!userProfile) return false;
    const result = await togglePostLike(userProfile.id, id);
    return result.liked;
  };

  // Handle post delete
  const handlePostDelete = async (id: string) => {
    await deletePost(id);
    onPostDeleted?.();
    onClose();
  };

  // Handle post pin
  const handleTogglePin = async (id: string, pinned: boolean) => {
    if (!hasAdminAccess(userProfile?.role || '')) return;
    await togglePinPost(id, pinned);
    if (post) {
      setPost({ ...post, pinned });
    }
    onPostUpdated?.();
  };

  // Handle post edit
  const handlePostEdit = (postToEdit: PostWithAuthor) => {
    setShowEditModal(true);
  };

  // Handle post save
  const handlePostSave = async (postId: string, input: UpdatePostInput) => {
    setIsEditingPost(true);
    try {
      await updatePost(postId, input);
      // Refetch the post to get updated data
      const updatedPost = await getPostById(postId, userProfile?.id);
      setPost(updatedPost);
      setShowEditModal(false);
      onPostUpdated?.();
    } finally {
      setIsEditingPost(false);
    }
  };

  // Handle comment edit
  const handleCommentEdit = async (commentId: string, input: UpdateCommentInput) => {
    await updateComment(commentId, input);
    const updatedComments = await getCommentsByPostId(postId, userProfile?.id);
    setComments(updatedComments);
  };

  // Handle comment create — OPTIMISTA (friction #1 del audit).
  // El comentario aparece al instante y el form se libera de inmediato; el
  // INSERT corre en fondo. En error: se quita el optimista, se restaura el
  // draft en localStorage (misma key que usa CommentForm) y se avisa.
  const handleCreateComment = async (input: CreateCommentInput) => {
    if (!userProfile) return;

    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();
    const optimistic = {
      id: tempId,
      post_id: postId,
      lesson_id: null,
      author_id: userProfile.id,
      content: input.content,
      parent_id: input.parent_id || null,
      media_urls: input.media_urls || [],
      video_embed_url: input.video_embed_url || null,
      created_at: nowIso,
      updated_at: nowIso,
      likes_count: 0,
      liked_by_me: false,
      audio_url: null,
      author: {
        id: userProfile.id,
        full_name: userProfile.full_name,
        avatar_url: userProfile.avatar_url,
        role: userProfile.role,
      },
      agent: null,
      replies: [],
    } as unknown as CommentWithReplies;

    setComments((prev) => {
      if (optimistic.parent_id) {
        return prev.map((c) =>
          c.id === optimistic.parent_id
            ? { ...c, replies: [...(c.replies || []), optimistic] }
            : c
        );
      }
      return [...prev, optimistic];
    });
    setReplyTarget(null);

    createComment(userProfile.id, input)
      .then((data) => {
        // Reemplazar el temp id por el real (el refetch de realtime luego
        // reconcilia el estado completo de todos modos)
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === tempId) return { ...c, id: data.id, created_at: data.created_at };
            if (c.replies?.some((r) => r.id === tempId)) {
              return {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === tempId ? { ...r, id: data.id, created_at: data.created_at } : r
                ),
              };
            }
            return c;
          })
        );
        onPostUpdated?.();
      })
      .catch((err) => {
        console.error('Error creating comment:', err);
        // Quitar el optimista del árbol
        setComments((prev) =>
          prev
            .filter((c) => c.id !== tempId)
            .map((c) =>
              c.replies?.some((r) => r.id === tempId)
                ? { ...c, replies: c.replies.filter((r) => r.id !== tempId) }
                : c
            )
        );
        // Restaurar el draft para que el texto no se pierda (misma key de CommentForm)
        try {
          window.localStorage.setItem(
            `comment-draft:post:${postId}:${input.parent_id || 'root'}`,
            input.content
          );
        } catch { /* storage lleno/privado: el toast sigue avisando */ }
        showError('No se pudo publicar el comentario. Tu texto quedó guardado como borrador.');
      });
  };

  // Handle comment like
  const handleCommentLike = async (commentId: string): Promise<boolean> => {
    if (!userProfile) return false;
    const result = await toggleCommentLike(userProfile.id, commentId);
    return result.liked;
  };

  // Handle comment delete — optimista: desaparece al instante, borra en fondo
  const handleCommentDelete = async (commentId: string) => {
    const snapshot = comments;
    setComments((prev) =>
      prev
        .filter((c) => c.id !== commentId)
        .map((c) =>
          c.replies?.some((r) => r.id === commentId)
            ? { ...c, replies: c.replies.filter((r) => r.id !== commentId) }
            : c
        )
    );
    try {
      await deleteComment(commentId);
      onPostUpdated?.();
    } catch (err) {
      console.error('Error deleting comment:', err);
      setComments(snapshot);
      showError('No se pudo eliminar el comentario');
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle favorite toggle
  const handleToggleFavorite = async (postId: string) => {
    if (!userProfile?.id) return;
    try {
      const result = await toggleFavorite(userProfile.id, postId);
      setIsFavorited(result.favorited);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-hidden"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      {/* Modal Container - FLEX para sticky form */}
      <div
        ref={modalContainerRef}
        className={`relative w-full max-w-2xl mx-4 flex flex-col ${
          // Móvil: alto DEFINIDO (85dvh). Con solo max-height, el alto del modal
          // dependía del contenido medido por WebKit, y en iPhone se quedaba
          // con un tamaño viejo: se veía el título y el resto quedaba cortado.
          // Escritorio conserva el modal que crece con su contenido.
          Object.keys(keyboardStyle).length === 0 ? 'my-8 md:my-16 h-[85dvh] md:h-auto md:max-h-[85vh]' : ''
        }`}
        style={keyboardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - mobile friendly */}
        <button
          onClick={onClose}
          className="icon-btn absolute -top-2 -right-2 md:top-0 md:-right-10 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-surface/80 text-muted"
          aria-label="Cerrar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Modal Content — titanium panel con brand glow pinned/post */}
        <div className={`titanium-panel rounded-xl overflow-hidden flex flex-col flex-1 min-h-0 !border-border ${
          (post?.pinned ?? initialPinned) ? 'es-tuyo-filo' : ''
        }`}>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          ) : error || !post ? (
            <div className="p-8 text-center">
              <p className="text-error">{error || 'Post no encontrado'}</p>
            </div>
          ) : (
            <>
              {/* Scrollable Content Area */}
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
                {/* Post Content */}
                <PostCardContent
                  post={post}
                  onLike={handlePostLike}
                  onDelete={handlePostDelete}
                  onEdit={handlePostEdit}
                  onTogglePin={handleTogglePin}
                  commentsCount={totalComments}
                  isFavorite={isFavorited}
                  onToggleFavorite={handleToggleFavorite}
                />

                {/* Comments Section */}
                <div className="border-t border-border bg-surface/30">
                  {/* Comments List */}
                  {comments.length > 0 && (
                    <div className="px-5 md:px-6 py-4 space-y-3">
                      {comments.map((comment, index) => (
                        <div
                          key={comment.id}
                          ref={index === comments.length - 1 ? lastCommentRef : null}
                        >
                          <CommentThread
                            comment={comment}
                            postId={postId}
                            userId={userProfile?.id}
                            onLike={handleCommentLike}
                            onDelete={handleCommentDelete}
                            onEdit={handleCommentEdit}
                            onReplyTo={handleReplyTo}
                            categoryId={post?.category_id || null}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Jump to Latest Comment Button - Floating */}
              {showJumpButton && comments.length > 0 && (
                <button
                  onClick={handleJumpToLatestComment}
                  className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-full shadow-lg hover:bg-surface transition-all text-sm font-medium text-foreground z-10"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  Jump to latest comment
                </button>
              )}

              {/* Sticky Comment Form - FUERA del scroll */}
              {userProfile && (
                <div ref={formRef} className="border-t border-border bg-surface-elevated/50 flex-shrink-0">
                  <CommentForm
                    postId={postId}
                    parentId={replyTarget?.commentId || null}
                    userId={userProfile.id}
                    onSubmit={handleCreateComment}
                    isSubmitting={false}
                    categoryId={post?.category_id || null}
                    initialMention={replyTarget?.isReplyToReply ? {
                      userId: replyTarget.userId,
                      userName: replyTarget.userName,
                    } : null}
                    replyingTo={replyTarget ? { userName: replyTarget.userName } : null}
                    onCancelReply={handleCancelReply}
                    isPinned={post?.pinned ?? initialPinned}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Post Edit Modal */}
      {showEditModal && post && (
        <PostEditModal
          post={post}
          onSave={handlePostSave}
          onCancel={() => setShowEditModal(false)}
          isSubmitting={isEditingPost}
        />
      )}
    </div>
  );
}
