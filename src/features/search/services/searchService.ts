import { supabase } from '@/shared/lib/supabase';

// Búsqueda por palabras clave directo contra Supabase (RLS aplica: cada
// miembro solo encuentra lo que ya puede ver). Sin embeddings ni índices extra.

export type SearchResultType = 'post' | 'lesson' | 'course' | 'member';

export interface SearchHit {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  url: string;
  metadata?: Record<string, unknown>;
}

const PREVIEW_LENGTH = 140;

function preview(html: string | null | undefined): string {
  if (!html) return '';
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
}

/**
 * Patrón ILIKE seguro: quita los caracteres que rompen la sintaxis de los
 * filtros `.or()` de PostgREST y los comodines de ILIKE.
 */
function toPattern(query: string): string {
  const clean = query.replace(/[%_\\,()"'*]/g, ' ').replace(/\s+/g, ' ').trim();
  return `%${clean}%`;
}

async function searchPosts(pattern: string, limit: number): Promise<SearchHit[]> {
  const { data } = await supabase
    .from('posts')
    .select('id, title, content, author:profiles!posts_author_id_fkey(full_name, avatar_url)')
    .eq('is_draft', false)
    .or(`title.ilike.${pattern},content.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map((p) => {
    const author = p.author as unknown as { full_name: string | null; avatar_url: string | null } | null;
    return {
      id: p.id,
      type: 'post' as const,
      title: p.title || preview(p.content).slice(0, 60) || 'Publicación',
      description: preview(p.content),
      url: `/community?post=${p.id}`,
      metadata: { author_name: author?.full_name ?? undefined, author_avatar: author?.avatar_url ?? undefined },
    };
  });
}

async function searchCourses(pattern: string, limit: number): Promise<SearchHit[]> {
  const { data } = await supabase
    .from('courses')
    .select('id, title, description, thumbnail_url')
    .or(`title.ilike.${pattern},description.ilike.${pattern}`)
    .limit(limit);

  return (data || []).map((c) => ({
    id: c.id,
    type: 'course' as const,
    title: c.title,
    description: preview(c.description),
    url: `/classroom/${c.id}`,
    metadata: { thumbnail_url: c.thumbnail_url ?? undefined },
  }));
}

async function searchLessons(pattern: string, limit: number): Promise<SearchHit[]> {
  const { data } = await supabase
    .from('lessons')
    .select('id, title, content, course_id, course:courses(title)')
    .eq('published', true)
    .ilike('title', pattern)
    .limit(limit);

  return (data || []).map((l) => {
    const course = l.course as unknown as { title: string | null } | null;
    return {
      id: l.id,
      type: 'lesson' as const,
      title: l.title,
      description: preview(l.content),
      url: `/classroom/${l.course_id}?lesson=${l.id}`,
      metadata: { course_title: course?.title ?? undefined },
    };
  });
}

async function searchMembers(pattern: string, limit: number): Promise<SearchHit[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, bio')
    .ilike('full_name', pattern)
    .limit(limit);

  return (data || []).map((m) => ({
    id: m.id,
    type: 'member' as const,
    title: m.full_name || 'Miembro',
    description: preview(m.bio),
    url: `/profile/${m.id}`,
    metadata: { avatar_url: m.avatar_url ?? undefined },
  }));
}

const SEARCHERS: Record<SearchResultType, (pattern: string, limit: number) => Promise<SearchHit[]>> = {
  post: searchPosts,
  course: searchCourses,
  lesson: searchLessons,
  member: searchMembers,
};

/** Busca en posts, cursos, lecciones y miembros. Un fallo parcial no tumba el resto. */
export async function searchCommunity(
  query: string,
  types?: SearchResultType[],
  limitPerType = 6
): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const pattern = toPattern(q);
  if (pattern === '%%') return [];
  const selected = types && types.length > 0 ? types : (Object.keys(SEARCHERS) as SearchResultType[]);

  const settled = await Promise.allSettled(selected.map((t) => SEARCHERS[t](pattern, limitPerType)));
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
