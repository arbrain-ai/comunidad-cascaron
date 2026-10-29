'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  getUsers,
  updateUserRole,
  updateUserTier,
  deleteUser,
  removeMemberFromGroup,
  restoreMemberAccess,
} from '../services/adminService';
import { UserRole, UserTier, UserWithStats } from '../types';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { canModifyUserRole, canDeleteUser } from '@/shared/constants/roles';

const PAGE_SIZE = 20;
const ROLES: UserRole[] = ['member', 'moderator', 'admin', 'owner'];
const TIERS: UserTier[] = ['no-paid', 'standard', 'vip'];

// Gestion de miembros: rol, tier, acceso a la comunidad y baja.
// El acceso vive en profiles.has_community_access; si conectas una pasarela
// de pago, su webhook es quien deberia escribir ese campo.
export function UserManagement() {
  const { userProfile: currentUser } = useUserProfile();
  const [members, setMembers] = useState<UserWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const loadMembers = async (): Promise<void> => {
    try {
      setMembers(await getUsers());
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.full_name].some((v) => v?.toLowerCase().includes(q))
    );
  }, [members, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const run = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
      await loadMembers();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error desconocido');
    }
  };

  const handleRoleChange = (member: UserWithStats, role: UserRole): void => {
    if (!currentUser || !canModifyUserRole(currentUser.role, member.role, role)) {
      alert('No tienes permisos para realizar este cambio de rol');
      return;
    }
    run(() => updateUserRole(member.id, role));
  };

  const handleAccessToggle = (member: UserWithStats): void => {
    run(() =>
      member.has_community_access ? removeMemberFromGroup(member.id) : restoreMemberAccess(member.id)
    );
  };

  const handleDelete = (member: UserWithStats): void => {
    if (!confirm(`¿Eliminar la cuenta de ${member.full_name}? No se puede deshacer.`)) return;
    run(() => deleteUser(member.id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="bg-card p-4 md:p-6 rounded-xl border border-border">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-black text-foreground">Miembros ({filtered.length})</h2>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por nombre o usuario"
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
        />
      </div>

      <div className="space-y-2">
        {visible.map((member) => (
          <div
            key={member.id}
            className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg border border-border/50"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground truncate">{member.full_name}</p>
                {!member.has_community_access && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-error/20 text-error">Sin acceso</span>
                )}
              </div>
              <p className="text-xs text-muted">
                Nivel {member.current_level ?? 1} · {member.total_points ?? 0} pts
                {member.created_at &&
                  ` · se unio ${formatDistanceToNow(new Date(member.created_at), { addSuffix: true, locale: es })}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={member.role}
                onChange={(e) => handleRoleChange(member, e.target.value as UserRole)}
                className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <select
                value={member.tier ?? 'no-paid'}
                onChange={(e) => run(() => updateUserTier(member.id, e.target.value as UserTier))}
                className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground"
              >
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </select>
              <button
                onClick={() => handleAccessToggle(member)}
                className="px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-background"
              >
                {member.has_community_access ? 'Quitar acceso' : 'Dar acceso'}
              </button>
              {currentUser && canDeleteUser(currentUser.role, member.role) && member.id !== currentUser.id && (
                <button
                  onClick={() => handleDelete(member)}
                  className="px-3 py-1.5 rounded-lg text-xs text-error border border-error/30 hover:bg-error/10"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">
            Anterior
          </button>
          <span className="text-muted">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="disabled:opacity-40">
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
