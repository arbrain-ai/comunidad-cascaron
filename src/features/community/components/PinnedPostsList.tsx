'use client';

import { PostWithAuthor, Category } from '../types';
import { PostCard } from './PostCard';

interface PinnedPostsListProps {
  pinnedPosts: PostWithAuthor[];
  unpinnedPosts: PostWithAuthor[];
  onLike: (postId: string) => Promise<boolean>;
  onDelete?: (postId: string) => Promise<void>;
  onEdit?: (post: PostWithAuthor) => void;
  onTogglePin?: (postId: string, pinned: boolean) => Promise<void>;
  onMoveToCategory?: (postId: string, categoryId: string) => Promise<void>;
  categories?: Category[];
  onOpenModal?: (postId: string) => void;
  onReorderPinned: (orderedPostIds: string[]) => Promise<void>;
  isAdmin: boolean;
  userFavorites?: Set<string>;
  onToggleFavorite?: (postId: string) => Promise<void>;
}

export function PinnedPostsList({
  pinnedPosts,
  unpinnedPosts,
  onLike,
  onDelete,
  onEdit,
  onTogglePin,
  onMoveToCategory,
  categories,
  onOpenModal,
  onReorderPinned,
  isAdmin,
  userFavorites = new Set(),
  onToggleFavorite,
}: PinnedPostsListProps) {
  // Move pinned post up (lower index = higher position)
  const handleMoveUp = async (postId: string) => {
    const currentIndex = pinnedPosts.findIndex((p) => p.id === postId);
    if (currentIndex <= 0) return; // Already at top

    const newOrder = [...pinnedPosts.map((p) => p.id)];
    // Swap with previous
    [newOrder[currentIndex - 1], newOrder[currentIndex]] = [
      newOrder[currentIndex],
      newOrder[currentIndex - 1],
    ];
    await onReorderPinned(newOrder);
  };

  // Move pinned post down (higher index = lower position)
  const handleMoveDown = async (postId: string) => {
    const currentIndex = pinnedPosts.findIndex((p) => p.id === postId);
    if (currentIndex < 0 || currentIndex >= pinnedPosts.length - 1) return; // Already at bottom

    const newOrder = [...pinnedPosts.map((p) => p.id)];
    // Swap with next
    [newOrder[currentIndex], newOrder[currentIndex + 1]] = [
      newOrder[currentIndex + 1],
      newOrder[currentIndex],
    ];
    await onReorderPinned(newOrder);
  };

  return (
    <div className="space-y-4">
      {/* Pinned Posts */}
      {pinnedPosts.map((post, index) => (
        <PostCard
          key={post.id}
          post={post}
          onLike={onLike}
          onDelete={onDelete}
          onEdit={onEdit}
          onTogglePin={onTogglePin}
          onMoveToCategory={onMoveToCategory}
          categories={categories}
          onOpenModal={onOpenModal}
          // Reorder controls for admins when multiple pinned posts
          onMoveUp={isAdmin && pinnedPosts.length > 1 && index > 0 ? () => handleMoveUp(post.id) : undefined}
          onMoveDown={isAdmin && pinnedPosts.length > 1 && index < pinnedPosts.length - 1 ? () => handleMoveDown(post.id) : undefined}
          isFavorite={userFavorites.has(post.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}

      {/* Unpinned Posts */}
      {unpinnedPosts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onLike={onLike}
          onDelete={onDelete}
          onEdit={onEdit}
          onTogglePin={onTogglePin}
          onMoveToCategory={onMoveToCategory}
          categories={categories}
          onOpenModal={onOpenModal}
          isFavorite={userFavorites.has(post.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
