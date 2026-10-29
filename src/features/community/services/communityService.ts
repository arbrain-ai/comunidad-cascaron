import { supabase } from '@/shared/lib/supabase';
import {
  PostWithAuthor,
  CommentWithAuthor,
  CommentWithReplies,
  CommentActivity,
  RecentCommenter,
  CreatePostInput,
  UpdatePostInput,
  CreateCommentInput,
  UpdateCommentInput,
  Category,
  CreatePollInput,
  PollWithOptionsAndVotes,
  PollOptionWithVoteStatus,
  VoterProfile,
  MentionableUser,
  Notification,
  PostAttachment,
} from '../types';

// ===== HELPERS =====

/**
 * Transform media_urls (which can be strings or full attachment objects) into PostAttachment[]
 * Handles backward compatibility with old posts that only have URL strings
 */
function transformMediaUrlsToAttachments(mediaUrls: unknown): PostAttachment[] {
  if (!mediaUrls || !Array.isArray(mediaUrls)) return [];

  return mediaUrls.map((item: unknown) => {
    // If it's already a full attachment object
    if (typeof item === 'object' && item !== null && 'url' in item && 'type' in item) {
      return item as PostAttachment;
    }

    // If it's just a URL string, infer type from extension or URL patterns
    if (typeof item === 'string') {
      const url = item;

      // Extract filename - handle Supabase Storage URLs which have format: .../bucket/folder/timestamp-filename.ext
      const urlPath = url.split('?')[0]; // Remove query params
      const pathParts = urlPath.split('/');
      const fullFileName = pathParts[pathParts.length - 1] || 'file';

      // Get extension from the full filename (handles timestamps like 1769520399971-Clawdbot.pdf)
      const extensionMatch = fullFileName.match(/\.([a-zA-Z0-9]+)$/);
      const extension = extensionMatch ? extensionMatch[1].toLowerCase() : '';

      // Clean up filename for display (remove timestamp prefix if present)
      let displayName = fullFileName;
      const timestampMatch = fullFileName.match(/^\d{13,}-(.+)$/);
      if (timestampMatch) {
        displayName = timestampMatch[1];
      }

      // Determine MIME type from extension
      let mimeType = 'application/octet-stream';
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
      const pdfExtensions = ['pdf'];
      const docExtensions = ['doc', 'docx', 'odt', 'rtf'];
      const spreadsheetExtensions = ['xls', 'xlsx', 'csv', 'ods'];
      const presentationExtensions = ['ppt', 'pptx', 'odp'];
      const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz'];

      if (imageExtensions.includes(extension)) {
        mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
      } else if (pdfExtensions.includes(extension)) {
        mimeType = 'application/pdf';
      } else if (docExtensions.includes(extension)) {
        mimeType = 'application/msword';
      } else if (spreadsheetExtensions.includes(extension)) {
        mimeType = 'application/vnd.ms-excel';
      } else if (presentationExtensions.includes(extension)) {
        mimeType = 'application/vnd.ms-powerpoint';
      } else if (archiveExtensions.includes(extension)) {
        mimeType = 'application/zip';
      }

      return {
        url,
        name: displayName,
        size: 0, // Unknown for legacy URLs
        type: mimeType,
      };
    }

    // Fallback
    return null;
  }).filter((item): item is PostAttachment => item !== null);
}

// ===== POSTS =====

/**
 * Fetch recent commenters and last comment timestamp for posts (Skool-style)
 */
async function getCommentActivityForPosts(postIds: string[]): Promise<Map<string, CommentActivity>> {
  if (postIds.length === 0) return new Map();

  // Get recent comments with author info (limit to recent activity)
  // OPTIMIZED: Reduced from 500 to 150 (30 posts × 5 commenters max per post)
  const { data: comments, error } = await supabase
    .from('comments')
    .select(`
      id, created_at, post_id, author_id,
      author:profiles!comments_author_id_fkey(id, full_name, avatar_url)
    `)
    .in('post_id', postIds)
    .order('created_at', { ascending: false })
    .limit(150);

  if (error) {
    console.error('Error fetching comment activity:', error);
    return new Map();
  }

  // Group by post_id and extract unique commenters
  const activityMap = new Map<string, CommentActivity>();

  // Process comments grouped by post
  const postComments = new Map<string, typeof comments>();
  for (const comment of comments || []) {
    const existing = postComments.get(comment.post_id) || [];
    existing.push(comment);
    postComments.set(comment.post_id, existing);
  }

  for (const [postId, postCommentList] of postComments) {
    // Get unique commenters (max 4)
    const seenIds = new Set<string>();
    const commenters: RecentCommenter[] = [];
    let lastCommentAt: string | null = null;

    for (const comment of postCommentList) {
      // Track last comment timestamp (first in desc order)
      if (!lastCommentAt) {
        lastCommentAt = comment.created_at;
      }

      // Get commenter info
      type AuthorInfo = { id: string; full_name: string; avatar_url: string | null } | null;
      const displayInfo = comment.author as unknown as AuthorInfo;
      const commenterId = comment.author_id;

      // Skip if already seen or no ID
      if (!commenterId || seenIds.has(commenterId)) continue;
      seenIds.add(commenterId);

      if (displayInfo && commenters.length < 4) {
        commenters.push({
          id: commenterId,
          avatar_url: displayInfo.avatar_url,
          full_name: displayInfo.full_name,
        });
      }
    }

    activityMap.set(postId, {
      recent_commenters: commenters,
      last_comment_at: lastCommentAt,
    });
  }

  return activityMap;
}

/**
 * Fetch polls for multiple posts (batch query for performance)
 */
async function getPollsForPosts(
  postIds: string[],
  userId?: string
): Promise<Map<string, PollWithOptionsAndVotes>> {
  if (postIds.length === 0) return new Map();

  // Get all polls with options for the given posts
  const { data: polls, error } = await supabase
    .from('polls')
    .select(`
      *,
      options:poll_options(*)
    `)
    .in('post_id', postIds);

  if (error) {
    console.error('Error fetching polls:', error);
    return new Map();
  }

  if (!polls || polls.length === 0) return new Map();

  // Get user's votes if userId provided
  let userVotesByPoll = new Map<string, Set<string>>();
  if (userId) {
    const allOptionIds = polls.flatMap(p =>
      (p.options as { id: string }[]).map(o => o.id)
    );

    if (allOptionIds.length > 0) {
      const { data: votes } = await supabase
        .from('poll_votes')
        .select('poll_option_id')
        .eq('user_id', userId)
        .in('poll_option_id', allOptionIds);

      // Group votes by poll
      for (const poll of polls) {
        const pollOptionIds = new Set((poll.options as { id: string }[]).map(o => o.id));
        const userVotesForPoll = new Set(
          (votes || [])
            .filter(v => pollOptionIds.has(v.poll_option_id))
            .map(v => v.poll_option_id)
        );
        userVotesByPoll.set(poll.id, userVotesForPoll);
      }
    }
  }

  // Fetch voter profiles (up to 3 per option)
  const allOptionIds = polls.flatMap(p =>
    (p.options as { id: string }[]).map(o => o.id)
  );
  const votersByOption = new Map<string, VoterProfile[]>();

  if (allOptionIds.length > 0) {
    const { data: voterRows } = await supabase
      .from('poll_votes')
      .select('poll_option_id, user:profiles!poll_votes_user_id_fkey(id, full_name, avatar_url)')
      .in('poll_option_id', allOptionIds)
      .order('created_at', { ascending: true });

    if (voterRows) {
      for (const row of voterRows) {
        const optId = row.poll_option_id;
        const existing = votersByOption.get(optId) || [];
        if (existing.length < 3 && row.user) {
          const user = row.user as unknown as VoterProfile;
          existing.push({ id: user.id, full_name: user.full_name, avatar_url: user.avatar_url });
          votersByOption.set(optId, existing);
        }
      }
    }
  }

  // Build the map
  const pollsMap = new Map<string, PollWithOptionsAndVotes>();

  for (const poll of polls) {
    const userVotes = userVotesByPoll.get(poll.id) || new Set();
    const options = poll.options as { id: string; poll_id: string; text: string; order_position: number; votes_count: number; created_at: string }[];

    const totalVotes = options.reduce((sum, opt) => sum + opt.votes_count, 0);

    const optionsWithStatus: PollOptionWithVoteStatus[] = options
      .sort((a, b) => a.order_position - b.order_position)
      .map(opt => ({
        ...opt,
        has_voted: userVotes.has(opt.id),
        voters: votersByOption.get(opt.id) || [],
      }));

    pollsMap.set(poll.post_id, {
      id: poll.id,
      post_id: poll.post_id,
      allow_multiple: poll.allow_multiple,
      created_at: poll.created_at,
      options: optionsWithStatus,
      total_votes: totalVotes,
      user_votes: Array.from(userVotes),
    });
  }

  return pollsMap;
}

/**
 * Pagination config
 */
export const POSTS_PER_PAGE = 30;

/**
 * Sort options for posts (Skool-style)
 */
export type PostSortOption = 'default' | 'new' | 'top' | 'unread' | 'most_commented' | 'most_saved';

export type TimeRange = 'all' | '3m' | '6m' | '1y';

function getTimeRangeDate(timeRange: TimeRange): string | null {
  if (timeRange === 'all') return null;
  const now = new Date();
  switch (timeRange) {
    case '3m': now.setMonth(now.getMonth() - 3); break;
    case '6m': now.setMonth(now.getMonth() - 6); break;
    case '1y': now.setFullYear(now.getFullYear() - 1); break;
  }
  return now.toISOString();
}

/**
 * Count total posts (for pagination)
 */
export async function getPostsCount(categoryId?: string, timeRange: TimeRange = 'all'): Promise<number> {
  let query = supabase
    .from('posts')
    .select('id', { count: 'exact', head: true });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const timeRangeDate = getTimeRangeDate(timeRange);
  if (timeRangeDate) {
    query = query.gte('created_at', timeRangeDate);
  }

  const { count, error } = await query;

  if (error) throw error;
  return count || 0;
}

/**
 * Pagination result type
 */
export interface PaginatedPosts {
  posts: PostWithAuthor[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Fetch posts with pagination (Skool-style: 30 per page)
 */
export async function getPosts(
  categoryId?: string,
  userTier?: string,
  page: number = 1,
  pageSize: number = POSTS_PER_PAGE,
  userId?: string,
  sortBy: PostSortOption = 'default',
  favoritesOnly?: boolean,
  timeRange: TimeRange = 'all'
): Promise<PaginatedPosts> {
  // El CONTEO sale disparado pero no se espera aquí: no lo necesita nadie para
  // armar la query de posts (el rango de paginación se calcula con page y
  // pageSize, nada más). Antes iba con await al frente y le costaba ~310ms EN
  // SERIE a cada carga del feed, solo para saber cuántas páginas pintar al
  // final. Se cobra abajo, cuando de verdad hace falta.
  const countPromise = getPostsCount(categoryId, timeRange).catch(() => 0);

  // Calculate range for pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // If favoritesOnly is true and userId is present, get favorited post IDs first
  let favoritedPostIds: string[] = [];
  if (favoritesOnly && userId) {
    const { data: favorites } = await supabase
      .from('post_favorites')
      .select('post_id')
      .eq('user_id', userId);
    favoritedPostIds = favorites?.map(f => f.post_id) || [];

    // If no favorites, return empty result early
    if (favoritedPostIds.length === 0) {
      await countPromise; // se consume para no dejar la promesa colgando
      return {
        posts: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
        hasNextPage: false,
        hasPrevPage: false,
      };
    }
  }

  let query = supabase
    .from('posts')
    .select(
      `
      *,
      author:profiles!posts_author_id_fkey(id, full_name, avatar_url, role),
      category:categories!posts_category_id_fkey(*)
    `
    );

  // Apply favorites filter if enabled
  if (favoritesOnly && favoritedPostIds.length > 0) {
    query = query.in('id', favoritedPostIds);
  }

  // For 'unread' filter, we need to exclude viewed posts
  let viewedPostIds: string[] = [];
  if (sortBy === 'unread' && userId) {
    const { data: views } = await supabase
      .from('post_views')
      .select('post_id')
      .eq('user_id', userId);
    viewedPostIds = views?.map(v => v.post_id) || [];
  }

  // Apply time range filter
  const timeRangeDate = getTimeRangeDate(timeRange);
  if (timeRangeDate) {
    query = query.gte('created_at', timeRangeDate);
  }

  // Apply sorting based on sortBy option
  // Pinned posts ALWAYS appear first (in pin_order), regardless of sort mode
  switch (sortBy) {
    case 'new':
      // Pinned first, then newest
      query = query.order('pinned', { ascending: false });
      query = query.order('pin_order', { ascending: true });
      query = query.order('created_at', { ascending: false });
      break;
    case 'top':
      // Pinned first, then most liked
      query = query.order('pinned', { ascending: false });
      query = query.order('pin_order', { ascending: true });
      query = query.order('likes_count', { ascending: false, nullsFirst: false });
      query = query.order('created_at', { ascending: false });
      break;
    case 'most_commented':
      // Pinned first, then most commented
      query = query.order('pinned', { ascending: false });
      query = query.order('pin_order', { ascending: true });
      query = query.order('comments_count', { ascending: false, nullsFirst: false });
      query = query.order('created_at', { ascending: false });
      break;
    case 'most_saved':
      // Pinned first, then most saved/bookmarked
      query = query.order('pinned', { ascending: false });
      query = query.order('pin_order', { ascending: true });
      query = query.order('favorites_count', { ascending: false, nullsFirst: false });
      query = query.order('created_at', { ascending: false });
      break;
    case 'unread':
      // Pinned first, then newest unread
      query = query.order('pinned', { ascending: false });
      query = query.order('pin_order', { ascending: true });
      query = query.order('created_at', { ascending: false });
      // Exclude viewed posts (if any)
      if (viewedPostIds.length > 0) {
        query = query.not('id', 'in', `(${viewedPostIds.join(',')})`);
      }
      break;
    case 'default':
    default:
      // "Recientes" = ultima actividad (posts con comentarios nuevos suben)
      // Pinned primero, luego por last_activity_at (bumped por trigger en comments)
      query = query.order('pinned', { ascending: false });
      query = query.order('pin_order', { ascending: true });
      query = query.order('last_activity_at', { ascending: false, nullsFirst: false });
      break;
  }

  query = query.range(from, to);

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;

  if (error) throw error;

  let posts = data as unknown as PostWithAuthor[];

  // Fetch first comments, comment activity, and likes in parallel
  const postIds = posts.map(p => p.id);

  if (postIds.length > 0) {
    // Likes, actividad de comentarios y encuestas dependen todas de los MISMOS
    // postIds y de nada más entre sí. Los likes iban con su propio await antes
    // del Promise.all, así que la página pagaba ~207ms extra en serie sin
    // ninguna razón. Ahora los tres viajan juntos.
    // IMPORTANT: los likes deben filtrarse por userId para marcar liked_by_me
    const [userLikesRes, commentActivity, pollsMap] = await Promise.all([
      userId
        ? supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', userId)  // Filter by current user
            .in('post_id', postIds)
            .is('comment_id', null)
        : Promise.resolve({ data: [] as { post_id: string }[] }),
      getCommentActivityForPosts(postIds),
      getPollsForPosts(postIds, userId),
    ]);

    const likedPostIds = new Set(
      (userLikesRes.data as { post_id: string }[] | null)?.map(l => l.post_id) || []
    );

    // Attach data to each post
    for (const post of posts) {
      post.comment_activity = commentActivity.get(post.id) || null;
      post.poll = pollsMap.get(post.id) || null;
      // @ts-ignore - added dynamically for performance
      post.liked_by_me = likedPostIds.has(post.id);
      // Transform media_urls to attachments with full metadata
      // @ts-ignore - attachments not in type but needed for PDFs/docs rendering
      post.attachments = transformMediaUrlsToAttachments(post.media_urls);
    }
  }

  // Aquí sí se cobra el conteo: para entonces ya viajó en paralelo con los
  // posts y con likes/comentarios/encuestas, así que normalmente ya llegó.
  const totalCount = await countPromise;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    posts,
    totalCount,
    totalPages,
    currentPage: page,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Fetch a single post by ID
 */
export async function getPostById(postId: string, userId?: string) {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      *,
      author:profiles!posts_author_id_fkey(id, full_name, avatar_url, role),
      category:categories!posts_category_id_fkey(*)
    `
    )
    .eq('id', postId)
    .single();

  if (error) throw error;

  const post = data as unknown as PostWithAuthor;
  // Transform media_urls to attachments with full metadata
  // @ts-ignore - attachments not in type but needed for PDFs/docs rendering
  post.attachments = transformMediaUrlsToAttachments(post.media_urls);

  // Load poll data + like state en paralelo. Prefetch de liked_by_me mata el
  // flash de "no like" al abrir el detalle (antes cada card lo consultaba
  // por separado al montar).
  const [pollsMap, likeRow] = await Promise.all([
    getPollsForPosts([postId], userId),
    userId
      ? supabase
          .from('likes')
          .select('id')
          .eq('user_id', userId)
          .eq('post_id', postId)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);
  post.poll = pollsMap.get(postId) || null;
  if (userId) {
    (post as unknown as { liked_by_me?: boolean }).liked_by_me = !!likeRow;
  }

  return post;
}

/**
 * Create a new post (with optional poll)
 */
export async function createPost(userId: string, input: CreatePostInput) {
  console.log('📝 [createPost] Creating post with input:', {
    userId,
    hasTitle: !!input.title,
    hasContent: !!input.content,
    category_id: input.category_id,
    hasAttachments: !!input.attachments?.length,
    hasMediaUrls: !!input.media_urls?.length,
    hasPoll: !!input.poll,
  });

  // Validate category permissions before creating post
  const { data: category } = await supabase
    .from('categories')
    .select('permissions')
    .eq('id', input.category_id)
    .single();

  if (category?.permissions === 'admins') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
      throw new Error('No tienes permisos para publicar en esta categoría');
    }
  }

  // Handle attachments: store full PostAttachment objects (url, name, size, type) for PDFs/docs
  // or just URLs for backward compatibility with images
  let mediaUrls: (string | { url: string; name: string; size: number; type: string })[] = [];
  if (input.attachments && input.attachments.length > 0) {
    // Store full attachment objects to preserve metadata for PDFs/docs
    mediaUrls = input.attachments;
    console.log('📎 [createPost] Storing full attachments with metadata:', mediaUrls);
  } else if (input.media_urls && input.media_urls.length > 0) {
    mediaUrls = input.media_urls;
    console.log('📎 [createPost] Using media_urls directly:', mediaUrls);
  }

  // Create the post
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: userId,
      title: input.title || null,
      content: input.content,
      category_id: input.category_id,
      media_urls: mediaUrls,
      video_embed_url: input.video_embed_url || null,
      send_email_notification: input.send_email_notification || false,
      ...(input.is_draft !== undefined && { is_draft: input.is_draft }),
    })
    .select()
    .single();

  if (error) {
    console.error('❌ [createPost] Database error:', error);
    if (error.message?.includes('rate_limit_exceeded')) {
      throw new Error('Alcanzaste el limite de 3 posts en 24 horas. Vuelve en unas horas para seguir compartiendo.');
    }
    throw error;
  }

  console.log('✅ [createPost] Post created successfully:', data.id);

  // Email broadcast is handled automatically by DB trigger notify_admin_post()
  // when send_email_notification=true on the post. No client-side action needed.
  if (data.send_email_notification) {
    console.log('📧 [createPost] Email broadcast will be handled by DB trigger for post:', data.id);
  }

  // Create poll if provided
  if (input.poll && input.poll.options.length >= 2) {
    try {
      await createPoll(data.id, input.poll);
      console.log('✅ [createPost] Poll created successfully');
    } catch (pollError) {
      console.error('❌ [createPost] Poll creation failed:', {
        message: (pollError as Record<string, unknown>)?.message,
        code: (pollError as Record<string, unknown>)?.code,
        details: (pollError as Record<string, unknown>)?.details,
        pollOptions: input.poll.options,
      });
      throw pollError;
    }
  }

  // Process mentions from title and content
  const titleMentions = input.title ? extractMentionIds(input.title) : [];
  const contentMentions = extractMentionIds(input.content);
  const allMentionedIds = [...new Set([...titleMentions, ...contentMentions])];

  if (allMentionedIds.length > 0) {
    saveMentions(allMentionedIds, userId, data.id).catch(console.error);
  }

  return data;
}

/**
 * Update a post
 */
export async function updatePost(postId: string, input: UpdatePostInput) {
  const { data, error } = await supabase
    .from('posts')
    .update(input)
    .eq('id', postId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * Delete a post
 */
export async function deletePost(postId: string) {
  const { error } = await supabase.from('posts').delete().eq('id', postId);

  if (error) throw error;
}

/**
 * Pin/unpin a post (admin only)
 */
export async function togglePinPost(postId: string, pinned: boolean) {
  if (pinned) {
    // When pinning, add to top: increment all existing pin_orders and set new one to 1
    // 1. Get all pinned posts
    const { data: pinnedPosts } = await supabase
      .from('posts')
      .select('id, pin_order')
      .eq('pinned', true);

    // 2. Increment each one's pin_order
    if (pinnedPosts && pinnedPosts.length > 0) {
      await Promise.all(
        pinnedPosts.map((post) =>
          supabase
            .from('posts')
            .update({ pin_order: (post.pin_order || 0) + 1 })
            .eq('id', post.id)
        )
      );
    }

    // 3. Set the new pinned post to order 1 (top)
    const { error } = await supabase
      .from('posts')
      .update({ pinned: true, pin_order: 1 })
      .eq('id', postId);

    if (error) throw error;
  } else {
    // When unpinning, reset pin_order to 0
    const { error } = await supabase
      .from('posts')
      .update({ pinned: false, pin_order: 0 })
      .eq('id', postId);

    if (error) throw error;
  }
}

/**
 * Reorder pinned posts (admin only)
 * @param orderedPostIds - Array of post IDs in the new order
 */
export async function reorderPinnedPosts(orderedPostIds: string[]) {
  // Update each post's pin_order based on its position in the array
  const updates = orderedPostIds.map((postId, index) =>
    supabase
      .from('posts')
      .update({ pin_order: index + 1 })
      .eq('id', postId)
  );

  const results = await Promise.all(updates);

  // Check for any errors
  for (const result of results) {
    if (result.error) throw result.error;
  }
}

/**
 * Move a post to a different category (admin only)
 */
export async function movePostToCategory(postId: string, categoryId: string) {
  const { error } = await supabase
    .from('posts')
    .update({ category_id: categoryId })
    .eq('id', postId);

  if (error) throw error;
}

/**
 * Mark a post as viewed by the current user (for Unread filter)
 */
export async function markPostAsViewed(userId: string, postId: string) {
  const { error } = await supabase
    .from('post_views')
    .upsert(
      { user_id: userId, post_id: postId, viewed_at: new Date().toISOString() },
      { onConflict: 'user_id,post_id' }
    );

  if (error) {
    console.error('Error marking post as viewed:', error);
  }
}

// ===== COMMENTS =====

/**
 * Fetch comments for a post (with nested replies)
 *
 * userId opcional: prefetch BATCH de liked_by_me (1 query para todos los
 * comments). Antes cada CommentCard consultaba su like al montar (N+1 con
 * flash de "no like" en threads largos).
 */
export async function getCommentsByPostId(postId: string, userId?: string): Promise<CommentWithReplies[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(
      `
      *,
      author:profiles!comments_author_id_fkey(id, full_name, avatar_url, role)
    `
    )
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const comments = data as unknown as CommentWithAuthor[];

  // Batch like state for all comments in a single query
  if (userId && comments.length > 0) {
    const { data: likes } = await supabase
      .from('likes')
      .select('comment_id')
      .eq('user_id', userId)
      .in('comment_id', comments.map(c => c.id));
    const likedSet = new Set((likes || []).map(l => l.comment_id));
    comments.forEach(c => {
      (c as unknown as { liked_by_me?: boolean }).liked_by_me = likedSet.has(c.id);
    });
  }

  // Separate parent comments and replies
  const parentComments = comments.filter(c => !c.parent_id);
  const replies = comments.filter(c => c.parent_id);

  // Attach replies to parent comments
  const commentsWithReplies: CommentWithReplies[] = parentComments.map(parent => ({
    ...parent,
    replies: replies.filter(r => r.parent_id === parent.id),
  }));

  return commentsWithReplies;
}

/**
 * Fetch comments for a lesson (with nested replies)
 * Uses same structure as post comments (Exclusive Arc pattern)
 */
export async function getCommentsByLessonId(lessonId: string, userId?: string): Promise<CommentWithReplies[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(
      `
      *,
      author:profiles!comments_author_id_fkey(id, full_name, avatar_url, role)
    `
    )
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const comments = data as unknown as CommentWithAuthor[];

  // Batch like state (mismo patrón que getCommentsByPostId): sin esto, cada
  // CommentCard disparaba su propia query de likes (37 requests en una clase)
  if (userId && comments.length > 0) {
    const { data: likes } = await supabase
      .from('likes')
      .select('comment_id')
      .eq('user_id', userId)
      .in('comment_id', comments.map(c => c.id));
    const likedSet = new Set((likes || []).map(l => l.comment_id));
    comments.forEach(c => {
      (c as unknown as { liked_by_me?: boolean }).liked_by_me = likedSet.has(c.id);
    });
  }

  // Separate parent comments and replies
  const parentComments = comments.filter(c => !c.parent_id);
  const replies = comments.filter(c => c.parent_id);

  // Attach replies to parent comments
  const commentsWithReplies: CommentWithReplies[] = parentComments.map(parent => ({
    ...parent,
    replies: replies.filter(r => r.parent_id === parent.id),
  }));

  return commentsWithReplies;
}

/**
 * Create a new comment (or reply)
 * Supports both posts (post_id) and lessons (lesson_id) via Exclusive Arc pattern
 */
export async function createComment(userId: string, input: CreateCommentInput) {
  // Validate Exclusive Arc: exactly one of post_id or lesson_id must be set
  if (!input.post_id && !input.lesson_id) {
    throw new Error('Either post_id or lesson_id must be provided');
  }
  if (input.post_id && input.lesson_id) {
    throw new Error('Cannot set both post_id and lesson_id (Exclusive Arc)');
  }

  const insertPayload = {
    author_id: userId,
    post_id: input.post_id || null,
    lesson_id: input.lesson_id || null,
    content: input.content,
    parent_id: input.parent_id || null,
    media_urls: input.media_urls || [],
    video_embed_url: input.video_embed_url || null,
  };

  let { data, error } = await supabase
    .from('comments')
    .insert(insertPayload)
    .select()
    .single();

  // Si RLS falla (sesión expirada), refrescar token y reintentar una vez
  if (error?.code === '42501') {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) {
      const retry = await supabase
        .from('comments')
        .insert(insertPayload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }
  }

  if (error) throw error;
  if (!data) throw new Error('No se pudo crear el comentario');

  // Guardar menciones (fallar aquí no deshace el comentario ya creado)
  const mentionedIds = extractMentionIds(input.content);
  if (mentionedIds.length > 0) {
    const mentionPostId = input.post_id || undefined;
    saveMentions(mentionedIds, userId, mentionPostId, data.id).catch(console.error);
  }

  return data;
}

/**
 * Update a comment (with mention processing for new mentions)
 */
export async function updateComment(commentId: string, input: UpdateCommentInput, userId?: string) {
  // Get the old content to diff mentions
  const { data: oldComment } = await supabase
    .from('comments')
    .select('content, post_id, lesson_id, parent_id')
    .eq('id', commentId)
    .single();

  const oldMentionIds = oldComment ? new Set(extractMentionIds(oldComment.content)) : new Set<string>();

  const updateData: Record<string, unknown> = { content: input.content };

  if (input.media_urls !== undefined) {
    updateData.media_urls = input.media_urls;
  }
  if (input.video_embed_url !== undefined) {
    updateData.video_embed_url = input.video_embed_url;
  }

  const { data, error } = await supabase
    .from('comments')
    .update(updateData)
    .eq('id', commentId)
    .select()
    .single();

  if (error) throw error;

  // Process NEW mentions only (added during edit)
  if (userId && oldComment) {
    const newMentionIds = extractMentionIds(input.content);
    const addedMentions = newMentionIds.filter(id => !oldMentionIds.has(id));

    if (addedMentions.length > 0) {
      // Fire-and-forget so mention processing failures don't abort a successful update
      const mentionPostId = oldComment.post_id || undefined;
      saveMentions(addedMentions, userId, mentionPostId, commentId).catch(console.error);
    }
  }

  return data;
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);

  if (error) throw error;
}

// ===== LIKES =====

/**
 * Toggle like on a post — RPC atómico (1 round-trip, race-safe).
 * Mismo patrón que vote_poll_option. userId se conserva en la firma por
 * compatibilidad; la identidad real la pone auth.uid() en el servidor.
 */
export async function togglePostLike(_userId: string, postId: string) {
  const { data, error } = await supabase.rpc('toggle_post_like', {
    p_post_id: postId,
  });

  if (error) throw error;
  return { liked: data as boolean };
}

/**
 * Toggle like on a comment — RPC atómico (1 round-trip, race-safe).
 */
export async function toggleCommentLike(_userId: string, commentId: string) {
  const { data, error } = await supabase.rpc('toggle_comment_like', {
    p_comment_id: commentId,
  });

  if (error) throw error;
  return { liked: data as boolean };
}

/**
 * Check if user liked a post
 */
export async function hasUserLikedPost(userId: string, postId: string) {
  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle();

  return !!data;
}

/**
 * Check if user liked a comment
 */
export async function hasUserLikedComment(userId: string, commentId: string) {
  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('comment_id', commentId)
    .maybeSingle();

  return !!data;
}

/**
 * Liker profile info for modal display
 */
export interface LikerProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

/**
 * Get users who liked a post
 */
export async function getPostLikers(postId: string): Promise<LikerProfile[]> {
  const { data, error } = await supabase
    .from('likes')
    .select(`
      user_id,
      user:profiles!likes_user_id_fkey(id, full_name, avatar_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data || [])
    .map(like => like.user as unknown as LikerProfile)
    .filter(Boolean);
}

/**
 * Get all users who voted for a specific poll option (no 3-voter cap).
 * Used by the poll voters modal.
 */
export async function getPollOptionVoters(optionId: string): Promise<VoterProfile[]> {
  const { data, error } = await supabase
    .from('poll_votes')
    .select(`
      user_id,
      user:profiles!poll_votes_user_id_fkey(id, full_name, avatar_url)
    `)
    .eq('poll_option_id', optionId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw error;

  return (data || [])
    .map(vote => vote.user as unknown as VoterProfile)
    .filter(Boolean);
}

/**
 * Get users who liked a comment
 */
export async function getCommentLikers(commentId: string): Promise<LikerProfile[]> {
  const { data, error } = await supabase
    .from('likes')
    .select(`
      user_id,
      user:profiles!likes_user_id_fkey(id, full_name, avatar_url)
    `)
    .eq('comment_id', commentId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data || [])
    .map(like => like.user as unknown as LikerProfile)
    .filter(Boolean);
}

// ===== CATEGORIES =====

/**
 * Fetch all categories
 */
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('order_position', { ascending: true });

  if (error) throw error;
  return data as Category[];
}

// ===== POLLS =====

/**
 * Create a poll for a post
 */
export async function createPoll(postId: string, input: CreatePollInput) {
  console.log('📊 [createPoll] Creating poll for post:', postId, 'options:', input.options);

  // Create the poll
  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .insert({
      post_id: postId,
      allow_multiple: input.allow_multiple || false,
    })
    .select()
    .single();

  if (pollError) {
    console.error('❌ [createPoll] Failed to create poll record:', pollError);
    throw pollError;
  }

  // Create poll options
  const optionsToInsert = input.options.map((text, index) => ({
    poll_id: poll.id,
    text,
    order_position: index,
  }));

  const { error: optionsError } = await supabase
    .from('poll_options')
    .insert(optionsToInsert);

  if (optionsError) {
    console.error('❌ [createPoll] Failed to create poll options:', optionsError);
    throw optionsError;
  }

  return poll;
}

/**
 * Get poll by post ID with options and vote status
 */
export async function getPollByPostId(
  postId: string,
  userId?: string
): Promise<PollWithOptionsAndVotes | null> {
  // Get poll with options
  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .select(`
      *,
      options:poll_options(*)
    `)
    .eq('post_id', postId)
    .single();

  if (pollError) {
    if (pollError.code === 'PGRST116') return null; // Not found
    throw pollError;
  }

  if (!poll) return null;

  // Get user's votes if userId provided
  let userVoteOptionIds: string[] = [];
  if (userId) {
    const { data: votes } = await supabase
      .from('poll_votes')
      .select('poll_option_id')
      .eq('user_id', userId)
      .in('poll_option_id', poll.options.map((o: { id: string }) => o.id));

    userVoteOptionIds = votes?.map(v => v.poll_option_id) || [];
  }

  // Calculate total votes
  const totalVotes = poll.options.reduce(
    (sum: number, opt: { votes_count: number }) => sum + opt.votes_count,
    0
  );

  // Map options with vote status
  const optionsWithStatus: PollOptionWithVoteStatus[] = poll.options
    .sort((a: { order_position: number }, b: { order_position: number }) =>
      a.order_position - b.order_position
    )
    .map((opt: { id: string; poll_id: string; text: string; order_position: number; votes_count: number; created_at: string }) => ({
      ...opt,
      has_voted: userVoteOptionIds.includes(opt.id),
    }));

  return {
    id: poll.id,
    post_id: poll.post_id,
    allow_multiple: poll.allow_multiple,
    created_at: poll.created_at,
    options: optionsWithStatus,
    total_votes: totalVotes,
    user_votes: userVoteOptionIds,
  };
}

/**
 * Vote on a poll option (uses RPC function)
 */
export async function votePollOption(optionId: string) {
  const { error } = await supabase.rpc('vote_poll_option', {
    option_id: optionId,
  });

  if (error) throw error;
}

/**
 * Unvote from a poll option (uses RPC function)
 */
export async function unvotePollOption(optionId: string) {
  const { error } = await supabase.rpc('unvote_poll_option', {
    option_id: optionId,
  });

  if (error) throw error;
}

/**
 * Delete a poll
 */
export async function deletePoll(pollId: string) {
  const { error } = await supabase
    .from('polls')
    .delete()
    .eq('id', pollId);

  if (error) throw error;
}

// ===== MENTIONS =====

/**
 * Search users for mention autocomplete
 */
export async function searchMentionableUsers(query: string): Promise<MentionableUser[]> {
  if (!query || query.length < 1) return [];

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role')
    .ilike('full_name', `%${query}%`)
    .order('full_name')
    .limit(8);

  if (error) throw error;

  return (users || []).map(user => ({
    id: user.id,
    full_name: user.full_name,
    avatar_url: user.avatar_url,
    is_agent: false,
    role: user.role,
  }));
}

/**
 * Save mentions for a post or comment
 */
export async function saveMentions(
  mentionedUserIds: string[],
  mentionedByUserId: string,
  postId?: string,
  commentId?: string
) {
  if (mentionedUserIds.length === 0) return;

  // Filtrar duplicados y el propio usuario
  const uniqueIds = [...new Set(mentionedUserIds)].filter(id => id !== mentionedByUserId);
  if (uniqueIds.length === 0) return;

  const mentionsToInsert = uniqueIds.map(userId => ({
    mentioned_user_id: userId,
    mentioned_by_user_id: mentionedByUserId,
    post_id: postId || null,
    comment_id: commentId || null,
  }));

  const { error } = await supabase
    .from('mentions')
    .insert(mentionsToInsert);

  if (error) throw error;
}

/**
 * Extract mention IDs from HTML content (TipTap format)
 */
export function extractMentionIds(htmlContent: string): string[] {
  // TipTap genera: <span data-type="mention" data-id="uuid">@nombre</span>
  const regex = /data-id="([a-f0-9-]{36})"/g;
  const ids: string[] = [];
  let match;
  while ((match = regex.exec(htmlContent)) !== null) {
    ids.push(match[1]);
  }
  return [...new Set(ids)];
}

// ===== NOTIFICATIONS =====

/**
 * Get notifications for a user
 */
export async function getNotifications(userId: string, limit = 20): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as Notification[];
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
  return count || 0;
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
}

// ============================================
// EMAIL BROADCAST STATUS
// ============================================
// Lee el acuse de entrega de un anuncio enviado por email.
// Existe porque hasta el 25 jul 2026 publicar con el toggle prendido no daba NINGUNA
// señal: 4 anuncios se perdieron en silencio (~471 correos c/u) y nadie se enteró en
// 16 dias. Solo admin/owner pueden leer la tabla (RLS).

export type EmailBroadcastStatus = {
  status: 'sent' | 'partial' | 'failed' | 'no_recipients';
  recipients_total: number;
  sent: number;
  failed: number;
  errors: string[];
};

export async function getEmailBroadcastStatus(
  postId: string
): Promise<EmailBroadcastStatus | null> {
  const { data, error } = await supabase
    .from('admin_email_broadcast_log')
    .select('status, recipients_total, sent, failed, errors')
    .eq('post_id', postId)
    .maybeSingle();

  // Sin fila todavia no es un error: el webhook puede seguir enviando.
  if (error) {
    console.error('[getEmailBroadcastStatus] Error:', error);
    return null;
  }

  return (data as EmailBroadcastStatus) ?? null;
}
