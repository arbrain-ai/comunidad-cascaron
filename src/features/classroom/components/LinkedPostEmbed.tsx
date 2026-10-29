'use client';

/**
 * LinkedPostEmbed - Embeds a Community post inside a Classroom lesson (Skool-style)
 *
 * Shows a compact card preview of the post. When clicked, opens the full post
 * in a modal with likes, comments, and all interactions - without leaving Classroom.
 */

import { useState, useEffect } from 'react';
import { isImageMedia, getMediaUrl } from '@/shared/utils/mediaType';
import { PostWithAuthor } from '@/features/community/types';
import { getPostById, togglePostLike } from '@/features/community/services/communityService';
import { PostDetailModal } from '@/features/community/components/PostDetailModal';
import { formatRelativeDate } from '@/shared/utils/dates';
import Image from 'next/image';

interface LinkedPostEmbedProps {
  postId: string;
  lessonTitle?: string;
}

// Caché de sesión: al cambiar de lección y volver, el post embebido pinta
// al instante en vez de re-mostrar skeleton + refetch. Cap LRU simple para
// que no crezca sin límite en sesiones largas (evict del más viejo).
const LINKED_POST_CACHE_MAX = 50;
const linkedPostCache = new Map<string, PostWithAuthor>();

function cacheLinkedPost(postId: string, post: PostWithAuthor) {
  linkedPostCache.delete(postId);
  linkedPostCache.set(postId, post);
  if (linkedPostCache.size > LINKED_POST_CACHE_MAX) {
    const oldest = linkedPostCache.keys().next().value;
    if (oldest !== undefined) linkedPostCache.delete(oldest);
  }
}

export function LinkedPostEmbed({ postId, lessonTitle }: LinkedPostEmbedProps) {
  const cached = linkedPostCache.get(postId) || null;
  const [post, setPost] = useState<PostWithAuthor | null>(cached);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (linkedPostCache.has(postId)) {
      setPost(linkedPostCache.get(postId) || null);
      setIsLoading(false);
      return;
    }

    async function fetchPost() {
      try {
        const data = await getPostById(postId);
        cacheLinkedPost(postId, data);
        setPost(data);
      } catch (err) {
        console.error('[LinkedPostEmbed] Error fetching post:', err);
        setError('No se pudo cargar el post');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPost();
  }, [postId]);

  if (isLoading) {
    return (
      <div className="glass-panel rounded-xl p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-surface" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-surface rounded" />
            <div className="h-3 w-24 bg-surface rounded" />
          </div>
        </div>
        <div className="h-5 w-3/4 bg-surface rounded mb-3" />
        <div className="h-4 w-full bg-surface rounded mb-2" />
        <div className="h-4 w-2/3 bg-surface rounded" />
      </div>
    );
  }

  // Un post que no se puede leer (borrador todavia no publicado, o borrado) no
  // le muestra un error crudo al miembro: la tarjeta simplemente no aparece.
  // El detalle queda en consola para quien depura.
  if (error || !post) {
    return null;
  }

  const displayAuthor = post.author;

  // Extract first image from media_urls for thumbnail
  // media_urls can be either string[] or object[] with { url, name, size, type }
  // Primera IMAGEN real (media_urls tambien trae videos embebidos y archivos).
  const rawMediaUrls = (post.media_urls as Array<string | { url: string; type?: string }>) || [];
  const thumbnailUrl = getMediaUrl(rawMediaUrls.find(isImageMedia)) ?? undefined;

  // Truncate content for preview (strip HTML, limit chars)
  const plainContent = post.content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const previewContent = plainContent.length > 200
    ? plainContent.substring(0, 200) + '...'
    : plainContent;

  return (
    <>
      {/* Lesson title if provided */}
      {lessonTitle && (
        <h1 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
          {lessonTitle}
        </h1>
      )}

      {/* Post Card Preview - Clickable */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full text-left glass-panel rounded-xl border border-border/30 hover:border-primary/50 transition-all duration-200 overflow-hidden group"
      >
        {/* Thumbnail if available */}
        {thumbnailUrl && (
          <div className="relative w-full h-48 bg-surface">
            <Image
              src={thumbnailUrl}
              alt="Post thumbnail"
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        <div className="p-4 md:p-5">
          {/* Author header */}
          <div className="flex items-center gap-3 mb-3">
            {displayAuthor.avatar_url ? (
              <img
                src={displayAuthor.avatar_url}
                alt={displayAuthor.full_name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-semibold">
                  {displayAuthor.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">{displayAuthor.full_name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>{formatRelativeDate(post.created_at || '')}</span>
                <span>·</span>
                <span
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: `${post.category.color || '#683ACC'}20`,
                    color: post.category.color || '#683ACC',
                  }}
                >
                  {post.category.name}
                </span>
              </div>
            </div>
            {/* Close/expand indicator */}
            <div className="ml-auto text-muted group-hover:text-primary transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </div>
          </div>

          {/* Title */}
          {post.title && (
            <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
              {post.title.replace(/<[^>]*>/g, '')}
            </h3>
          )}

          {/* Content preview */}
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
            {previewContent}
          </p>

          {/* Stats footer */}
          <div className="flex items-center gap-4 text-sm text-muted pt-3 border-t border-border/50">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              <span>{post.likes_count || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{post.comments_count || 0} comments</span>
            </div>
            <span className="ml-auto text-xs text-primary font-medium group-hover:underline">
              Ver post completo →
            </span>
          </div>
        </div>
      </button>

      {/* Full Post Modal */}
      {showModal && (
        <PostDetailModal
          postId={postId}
          onClose={() => setShowModal(false)}
          onPostUpdated={() => {
            // Refresh the post data (y el caché de sesión)
            getPostById(postId).then((fresh) => {
              cacheLinkedPost(postId, fresh);
              setPost(fresh);
            });
          }}
        />
      )}
    </>
  );
}
