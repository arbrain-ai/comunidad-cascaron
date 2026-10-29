import { Tables } from '@/shared/types/database.types';

export type UserProfile = Tables<'profiles'>;
export type Post = Tables<'posts'>;
export type Course = Tables<'courses'>;
export type Event = Tables<'events'>;

export interface AdminStats {
  totalUsers: number;
  totalPosts: number;
  totalCourses: number;
  totalEvents: number;
  newUsersThisWeek: number;
  newPostsThisWeek: number;
}

export interface UserWithStats extends UserProfile {
  post_count?: number;
  comment_count?: number;
}

export type UserRole = 'owner' | 'admin' | 'moderator' | 'member' | 'agent';
export type UserTier = 'no-paid' | 'free' | 'standard' | 'vip';
