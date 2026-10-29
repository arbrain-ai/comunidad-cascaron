'use client';

import { useState, useMemo, useCallback } from 'react';
import type { MembersFilter } from '../types';
import { filterMembers } from '../services/memberSnapshot';
import { useMemberDirectory } from './useMemberDirectory';

export function useMembers(initialFilters?: MembersFilter) {
  const [filters, setFilters] = useState<MembersFilter>(initialFilters || { sortBy: 'online' });
  const directory = useMemberDirectory();
  const members = useMemo(
    () => filterMembers(directory.rows, filters, directory.updatedAt),
    [directory.rows, directory.updatedAt, filters],
  );
  const updateFilters = useCallback((next: Partial<MembersFilter>) => {
    setFilters(previous => ({ ...previous, ...next }));
  }, []);
  return { countsAvailable: directory.updatedAt > 0, members, counts: directory.counts, isLoading: directory.loading,
    error: directory.error, filters, updateFilters, refreshMembers: directory.refresh };
}
