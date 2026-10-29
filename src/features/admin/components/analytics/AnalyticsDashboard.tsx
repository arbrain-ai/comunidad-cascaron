'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { MetricCard, AlertMetricCard } from './MetricCard';
import { TopContributorsTable } from './TopContributorsTable';
import { MemberGrowthChart } from './MemberGrowthChart';
import { CohortRetentionTable } from './CohortRetentionTable';
import { ActiveMembersChart } from './ActiveMembersChart';
import type { UnifiedAnalytics } from '@/features/admin/services/analyticsService';
import type {
  MemberGrowthData,
  CohortRow,
  ActiveMembersData,
} from '@/features/admin/services/cohortAnalyticsService';

interface AnalyticsDashboardProps {
  onNavigateToUsers?: () => void;
}

type AnalyticsTab = 'overview' | 'members' | 'retention';

interface CohortData {
  memberGrowth: MemberGrowthData[];
  cohortRetention: CohortRow[];
  activeMembers: ActiveMembersData;
  summary: {
    totalMembers: number;
    activeMembers: number;
    activePct: number;
    changeText: string;
  };
}

interface ExtendedAnalytics extends UnifiedAnalytics {
  cohort?: CohortData;
}

// Format large numbers
const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export function AnalyticsDashboard({ onNavigateToUsers }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<ExtendedAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');

  const fetchAnalytics = useCallback(async (refresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Get auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('No autenticado');
        return;
      }

      const url = `/api/admin/analytics${refresh ? '?refresh=true' : ''}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al cargar analytics');
      }

      const data = await response.json();
      setAnalytics(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[AnalyticsDashboard] Error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Loading state
  if (isLoading && !analytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-foreground">Analytics Dashboard</h2>
        </div>
        <div className="glass-panel-strong rounded-xl p-6 h-[100px] animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-panel rounded-xl p-6 h-[100px] animate-pulse" />
          ))}
        </div>
        <div className="glass-panel rounded-xl p-6 h-[350px] animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="text-error font-medium mb-2">{error}</p>
        <button
          onClick={() => fetchAnalytics(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!analytics) return null;

  const { users, engagement, cohort } = analytics;

  const tabs: { value: AnalyticsTab; label: string }[] = [
    { value: 'overview', label: 'Resumen' },
    { value: 'members', label: 'Members' },
    { value: 'retention', label: 'Engagement cohorts' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-foreground">Analytics Dashboard</h2>
          {lastUpdated && (
            <p className="text-xs text-muted mt-1">
              Actualizado:{' '}
              {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={() => fetchAnalytics(true)}
          disabled={isLoading}
          className={`
            flex items-center gap-2 px-4 py-2
            glass-panel rounded-lg border border-glass-border
            hover:border-glass-border-strong
            transition-all duration-200
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <svg
            className={`w-4 h-4 text-muted ${isLoading ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span className="text-sm text-foreground">Actualizar</span>
        </button>
      </div>

      {/* Top Metrics Row - Always visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{cohort?.summary.totalMembers || users.total}</p>
          <p className="text-xs text-muted mt-1">Members</p>
        </div>
        <div className="glass-panel rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{users.withAccess}</p>
          <p className="text-xs text-muted mt-1">Con acceso</p>
        </div>
        <div className="glass-panel rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{users.newLast30d}</p>
          <p className="text-xs text-muted mt-1">Nuevos 30d</p>
        </div>
        <div className="glass-panel rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{cohort?.summary.activePct || 0}%</p>
          <p className="text-xs text-muted mt-1">Retention</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${
                activeTab === tab.value
                  ? 'solid-card text-foreground'
                  : 'text-muted hover:text-foreground hover:bg-card/50'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'members' && cohort && (
        <div className="space-y-6">
          {/* Member Growth Chart */}
          <MemberGrowthChart data={cohort.memberGrowth} title="Members" />

          {/* Active Members Chart */}
          <ActiveMembersChart data={cohort.activeMembers} summary={cohort.summary} />
        </div>
      )}

      {activeTab === 'retention' && cohort && (
        <div className="space-y-6">
          {/* Cohort Retention Table */}
          <CohortRetentionTable data={cohort.cohortRetention} title="Engagement cohorts" />
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Miembros"
              value={formatNumber(users.total)}
              subtitle={`+${users.newLast7d} esta semana`}
              trend={{
                value: users.accessRate,
                label: 'con acceso',
              }}
              variant="primary"
            />

            <AlertMetricCard
              title="Engagement 30d"
              count={engagement.postsLast30d + engagement.commentsLast30d}
              description={`${engagement.postsLast30d} posts, ${engagement.commentsLast30d} comentarios`}
              severity="info"
            />

            <AlertMetricCard
              title="Lecciones completadas"
              count={engagement.lessonsCompletedLast30d}
              description={`${engagement.totalLessonProgress} total histórico`}
              severity="info"
            />
          </div>

          <TopContributorsTable contributors={engagement.topContributors} onViewUser={onNavigateToUsers ? () => onNavigateToUsers() : undefined} />
        </div>
      )}
    </div>
  );
}
