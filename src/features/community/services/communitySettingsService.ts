import { supabase } from '@/shared/lib/supabase';

export interface CommunitySettings {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function getCommunitySettings(): Promise<CommunitySettings | null> {
  const { data, error } = await supabase
    .from('community_settings')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching community settings:', error);
    return null;
  }

  return data;
}

export async function updateCommunitySettings(
  updates: Partial<Pick<CommunitySettings, 'name' | 'description' | 'cover_image_url' | 'logo_url'>>
): Promise<CommunitySettings | null> {
  // Get the single settings row
  const { data: existing } = await supabase
    .from('community_settings')
    .select('id')
    .limit(1)
    .single();

  if (!existing) {
    console.error('No community settings found');
    return null;
  }

  const { data, error } = await supabase
    .from('community_settings')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating community settings:', error);
    throw error;
  }

  return data;
}

export async function uploadCommunityImage(
  file: File,
  type: 'cover' | 'logo'
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `community-${type}-${Date.now()}.${fileExt}`;
  const filePath = `community/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Error uploading image:', uploadError);
    throw uploadError;
  }

  const { data: urlData } = supabase.storage
    .from('media')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}
