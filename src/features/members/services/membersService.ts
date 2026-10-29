import { supabase } from '@/shared/lib/supabase';
import { MemberProfile, MembersFilter } from '../types';

/**
 * Get all members with optional filters
 * Public directory: profiles with community membership, including active admins and courtesy access.
 * An administrative authorization bypass does not make an old cancelled account a member.
 * Uses pagination to handle >1000 members (Supabase default limit)
 */
export async function getMembers(filters?: MembersFilter): Promise<MemberProfile[]> {
  const PAGE_SIZE = 1000;
  const allData: MemberProfile[] = [];
  let from = 0;

  // Determine sort column
  let orderColumn = 'created_at';
  let orderAscending = false;
  let orderNullsFirst = undefined as boolean | undefined;
  switch (filters?.sortBy) {
    case 'name':
      orderColumn = 'full_name';
      orderAscending = true;
      break;
    case 'online':
      orderColumn = 'last_seen';
      orderAscending = false;
      orderNullsFirst = false;
      break;
  }

  while (true) {
    let query = supabase
      .from('profiles')
      .select('id, full_name, avatar_url, bio, role, tier, created_at, updated_at, last_seen, current_level, location_city, location_country, location_visible')
      .eq('has_community_access', true)
      .range(from, from + PAGE_SIZE - 1)
      .order(orderColumn, { ascending: orderAscending, ...(orderNullsFirst !== undefined ? { nullsFirst: orderNullsFirst } : {}) })
      .order('id', { ascending: true });

    if (filters?.search) {
      query = query.ilike('full_name', `%${filters.search}%`);
    }

    if (filters?.role && filters.role !== 'all') {
      // Treat owners as admins for the public-facing filter so the whole
      // team appears under the same chip.
      if (filters.role === 'admin') {
        query = query.in('role', ['admin', 'owner']);
      } else {
        query = query.eq('role', filters.role);
      }
    }

    if (filters?.onlineOnly) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      query = query.gte('last_seen', fiveMinutesAgo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching members:', error);
      throw error;
    }

    if (!data || data.length === 0) break;
    allData.push(...(data as MemberProfile[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}

/**
 * Get a single member by ID
 */
export async function getMemberById(memberId: string): Promise<MemberProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, bio, role, created_at, updated_at, last_seen')
    .eq('id', memberId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching member:', error);
    throw error;
  }

  return data as MemberProfile;
}

/**
 * Update current user's last_seen timestamp
 * Call this on user activity (page views, interactions)
 */
export async function updateLastSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('Error updating last_seen:', error);
    // Don't throw - this is a background operation
  }
}
