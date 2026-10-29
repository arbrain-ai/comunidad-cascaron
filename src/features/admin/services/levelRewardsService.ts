// ============================================
// Level Rewards Admin Service
// ============================================
// CRUD para gestionar premios por nivel desde el admin panel

import { supabase } from '@/shared/lib/supabase';

export interface RewardItem {
  title: string;
  description: string;
  icon: string;
}

export interface RepoConfig {
  owner: string;
  name: string;
  displayName: string;
  grantType: string;
}

export interface LevelRewardDB {
  id: string;
  level: number;
  title: string;
  description: string;
  icon: string;
  expanded_title: string | null;
  expanded_description: string | null;
  preview_image_url: string | null;
  rewards: RewardItem[];
  is_active: boolean;
  repo_config: RepoConfig | null;
  agent_rewards: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateLevelRewardInput {
  title?: string;
  description?: string;
  icon?: string;
  expanded_title?: string | null;
  expanded_description?: string | null;
  preview_image_url?: string | null;
  rewards?: RewardItem[];
  is_active?: boolean;
  repo_config?: RepoConfig | null;
  agent_rewards?: string[] | null;
}

/**
 * Obtiene todos los premios de nivel ordenados por nivel
 */
export async function getAllLevelRewards(): Promise<LevelRewardDB[]> {
  
  const { data, error } = await supabase
    .from('level_rewards')
    .select('*')
    .order('level', { ascending: true });

  if (error) {
    console.error('Error fetching level rewards:', error);
    throw error;
  }

  return data || [];
}

/**
 * Obtiene un premio específico por nivel
 */
export async function getLevelRewardByLevel(level: number): Promise<LevelRewardDB | null> {
  
  const { data, error } = await supabase
    .from('level_rewards')
    .select('*')
    .eq('level', level)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No encontrado
    console.error('Error fetching level reward:', error);
    throw error;
  }

  return data;
}

/**
 * Actualiza un premio de nivel
 */
export async function updateLevelReward(
  level: number,
  updates: UpdateLevelRewardInput
): Promise<{ success: boolean; error?: string }> {
  
  const { error } = await supabase
    .from('level_rewards')
    .update(updates)
    .eq('level', level);

  if (error) {
    console.error('Error updating level reward:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Sube una imagen de preview para un nivel
 * Retorna la URL pública de la imagen
 */
export async function uploadPreviewImage(
  level: number,
  file: File
): Promise<{ url: string | null; error?: string }> {
  
  // Generar nombre único para el archivo
  const fileExt = file.name.split('.').pop();
  const fileName = `level-${level}-preview-${Date.now()}.${fileExt}`;
  const filePath = `level-rewards/${fileName}`;

  // Subir archivo al bucket 'media'
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Error uploading preview image:', uploadError);
    return { url: null, error: uploadError.message };
  }

  // Obtener URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('media')
    .getPublicUrl(filePath);

  // Actualizar el registro con la URL
  await updateLevelReward(level, { preview_image_url: publicUrl });

  return { url: publicUrl };
}

/**
 * Elimina la imagen de preview de un nivel
 */
export async function deletePreviewImage(
  level: number,
  currentUrl: string
): Promise<{ success: boolean; error?: string }> {
  
  // Extraer el path del archivo de la URL
  const urlParts = currentUrl.split('/media/');
  if (urlParts.length < 2) {
    return { success: false, error: 'Invalid URL format' };
  }
  const filePath = urlParts[1];

  // Eliminar archivo del bucket 'media'
  const { error: deleteError } = await supabase.storage
    .from('media')
    .remove([filePath]);

  if (deleteError) {
    console.error('Error deleting preview image:', deleteError);
    return { success: false, error: deleteError.message };
  }

  // Limpiar la URL en el registro
  await updateLevelReward(level, { preview_image_url: null });

  return { success: true };
}
