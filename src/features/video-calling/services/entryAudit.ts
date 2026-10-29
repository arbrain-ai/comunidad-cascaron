import { entryRequest } from './entryRequest';
import { createClient } from '@supabase/supabase-js';
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>entryRequest(String(url),options??{},1500)}});
export async function startEntryAttempt(userId:string, roomId:unknown):Promise<string|null> {
  try {
    const id=crypto.randomUUID();
    const room=typeof roomId==='string' && /^[0-9a-f-]{36}$/i.test(roomId)?roomId:null;
    const {error}=await admin().from('video_entry_attempts').insert({id,user_id:userId,room_id:room});
    if(error) {console.error('[entry-audit] start failed',error.code);return null;}return id;
  }catch {console.error('[entry-audit] unavailable');return null;}
}
export async function finishEntryAttempt(id:string|null,status:number,sessionId?:string,code?:string){
  if(!id)return;
  try {const {error}=await admin().from('video_entry_attempts').update({token_status:status<400?'issued':status<500?'denied':'failed',http_status:status,session_id:sessionId??null,error_code:code?.slice(0,80)??null,updated_at:new Date().toISOString()}).eq('id',id);if(error)console.error('[entry-audit] finish failed',error.code);}catch{console.error('[entry-audit] unavailable');}
}
