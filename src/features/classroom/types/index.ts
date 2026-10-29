import { Tables } from '@/shared/types/database.types';

// Base types from database
export type BaseCourse = Tables<'courses'>;
export type BaseFolder = Tables<'folders'>;
export type BaseLesson = Tables<'lessons'>;
export type LessonProgress = Tables<'lesson_progress'>;

// Extended types to match actual DB schema (until types are regenerated)
export interface Folder extends Omit<BaseFolder, 'module_id' | 'course_id' | 'published'> {
  module_id?: string | null;
  course_id?: string | null;
  published?: boolean;  // DEFAULT true - si false, el folder y sus lessons son borrador
}

export interface Lesson extends Omit<BaseLesson, 'folder_id' | 'course_id' | 'published' | 'content_format' | 'content_v2' | 'search_text'> {
  /** Marcador hacia la página HTML completa de la lección (formato 'html'). */
  content_v2?: string | null;
  folder_id: string | null;
  course_id?: string | null;
  published?: boolean;  // DEFAULT true - si false, la lesson es borrador
  linked_post_id: string | null;  // DRY: cuando existe, muestra el post embebido en lugar de content
  /**
   * Classroom v2 — motor de render del contenido.
   *  'tiptap' (DEFAULT): HTML del editor, renderizado por PageEditor.
   *  'html': página HTML completa, renderizada por LessonHtml.
   */
  content_format?: 'tiptap' | 'html';
  /** Espejo de texto plano para búsqueda (lecciones-cápsula, fase 2). */
  search_text?: string | null;
}

// Tier system types (VIP salta requisitos de nivel)
export type UserTier = 'standard' | 'vip';

// New 5-option access system (Skool-like)
export type CourseAccessType = 'open' | 'level_unlock' | 'buy_now' | 'time_unlock' | 'private';

// Extended Course type with new access fields
export interface Course extends Omit<BaseCourse, 'access_type' | 'unlock_level' | 'price_cents' | 'unlock_after_days' | 'tier_bypass_enabled' | 'tier_bypass_min'> {
  access_type?: CourseAccessType;
  // Conditional fields for access types
  unlock_level?: number | null;      // For level_unlock (1-9)
  price_cents?: number | null;        // For buy_now
  unlock_after_days?: number | null;  // For time_unlock
  // Tier bypass: los VIP pueden saltar restricciones
  tier_bypass_enabled?: boolean;
  tier_bypass_min?: 'standard' | 'vip' | null;
}

// Course access grant (permanent access)
export type GrantType =
  | 'premium_90_days_milestone'  // User completed 90 days as premium
  | 'admin_grant'                // Manually granted by admin
  | 'purchase'                   // One-time purchase grant
  | 'scholarship'                // Scholarship or promotion
  | 'contest_prize';             // Won in a contest

export interface CourseAccessGrant {
  id: string;
  user_id: string;
  course_id: string;
  grant_type: GrantType;
  granted_at: string;
  granted_by?: string | null;
  metadata?: Record<string, any>;
  expires_at?: string | null;  // NULL = permanent
  created_at: string;
  updated_at: string;
}

// Simplified structure for Skool-like UI
export interface FolderWithLessons extends Folder {
  lessons: Lesson[];
}

export interface CourseWithContent extends Course {
  folders: FolderWithLessons[];
  standaloneLessons: Lesson[];
}

export interface LessonWithProgress extends Lesson {
  progress?: LessonProgress | null;
}

// Drag & drop types
export type DraggableType = 'folder' | 'lesson';

export interface DragItem {
  id: string;
  type: DraggableType;
  folderId?: string | null; // For lessons: which folder they belong to
}
