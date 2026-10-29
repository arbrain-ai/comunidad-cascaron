import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserId } from '@/shared/lib/api-auth';
export async function POST(request:NextRequest){
 const uid=await getAuthenticatedUserId();if(!uid)return NextResponse.json({error:'Unauthorized'},{status:401});
 let body;try{body=await request.json();}catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
 if(typeof body?.attempt_id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.attempt_id)||!['connected','failed','disconnected'].includes(body.status))return NextResponse.json({error:'Invalid event'},{status:400});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
 const {error}=await db.from('video_entry_attempts').update({client_status:body.status,updated_at:new Date().toISOString()}).eq('id',body.attempt_id).eq('user_id',uid);
 return NextResponse.json({ok:!error},{status:error?503:200});
}
