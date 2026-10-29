import { supabase } from '@/shared/lib/supabase';

/**
 * Add a post to user's favorites
 *
 * @param userId - User ID adding the favorite
 * @param postId - Post ID to add to favorites
 * @returns Object with success status
 * @throws Error if database operation fails
 */
export async function addFavorite(userId: string, postId: string) {
  try {
    // Check if already favorited to avoid duplicate key errors
    const { data: existing } = await supabase
      .from('post_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();

    if (existing) {
      // Already favorited, return early
      return { success: true, alreadyFavorited: true };
    }

    // Insert new favorite
    const { error } = await supabase
      .from('post_favorites')
      .insert({
        user_id: userId,
        post_id: postId,
      });

    if (error) {
      console.error('[addFavorite] Database error:', error);
      throw new Error(`Failed to add favorite: ${error.message}`);
    }

    return { success: true, alreadyFavorited: false };
  } catch (error) {
    console.error('[addFavorite] Unexpected error:', error);
    throw error instanceof Error
      ? error
      : new Error('An unexpected error occurred while adding favorite');
  }
}

/**
 * Remove a post from user's favorites
 *
 * @param userId - User ID removing the favorite
 * @param postId - Post ID to remove from favorites
 * @returns Object with success status
 * @throws Error if database operation fails
 */
export async function removeFavorite(userId: string, postId: string) {
  try {
    const { error } = await supabase
      .from('post_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('post_id', postId);

    if (error) {
      console.error('[removeFavorite] Database error:', error);
      throw new Error(`Failed to remove favorite: ${error.message}`);
    }

    return { success: true };
  } catch (error) {
    console.error('[removeFavorite] Unexpected error:', error);
    throw error instanceof Error
      ? error
      : new Error('An unexpected error occurred while removing favorite');
  }
}

/**
 * Get list of post IDs favorited by user
 *
 * @param userId - User ID to get favorites for
 * @returns Array of post IDs
 * @throws Error if database operation fails
 */
export async function getUserFavorites(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('post_favorites')
      .select('post_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getUserFavorites] Database error:', error);
      throw new Error(`Failed to get user favorites: ${error.message}`);
    }

    return (data || []).map(fav => fav.post_id);
  } catch (error) {
    console.error('[getUserFavorites] Unexpected error:', error);
    throw error instanceof Error
      ? error
      : new Error('An unexpected error occurred while fetching favorites');
  }
}

/**
 * Check if a post is favorited by user
 *
 * @param userId - User ID to check
 * @param postId - Post ID to check
 * @returns Boolean indicating if post is favorited
 */
export async function isFavorite(userId: string, postId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('post_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();

    if (error) {
      console.error('[isFavorite] Database error:', error);
      throw new Error(`Failed to check favorite status: ${error.message}`);
    }

    return !!data;
  } catch (error) {
    console.error('[isFavorite] Unexpected error:', error);
    // For read operations, we can return false on error instead of throwing
    // This prevents UI breakage on non-critical checks
    return false;
  }
}

/**
 * Toggle favorite status for a post
 * Convenience function that adds or removes based on current state
 *
 * @param userId - User ID
 * @param postId - Post ID
 * @returns Object with new favorited status
 * @throws Error if database operation fails
 */
export async function toggleFavorite(userId: string, postId: string) {
  try {
    const currentlyFavorited = await isFavorite(userId, postId);

    if (currentlyFavorited) {
      await removeFavorite(userId, postId);
      return { favorited: false };
    } else {
      await addFavorite(userId, postId);
      return { favorited: true };
    }
  } catch (error) {
    console.error('[toggleFavorite] Error:', error);
    throw error instanceof Error
      ? error
      : new Error('An unexpected error occurred while toggling favorite');
  }
}
