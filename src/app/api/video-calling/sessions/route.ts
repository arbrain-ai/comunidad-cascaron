// ============================================
// API Route: Video Sessions
// ============================================
// POST /api/video-calling/sessions - Start/end sessions
// Requires admin role for start, any authenticated user for end (own session)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { awardSessionPoints } from '@/features/video-calling/services/gamificationBridge';

// Perezoso a proposito: creado al importar, esto corre durante el BUILD y
// tumba la compilacion en cualquier entorno sin las variables de Supabase.
const crearSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
let _supabaseAdmin: ReturnType<typeof crearSupabaseAdmin> | null = null;
const supabaseAdmin = () => (_supabaseAdmin ??= crearSupabaseAdmin());

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ).auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, room_id, session_id } = body;

    if (action === 'start') {
      // Admin only
      const { data: profile } = await supabaseAdmin()
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['admin', 'owner'].includes(profile.role)) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      if (!room_id) {
        return NextResponse.json({ error: 'room_id required' }, { status: 400 });
      }

      // End any active sessions for this room
      await supabaseAdmin()
        .from('video_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('room_id', room_id)
        .is('ended_at', null);

      // Start new session
      const { data: session, error: sessionError } = await supabaseAdmin()
        .from('video_sessions')
        .insert({ room_id })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Update room status
      await supabaseAdmin()
        .from('video_rooms')
        .update({ status: 'active' })
        .eq('id', room_id);

      return NextResponse.json({ success: true, data: session }, { status: 201 });
    }

    if (action === 'end') {
      if (!session_id) {
        return NextResponse.json({ error: 'session_id required' }, { status: 400 });
      }

      // Only admin/owner can end sessions
      const { data: callerProfile } = await supabaseAdmin()
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!callerProfile || !['admin', 'owner'].includes(callerProfile.role)) {
        return NextResponse.json({ error: 'Admin access required to end sessions' }, { status: 403 });
      }

      // Get session to find room
      const { data: session } = await supabaseAdmin()
        .from('video_sessions')
        .select('room_id')
        .eq('id', session_id)
        .single();

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // El anfitrion cerro la sesion: las conexiones abiertas se cierran a esta
      // hora (es un hecho: la sesion termino) y quedan marcadas.
      const ahora = new Date().toISOString();
      await supabaseAdmin()
        .from('video_participants')
        .update({ left_at: ahora, nota_calidad: 'cerrado al finalizar la sesion el anfitrion' })
        .eq('session_id', session_id)
        .is('left_at', null);

      // Personas unicas (cada reentrada es una fila; no se cuentan dos veces)
      const { data: filas } = await supabaseAdmin()
        .from('video_participants')
        .select('user_id')
        .eq('session_id', session_id);
      const unicos = new Set((filas ?? []).map((f: { user_id: string }) => f.user_id)).size;

      // End session
      await supabaseAdmin()
        .from('video_sessions')
        .update({
          ended_at: ahora,
          total_unique_participants: unicos,
        })
        .eq('id', session_id);

      // Update room status
      await supabaseAdmin()
        .from('video_rooms')
        .update({ status: 'idle' })
        .eq('id', session.room_id);

      // Award gamification points
      try {
        await awardSessionPoints(session_id, supabaseAdmin());
      } catch (err) {
        console.error('Error awarding points:', err);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action. Use "start" or "end"' }, { status: 400 });
  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
