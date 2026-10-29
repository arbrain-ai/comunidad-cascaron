import { NextRequest, NextResponse } from 'next/server';
import { ActionAuthorizationError, requireAdminActionActor } from '@/shared/lib/server-action-auth';
import { getUnifiedAnalytics } from '@/features/admin/services/analyticsService';
import { getCohortAnalytics } from '@/features/admin/services/cohortAnalyticsService';

// Cache duration in seconds (5 minutes)
const CACHE_DURATION = 300;
let cachedData: { data: unknown; timestamp: number } | null = null;

export async function GET(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length);
    if (!token || /\s/.test(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await requireAdminActionActor(token);

    // Check cache (unless ?refresh=true is passed)
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    if (!forceRefresh && cachedData) {
      const cacheAge = (Date.now() - cachedData.timestamp) / 1000;
      if (cacheAge < CACHE_DURATION) {
        const cached = cachedData.data as Record<string, unknown>;
        return NextResponse.json({
          ...cached,
          cached: true,
          cacheAge: Math.round(cacheAge),
        });
      }
    }

    // Fetch all analytics data in parallel
    const [supabaseAnalytics, cohortAnalytics] = await Promise.all([
      getUnifiedAnalytics(),
      getCohortAnalytics(),
    ]);

    const responseData = {
      users: supabaseAnalytics.users,
      engagement: supabaseAnalytics.engagement,
      lastUpdated: supabaseAnalytics.lastUpdated,

      // Cohortes
      cohort: {
        memberGrowth: cohortAnalytics.memberGrowth,
        cohortRetention: cohortAnalytics.cohortRetention,
        activeMembers: cohortAnalytics.activeMembers,
        summary: cohortAnalytics.summary,
      },

      // Metadata
      cached: false,
      generatedAt: new Date().toISOString(),
    };

    // Update cache
    cachedData = {
      data: responseData,
      timestamp: Date.now(),
    };

    return NextResponse.json(responseData);
  } catch (error) {
    if (error instanceof ActionAuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
