import { useState, useEffect, useCallback, useRef } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { supabase } from '@/shared/lib/supabase';
import {
  getPosts,
  createPost,
  updatePost,
  deletePost,
  togglePinPost,
  reorderPinnedPosts,
  movePostToCategory,
  togglePostLike,
  hasUserLikedPost,
  POSTS_PER_PAGE,
  PaginatedPosts,
  PostSortOption,
  TimeRange,
} from '../services/communityService';
import { PostWithAuthor, CreatePostInput, UpdatePostInput } from '../types';
import { getCached, setCached } from '@/shared/lib/queryCache';

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface FetchOptions {
  /**
   * silent: refresca la data SIN volar el feed a estado loading. Es el modo
   * para refetches de fondo (post creado/editado, comentario nuevo via
   * realtime, pull-to-refresh, banner de posts nuevos). El modo full
   * (skeletons) queda solo para carga inicial, cambio de filtros y paginación.
   */
  silent?: boolean;
}

export function usePosts(categoryId?: string, sortBy: PostSortOption = 'default', favoritesOnly: boolean = false, timeRange: TimeRange = 'all') {
  const { userProfile, isLoading: isAuthLoading } = useUserProfile();

  // Caché de módulo (paint-first): al volver al feed se pinta el último
  // snapshot AL INSTANTE (cero skeleton) y SIEMPRE se revalida en silencio
  // detrás — el feed cambia seguido, la frescura se autocura en un fetch de
  // fondo sin que el usuario vea parpadeos.
  const userId = userProfile?.id;
  const cacheKeyFor = useCallback(
    (page: number) =>
      `posts:${categoryId || 'all'}:${sortBy}:${favoritesOnly}:${timeRange}:u${userId || 'anon'}:p${page}`,
    [categoryId, sortBy, favoritesOnly, timeRange, userId]
  );
  const initialCache = getCached<PaginatedPosts>(
    `posts:${categoryId || 'all'}:${sortBy}:${favoritesOnly}:${timeRange}:u${userProfile?.id || 'anon'}:p1`
  );

  const [posts, setPosts] = useState<PostWithAuthor[]>(initialCache?.data.posts ?? []);
  // Start loading=true and stay loading until auth hydrates AND the first fetch resolves.
  // Without this, RLS on posts can silently return [] before the session is ready,
  // causing "empty feed on reload" that fixes itself with a second refresh.
  const [isLoading, setIsLoading] = useState(!initialCache);
  const [error, setError] = useState<string | null>(null);
  // Posts nuevos de OTROS detectados por realtime mientras el usuario mira el feed
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [pagination, setPagination] = useState<PaginationState>(
    initialCache
      ? {
          currentPage: initialCache.data.currentPage,
          totalPages: initialCache.data.totalPages,
          totalCount: initialCache.data.totalCount,
          hasNextPage: initialCache.data.hasNextPage,
          hasPrevPage: initialCache.data.hasPrevPage,
        }
      : {
          currentPage: 1,
          totalPages: 1,
          totalCount: 0,
          hasNextPage: false,
          hasPrevPage: false,
        }
  );
  const postIdsRef = useRef<Set<string>>(new Set(initialCache?.data.posts.map((p) => p.id) ?? []));
  const currentPageRef = useRef(1);
  // IDs visibles (ordenados, unidos) — clave para re-suscribir realtime con filtro server-side
  const [visibleIdsKey, setVisibleIdsKey] = useState(
    initialCache ? initialCache.data.posts.map((p) => p.id).sort().join(',') : ''
  );

  const fetchPosts = useCallback(async (page: number = currentPageRef.current, options?: FetchOptions) => {
    try {
      if (!options?.silent) setIsLoading(true);
      setError(null);
      const result: PaginatedPosts = await getPosts(
        categoryId,
        userProfile?.tier,
        page,
        undefined,  // pageSize - use default
        userProfile?.id,  // userId - for correct liked_by_me
        sortBy,  // sort option
        favoritesOnly,  // filter by favorites
        timeRange  // time range filter
      );
      // Write-through al caché de módulo: el próximo mount pinta esto al instante
      setCached(cacheKeyFor(result.currentPage), result);
      setPosts(result.posts);
      setPagination({
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
      currentPageRef.current = result.currentPage;
      // Track current post IDs for realtime filtering
      postIdsRef.current = new Set(result.posts.map(p => p.id));
      // Server-side realtime filter (Goal 2): el canal se re-suscribe con los
      // IDs de la página visible — Supabase deja de mandarnos eventos de TODA
      // la comunidad a cada tab abierto
      setVisibleIdsKey(result.posts.map(p => p.id).sort().join(','));
    } catch (err) {
      console.error('Error fetching posts:', err);
      // En refetch silencioso no destruimos el feed visible por un error de fondo
      if (!options?.silent) setError('Error al cargar los posts');
    } finally {
      if (!options?.silent) setIsLoading(false);
    }
  }, [categoryId, userProfile?.tier, userProfile?.id, sortBy, favoritesOnly, timeRange, cacheKeyFor]);

  // Reset to page 1 when category, sort, favoritesOnly, or timeRange changes.
  // CRITICAL: wait for auth to finish loading. If we fetch while the Supabase
  // browser client has no hydrated session, RLS returns [] silently and the
  // UI falls through to the empty state (the "blank feed on reload" bug).
  useEffect(() => {
    if (isAuthLoading) return;
    currentPageRef.current = 1;
    setNewPostsCount(0);
    // Paint-first: si hay snapshot cacheado de esta vista, píntalo YA y
    // revalida en silencio; el skeleton queda solo para vistas nunca vistas.
    const entry = getCached<PaginatedPosts>(cacheKeyFor(1));
    if (entry) {
      setPosts(entry.data.posts);
      setPagination({
        currentPage: entry.data.currentPage,
        totalPages: entry.data.totalPages,
        totalCount: entry.data.totalCount,
        hasNextPage: entry.data.hasNextPage,
        hasPrevPage: entry.data.hasPrevPage,
      });
      postIdsRef.current = new Set(entry.data.posts.map((p) => p.id));
      setVisibleIdsKey(entry.data.posts.map((p) => p.id).sort().join(','));
      setIsLoading(false);
      fetchPosts(1, { silent: true });
    } else {
      fetchPosts(1);
    }
  }, [categoryId, userProfile?.tier, userProfile?.id, sortBy, favoritesOnly, timeRange, isAuthLoading, cacheKeyFor, fetchPosts]);

  // Realtime subscription for post updates (triggered when comments_count changes via DB trigger)
  // OPTIMIZED: Debounced refetch to prevent thundering herd with 300+ concurrent users
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Sin posts visibles no hay nada que escuchar (evita canal sin filtro)
    if (!visibleIdsKey) return;

    // FILTRO SERVER-SIDE (Goal 2): antes el canal recibía UPDATE de TODOS los
    // posts e INSERT de TODOS los comments de la plataforma y descartaba en
    // cliente — fan-out de red/batería que escala con la actividad total de la
    // comunidad. Ahora Supabase filtra por los IDs de la página visible; el
    // check de postIdsRef abajo queda como cinturón.
    const idsFilter = `id=in.(${visibleIdsKey})`;
    const postIdFilter = `post_id=in.(${visibleIdsKey})`;

    const channel = supabase
      .channel('community-posts-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
          filter: idsFilter,
        },
        (payload) => {
          const updatedPost = payload.new as { id: string; comments_count: number; likes_count: number };
          // Only update if it's a post we're displaying
          if (postIdsRef.current.has(updatedPost.id)) {
            // Update the specific post in state to avoid full refetch
            setPosts((prev) =>
              prev.map((post) =>
                post.id === updatedPost.id
                  ? { ...post, comments_count: updatedPost.comments_count, likes_count: updatedPost.likes_count }
                  : post
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: postIdFilter,
        },
        (payload) => {
          // Debounce: batch multiple comment inserts into a single refetch
          // Prevents 300 simultaneous refetches when many users comment at once
          const newComment = payload.new as { post_id: string };
          if (postIdsRef.current.has(newComment.post_id)) {
            if (refetchTimerRef.current) {
              clearTimeout(refetchTimerRef.current);
            }
            refetchTimerRef.current = setTimeout(() => {
              // silent: antes este refetch ponía isLoading=true y el feed
              // ENTERO se reemplazaba por un spinner cada vez que alguien
              // comentaba (friction #1 del audit). Ahora refresca en fondo.
              fetchPosts(undefined, { silent: true });
            }, 2000); // 2s debounce - batches rapid comment activity
          }
        }
      )
      .subscribe();

    return () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [fetchPosts, visibleIdsKey]);

  // FEED VIVO (Goal 3): INSERT de posts nuevos → contador para el banner
  // "N posts nuevos". No refetcheamos automático (sería thundering herd con
  // cada post); el usuario decide cuándo traerlos (tap banner o pull-to-refresh).
  useEffect(() => {
    if (isAuthLoading || !userProfile?.id) return;

    const channel = supabase
      .channel('community-posts-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          const p = payload.new as { id: string; author_id: string; is_draft?: boolean; category_id?: string };
          if (p.is_draft) return;
          // Los propios ya aparecen via el fetch del flujo de publicar
          if (p.author_id === userProfile.id) return;
          // Respetar el filtro de categoría activo
          if (categoryId && p.category_id !== categoryId) return;
          setNewPostsCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthLoading, userProfile?.id, categoryId]);

  // Trae los posts nuevos anunciados por el banner (refetch silencioso a página 1)
  const showNewPosts = useCallback(async () => {
    setNewPostsCount(0);
    currentPageRef.current = 1;
    await fetchPosts(1, { silent: true });
  }, [fetchPosts]);

  // Pagination controls
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      currentPageRef.current = page;
      fetchPosts(page);
    }
  }, [pagination.totalPages, fetchPosts]);

  const nextPage = useCallback(() => {
    if (pagination.hasNextPage) {
      goToPage(pagination.currentPage + 1);
    }
  }, [pagination.hasNextPage, pagination.currentPage, goToPage]);

  const prevPage = useCallback(() => {
    if (pagination.hasPrevPage) {
      goToPage(pagination.currentPage - 1);
    }
  }, [pagination.hasPrevPage, pagination.currentPage, goToPage]);

  const createNewPost = async (input: CreatePostInput) => {
    if (!userProfile) throw new Error('Usuario no autenticado');

    const newPost = await createPost(userProfile.id, input);
    // Go to page 1 to see the new post. Silent: el feed no parpadea a spinner,
    // el post nuevo simplemente aparece arriba. ÚNICO fetch del flujo de
    // publicar (antes la página encadenaba un segundo refetch completo).
    currentPageRef.current = 1;
    await fetchPosts(1, { silent: true });
    return newPost;
  };

  const updateExistingPost = async (postId: string, input: UpdatePostInput) => {
    await updatePost(postId, input);
    await fetchPosts(undefined, { silent: true });
  };

  const deleteExistingPost = async (postId: string) => {
    await deletePost(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const togglePin = async (postId: string, pinned: boolean) => {
    await togglePinPost(postId, pinned);
    await fetchPosts(undefined, { silent: true });
  };

  const reorderPinned = async (orderedPostIds: string[]) => {
    // Optimistic update: reorder locally AND update pin_order values immediately
    setPosts((prev) => {
      const pinnedPosts = prev.filter(p => p.pinned);
      const unpinnedPosts = prev.filter(p => !p.pinned);

      // Reorder pinned posts and update their pin_order to reflect new position
      const reorderedPinned: PostWithAuthor[] = [];
      for (let index = 0; index < orderedPostIds.length; index++) {
        const post = pinnedPosts.find(p => p.id === orderedPostIds[index]);
        if (post) reorderedPinned.push({ ...post, pin_order: index + 1 });
      }

      return [...reorderedPinned, ...unpinnedPosts];
    });

    // Persist to database
    await reorderPinnedPosts(orderedPostIds);
  };

  const toggleLike = async (postId: string) => {
    if (!userProfile) throw new Error('Usuario no autenticado');

    // RPC atómico (1 round-trip). La UI optimista vive en PostCard; aquí solo
    // reconciliamos el estado compartido del feed con la verdad del servidor.
    const result = await togglePostLike(userProfile.id, postId);

    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              likes_count: result.liked
                ? (post.likes_count || 0) + 1
                : Math.max((post.likes_count || 0) - 1, 0),
            }
          : post
      )
    );

    return result.liked;
  };

  const checkIfLiked = async (postId: string) => {
    if (!userProfile) return false;
    return await hasUserLikedPost(userProfile.id, postId);
  };

  const moveToCategory = async (postId: string, categoryId: string) => {
    await movePostToCategory(postId, categoryId);
    await fetchPosts(undefined, { silent: true });
  };

  return {
    posts,
    isLoading,
    error,
    pagination,
    newPostsCount,
    showNewPosts,
    refetch: fetchPosts,
    goToPage,
    nextPage,
    prevPage,
    createPost: createNewPost,
    updatePost: updateExistingPost,
    deletePost: deleteExistingPost,
    togglePin,
    reorderPinned,
    moveToCategory,
    toggleLike,
    checkIfLiked,
  };
}
