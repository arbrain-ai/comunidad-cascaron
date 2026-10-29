import { Tables } from './database.types';

/**
 * Represents a user profile from the profiles table
 * Extends the database-generated type
 */
export type UserProfile = Tables<'profiles'>;

/**
 * Type for creating a new profile
 */
export type CreateProfileInput = {
  id: string; // auth.uid()
  email: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  role?: 'admin' | 'moderator' | 'member';
};

/**
 * Type for updating an existing profile
 */
export type UpdateProfileInput = Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>;
