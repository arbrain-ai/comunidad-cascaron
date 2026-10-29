import { guardAdminRequest } from '@/shared/lib/admin-route-auth';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminRole, unauthorized, forbidden } from '@/shared/lib/api-auth';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const authFailure = await guardAdminRequest(request);
  if (authFailure) return authFailure;

  try {
    const { userId, isAdmin } = await requireAdminRole();
    if (!userId) return unauthorized();
    if (!isAdmin) return forbidden('Admin role required');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const courseId = (formData.get('courseId') as string | null) || 'new';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: jpeg, png, gif, webp` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum 5MB' }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${courseId}-${Date.now()}.${fileExt}`;
    const filePath = `course-thumbnails/${fileName}`;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: uploadError } = await supabaseAdmin.storage
      .from('course-assets')
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('[upload-course-thumbnail] Upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabaseAdmin.storage.from('course-assets').getPublicUrl(filePath);

    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error('[upload-course-thumbnail] Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
