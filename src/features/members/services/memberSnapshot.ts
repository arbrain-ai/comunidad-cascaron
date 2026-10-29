import type { MemberProfile, MembersFilter } from '../types';

export function summarizeMembers(rows: MemberProfile[], now: number) {
  const online = rows.filter(row => row.last_seen && Date.parse(row.last_seen) > now - 300_000);
  return {
    counts: {
      total: rows.length,
      admins: rows.filter(row => row.role === 'admin' || row.role === 'owner').length,
      moderators: rows.filter(row => row.role === 'moderator').length,
      members: rows.filter(row => row.role === 'member').length,
      online: online.length,
    },
    onlineAvatars: [...online].sort((a, b) => (b.last_seen ?? '').localeCompare(a.last_seen ?? '')).slice(0, 10),
  };
}

export function filterMembers(rows: MemberProfile[], filters: MembersFilter, now: number): MemberProfile[] {
  const search = filters.search?.trim().toLocaleLowerCase();
  return rows.filter(row => {
    if (search && !row.full_name?.toLocaleLowerCase().includes(search)) return false;
    if (filters.role && filters.role !== 'all') {
      const matches = filters.role === 'admin'
        ? row.role === 'admin' || row.role === 'owner' : row.role === filters.role;
      if (!matches) return false;
    }
    return !filters.onlineOnly || !!row.last_seen && Date.parse(row.last_seen) > now - 300_000;
  }).sort((a, b) => {
    if (filters.sortBy === 'name') return (a.full_name ?? '').localeCompare(b.full_name ?? '');
    const field = filters.sortBy === 'online' ? 'last_seen' : 'created_at';
    return (b[field] ?? '').localeCompare(a[field] ?? '');
  });
}
