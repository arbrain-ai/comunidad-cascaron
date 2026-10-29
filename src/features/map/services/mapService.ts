import { supabase } from '@/shared/lib/supabase';
import { MemberLocation, LocationInput } from '../types';

/**
 * Fetch all members with visible locations for the map
 * Note: Only includes active members (free/standard/vip tier) - excludes non-paid users
 */
export async function getMembersWithLocation(): Promise<MemberLocation[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, bio, last_seen, location_city, location_country, location_lat, location_lng')
    .eq('location_visible', true)
    .not('location_lat', 'is', null)
    .not('location_lng', 'is', null)
    // Only include active members (free, standard, or vip tier)
    .in('tier', ['free', 'standard', 'vip']);

  if (error) {
    console.error('Error fetching members with location:', error);
    throw error;
  }

  return (data || []) as MemberLocation[];
}

/**
 * Update user's location in profile
 */
export async function updateUserLocation(
  userId: string,
  location: LocationInput | null
): Promise<void> {
  const updateData = location
    ? {
        location_city: location.city,
        location_country: location.country,
        location_lat: location.lat,
        location_lng: location.lng,
      }
    : {
        location_city: null,
        location_country: null,
        location_lat: null,
        location_lng: null,
      };

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error('Error updating user location:', error);
    throw error;
  }
}

/**
 * Toggle location visibility for a user
 */
export async function toggleLocationVisibility(
  userId: string,
  visible: boolean
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ location_visible: visible })
    .eq('id', userId);

  if (error) {
    console.error('Error toggling location visibility:', error);
    throw error;
  }
}

/**
 * Get current user's location settings
 */
export async function getUserLocationSettings(userId: string): Promise<{
  location_city: string | null;
  location_country: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_visible: boolean;
} | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('location_city, location_country, location_lat, location_lng, location_visible')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user location settings:', error);
    return null;
  }

  return data;
}
