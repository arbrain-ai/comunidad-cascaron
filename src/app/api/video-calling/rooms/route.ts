// ============================================
// API Route: Video Rooms CRUD
// ============================================
// GET /api/video-calling/rooms - List rooms
// POST /api/video-calling/rooms - Create room (admin only)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Perezoso a proposito: creado al importar, esto corre durante el BUILD y
// tumba la compilacion en cualquier entorno sin las variables de Supabase.
const crearSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
let _supabaseAdmin: ReturnType<typeof crearSupabaseAdmin> | null = null;
const supabaseAdmin = () => (_supabaseAdmin ??= crearSupabaseAdmin());

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabaseAdmin()
      .from('video_rooms')
      .select(`
        *,
        creator:created_by(id, full_name, avatar_url),
        room_settings:video_room_settings(*)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('List rooms error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    // Verify admin role
    const { data: profile } = await supabaseAdmin()
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, event_id, room_type, max_participants, settings, slug: customSlug } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Custom slug validation or generate random
    let slug: string;
    if (customSlug) {
      // Validate format: lowercase alphanumeric + hyphens, 3-60 chars
      const slugRegex = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;
      if (!slugRegex.test(customSlug)) {
        return NextResponse.json(
          { error: 'Slug invalido. Usa solo letras minusculas, numeros y guiones (3-60 caracteres).' },
          { status: 400 }
        );
      }
      // Check uniqueness
      const { data: existing } = await supabaseAdmin()
        .from('video_rooms')
        .select('id')
        .eq('slug', customSlug)
        .maybeSingle();
      if (existing) {
        return NextResponse.json(
          { error: 'Este slug ya esta en uso. Elige otro.' },
          { status: 409 }
        );
      }
      slug = customSlug;
    } else {
      slug = Math.random().toString(36).substring(2, 10);
    }

    const { data: room, error: roomError } = await supabaseAdmin()
      .from('video_rooms')
      .insert({
        name,
        slug,
        event_id: event_id || null,
        room_type: room_type || 'event',
        max_participants: max_participants || 100,
        created_by: user.id,
        livekit_room_name: `room_${slug}`,
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // Create room settings
    await supabaseAdmin()
      .from('video_room_settings')
      .insert({
        room_id: room.id,
        ...(settings || {}),
      });

    return NextResponse.json({ success: true, data: room }, { status: 201 });
  } catch (error) {
    console.error('Create room error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
