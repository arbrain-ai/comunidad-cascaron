/**
 * /api/course-loves — "me encanta" de un curso (cursos v2, 30 ago 2026).
 *
 * GET  ?courseId=…  → { total, mio, caras: [{id, name, avatar}] }   (las 12 más recientes)
 * POST { courseId } → alterna el me encanta del usuario → { total, mio }
 *
 * Reemplaza los comentarios de lección (muertos: 19 en 30 días contra 3,205 en posts) por una
 * señal barata que sí se ve al pie de cada lección: cuántos y quiénes aman el curso.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/shared/lib/supabase-server';

async function resumen(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, courseId: string, userId: string | null) {
  const { count } = await supabase.from('course_loves').select('user_id', { count: 'exact', head: true }).eq('course_id', courseId);
  const { data: filas } = await supabase
    .from('course_loves')
    .select('user_id, created_at, profiles:user_id(id, full_name, avatar_url)')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .limit(12);
  let mio = false;
  if (userId) {
    const { data } = await supabase.from('course_loves').select('user_id').eq('course_id', courseId).eq('user_id', userId).maybeSingle();
    mio = !!data;
  }
  const caras = (filas || []).map((f) => {
    const p = (Array.isArray(f.profiles) ? f.profiles[0] : f.profiles) as { id: string; full_name: string | null; avatar_url: string | null } | null;
    return { id: p?.id ?? f.user_id, name: p?.full_name ?? '', avatar: p?.avatar_url ?? null };
  });
  return { total: count ?? 0, mio, caras };
}

export async function GET(req: Request) {
  const courseId = new URL(req.url).searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'courseId requerido' }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json(await resumen(supabase, courseId, user?.id ?? null));
}

export async function POST(req: Request) {
  const { courseId } = (await req.json().catch(() => ({}))) as { courseId?: string };
  if (!courseId) return NextResponse.json({ error: 'courseId requerido' }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'sin sesión' }, { status: 401 });
  const { data: existe } = await supabase.from('course_loves').select('user_id').eq('course_id', courseId).eq('user_id', user.id).maybeSingle();
  if (existe) {
    await supabase.from('course_loves').delete().eq('course_id', courseId).eq('user_id', user.id);
  } else {
    const { error } = await supabase.from('course_loves').insert({ course_id: courseId, user_id: user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(await resumen(supabase, courseId, user.id));
}
