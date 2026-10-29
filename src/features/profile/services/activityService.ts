import { supabase } from '@/shared/lib/supabase';

export interface ActivityDay {
  date: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4; // 0 = none, 4 = max activity
}

export interface UserStats {
  posts_count: number;
  comments_count: number;
  likes_received: number;
  lessons_completed: number;
  followers_count: number;
  following_count: number;
}

export interface UserActivityData {
  activity: ActivityDay[];
  stats: UserStats;
  last_active: string | null;
  joined_at: string;
}

/**
 * Calculate activity level (0-4) based on count
 */
function getActivityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

/**
 * Generate empty activity grid for last N days
 */
function generateEmptyGrid(days: number = 365): Map<string, number> {
  const grid = new Map<string, number>();
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    grid.set(dateStr, 0);
  }

  return grid;
}

/**
 * Fetch user activity heatmap data (posts, comments, likes, lessons)
 */
export async function getUserActivity(userId: string, days: number = 365): Promise<UserActivityData> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString();

  // Fetch all activity in parallel
  const [postsRes, commentsRes, likesRes, lessonsRes, profileRes] = await Promise.all([
    // Posts by user
    supabase
      .from('posts')
      .select('created_at')
      .eq('author_id', userId)
      .gte('created_at', startDateStr),

    // Comments by user
    supabase
      .from('comments')
      .select('created_at')
      .eq('author_id', userId)
      .gte('created_at', startDateStr),

    // Likes given by user
    supabase
      .from('likes')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', startDateStr),

    // Lessons completed
    supabase
      .from('lesson_progress')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('completed_at', startDateStr),

    // Profile info
    supabase
      .from('profiles')
      .select('created_at, last_seen')
      .eq('id', userId)
      .single()
  ]);

  // Build activity grid
  const activityGrid = generateEmptyGrid(days);

  // Count posts per day
  postsRes.data?.forEach(post => {
    const date = post.created_at?.split('T')[0];
    if (date && activityGrid.has(date)) {
      activityGrid.set(date, (activityGrid.get(date) || 0) + 2); // Posts weight: 2
    }
  });

  // Count comments per day
  commentsRes.data?.forEach(comment => {
    const date = comment.created_at?.split('T')[0];
    if (date && activityGrid.has(date)) {
      activityGrid.set(date, (activityGrid.get(date) || 0) + 1); // Comments weight: 1
    }
  });

  // Count likes per day
  likesRes.data?.forEach(like => {
    const date = like.created_at?.split('T')[0];
    if (date && activityGrid.has(date)) {
      activityGrid.set(date, (activityGrid.get(date) || 0) + 0.5); // Likes weight: 0.5
    }
  });

  // Count lessons completed per day
  lessonsRes.data?.forEach(lesson => {
    const date = lesson.completed_at?.split('T')[0];
    if (date && activityGrid.has(date)) {
      activityGrid.set(date, (activityGrid.get(date) || 0) + 3); // Lessons weight: 3
    }
  });

  // Convert to array with levels
  const activity: ActivityDay[] = [];
  activityGrid.forEach((count, date) => {
    activity.push({
      date,
      count: Math.round(count),
      level: getActivityLevel(Math.round(count))
    });
  });

  return {
    activity,
    stats: {
      posts_count: postsRes.data?.length || 0,
      comments_count: commentsRes.data?.length || 0,
      likes_received: 0, // Would need separate query
      lessons_completed: lessonsRes.data?.length || 0,
      followers_count: 0, // Not implemented yet
      following_count: 0  // Not implemented yet
    },
    last_active: profileRes.data?.last_seen || null,
    joined_at: profileRes.data?.created_at || ''
  };
}

/**
 * Fetch user stats (total counts)
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  const [postsRes, commentsRes, lessonsRes, likesReceivedRes] = await Promise.all([
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId),

    supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId),

    supabase
      .from('lesson_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true),

    // Likes received on user's posts
    supabase
      .from('likes')
      .select('posts!inner(author_id)', { count: 'exact', head: true })
      .eq('posts.author_id', userId)
  ]);

  return {
    posts_count: postsRes.count || 0,
    comments_count: commentsRes.count || 0,
    likes_received: likesReceivedRes.count || 0,
    lessons_completed: lessonsRes.count || 0,
    followers_count: 0,
    following_count: 0
  };
}

/**
 * Get user profile with basic info for popup
 */
export async function getUserProfileForPopup(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, bio, role, tier, created_at, last_seen, location_city, location_country')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}
