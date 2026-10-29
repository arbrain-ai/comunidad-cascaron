'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePosts } from '@/features/community/hooks/usePosts';
import { useCategories } from '@/features/community/hooks/useCategories';
import { PostCard } from '@/features/community/components/PostCard';
import { EmailBroadcastToast } from '@/features/community/components/EmailBroadcastToast';
import { PostCardSkeleton } from '@/features/community/components/PostCardSkeleton';
import { PinnedPostsList } from '@/features/community/components/PinnedPostsList';
import { usePullToRefresh } from '@/shared/hooks/usePullToRefresh';

// Lazy (Goal 2): PostForm arrastra TipTap completo (ProseMirror + 6 extensiones)
// y los modales arrastran editores — quien solo LEE el feed no debe pagar ese
// bundle. Se cargan al hidratar el composer / abrir un post.
const PostForm = dynamic(
  () => import('@/features/community/components/PostForm').then((m) => m.PostForm),
  { ssr: false, loading: () => <div className="solid-card rounded-xl h-[72px] animate-pulse" /> }
);
const PostDetailModal = dynamic(
  () => import('@/features/community/components/PostDetailModal').then((m) => m.PostDetailModal),
  { ssr: false }
);
const PostEditModal = dynamic(
  () => import('@/features/community/components/PostEditModal').then((m) => m.PostEditModal),
  { ssr: false }
);
import { CategoryFilter, PostSortOption } from '@/features/community/components/CategoryFilter';
import { TimeRange } from '@/features/community/services/communityService';
import { CommunitySidebar } from '@/features/community/components/CommunitySidebar';
import { UpcomingEventBanner } from '@/features/calendar/components/UpcomingEventBanner';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { hasAdminAccess } from '@/shared/constants/roles';
import { CreatePostInput, UpdatePostInput, PostWithAuthor } from '@/features/community/types';
import { UserTier } from '@/features/admin/types';
import { toggleFavorite, getUserFavorites } from '@/features/community/services/favoritesService';

// Check if there's a pending draft to auto-open the form
function hasPendingDraft(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem('app:post-draft');
    if (!stored) return false;
    const draft = JSON.parse(stored);
    // Check if draft has actual content and isn't expired (24h)
    const hasContent = !!(draft.title?.trim() || draft.content?.trim() || draft.videoUrl || draft.gifUrl || draft.attachments?.length > 0 || draft.poll);
    const isExpired = (Date.now() - draft.savedAt) / (1000 * 60 * 60) > 24;
    return hasContent && !isExpired;
  } catch {
    return false;
  }
}

// Loading fallback for Suspense
function CommunityLoadingFallback() {
  return (
    <div className="sf-page-grid">
      <div className="sf-page-main space-y-4">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function CommunityPage() {
  return (
    <Suspense fallback={<CommunityLoadingFallback />}>
      <CommunityContent />
    </Suspense>
  );
}

// Main content component
function CommunityContent() {
  const { userProfile } = useUserProfile();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<PostSortOption>('default');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  // Auto-open form if there's a pending draft or ?create=true param
  const createParam = searchParams.get('create');
  const categoryParam = searchParams.get('category');
  // El cierre de una lección manda aquí con el post ya armado
  const tituloParam = searchParams.get('titulo');
  const cuerpoParam = searchParams.get('cuerpo');
  const [showCreatePost, setShowCreatePost] = useState(() => createParam === 'true' || hasPendingDraft());
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  // Post cuyo envío por email estamos siguiendo (null = ninguno en vuelo)
  const [broadcastPostId, setBroadcastPostId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Next conserva esta página al cambiar solo el query string: un enlace con
  // ?create=true también debe abrir el formulario si ya estabas en el feed.
  useEffect(() => {
    if (createParam === 'true') setShowCreatePost(true);
  }, [createParam, categoryParam]);
  const closeComposer = () => {
    setShowCreatePost(false);
    if (createParam === 'true') {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of ['create','category','titulo','cuerpo']) params.delete(key);
      router.replace(`/community${params.size ? `?${params}` : ''}`, { scroll: false });
    }
  };

  // Favorites state
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [userFavorites, setUserFavorites] = useState<Set<string>>(new Set());
  const [isFavoritesLoading, setIsFavoritesLoading] = useState(false);

  // Load user favorites on mount
  useEffect(() => {
    const loadFavorites = async () => {
      if (!userProfile?.id) return;
      setIsFavoritesLoading(true);
      try {
        const favoriteIds = await getUserFavorites(userProfile.id);
        setUserFavorites(new Set(favoriteIds));
      } catch (error) {
        console.error('Error loading favorites:', error);
      } finally {
        setIsFavoritesLoading(false);
      }
    };
    loadFavorites();
  }, [userProfile?.id]);

  // Handle ?post=<id> query param for deep linking (e.g., from notifications)
  useEffect(() => {
    const postId = searchParams.get('post');
    if (postId && postId !== selectedPostId) {
      setSelectedPostId(postId);
    }
  }, [searchParams, selectedPostId]);

  // Clear URL param when modal closes
  const handleClosePostModal = useCallback(() => {
    setSelectedPostId(null);
    // Remove ?post param from URL without full navigation
    const currentParams = new URLSearchParams(searchParams.toString());
    if (currentParams.has('post')) {
      currentParams.delete('post');
      const newUrl = currentParams.toString()
        ? `/community?${currentParams.toString()}`
        : '/community';
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, router]);

  // Roles
  const isAdmin = hasAdminAccess(userProfile?.role || '');

  const { categories } = useCategories();
  const {
    posts,
    isLoading: postsLoading,
    error: postsError,
    pagination,
    newPostsCount,
    showNewPosts,
    createPost,
    updatePost,
    deletePost,
    togglePin,
    reorderPinned,
    moveToCategory,
    toggleLike,
    refetch,
    goToPage,
    nextPage,
    prevPage,
  } = usePosts(selectedCategoryId || undefined, sortBy, showFavoritesOnly, timeRange);

  // Refetch silencioso: refresca data SIN volar el feed a skeletons (para
  // callbacks del modal de detalle, pull-to-refresh y banner de posts nuevos)
  const refetchSilent = useCallback(async () => {
    await refetch(undefined, { silent: true });
  }, [refetch]);

  // Pull-to-refresh (móvil): jalar hacia abajo en el tope del feed → refetch
  const { isRefreshing, isPulling } = usePullToRefresh(refetchSilent);

  // Banner "posts nuevos" → traerlos y subir al tope
  const handleShowNewPosts = useCallback(async () => {
    await showNewPosts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [showNewPosts]);

  // Paginación con scroll-to-top (antes cambiaba la página y te dejaba
  // clavado al fondo mirando los controles — hallazgo #7 del audit)
  const scrollTopSmooth = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  const handleGoToPage = useCallback((page: number) => {
    goToPage(page);
    scrollTopSmooth();
  }, [goToPage, scrollTopSmooth]);
  const handleNextPage = useCallback(() => {
    nextPage();
    scrollTopSmooth();
  }, [nextPage, scrollTopSmooth]);
  const handlePrevPage = useCallback(() => {
    prevPage();
    scrollTopSmooth();
  }, [prevPage, scrollTopSmooth]);

  // Post editing state
  const [editingPost, setEditingPost] = useState<PostWithAuthor | null>(null);
  const [isEditingPost, setIsEditingPost] = useState(false);

  // Handle post edit
  const handleEditPost = useCallback((post: PostWithAuthor) => {
    setEditingPost(post);
  }, []);

  // Handle post save — updatePost (hook) ya refetchea silencioso; el segundo
  // refetch completo que vivía aquí era redundante (hallazgo #3 del audit)
  const handleSavePost = useCallback(async (postId: string, input: UpdatePostInput) => {
    setIsEditingPost(true);
    try {
      await updatePost(postId, input);
      setEditingPost(null);
    } finally {
      setIsEditingPost(false);
    }
  }, [updatePost]);

  // Separate pinned and unpinned posts, always sorted by pin_order
  const pinnedPosts = useMemo(() =>
    posts.filter(post => post.pinned).sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0)),
    [posts]
  );
  const unpinnedPosts = useMemo(() =>
    posts.filter(post => !post.pinned),
    [posts]
  );

  // ClientLayoutWrapper ya maneja auth redirects

  const handleCreatePost = async (input: CreatePostInput) => {
    setIsCreatingPost(true);
    try {
      console.log('📝 [handleCreatePost] Creating post with input:', input);
      // createPost (hook) ya hace el ÚNICO fetch (página 1, silencioso).
      // Antes aquí se encadenaba un refetch redundante del feed completo:
      // doble spinner de 1.5-3s en el momento más importante (hallazgo #3).
      const nuevoPost = await createPost(input);
      closeComposer();

      // Si el anuncio pidió email, seguir la entrega hasta tener acuse.
      // Publicar a ciegas fue lo que dejó pasar 16 días de correos perdidos.
      if (input.send_email_notification && nuevoPost?.id) {
        setBroadcastPostId(nuevoPost.id);
      }
    } catch (error) {
      // Better error serialization for Supabase PostgrestError
      const errorDetails = error && typeof error === 'object'
        ? {
            message: (error as Record<string, unknown>).message,
            code: (error as Record<string, unknown>).code,
            details: (error as Record<string, unknown>).details,
            hint: (error as Record<string, unknown>).hint,
            name: (error as Record<string, unknown>).name,
          }
        : error;
      console.error('❌ [handleCreatePost] Error:', errorDetails);
      const errorMessage = (error as Record<string, unknown>)?.message || (error instanceof Error ? error.message : 'Error desconocido');
      alert(`Error al crear el post: ${errorMessage}`);
      throw error;
    } finally {
      setIsCreatingPost(false);
    }
  };

  const handleTogglePin = async (postId: string, pinned: boolean) => {
    if (!hasAdminAccess(userProfile?.role || '')) {
      alert('Solo los administradores pueden fijar posts');
      return;
    }
    await togglePin(postId, pinned);
  };


  const handleToggleFavorite = async (postId: string) => {
    if (!userProfile?.id) return;
    try {
      const result = await toggleFavorite(userProfile.id, postId);
      if (result.favorited) {
        setUserFavorites(prev => new Set([...prev, postId]));
      } else {
        setUserFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
      }
      // Refetch posts to update the list when in favorites view (silencioso:
      // el post desaparece de la vista sin volar el feed a skeletons)
      if (showFavoritesOnly) {
        await refetchSilent();
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Clear favorites filter when selecting a category or "Todas"
  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    // Always clear favorites filter when selecting any category or "Todas"
    if (showFavoritesOnly) {
      setShowFavoritesOnly(false);
    }
  };

  return (
    <div className="sf-page-grid">
      {/* Pull-to-refresh indicator (móvil) */}
      {(isPulling || isRefreshing) && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-full shadow-lg text-sm text-foreground">
          <svg className={`w-4 h-4 text-primary ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {isRefreshing ? 'Actualizando…' : 'Suelta para actualizar'}
        </div>
      )}

      {/* Banner "posts nuevos" — feed vivo via realtime INSERT */}
      {newPostsCount > 0 && (
        <button
          onClick={handleShowNewPosts}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 btn-primary rounded-full shadow-lg text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          {newPostsCount === 1 ? '1 post nuevo' : `${newPostsCount} posts nuevos`}
        </button>
      )}

      {/* Main Content - Posts */}
      <div className="sf-page-main space-y-4">
        {/* Create Post Button - INLINE (solo este, sin modal) */}
        {!showCreatePost && (
          <button
            onClick={() => setShowCreatePost(true)}
            className="card-interactive block w-full p-4 text-left flex items-center gap-4"
          >
            {/* User Avatar */}
            {userProfile?.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                alt={userProfile.full_name || 'User'}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold">
                  {userProfile?.full_name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            )}
            <span className="min-w-0 text-muted hover:text-foreground">
              ¿Qué quieres compartir con la comunidad?
            </span>
          </button>
        )}

        {/* Create Post Form - INLINE (no modal) */}
        {showCreatePost && (
          <div className="space-y-3">
          <PostForm
            onSubmit={handleCreatePost}
            onCancel={closeComposer}
            isSubmitting={isCreatingPost}
            defaultCategorySlug={categoryParam || undefined}
            defaultTitle={tituloParam || undefined}
            defaultContent={cuerpoParam || undefined}
          />
          </div>
        )}

        {/* Upcoming Event Banner - Skool style */}
        <UpcomingEventBanner
          userTier={(userProfile?.tier as 'standard' | 'vip') || null}
        />

        {/* Category Filter + Sort */}
        <CategoryFilter
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleCategorySelect}
          userTier={(userProfile?.tier as UserTier) || null}
          sortBy={sortBy}
          onSortChange={setSortBy}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
        />

        {/* Loading State — skeletons con la silueta real de las cards
            (el spinner único borraba todo el feed, hallazgo #8) */}
        {postsLoading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error State — separated from empty so we don't mask real failures */}
        {!postsLoading && postsError && (
          <div className="solid-card p-12 text-center space-y-4">
            <p className="text-muted">
              Hubo un problema cargando los posts. Intenta de nuevo.
            </p>
            <button
              onClick={() => refetch()}
              className="btn-secondary"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Empty State — only when we genuinely have zero posts (no error) */}
        {!postsLoading && !postsError && posts.length === 0 && (
          <div className="solid-card p-12 text-center">
            <p className="text-muted">
              {selectedCategoryId
                ? 'No hay posts en esta categoría aún'
                : 'No hay posts aún. ¡Sé el primero en publicar!'}
            </p>
          </div>
        )}

        {!postsLoading && !postsError && posts.length > 0 && (
          <PinnedPostsList
            pinnedPosts={pinnedPosts}
            unpinnedPosts={unpinnedPosts}
            onLike={toggleLike}
            onDelete={deletePost}
            onEdit={handleEditPost}
            onTogglePin={handleTogglePin}
            onMoveToCategory={moveToCategory}
            categories={categories}
            onOpenModal={setSelectedPostId}
            onReorderPinned={reorderPinned}
            isAdmin={isAdmin}
            userFavorites={userFavorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {/* Pagination Controls - Skool style */}
        {!postsLoading && pagination.totalPages > 1 && (
          <div className="flex flex-col items-center gap-2 py-6">
            {/* Navigation row */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Previous */}
              <button
                onClick={handlePrevPage}
                disabled={!pagination.hasPrevPage}
                className="btn-ghost disabled:opacity-30 disabled:pointer-events-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Previous</span>
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                  // Show pages around current page
                  let pageNum: number;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.currentPage >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handleGoToPage(pageNum)}
                      className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium transition-all duration-fast ${
                        pageNum === pagination.currentPage
                          ? 'bg-primary text-white shadow-elevation-xs'
                          : 'text-foreground hover:bg-card-hover hover:shadow-sm'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                {/* Ellipsis and last page */}
                {pagination.totalPages > 5 && pagination.currentPage < pagination.totalPages - 2 && (
                  <>
                    <span className="px-1 sm:px-2 text-muted">...</span>
                    <button
                      onClick={() => handleGoToPage(pagination.totalPages)}
                      className="w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium text-foreground hover:bg-card-hover hover:shadow-sm transition-all duration-fast"
                    >
                      {pagination.totalPages}
                    </button>
                  </>
                )}
              </div>

              {/* Next */}
              <button
                onClick={handleNextPage}
                disabled={!pagination.hasNextPage}
                className="btn-ghost disabled:opacity-30 disabled:pointer-events-none"
              >
                <span className="hidden sm:inline">Next</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Total count - separate line */}
            <span className="text-xs text-muted">
              {((pagination.currentPage - 1) * 30) + 1}-{Math.min(pagination.currentPage * 30, pagination.totalCount)} of {pagination.totalCount.toLocaleString()}
            </span>
          </div>
        )}

        {/* Post Detail Modal */}
        {selectedPostId && (
          <PostDetailModal
            postId={selectedPostId}
            initialPinned={pinnedPosts.some(p => p.id === selectedPostId)}
            onClose={handleClosePostModal}
            onPostDeleted={() => {
              handleClosePostModal();
              refetchSilent();
            }}
            onPostUpdated={refetchSilent}
          />
        )}

        {/* Post Edit Modal */}
        {editingPost && (
          <PostEditModal
            post={editingPost}
            onSave={handleSavePost}
            onCancel={() => setEditingPost(null)}
            isSubmitting={isEditingPost}
          />
        )}
      </div>

      {/* Sidebar */}
      <CommunitySidebar />

      {/* Mobile FAB - Create Post */}
      {!showCreatePost && (
        <button
          onClick={() => {
            setShowCreatePost(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="sf-fab md:hidden"
          aria-label="Crear post"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Acuse de entrega del correo del anuncio (solo cuando se pidió email) */}
      {broadcastPostId && (
        <EmailBroadcastToast
          postId={broadcastPostId}
          onClose={() => setBroadcastPostId(null)}
        />
      )}
    </div>
  );
}
