'use client';

import Link from 'next/link';
import { MembersFilter as FilterType } from '../types';
import { hasAdminAccess } from '@/shared/constants/roles';

interface MembersFilterProps {
  filters: FilterType;
  onFilterChange: (filters: Partial<FilterType>) => void;
  counts: {
    total: number;
    admins: number;
    moderators: number;
    members: number;
    online: number;
  };
  userRole?: string;
  countsAvailable?: boolean;
}

export function MembersFilter({ filters, onFilterChange, counts, userRole, countsAvailable = true }: MembersFilterProps) {
  const isAdmin = hasAdminAccess(userRole || '');

  return (
    <div className="space-y-4">
      {/* Stats pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onFilterChange({ role: 'all', onlineOnly: false })}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            (filters.role === 'all' || !filters.role) && !filters.onlineOnly
              ? 'bg-primary text-white'
              : 'bg-surface border border-border text-foreground hover:bg-surface-elevated'
          }`}
        >
          Todos {countsAvailable ? counts.total : '—'}
        </button>

        <button
          onClick={() => onFilterChange({ role: 'admin', onlineOnly: false })}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filters.role === 'admin'
              ? 'bg-red-500/80 text-white'
              : 'bg-surface border border-border text-foreground hover:bg-surface-elevated'
          }`}
        >
          Admins {countsAvailable ? counts.admins : '—'}
        </button>

        <button
          onClick={() => onFilterChange({ onlineOnly: !filters.onlineOnly, role: 'all' })}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filters.onlineOnly
              ? 'bg-green-500/80 text-white'
              : 'bg-surface border border-border text-green-400 hover:bg-surface-elevated'
          }`}
        >
          Online {countsAvailable ? counts.online : '—'}
        </button>

        {/* Admin Panel button - only visible to owners */}
        {isAdmin && (
          <Link
            href="/admin?tab=users"
            className="ml-auto px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Gestionar
          </Link>
        )}
      </div>

      {/* Search and sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Buscar miembros..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Sort */}
        <select
          value={filters.sortBy || 'online'}
          onChange={(e) => onFilterChange({ sortBy: e.target.value as FilterType['sortBy'] })}
          className="px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="online">Online primero</option>
          <option value="recent">Recientes</option>
          <option value="name">Nombre A-Z</option>
        </select>
      </div>
    </div>
  );
}
