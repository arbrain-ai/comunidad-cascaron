import { Tables } from '@/shared/types/database.types';

// Database types
export type Post = Tables<'posts'>;
export type Comment = Tables<'comments'>;
export type Like = Tables<'likes'>;
export type Category = Tables<'categories'>;

// Poll types (matching migration 016)
export interface Poll {
  id: string;
  post_id: string;
  allow_multiple: boolean;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  text: string;
  order_position: number;
  votes_count: number;
  created_at: string;
}

// Extended poll types with relations
export interface PollWithOptions extends Poll {
  options: PollOption[];
}

export interface VoterProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface PollOptionWithVoteStatus extends PollOption {
  has_voted: boolean;
  voters: VoterProfile[];
}

export interface PollWithOptionsAndVotes extends Poll {
  options: PollOptionWithVoteStatus[];
  total_votes: number;
  user_votes: string[]; // option IDs the user voted for
}

// Attachment types
// Una entrada de media_urls. `type` es el MIME real del archivo subido, o el
// sintetico 'video/embed' (VIDEO_EMBED_TYPE en shared/utils/mediaType) cuando
// la ficha es un video de video propio/YouTube/Vimeo/Loom: asi el video se ordena
// junto a las imagenes en la bandeja y el post lo pinta en esa posicion.
export interface PostAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

// Poll creation input
export interface CreatePollInput {
  allow_multiple?: boolean;
  options: string[]; // Array of option texts
}

export interface CreatePollOptionInput {
  poll_id: string;
  text: string;
  order_position: number;
}

// Recent commenter avatar for Skool-style display
export interface RecentCommenter {
  id: string;
  avatar_url: string | null;
  full_name: string;
}

// Comment activity summary for posts
export interface CommentActivity {
  recent_commenters: RecentCommenter[];
  last_comment_at: string | null;
}

// Extended types with relations
export interface PostWithAuthor extends Post {
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  };
  // AI agent author - when set, UI shows agent info instead of user
  agent_author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  category: Category;
  poll?: PollWithOptionsAndVotes | null;
  comment_activity?: CommentActivity | null;
}

export interface CommentWithAuthor extends Omit<Comment, 'media_urls' | 'video_embed_url' | 'parent_id'> {
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  } | null;
  agent?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  parent_id?: string | null;
  media_urls?: PostAttachment[];
  video_embed_url?: string | null;
  audio_url: string | null; // TTS audio for agent comments
}

// Comment with nested replies (1 level only)
export interface CommentWithReplies extends CommentWithAuthor {
  replies: CommentWithAuthor[];
}

// Form inputs
export interface CreatePostInput {
  title?: string;
  content: string;
  category_id: string;
  media_urls?: string[];
  video_embed_url?: string | null;
  attachments?: PostAttachment[];
  poll?: CreatePollInput;
  send_email_notification?: boolean;
  is_draft?: boolean;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  category_id?: string;
  // Objetos completos (url, name, size, type). Guardar solo strings al editar
  // perdia el nombre/tamaño de los PDFs y convertia el video en "archivo".
  media_urls?: (string | PostAttachment)[];
  video_embed_url?: string | null;
  pinned?: boolean;
  is_draft?: boolean;
  // Solo se mandan al PUBLICAR un borrador (is_draft true -> false):
  // el trigger notify_admin_post_published lee send_email_notification de la fila NUEVA,
  // y created_at se refresca para que el post entre al feed por arriba.
  send_email_notification?: boolean;
  created_at?: string;
}

export interface CreateCommentInput {
  post_id?: string;      // For community posts
  lesson_id?: string;    // For classroom lessons (Exclusive Arc: one must be set)
  content: string;
  parent_id?: string | null;
  media_urls?: PostAttachment[];
  video_embed_url?: string | null;
}

export interface UpdateCommentInput {
  content: string;
  media_urls?: PostAttachment[];
  video_embed_url?: string | null;
}

// ===== COMMENT CONTEXT =====

/**
 * Context type for polymorphic comments (Exclusive Arc pattern)
 * A comment belongs to EITHER a post OR a lesson, never both
 */
export type CommentContextType = 'post' | 'lesson';

export interface CommentContext {
  type: CommentContextType;
  id: string;  // postId or lessonId
}

// ===== MENTIONS =====

export interface Mention {
  id: string;
  post_id?: string | null;
  comment_id?: string | null;
  mentioned_user_id: string;
  mentioned_by_user_id: string;
  created_at: string;
}

export interface MentionableUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_agent: boolean;
  role: string;
  // Campos para agentes bloqueados por nivel
  isLocked?: boolean;
  requiredLevel?: number;
}

// ===== NOTIFICATIONS =====

export interface Notification {
  id: string;
  user_id: string;
  type: 'mention' | 'reply' | 'like' | 'agent_response';
  title: string;
  body?: string | null;
  data?: {
    post_id?: string;
    comment_id?: string;
    from_user_id?: string;
  };
  read: boolean;
  created_at: string;
}

// ===== FAVORITES =====

export interface PostFavorite {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

