import { supabase } from '@/shared/lib/supabase';
import { AdminStats, UserRole, UserTier, UserWithStats } from '../types';
import { tiptapToPreview } from '@/shared/utils/tiptap';

const PAGE_SIZE = 1000;

// Get admin stats
export async function getAdminStats(): Promise<AdminStats> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [usersCount, postsCount, coursesCount, eventsCount, newUsers, newPosts] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('posts').select('id', { count: 'exact', head: true }),
    supabase.from('courses').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', oneWeekAgo.toISOString()),
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', oneWeekAgo.toISOString()),
  ]);

  return {
    totalUsers: usersCount.count || 0,
    totalPosts: postsCount.count || 0,
    totalCourses: coursesCount.count || 0,
    totalEvents: eventsCount.count || 0,
    newUsersThisWeek: newUsers.count || 0,
    newPostsThisWeek: newPosts.count || 0,
  };
}

// Get all users with stats (paginated to handle >1000 users)
export async function getUsers() {
  const allData: UserWithStats[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...(data as UserWithStats[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allData;
}

// Cambia rol, tier o acceso de un miembro. Pasa SIEMPRE por el servidor:
// desde el 3 sep 2026 `profiles` ya no acepta esas columnas con el anon key
// (migracion 20260903_rls_profiles_columnas), porque el mismo permiso que le
// servia al panel le servia a cualquier miembro para hacerse owner.
async function parcharPerfil(userId: string, cambios: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No authenticated session');

  const response = await fetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cambios),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo actualizar el perfil');
  }
}

// Remove member from group (revoke access without deleting account)
export async function removeMemberFromGroup(userId: string) {
  await parcharPerfil(userId, { has_community_access: false });
}

// Restore member access
export async function restoreMemberAccess(userId: string) {
  await parcharPerfil(userId, { has_community_access: true });
}

// Update user role
export async function updateUserRole(userId: string, role: UserRole) {
  await parcharPerfil(userId, { role });
}

// Update user tier
export async function updateUserTier(userId: string, tier: UserTier) {
  await parcharPerfil(userId, { tier });
}

// Delete user (admin only - be careful!)
export async function deleteUser(userId: string) {
  // Get current session token
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('No authenticated session');
  }

  // Use API route with service_role to delete from auth.users
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete user');
  }
}

// Pin/Unpin post
export async function togglePinPost(postId: string, pinned: boolean) {
  const { error } = await supabase.from('posts').update({ pinned }).eq('id', postId);
  if (error) throw error;
}

// Delete post
export async function deletePost(postId: string) {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw error;
}

// Delete course
export async function deleteCourse(courseId: string) {
  const { error } = await supabase.from('courses').delete().eq('id', courseId);
  if (error) throw error;
}

// Delete event
export async function deleteEvent(eventId: string) {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw error;
}

// Get recent activity (posts + comments)
export async function getRecentActivity(limit = 10) {
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select(
      `
      id,
      title,
      content,
      created_at,
      author:profiles!posts_author_id_fkey(full_name, avatar_url)
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (postsError) throw postsError;

  // Process posts to add plain text preview
  const processedPosts = posts?.map(post => ({
    ...post,
    title: post.title || '',
    preview: post.content ? tiptapToPreview(post.content, 100) : ''
  })) || [];

  return processedPosts;
}
