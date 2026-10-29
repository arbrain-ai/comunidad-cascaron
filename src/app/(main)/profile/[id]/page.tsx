'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MapPin, Calendar, Edit, Github } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { ActivityHeatmap, ActivityLegend } from '@/shared/components/ActivityHeatmap';
import { ExpandableAvatar } from '@/shared/components/ExpandableAvatar';
import { getUserActivity, getUserStats, type UserActivityData, type UserStats } from '@/features/profile/services/activityService';


interface PublicProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  tier: string;
  created_at: string;
  last_seen: string | null;
  location_city: string | null;
  location_country: string | null;
  github_username: string | null;
  current_level: number | null;
  total_points: number | null;
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const { userProfile: currentUser } = useUserProfile();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [activity, setActivity] = useState<UserActivityData | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, bio, role, tier, created_at, last_seen, location_city, location_country, github_username, current_level, total_points')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;
        if (!profileData) throw new Error('Perfil no encontrado');

        setProfile(profileData);

        const [activityData, statsData] = await Promise.all([
          getUserActivity(userId, 365),
          getUserStats(userId),
        ]);

        setActivity(activityData);
        setStats(statsData);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('No se pudo cargar el perfil');
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      loadProfile();
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="glass-panel p-8 rounded-xl text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Perfil no encontrado</h1>
          <p className="text-muted mb-4">{error || 'El usuario no existe o ha sido eliminado.'}</p>
          <Link href="/members" className="text-primary hover:underline">
            Ver todos los miembros
          </Link>
        </div>
      </div>
    );
  }

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : null;

  const totalContributions = (stats?.posts_count || 0) + (stats?.comments_count || 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">

        {/* ===== LEFT SIDEBAR (GitHub style) ===== */}
        <div className="md:w-72 lg:w-80 flex-shrink-0">
          {/* Avatar */}
          <div className="relative">
            <ExpandableAvatar
              src={profile.avatar_url}
              alt={profile.full_name}
              fallbackInitial={profile.full_name?.charAt(0)}
              size="xl"
            />
            {/* Role badge */}
            {profile.role !== 'member' && (
              <span className={`absolute bottom-2 right-2 px-2.5 py-1 text-xs font-bold rounded-full ${
                profile.role === 'admin'
                  ? 'bg-red-500 text-white'
                  : 'bg-blue-500 text-white'
              }`}>
                {profile.role === 'admin' ? 'ADMIN' : 'MOD'}
              </span>
            )}
          </div>

          {/* Name & Level */}
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-foreground">{profile.full_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                isOwnProfile
                  ? 'es-vivo bg-gold/15 border-gold/40'
                  : 'bg-primary/20 text-primary border-primary/30'
              }`}>
                Nivel {profile.current_level || 1}
              </span>
              <span className={`text-sm ${isOwnProfile ? 'es-tuyo' : 'text-muted'}`}>
                {(profile.total_points || 0).toLocaleString()} puntos
              </span>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-muted text-sm mt-3 leading-relaxed">{profile.bio}</p>
          )}

          {/* Action button */}
          <div className="mt-4">
            {isOwnProfile ? (
              <Link
                href="/profile"
                className="btn-secondary w-full"
              >
                <Edit className="w-4 h-4" />
                Editar perfil
              </Link>
            ) : null}
          </div>

          {/* Meta info */}
          <div className="mt-4 space-y-2 text-sm text-muted">
            {(profile.location_city || profile.location_country) && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>{[profile.location_city, profile.location_country].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {joinedDate && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>Miembro desde {joinedDate}</span>
              </div>
            )}
            {profile.github_username && (
              <a
                href={`https://github.com/${profile.github_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Github className="w-4 h-4 flex-shrink-0" />
                <span>{profile.github_username}</span>
              </a>
            )}
          </div>

          {/* ===== LOGROS ===== */}
        </div>

        {/* ===== RIGHT CONTENT ===== */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="sup p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{totalContributions}</div>
              <div className="text-xs text-muted uppercase">Contribuciones</div>
            </div>
            <div className="sup p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{stats?.posts_count || 0}</div>
              <div className="text-xs text-muted uppercase">Posts</div>
            </div>
            <div className="sup p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{stats?.comments_count || 0}</div>
              <div className="text-xs text-muted uppercase">Comentarios</div>
            </div>
            <div className="sup p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{stats?.lessons_completed || 0}</div>
              <div className="text-xs text-muted uppercase">Lecciones</div>
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="sup p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Actividad</h2>
                <p className="text-sm text-muted">
                  {totalContributions} contribuciones en el ultimo ano
                </p>
              </div>
              <ActivityLegend />
            </div>
            {activity && <ActivityHeatmap activity={activity.activity} showLegend={false} />}
          </div>

          {/* Recent Posts */}
          <div className="sup p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Posts</h2>
            <RecentPostsList userId={userId} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-component for recent posts with pagination
const POSTS_PAGE_SIZE = 10;

function RecentPostsList({ userId }: { userId: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadPosts = async (offset: number) => {
    const { data } = await supabase
      .from('posts')
      .select('id, title, content, created_at, likes_count, comments_count, category:categories(name, color, emoji)')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + POSTS_PAGE_SIZE - 1);

    return data || [];
  };

  useEffect(() => {
    async function init() {
      const data = await loadPosts(0);
      setPosts(data);
      setHasMore(data.length === POSTS_PAGE_SIZE);
      setLoading(false);
    }
    init();
  }, [userId]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const data = await loadPosts(posts.length);
    setPosts(prev => [...prev, ...data]);
    setHasMore(data.length === POSTS_PAGE_SIZE);
    setLoadingMore(false);
  };

  if (loading) {
    return <div className="animate-pulse h-20 bg-surface/50 rounded-lg" />;
  }

  if (posts.length === 0) {
    return <p className="text-muted text-sm">Este usuario aun no ha publicado nada.</p>;
  }

  const stripHtml = (html: string) => html?.replace(/<[^>]*>/g, '') || '';

  return (
    <div className="space-y-3">
      {posts.map(post => (
        <Link
          key={post.id}
          href={`/community?post=${post.id}`}
          className="block p-4 rounded-lg bg-surface/30 hover:bg-surface/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {post.title && (
                <h3 className="font-medium text-foreground truncate">{stripHtml(post.title)}</h3>
              )}
              <p className="text-sm text-muted line-clamp-1 mt-1">
                {stripHtml(post.content).substring(0, 100)}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted flex-shrink-0">
              <span>{post.likes_count || 0} likes</span>
              <span>{post.comments_count || 0} comentarios</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {post.category && (
              <span
                className="px-2 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: post.category.color ? `${post.category.color}20` : 'rgba(var(--primary-rgb), 0.18)',
                  color: post.category.color || 'var(--primary)'
                }}
              >
                {post.category.emoji} {post.category.name}
              </span>
            )}
            <span className="text-xs text-muted">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: es })}
            </span>
          </div>
        </Link>
      ))}

      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full py-3 text-sm font-medium text-primary hover:text-primary/80 bg-surface/30 hover:bg-surface/50 border border-border/30 rounded-lg transition-colors disabled:opacity-50"
        >
          {loadingMore ? 'Cargando...' : 'Ver siguientes 10 posts'}
        </button>
      )}
    </div>
  );
}
