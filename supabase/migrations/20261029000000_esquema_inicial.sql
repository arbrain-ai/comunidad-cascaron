-- ============================================================
-- Esquema inicial de la comunidad. Aplicalo una vez sobre un proyecto de Supabase vacio.
-- ============================================================

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
-- Sin politicas: solo service_role y funciones SECURITY DEFINER la leen.
alter table public.app_config enable row level security;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_net with schema extensions;


-- ---------------- Tablas ----------------
create table if not exists public."admin_email_broadcast_log" (
  "id" uuid default gen_random_uuid() not null,
  "post_id" uuid,
  "notification_id" uuid,
  "status" text not null,
  "recipients_total" integer default 0 not null,
  "sent" integer default 0 not null,
  "failed" integer default 0 not null,
  "errors" jsonb default '[]'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public."categories" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "slug" text not null,
  "color" text default '#683ACC'::text,
  "description" text,
  "order_position" integer default 0,
  "created_at" timestamp with time zone default now(),
  "emoji" text default ''::text,
  "permissions" text default 'members'::text,
  "sort_method" text default 'default'::text
);
create table if not exists public."comments" (
  "id" uuid default gen_random_uuid() not null,
  "post_id" uuid,
  "author_id" uuid,
  "content" text not null,
  "likes_count" integer default 0,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "parent_id" uuid,
  "media_urls" jsonb default '[]'::jsonb,
  "video_embed_url" text,
  "agent_id" uuid,
  "audio_url" text,
  "lesson_id" uuid
);
create table if not exists public."community_settings" (
  "id" uuid default gen_random_uuid() not null,
  "name" text default 'Mi Comunidad'::text not null,
  "description" text default 'Aprende, comparte y crece con tu comunidad'::text,
  "cover_image_url" text,
  "logo_url" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
create table if not exists public."course_access_grants" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "course_id" uuid not null,
  "grant_type" text not null,
  "granted_at" timestamp with time zone default now() not null,
  "granted_by" uuid,
  "metadata" jsonb default '{}'::jsonb,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
create table if not exists public."course_loves" (
  "course_id" uuid not null,
  "user_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public."courses" (
  "id" uuid default gen_random_uuid() not null,
  "title" text not null,
  "description" text,
  "thumbnail_url" text,
  "created_by" uuid not null,
  "published" boolean default false,
  "order_position" integer default 0,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "access_type" text default 'open'::text not null,
  "unlock_level" integer,
  "price_cents" integer,
  "unlock_after_days" integer,
  "tier_bypass_enabled" boolean default false,
  "tier_bypass_min" text
);
create table if not exists public."event_reminders" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid not null,
  "user_id" uuid not null,
  "lead_minutes" integer default 15 not null,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public."event_series" (
  "id" uuid default gen_random_uuid() not null,
  "title" text not null,
  "description" text,
  "rrule" text not null,
  "timezone" text default 'America/Mexico_City'::text not null,
  "duration_minutes" integer default 60 not null,
  "host_id" uuid not null,
  "cover_image_url" text,
  "required_level" smallint default 1 not null,
  "required_tier" text default 'standard'::text not null,
  "visible_to_tier" text default 'standard'::text not null,
  "use_native_room" boolean default true not null,
  "status" text default 'activa'::text not null,
  "created_by" uuid not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table if not exists public."events" (
  "id" uuid default gen_random_uuid() not null,
  "title" text not null,
  "description" text,
  "start_time" timestamp with time zone not null,
  "end_time" timestamp with time zone,
  "google_meet_link" text,
  "created_by" uuid not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "cover_image_url" text,
  "duration_minutes" integer default 60,
  "is_recurring" boolean default false,
  "recurrence_pattern" jsonb,
  "parent_event_id" uuid,
  "required_tier" text default 'standard'::text not null,
  "visible_to_tier" text default 'standard'::text not null,
  "required_level" smallint default 1 not null,
  "series_id" uuid,
  "timezone" text,
  "host_id" uuid,
  "status" text default 'programado'::text not null,
  "is_exception" boolean default false not null,
  "cancelled_at" timestamp with time zone,
  "cancel_reason" text,
  "modo_sala" text,
  "recording_url" text
);
create table if not exists public."folders" (
  "id" uuid default gen_random_uuid() not null,
  "module_id" uuid,
  "title" text not null,
  "order_position" integer default 0,
  "created_at" timestamp with time zone default now(),
  "course_id" uuid,
  "published" boolean default true
);
create table if not exists public."lesson_progress" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "lesson_id" uuid not null,
  "completed" boolean default false,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now()
);
create table if not exists public."lessons" (
  "id" uuid default gen_random_uuid() not null,
  "folder_id" uuid,
  "title" text not null,
  "content" text,
  "video_embed_url" text,
  "file_urls" jsonb default '[]'::jsonb,
  "order_position" integer default 0,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "course_id" uuid,
  "attachments" jsonb default '[]'::jsonb,
  "published" boolean default true,
  "comments_count" integer default 0,
  "linked_post_id" uuid,
  "content_format" text default 'tiptap'::text not null,
  "search_text" text,
  "content_v2" text
);
create table if not exists public."level_rewards" (
  "id" uuid default gen_random_uuid() not null,
  "level" integer not null,
  "title" character varying(100) not null,
  "description" text not null,
  "icon" character varying(10) default '🎁'::character varying not null,
  "expanded_title" character varying(200),
  "expanded_description" text,
  "preview_image_url" text,
  "rewards" jsonb default '[]'::jsonb,
  "is_active" boolean default true,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "repo_config" jsonb,
  "agent_rewards" jsonb
);
create table if not exists public."likes" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "post_id" uuid,
  "comment_id" uuid,
  "created_at" timestamp with time zone default now()
);
create table if not exists public."mentions" (
  "id" uuid default gen_random_uuid() not null,
  "post_id" uuid,
  "comment_id" uuid,
  "mentioned_user_id" uuid not null,
  "mentioned_by_user_id" uuid not null,
  "created_at" timestamp with time zone default now()
);
create table if not exists public."notifications" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "type" character varying(50) not null,
  "title" text not null,
  "body" text,
  "data" jsonb,
  "read" boolean default false,
  "created_at" timestamp with time zone default now(),
  "author_avatar" text
);
create table if not exists public."point_transactions" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "points" integer not null,
  "action" text not null,
  "source_id" uuid,
  "source_type" text,
  "created_at" timestamp with time zone default now(),
  "is_retroactive" boolean default false not null
);
create table if not exists public."poll_options" (
  "id" uuid default gen_random_uuid() not null,
  "poll_id" uuid not null,
  "text" text not null,
  "order_position" integer default 0,
  "votes_count" integer default 0,
  "created_at" timestamp with time zone default now()
);
create table if not exists public."poll_votes" (
  "id" uuid default gen_random_uuid() not null,
  "poll_option_id" uuid not null,
  "user_id" uuid not null,
  "created_at" timestamp with time zone default now()
);
create table if not exists public."polls" (
  "id" uuid default gen_random_uuid() not null,
  "post_id" uuid not null,
  "allow_multiple" boolean default false,
  "created_at" timestamp with time zone default now()
);
create table if not exists public."post_favorites" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "post_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public."post_views" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "post_id" uuid not null,
  "viewed_at" timestamp with time zone default now() not null
);
create table if not exists public."posts" (
  "id" uuid default gen_random_uuid() not null,
  "author_id" uuid not null,
  "category_id" uuid not null,
  "title" text,
  "content" text not null,
  "media_urls" jsonb default '[]'::jsonb,
  "video_embed_url" text,
  "pinned" boolean default false,
  "likes_count" integer default 0,
  "comments_count" integer default 0,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "pin_order" integer default 0,
  "pinned_until" timestamp with time zone,
  "agent_author_id" uuid,
  "send_email_notification" boolean default false,
  "is_draft" boolean default false,
  "favorites_count" integer default 0,
  "last_activity_at" timestamp with time zone default now() not null,
  "hidden_from_feed" boolean default false not null,
  "hidden_reason" text,
  "hidden_at" timestamp with time zone,
  "notificar_comunidad" boolean default true not null
);
create table if not exists public."profiles" (
  "id" uuid not null,
  "email" text,
  "full_name" text not null,
  "avatar_url" text,
  "bio" text,
  "role" text default 'member'::text not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "last_seen" timestamp with time zone default now(),
  "location_city" text,
  "location_country" text,
  "location_lat" numeric(10,8),
  "location_lng" numeric(11,8),
  "location_visible" boolean default true,
  "tier" text default 'no-paid'::text not null,
  "is_agent" boolean default false,
  "total_points" integer default 0,
  "current_level" integer default 1,
  "onboarding_completed" boolean default false,
  "has_community_access" boolean default false not null,
  "first_name" text,
  "last_name" text,
  "github_username" text,
  "email_notifications_enabled" boolean default true,
  "show_in_leaderboard" boolean default false,
  "timezone" text
);
create table if not exists public."push_send_log" (
  "id" bigint generated always as identity not null,
  "subscription_id" uuid,
  "user_id" uuid,
  "platform" text not null,
  "notification_type" text,
  "outcome" text not null,
  "status_code" integer,
  "error" text,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public."push_subscriptions" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "endpoint" text not null,
  "p256dh" text not null,
  "auth" text not null,
  "device_name" text,
  "browser" text,
  "user_agent" text,
  "created_at" timestamp with time zone default now() not null,
  "last_used_at" timestamp with time zone default now() not null,
  "failed_attempts" integer default 0 not null,
  "last_failure_at" timestamp with time zone
);
create table if not exists public."video_audio_events" (
  "id" uuid default gen_random_uuid() not null,
  "session_id" uuid not null,
  "user_id" uuid not null,
  "participant_sid" text,
  "event" text not null,
  "detail" jsonb default '{}'::jsonb not null,
  "client_ts" timestamp with time zone not null,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists public."video_entry_attempts" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "room_id" uuid,
  "session_id" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "token_status" text default 'requested'::text not null,
  "http_status" integer,
  "client_status" text,
  "error_code" text
);
create table if not exists public."video_hand_raises" (
  "id" uuid default gen_random_uuid() not null,
  "session_id" uuid not null,
  "user_id" uuid not null,
  "raised_at" timestamp with time zone default now(),
  "acknowledged_at" timestamp with time zone,
  "lowered_at" timestamp with time zone,
  "was_addressed" boolean default false,
  "position_in_queue" integer,
  "priority" text default 'normal'::text,
  "created_at" timestamp with time zone default now()
);
create table if not exists public."video_participants" (
  "id" uuid default gen_random_uuid() not null,
  "session_id" uuid not null,
  "user_id" uuid not null,
  "role" text default 'participant'::text not null,
  "joined_at" timestamp with time zone default now(),
  "left_at" timestamp with time zone,
  "had_video" boolean default false,
  "had_audio" boolean default false,
  "had_screen_share" boolean default false,
  "device_info" jsonb default '{}'::jsonb,
  "connection_quality_avg" numeric(3,2),
  "points_awarded" integer default 0,
  "created_at" timestamp with time zone default now(),
  "participant_sid" text,
  "left_at_unreliable" boolean default false not null,
  "nota_calidad" text
);
create table if not exists public."video_recordings" (
  "id" uuid default gen_random_uuid() not null,
  "session_id" uuid not null,
  "storage_path" text,
  "storage_url" text,
  "duration_seconds" integer,
  "file_size_bytes" bigint,
  "format" text default 'mp4'::text,
  "recording_type" text default 'composite'::text,
  "egress_id" text,
  "status" text default 'recording'::text,
  "created_at" timestamp with time zone default now(),
  "video_url" text,
  "thumbnail_url" text,
  "summary_text" text,
  "transcript_text" text,
  "action_items" jsonb default '[]'::jsonb,
  "community_post_id" uuid,
  "processing_status" text default 'pending'::text,
  "diarized_transcript" text,
  "calidad" text,
  "calidad_detalle" jsonb,
  "lesson_id" uuid
);
create table if not exists public."video_room_settings" (
  "id" uuid default gen_random_uuid() not null,
  "room_id" uuid not null,
  "allow_hand_raise" boolean default true,
  "allow_chat" boolean default true,
  "allow_screen_share" boolean default true,
  "allow_recording" boolean default true,
  "require_recording_consent" boolean default true,
  "auto_record" boolean default false,
  "max_duration_minutes" integer,
  "min_level_for_camera" integer default 3,
  "min_level_for_mic" integer default 1,
  "min_level_for_screen_share" integer default 4,
  "required_tier" text default 'standard'::text,
  "layout_default" text default 'gallery'::text,
  "waiting_room_enabled" boolean default true,
  "mute_on_join" boolean default true,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "turno_max_segundos" integer default 180 not null,
  "presupuesto_total_segundos" integer default 300 not null
);
create table if not exists public."video_rooms" (
  "id" uuid default gen_random_uuid() not null,
  "event_id" uuid,
  "name" text not null,
  "slug" text not null,
  "created_by" uuid not null,
  "room_type" text default 'event'::text not null,
  "max_participants" integer default 100,
  "settings" jsonb default '{}'::jsonb,
  "status" text default 'idle'::text not null,
  "livekit_room_name" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
create table if not exists public."video_sessions" (
  "id" uuid default gen_random_uuid() not null,
  "room_id" uuid not null,
  "started_at" timestamp with time zone default now(),
  "ended_at" timestamp with time zone,
  "peak_participants" integer default 0,
  "total_unique_participants" integer default 0,
  "recording_status" text default 'none'::text,
  "metadata" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now(),
  "modo" text default 'abierta'::text not null,
  "modo_cambiado_at" timestamp with time zone,
  "anfitrion_entro_at" timestamp with time zone,
  "cierre_at" timestamp with time zone,
  "cerrada_por" text,
  "reconciliado_at" timestamp with time zone,
  "estado_version" integer default 0 not null
);
create table if not exists public."video_turnos" (
  "id" uuid default gen_random_uuid() not null,
  "session_id" uuid not null,
  "identity" text not null,
  "concedido_por" text,
  "concedido_at" timestamp with time zone default now() not null,
  "vence_at" timestamp with time zone not null,
  "terminado_at" timestamp with time zone,
  "motivo_fin" text,
  "bonus_segundos" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

-- ---------------- Restricciones ----------------
alter table public."admin_email_broadcast_log" add constraint "admin_email_broadcast_log_pkey" PRIMARY KEY (id);
alter table public."categories" add constraint "categories_pkey" PRIMARY KEY (id);
alter table public."comments" add constraint "comments_pkey" PRIMARY KEY (id);
alter table public."community_settings" add constraint "community_settings_pkey" PRIMARY KEY (id);
alter table public."course_access_grants" add constraint "course_access_grants_pkey" PRIMARY KEY (id);
alter table public."course_loves" add constraint "course_loves_pkey" PRIMARY KEY (course_id, user_id);
alter table public."courses" add constraint "courses_pkey" PRIMARY KEY (id);
alter table public."event_reminders" add constraint "event_reminders_pkey" PRIMARY KEY (id);
alter table public."event_series" add constraint "event_series_pkey" PRIMARY KEY (id);
alter table public."events" add constraint "events_pkey" PRIMARY KEY (id);
alter table public."folders" add constraint "folders_pkey" PRIMARY KEY (id);
alter table public."lesson_progress" add constraint "lesson_progress_pkey" PRIMARY KEY (id);
alter table public."lessons" add constraint "lessons_pkey" PRIMARY KEY (id);
alter table public."level_rewards" add constraint "level_rewards_pkey" PRIMARY KEY (id);
alter table public."likes" add constraint "likes_pkey" PRIMARY KEY (id);
alter table public."mentions" add constraint "mentions_pkey" PRIMARY KEY (id);
alter table public."notifications" add constraint "notifications_pkey" PRIMARY KEY (id);
alter table public."point_transactions" add constraint "point_transactions_pkey" PRIMARY KEY (id);
alter table public."poll_options" add constraint "poll_options_pkey" PRIMARY KEY (id);
alter table public."poll_votes" add constraint "poll_votes_pkey" PRIMARY KEY (id);
alter table public."polls" add constraint "polls_pkey" PRIMARY KEY (id);
alter table public."post_favorites" add constraint "post_favorites_pkey" PRIMARY KEY (id);
alter table public."post_views" add constraint "post_views_pkey" PRIMARY KEY (id);
alter table public."posts" add constraint "posts_pkey" PRIMARY KEY (id);
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."push_send_log" add constraint "push_send_log_pkey" PRIMARY KEY (id);
alter table public."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY (id);
alter table public."video_audio_events" add constraint "video_audio_events_pkey" PRIMARY KEY (id);
alter table public."video_entry_attempts" add constraint "video_entry_attempts_pkey" PRIMARY KEY (id);
alter table public."video_hand_raises" add constraint "video_hand_raises_pkey" PRIMARY KEY (id);
alter table public."video_participants" add constraint "video_participants_pkey" PRIMARY KEY (id);
alter table public."video_recordings" add constraint "video_recordings_pkey" PRIMARY KEY (id);
alter table public."video_room_settings" add constraint "video_room_settings_pkey" PRIMARY KEY (id);
alter table public."video_rooms" add constraint "video_rooms_pkey" PRIMARY KEY (id);
alter table public."video_sessions" add constraint "video_sessions_pkey" PRIMARY KEY (id);
alter table public."video_turnos" add constraint "video_turnos_pkey" PRIMARY KEY (id);
alter table public."admin_email_broadcast_log" add constraint "admin_email_broadcast_log_notification_id_key" UNIQUE (notification_id);
alter table public."categories" add constraint "categories_name_key" UNIQUE (name);
alter table public."categories" add constraint "categories_slug_key" UNIQUE (slug);
alter table public."course_access_grants" add constraint "course_access_grants_user_id_course_id_grant_type_key" UNIQUE (user_id, course_id, grant_type);
alter table public."event_reminders" add constraint "event_reminders_event_id_user_id_lead_minutes_key" UNIQUE (event_id, user_id, lead_minutes);
alter table public."lesson_progress" add constraint "lesson_progress_user_id_lesson_id_key" UNIQUE (user_id, lesson_id);
alter table public."level_rewards" add constraint "level_rewards_level_key" UNIQUE (level);
alter table public."likes" add constraint "likes_user_id_post_id_comment_id_key" UNIQUE NULLS NOT DISTINCT (user_id, post_id, comment_id);
alter table public."poll_votes" add constraint "poll_votes_poll_option_id_user_id_key" UNIQUE (poll_option_id, user_id);
alter table public."polls" add constraint "polls_post_id_key" UNIQUE (post_id);
alter table public."post_favorites" add constraint "post_favorites_user_id_post_id_key" UNIQUE (user_id, post_id);
alter table public."post_views" add constraint "post_views_user_id_post_id_key" UNIQUE (user_id, post_id);
alter table public."profiles" add constraint "profiles_github_username_key" UNIQUE (github_username);
alter table public."push_subscriptions" add constraint "push_subscriptions_user_id_endpoint_key" UNIQUE (user_id, endpoint);
alter table public."video_room_settings" add constraint "video_room_settings_room_id_key" UNIQUE (room_id);
alter table public."video_rooms" add constraint "video_rooms_slug_key" UNIQUE (slug);
alter table public."admin_email_broadcast_log" add constraint "admin_email_broadcast_log_status_check" CHECK ((status = ANY (ARRAY['sent'::text, 'partial'::text, 'failed'::text, 'no_recipients'::text])));
alter table public."categories" add constraint "categories_permissions_check" CHECK ((permissions = ANY (ARRAY['members'::text, 'admins'::text, 'premium'::text, 'vip'::text])));
alter table public."categories" add constraint "categories_sort_method_check" CHECK ((sort_method = ANY (ARRAY['default'::text, 'top_week'::text, 'top_month'::text, 'latest'::text])));
alter table public."comments" add constraint "comments_author_check" CHECK (((author_id IS NOT NULL) OR (agent_id IS NOT NULL)));
alter table public."comments" add constraint "comments_exclusive_parent" CHECK ((((post_id IS NOT NULL) AND (lesson_id IS NULL)) OR ((post_id IS NULL) AND (lesson_id IS NOT NULL))));
alter table public."course_access_grants" add constraint "course_access_grants_grant_type_check" CHECK ((grant_type = ANY (ARRAY['premium_90_days_milestone'::text, 'admin_grant'::text, 'purchase'::text, 'scholarship'::text, 'contest_prize'::text])));
alter table public."courses" add constraint "courses_access_type_check" CHECK ((access_type = ANY (ARRAY['open'::text, 'level_unlock'::text, 'buy_now'::text, 'time_unlock'::text, 'private'::text])));
alter table public."courses" add constraint "courses_price_cents_check" CHECK (((price_cents IS NULL) OR (price_cents > 0)));
alter table public."courses" add constraint "courses_tier_bypass_min_check" CHECK (((tier_bypass_min IS NULL) OR (tier_bypass_min = ANY (ARRAY['standard'::text, 'premium'::text, 'vip'::text]))));
alter table public."courses" add constraint "courses_unlock_after_days_check" CHECK (((unlock_after_days IS NULL) OR (unlock_after_days > 0)));
alter table public."courses" add constraint "courses_unlock_level_check" CHECK (((unlock_level IS NULL) OR ((unlock_level >= 1) AND (unlock_level <= 9))));
alter table public."event_series" add constraint "event_series_status_chk" CHECK ((status = ANY (ARRAY['activa'::text, 'cerrada'::text])));
alter table public."events" add constraint "events_modo_sala_check" CHECK (((modo_sala IS NULL) OR (modo_sala = ANY (ARRAY['abierta'::text, 'clase'::text]))));
alter table public."events" add constraint "events_required_tier_check" CHECK ((required_tier = ANY (ARRAY['standard'::text, 'premium'::text, 'vip'::text])));
alter table public."events" add constraint "events_status_chk" CHECK ((status = ANY (ARRAY['programado'::text, 'cancelado'::text])));
alter table public."events" add constraint "events_visible_to_tier_check" CHECK ((visible_to_tier = ANY (ARRAY['standard'::text, 'premium'::text, 'vip'::text])));
alter table public."lessons" add constraint "lessons_content_format_chk" CHECK ((content_format = ANY (ARRAY['tiptap'::text, 'html'::text])));
alter table public."level_rewards" add constraint "level_rewards_level_check" CHECK (((level >= 1) AND (level <= 9)));
alter table public."likes" add constraint "likes_check" CHECK ((((post_id IS NOT NULL) AND (comment_id IS NULL)) OR ((post_id IS NULL) AND (comment_id IS NOT NULL))));
alter table public."mentions" add constraint "mentions_check" CHECK ((((post_id IS NOT NULL) AND (comment_id IS NULL)) OR ((post_id IS NULL) AND (comment_id IS NOT NULL))));
alter table public."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text, 'member'::text])));
alter table public."profiles" add constraint "profiles_tier_check" CHECK ((tier = ANY (ARRAY['free'::text, 'standard'::text, 'premium'::text, 'vip'::text, 'no-paid'::text, 'cancelled'::text])));
alter table public."video_entry_attempts" add constraint "video_entry_attempts_client_status_check" CHECK ((client_status = ANY (ARRAY['connected'::text, 'failed'::text, 'disconnected'::text])));
alter table public."video_entry_attempts" add constraint "video_entry_attempts_token_status_check" CHECK ((token_status = ANY (ARRAY['requested'::text, 'issued'::text, 'denied'::text, 'failed'::text])));
alter table public."video_hand_raises" add constraint "video_hand_raises_priority_check" CHECK ((priority = ANY (ARRAY['normal'::text, 'vip'::text])));
alter table public."video_participants" add constraint "video_participants_role_check" CHECK ((role = ANY (ARRAY['host'::text, 'co_host'::text, 'speaker'::text, 'participant'::text, 'viewer'::text])));
alter table public."video_participants" add constraint "video_participants_salida_despues_de_entrada" CHECK (((left_at IS NULL) OR (left_at >= joined_at))) NOT VALID;
alter table public."video_recordings" add constraint "video_recordings_calidad_check" CHECK (((calidad IS NULL) OR (calidad = ANY (ARRAY['ok'::text, 'degradada'::text, 'no_medida'::text]))));
alter table public."video_recordings" add constraint "video_recordings_recording_type_check" CHECK ((recording_type = ANY (ARRAY['composite'::text, 'individual'::text, 'screen_only'::text])));
alter table public."video_recordings" add constraint "video_recordings_status_check" CHECK ((status = ANY (ARRAY['recording'::text, 'uploading'::text, 'ready'::text, 'failed'::text])));
alter table public."video_rooms" add constraint "video_rooms_room_type_check" CHECK ((room_type = ANY (ARRAY['event'::text, 'adhoc'::text, 'breakout'::text])));
alter table public."video_rooms" add constraint "video_rooms_status_check" CHECK ((status = ANY (ARRAY['idle'::text, 'active'::text, 'ended'::text])));
alter table public."video_sessions" add constraint "video_sessions_modo_check" CHECK ((modo = ANY (ARRAY['abierta'::text, 'clase'::text])));
alter table public."video_sessions" add constraint "video_sessions_recording_status_check" CHECK ((recording_status = ANY (ARRAY['none'::text, 'recording'::text, 'processing'::text, 'ready'::text, 'failed'::text])));
alter table public."admin_email_broadcast_log" add constraint "admin_email_broadcast_log_post_id_fkey" FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
alter table public."comments" add constraint "comments_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."comments" add constraint "comments_lesson_id_fkey" FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
alter table public."comments" add constraint "comments_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;
alter table public."comments" add constraint "comments_post_id_fkey" FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
alter table public."course_access_grants" add constraint "course_access_grants_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public."course_access_grants" add constraint "course_access_grants_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."course_access_grants" add constraint "course_access_grants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."course_loves" add constraint "course_loves_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public."course_loves" add constraint "course_loves_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."courses" add constraint "courses_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public."event_reminders" add constraint "event_reminders_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public."event_reminders" add constraint "event_reminders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."event_series" add constraint "event_series_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public."event_series" add constraint "event_series_host_id_fkey" FOREIGN KEY (host_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public."events" add constraint "events_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public."events" add constraint "events_host_id_fkey" FOREIGN KEY (host_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."events" add constraint "events_parent_event_id_fkey" FOREIGN KEY (parent_event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public."events" add constraint "events_series_id_fkey" FOREIGN KEY (series_id) REFERENCES event_series(id) ON DELETE SET NULL;
alter table public."folders" add constraint "folders_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public."lesson_progress" add constraint "lesson_progress_lesson_id_fkey" FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
alter table public."lesson_progress" add constraint "lesson_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."lessons" add constraint "lessons_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public."lessons" add constraint "lessons_folder_id_fkey" FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE;
alter table public."lessons" add constraint "lessons_linked_post_id_fkey" FOREIGN KEY (linked_post_id) REFERENCES posts(id) ON DELETE SET NULL;
alter table public."likes" add constraint "likes_comment_id_fkey" FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE;
alter table public."likes" add constraint "likes_post_id_fkey" FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
alter table public."likes" add constraint "likes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."mentions" add constraint "mentions_comment_id_fkey" FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE;
alter table public."mentions" add constraint "mentions_mentioned_by_user_id_fkey" FOREIGN KEY (mentioned_by_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."mentions" add constraint "mentions_mentioned_user_id_fkey" FOREIGN KEY (mentioned_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."mentions" add constraint "mentions_post_id_fkey" FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
alter table public."notifications" add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."point_transactions" add constraint "point_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."poll_options" add constraint "poll_options_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE;
alter table public."poll_votes" add constraint "poll_votes_poll_option_id_fkey" FOREIGN KEY (poll_option_id) REFERENCES poll_options(id) ON DELETE CASCADE;
alter table public."poll_votes" add constraint "poll_votes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."polls" add constraint "polls_post_id_fkey" FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
alter table public."post_favorites" add constraint "post_favorites_post_id_fkey" FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
alter table public."post_favorites" add constraint "post_favorites_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."post_views" add constraint "post_views_post_id_fkey" FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
alter table public."post_views" add constraint "post_views_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."posts" add constraint "posts_author_id_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."posts" add constraint "posts_category_id_fkey" FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;
alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."push_subscriptions" add constraint "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."video_audio_events" add constraint "video_audio_events_session_id_fkey" FOREIGN KEY (session_id) REFERENCES video_sessions(id) ON DELETE CASCADE;
alter table public."video_audio_events" add constraint "video_audio_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."video_entry_attempts" add constraint "video_entry_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table public."video_hand_raises" add constraint "video_hand_raises_session_id_fkey" FOREIGN KEY (session_id) REFERENCES video_sessions(id) ON DELETE CASCADE;
alter table public."video_hand_raises" add constraint "video_hand_raises_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table public."video_participants" add constraint "video_participants_session_id_fkey" FOREIGN KEY (session_id) REFERENCES video_sessions(id) ON DELETE CASCADE;
alter table public."video_participants" add constraint "video_participants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table public."video_recordings" add constraint "video_recordings_community_post_id_fkey" FOREIGN KEY (community_post_id) REFERENCES posts(id);
alter table public."video_recordings" add constraint "video_recordings_lesson_id_fkey" FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL;
alter table public."video_recordings" add constraint "video_recordings_session_id_fkey" FOREIGN KEY (session_id) REFERENCES video_sessions(id) ON DELETE CASCADE;
alter table public."video_room_settings" add constraint "video_room_settings_room_id_fkey" FOREIGN KEY (room_id) REFERENCES video_rooms(id) ON DELETE CASCADE;
alter table public."video_rooms" add constraint "video_rooms_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public."video_rooms" add constraint "video_rooms_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
alter table public."video_sessions" add constraint "video_sessions_room_id_fkey" FOREIGN KEY (room_id) REFERENCES video_rooms(id) ON DELETE CASCADE;
alter table public."video_turnos" add constraint "video_turnos_session_id_fkey" FOREIGN KEY (session_id) REFERENCES video_sessions(id) ON DELETE CASCADE;

-- ---------------- Indices ----------------
CREATE INDEX IF NOT EXISTS idx_admin_email_broadcast_log_created ON public.admin_email_broadcast_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_email_broadcast_log_post ON public.admin_email_broadcast_log USING btree (post_id);
CREATE INDEX IF NOT EXISTS idx_categories_order ON public.categories USING btree (order_position);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_comments_agent_id ON public.comments USING btree (agent_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments USING btree (author_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_lesson ON public.comments USING btree (lesson_id, created_at) WHERE (lesson_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments USING btree (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments USING btree (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments USING btree (post_id);
CREATE INDEX IF NOT EXISTS idx_course_access_grants_course_id ON public.course_access_grants USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_course_access_grants_expires_at ON public.course_access_grants USING btree (expires_at) WHERE (expires_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_course_access_grants_grant_type ON public.course_access_grants USING btree (grant_type);
CREATE INDEX IF NOT EXISTS idx_course_access_grants_user_course ON public.course_access_grants USING btree (user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_course_access_grants_user_id ON public.course_access_grants USING btree (user_id);
CREATE INDEX IF NOT EXISTS course_loves_course_idx ON public.course_loves USING btree (course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_created_by ON public.courses USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_courses_published ON public.courses USING btree (published, order_position);
CREATE INDEX IF NOT EXISTS event_reminders_pending_idx ON public.event_reminders USING btree (event_id) WHERE (sent_at IS NULL);
CREATE INDEX IF NOT EXISTS event_reminders_user_idx ON public.event_reminders USING btree (user_id);
CREATE INDEX IF NOT EXISTS event_series_host_idx ON public.event_series USING btree (host_id);
CREATE INDEX IF NOT EXISTS event_series_status_idx ON public.event_series USING btree (status);
CREATE INDEX IF NOT EXISTS events_host_idx ON public.events USING btree (host_id);
CREATE INDEX IF NOT EXISTS events_series_idx ON public.events USING btree (series_id);
CREATE INDEX IF NOT EXISTS events_start_idx ON public.events USING btree (start_time);
CREATE INDEX IF NOT EXISTS idx_events_calendar_view ON public.events USING btree (start_time, visible_to_tier);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_events_date_range ON public.events USING btree (start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_events_parent ON public.events USING btree (parent_event_id) WHERE (parent_event_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON public.events USING btree (start_time);
CREATE INDEX IF NOT EXISTS idx_events_visible_to_tier ON public.events USING btree (visible_to_tier);
CREATE INDEX IF NOT EXISTS idx_folders_course_id ON public.folders USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_folders_module ON public.folders USING btree (module_id, order_position);
CREATE INDEX IF NOT EXISTS idx_folders_published ON public.folders USING btree (course_id, published, order_position);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON public.lesson_progress USING btree (lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON public.lesson_progress USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_attachments ON public.lessons USING gin (attachments);
CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON public.lessons USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_folder ON public.lessons USING btree (folder_id, order_position);
CREATE INDEX IF NOT EXISTS idx_lessons_linked_post_id ON public.lessons USING btree (linked_post_id) WHERE (linked_post_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_lessons_published ON public.lessons USING btree (course_id, published, order_position);
CREATE INDEX IF NOT EXISTS idx_level_rewards_level ON public.level_rewards USING btree (level);
CREATE INDEX IF NOT EXISTS idx_likes_comment ON public.likes USING btree (comment_id);
CREATE INDEX IF NOT EXISTS idx_likes_post ON public.likes USING btree (post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON public.likes USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_by_user ON public.mentions USING btree (mentioned_by_user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_comment ON public.mentions USING btree (comment_id) WHERE (comment_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_mentions_mentioned_user ON public.mentions USING btree (mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_post ON public.mentions USING btree (post_id) WHERE (post_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_post_id_unread ON public.notifications USING btree (user_id, ((data ->> 'post_id'::text))) WHERE ((read = false) AND ((data ->> 'post_id'::text) IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_admin_post ON public.notifications USING btree (user_id, type, ((data ->> 'post_id'::text))) WHERE (((type)::text = 'admin_post'::text) AND ((data ->> 'post_id'::text) IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications USING btree (user_id, read) WHERE (read = false);
CREATE INDEX IF NOT EXISTS idx_notifications_unread_message_conversation ON public.notifications USING btree (user_id, type, read) WHERE (((type)::text = 'message'::text) AND (read = false));
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS business_result_once ON public.point_transactions USING btree (user_id, action) WHERE (action = ANY (ARRAY['business_first_client'::text, 'business_first_1k'::text]));
CREATE UNIQUE INDEX IF NOT EXISTS class_attendance_once ON public.point_transactions USING btree (user_id, source_id) WHERE (action = 'class_attended'::text);
CREATE INDEX IF NOT EXISTS idx_point_transactions_action ON public.point_transactions USING btree (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON public.point_transactions USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_date ON public.point_transactions USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON public.point_transactions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON public.poll_options USING btree (poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON public.poll_votes USING btree (poll_option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON public.poll_votes USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_post_favorites_created_at ON public.post_favorites USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_favorites_post_id ON public.post_favorites USING btree (post_id);
CREATE INDEX IF NOT EXISTS idx_post_favorites_user_id ON public.post_favorites USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON public.post_views USING btree (post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_user_id ON public.post_views USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_post_views_user_post ON public.post_views USING btree (user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_posts_agent_author_id ON public.posts USING btree (agent_author_id) WHERE (agent_author_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts USING btree (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_created_published ON public.posts USING btree (author_id, created_at DESC) WHERE (is_draft = false);
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_favorites_count ON public.posts USING btree (favorites_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_hidden_from_feed ON public.posts USING btree (hidden_from_feed) WHERE (hidden_from_feed = true);
CREATE INDEX IF NOT EXISTS idx_posts_pin_order ON public.posts USING btree (pinned, pin_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON public.posts USING btree (pinned, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_pinned_until ON public.posts USING btree (pinned_until) WHERE ((pinned = true) AND (pinned_until IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_posts_search ON public.posts USING gin (to_tsvector('spanish'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || content)));
CREATE INDEX IF NOT EXISTS idx_posts_sort_activity ON public.posts USING btree (pinned DESC, pin_order, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_current_level ON public.profiles USING btree (current_level DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_email_notifications ON public.profiles USING btree (email_notifications_enabled) WHERE (email_notifications_enabled = true);
CREATE INDEX IF NOT EXISTS idx_profiles_first_name ON public.profiles USING btree (first_name);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles USING btree (full_name);
CREATE INDEX IF NOT EXISTS idx_profiles_has_community_access ON public.profiles USING btree (has_community_access) WHERE (has_community_access = true);
CREATE INDEX IF NOT EXISTS idx_profiles_is_agent ON public.profiles USING btree (is_agent) WHERE (is_agent = true);
CREATE INDEX IF NOT EXISTS idx_profiles_last_name ON public.profiles USING btree (last_name);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles USING btree (last_seen DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles USING btree (location_lat, location_lng) WHERE ((location_visible = true) AND (location_lat IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON public.profiles USING btree (onboarding_completed) WHERE (onboarding_completed = false);
CREATE INDEX IF NOT EXISTS idx_profiles_rls_lookup ON public.profiles USING btree (id) INCLUDE (role, tier, has_community_access);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles USING btree (tier);
CREATE INDEX IF NOT EXISTS idx_profiles_total_points ON public.profiles USING btree (total_points DESC);
CREATE INDEX IF NOT EXISTS idx_push_send_log_created ON public.push_send_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_send_log_outcome ON public.push_send_log USING btree (outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions USING btree (endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_last_used ON public.push_subscriptions USING btree (last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_unique ON public.push_subscriptions USING btree (endpoint);
CREATE INDEX IF NOT EXISTS idx_video_audio_events_session_ts ON public.video_audio_events USING btree (session_id, client_ts);
CREATE INDEX IF NOT EXISTS idx_video_audio_events_user_ts ON public.video_audio_events USING btree (user_id, client_ts);
CREATE INDEX IF NOT EXISTS video_entry_attempts_created ON public.video_entry_attempts USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_hand_raises_session_id ON public.video_hand_raises USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_video_hand_raises_user_id ON public.video_hand_raises USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_video_participants_session_id ON public.video_participants USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_video_participants_session_user_open ON public.video_participants USING btree (session_id, user_id) WHERE (left_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_video_participants_user_id ON public.video_participants USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS video_participants_participant_sid_key ON public.video_participants USING btree (participant_sid) WHERE (participant_sid IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_video_recordings_created_at ON public.video_recordings USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_recordings_lesson_id ON public.video_recordings USING btree (lesson_id) WHERE (lesson_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_video_recordings_session_id ON public.video_recordings USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_status ON public.video_recordings USING btree (status);
CREATE INDEX IF NOT EXISTS idx_video_rooms_created_by ON public.video_rooms USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_video_rooms_event_id ON public.video_rooms USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_video_rooms_slug ON public.video_rooms USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_video_rooms_status ON public.video_rooms USING btree (status);
CREATE INDEX IF NOT EXISTS idx_video_sessions_room_id ON public.video_sessions USING btree (room_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_started_at ON public.video_sessions USING btree (started_at);
CREATE INDEX IF NOT EXISTS video_turnos_session_activos_idx ON public.video_turnos USING btree (session_id, terminado_at);

-- ---------------- Funciones ----------------
create schema if not exists private;
grant usage on schema private to authenticated;
CREATE OR REPLACE FUNCTION private.avatar_editor_aal2()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'aal','')='aal2'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','owner'))
$function$;
grant execute on function private.avatar_editor_aal2() to authenticated;

CREATE OR REPLACE FUNCTION public.add_points_to_user(p_user_id uuid, p_points integer, p_action text, p_source_id uuid DEFAULT NULL::uuid, p_source_type text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_total INTEGER;
  new_level INTEGER;
BEGIN
  UPDATE profiles
  SET total_points = COALESCE(total_points, 0) + p_points
  WHERE id = p_user_id
  RETURNING total_points INTO new_total;

  new_level := calculate_level(new_total);
  -- Ratchet: por esta via el nivel SOLO sube.
  UPDATE profiles
  SET current_level = GREATEST(COALESCE(current_level, 1), new_level)
  WHERE id = p_user_id;

  INSERT INTO point_transactions (user_id, points, action, source_id, source_type)
  VALUES (p_user_id, p_points, p_action, p_source_id, p_source_type);
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_class_attendance(p_user_ids uuid[], p_class_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid; awarded integer := 0;
BEGIN
  IF p_class_id IS NULL THEN RAISE EXCEPTION 'class-required'; END IF;
  -- Orden estable de bloqueos para dos lotes simultáneos.
  FOR uid IN SELECT DISTINCT x FROM unnest(p_user_ids) x WHERE x IS NOT NULL ORDER BY x LOOP
    PERFORM 1 FROM profiles WHERE id=uid FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM point_transactions
      WHERE user_id=uid AND action IN ('class_attended','video_call_attended') AND source_id=p_class_id) THEN
      PERFORM add_points_to_user(uid,5,'class_attended',p_class_id,'class');
      awarded := awarded+1;
    END IF;
  END LOOP;
  RETURN awarded;
END $function$;

CREATE OR REPLACE FUNCTION public.award_video_session_attendance(p_session_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE class_id uuid; attendees uuid[]; awarded integer;
BEGIN
  SELECT r.event_id INTO class_id FROM video_sessions s JOIN video_rooms r ON r.id=s.room_id
    WHERE s.id=p_session_id AND s.ended_at IS NOT NULL;
  IF class_id IS NULL THEN RETURN 0; END IF;
  -- También serializa dos cierres distintos de la misma clase.
  PERFORM 1 FROM events WHERE id=class_id FOR UPDATE;
  SELECT array_agg(a.user_id ORDER BY a.user_id) INTO attendees FROM video_class_attendance(class_id) a
    WHERE a.minutes_attended>=5;
  awarded := award_class_attendance(attendees,class_id);
  -- Un marcador por persona/clase; no sumar +5 por cada conexión del mismo usuario.
  UPDATE video_participants p SET points_awarded=5 WHERE p.id IN (
    SELECT DISTINCT ON (v.user_id) v.id FROM video_participants v
      JOIN video_sessions s ON s.id=v.session_id JOIN video_rooms r ON r.id=s.room_id
      WHERE r.event_id=class_id AND v.user_id=ANY(attendees)
      ORDER BY v.user_id,v.joined_at,v.id
  );
  RETURN awarded;
END $function$;

CREATE OR REPLACE FUNCTION public.bump_post_activity_on_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN UPDATE posts SET last_activity_at = NEW.created_at WHERE id = NEW.post_id AND (last_activity_at IS NULL OR last_activity_at < NEW.created_at); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.calculate_level(points integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  -- Espejo exacto de LEVEL_THRESHOLDS en src/features/gamification/types
  RETURN CASE
    WHEN points >= 33015 THEN 9
    WHEN points >= 8015  THEN 8
    WHEN points >= 2015  THEN 7
    WHEN points >= 515   THEN 6
    WHEN points >= 155   THEN 5
    WHEN points >= 65    THEN 4
    WHEN points >= 20    THEN 3
    WHEN points >= 5     THEN 2
    ELSE 1
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_comment_nesting()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If this is a reply (has parent_id)
  IF NEW.parent_id IS NOT NULL THEN
    -- Check if parent is also a reply (has its own parent)
    IF EXISTS (
      SELECT 1 FROM comments 
      WHERE id = NEW.parent_id 
      AND parent_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Cannot reply to a reply. Only 1 level of nesting allowed.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_batch_notifications(p_user_ids uuid[], p_type character varying, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted_count INTEGER;
  caller_role TEXT;
BEGIN
  -- SECURITY: Only admin/owner can send batch notifications
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
    IF caller_role IS NULL OR caller_role NOT IN ('admin', 'owner') THEN
      RAISE EXCEPTION 'Unauthorized: only admins can send batch notifications';
    END IF;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, data, read, created_at)
  SELECT unnest(p_user_ids), p_type, p_title, p_body, p_data, false, NOW()
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_email_broadcast_notification(p_post_id uuid, p_author_id uuid, p_author_name text, p_author_avatar text, p_post_title text, p_post_content text, p_media_urls jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert ONE single notification for email broadcast
  -- This triggers the webhook exactly ONCE
  INSERT INTO notifications (user_id, type, title, body, data, read, created_at)
  VALUES (
    p_author_id,  -- user_id = author (just for FK, not sending TO author)
    'admin_post_email_broadcast',  -- Special type for email only
    p_author_name || ' publico un anuncio',
    p_post_title,
    jsonb_build_object(
      'post_id', p_post_id,
      'from_user_id', p_author_id,
      'author_name', p_author_name,
      'author_avatar', p_author_avatar,
      'post_content', p_post_content,
      'media_urls', COALESCE(p_media_urls, '[]'::jsonb),
      'url', '/community?post=' || p_post_id::text
    ),
    true,  -- Mark as read immediately (this is not a real notification for the author)
    NOW()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_mention_notification()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  mentioner_name TEXT;
  mentioner_avatar TEXT;
  content_preview TEXT;
  notification_url TEXT;
BEGIN
  -- Obtener nombre y avatar del que menciona
  SELECT full_name, avatar_url INTO mentioner_name, mentioner_avatar
  FROM public.profiles
  WHERE id = NEW.mentioned_by_user_id;

  -- Obtener preview del contenido (strip HTML) y URL
  IF NEW.post_id IS NOT NULL AND NEW.comment_id IS NULL THEN
    -- Mención en post
    SELECT LEFT(regexp_replace(content, '<[^>]+>', '', 'g'), 100) INTO content_preview
    FROM public.posts
    WHERE id = NEW.post_id;
    notification_url := '/community?post=' || NEW.post_id::text;
  ELSE
    -- Mención en comentario
    SELECT LEFT(regexp_replace(content, '<[^>]+>', '', 'g'), 100) INTO content_preview
    FROM public.comments
    WHERE id = NEW.comment_id;
    notification_url := '/community?post=' || NEW.post_id::text || '#comment-' || NEW.comment_id::text;
  END IF;

  -- Insertar notificación con formato LIMPIO
  INSERT INTO public.notifications (user_id, type, title, body, data, author_avatar)
  VALUES (
    NEW.mentioned_user_id,
    'mention',
    mentioner_name,
    content_preview,
    jsonb_build_object(
      'post_id', NEW.post_id,
      'comment_id', NEW.comment_id,
      'from_user_id', NEW.mentioned_by_user_id,
      'author_name', mentioner_name,
      'author_avatar', mentioner_avatar,
      'url', notification_url
    ),
    mentioner_avatar
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.emit_admin_post_notification(p posts)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_admin_name TEXT;
  v_admin_avatar TEXT;
  v_user_ids UUID[];
  v_post_title TEXT;
  v_email_title TEXT;
BEGIN
  -- solo posts de admin/owner generan anuncio
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p.author_id AND role IN ('admin', 'owner')
  ) THEN
    RETURN;
  END IF;

  SELECT full_name, avatar_url INTO v_admin_name, v_admin_avatar
  FROM profiles WHERE id = p.author_id;

  v_post_title := COALESCE(NULLIF(trim(p.title), ''), p.content);
  v_email_title := v_post_title;  -- crudo: emailNotificationService ya hace stripHtml()
  v_post_title := regexp_replace(v_post_title, '<[^>]+>', ' ', 'g');
  v_post_title := trim(regexp_replace(v_post_title, '\s+', ' ', 'g'));
  v_post_title := LEFT(v_post_title, 100);

  -- Un post puede publicarse sin notificar a toda la comunidad
  -- (notificar_comunidad = false), por ejemplo material que vive en un curso.
  IF COALESCE(p.notificar_comunidad, true) = true THEN
    v_user_ids := get_all_users_except(p.author_id);

    IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
      PERFORM create_batch_notifications(
        v_user_ids,
        'admin_post',
        v_admin_name || ' publico un anuncio',
        v_post_title,
        jsonb_build_object(
          'post_id', p.id,
          'from_user_id', p.author_id,
          'author_name', v_admin_name,
          'author_avatar', v_admin_avatar,
          'url', '/community?post=' || p.id::text
        )
      );
    END IF;
  END IF;

  IF COALESCE(p.send_email_notification, false) = true THEN
    PERFORM create_email_broadcast_notification(
      p.id, p.author_id, v_admin_name, v_admin_avatar,
      v_email_title, p.content, COALESCE(p.media_urls, '[]'::jsonb)
    );
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_post_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  recent_count INT;
  user_role TEXT;
BEGIN
  -- Drafts no cuentan (puedes guardar todos los borradores que quieras)
  IF NEW.is_draft = true THEN
    RETURN NEW;
  END IF;

  -- Admin/owner sin rate limit
  SELECT role INTO user_role FROM profiles WHERE id = NEW.author_id;
  IF user_role IN ('admin', 'owner') THEN
    RETURN NEW;
  END IF;

  -- Posts de agentes sin rate limit
  IF NEW.agent_author_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Contar posts published en últimas 24h del mismo autor
  SELECT COUNT(*) INTO recent_count
  FROM posts
  WHERE author_id = NEW.author_id
    AND is_draft = false
    AND created_at >= NOW() - INTERVAL '24 hours';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'rate_limit_exceeded: max 3 posts per 24h. Try again later.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_event_video_room(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  actor public.profiles%ROWTYPE;
  lesson public.events%ROWTYPE;
  room public.video_rooms%ROWTYPE;
  room_slug text;
  staff boolean;
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inicia sesión para entrar a la clase.' USING ERRCODE = '42501';
  END IF;
  staff := COALESCE(actor.role IN ('admin', 'owner'), false);
  IF NOT staff AND NOT COALESCE(actor.has_community_access, false) THEN
    RAISE EXCEPTION 'Necesitas acceso a la comunidad para entrar a la clase.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO lesson FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos esta clase.' USING ERRCODE = 'P0002';
  END IF;
  IF lesson.status = 'cancelado' OR lesson.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta clase fue cancelada.' USING ERRCODE = '42501';
  END IF;
  -- VIP/staff and the teacher of THIS occurrence retain their assigned access.
  IF NOT staff AND actor.id IS DISTINCT FROM COALESCE(lesson.host_id, lesson.created_by)
     AND COALESCE(actor.tier, '') <> 'vip' THEN
    IF lesson.visible_to_tier = 'vip' THEN
      RAISE EXCEPTION 'Esta clase es solo para miembros VIP.' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(actor.current_level, 1) < COALESCE(lesson.required_level, 1) THEN
      RAISE EXCEPTION 'Esta clase requiere Nivel %.', lesson.required_level USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO room FROM public.video_rooms WHERE event_id = p_event_id
    ORDER BY created_at, id LIMIT 1;
  IF NOT FOUND THEN
    room_slug := replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.video_rooms(event_id, name, slug, created_by, room_type, livekit_room_name)
    VALUES (lesson.id, lesson.title, room_slug,
            COALESCE(lesson.host_id, lesson.created_by), 'event', 'room_' || room_slug)
    RETURNING * INTO room;
  END IF;
  INSERT INTO public.video_room_settings(room_id) VALUES (room.id)
    ON CONFLICT (room_id) DO NOTHING;
  RETURN to_jsonb(room);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_users_except(excluded_user_id uuid)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE
AS $function$
  SELECT ARRAY_AGG(id)
  FROM profiles
  WHERE id != excluded_user_id
    AND role IN ('member', 'moderator', 'admin', 'owner');
$function$;

CREATE OR REPLACE FUNCTION public.get_email_eligible_members()
 RETURNS TABLE(user_id uuid, email text, full_name text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT DISTINCT ON (p.email)
    p.id as user_id,
    p.email,
    p.full_name
  FROM profiles p
  WHERE p.email_notifications_enabled = true
    AND p.email IS NOT NULL
    AND p.email != ''
    AND p.email NOT LIKE '%@example.com'
    AND p.role IN ('member', 'moderator', 'admin', 'owner')
    AND (p.has_community_access = true OR p.role IN ('admin', 'owner'))
  ORDER BY p.email, p.created_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_leaderboard_by_period(period_type text, result_limit integer DEFAULT 10)
 RETURNS TABLE(rank bigint, user_id uuid, full_name text, avatar_url text, total_points integer, current_level integer, points_in_period bigint, is_annual boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE start_date timestamptz;
BEGIN
  IF period_type = '7d' THEN
    start_date := NOW() - INTERVAL '7 days';
  ELSIF period_type = '30d' THEN
    start_date := NOW() - INTERVAL '30 days';
  ELSE
    start_date := NULL;
  END IF;

  RETURN QUERY
  WITH period_points AS (
    SELECT pt.user_id, SUM(pt.points) FILTER (WHERE pt.points > 0) AS earned_points
    FROM public.point_transactions pt
    WHERE (start_date IS NULL OR pt.created_at >= start_date)
      AND (start_date IS NULL OR NOT pt.is_retroactive)
      AND (start_date IS NULL OR (pt.source_type IS DISTINCT FROM 'admin'
        AND (pt.action IS NULL OR pt.action NOT IN (
          'admin_level6_grant'
        ))))
    GROUP BY pt.user_id
    HAVING SUM(pt.points) FILTER (WHERE pt.points > 0) > 0
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY pp.earned_points DESC)::bigint AS rank,
    p.id AS user_id, p.full_name, p.avatar_url,
    COALESCE(p.total_points, 0)::integer AS total_points,
    COALESCE(p.current_level, 1)::integer AS current_level,
    COALESCE(pp.earned_points, 0)::bigint AS points_in_period,
    false AS is_annual
  FROM period_points pp
  JOIN public.profiles p ON pp.user_id = p.id
  WHERE p.has_community_access = true
    AND (p.role NOT IN ('owner', 'admin') OR p.show_in_leaderboard = true)
  ORDER BY pp.earned_points DESC
  LIMIT result_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_level_distribution()
 RETURNS TABLE(level integer, member_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.current_level AS level, COUNT(*)::bigint AS member_count
  FROM profiles p
  WHERE p.has_community_access = true
  GROUP BY p.current_level
  ORDER BY p.current_level;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _avatar_url TEXT;
  _full_name TEXT;
BEGIN
  -- Extract avatar_url
  _avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  -- Extract full_name
  _full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    'Usuario'
  );

  -- 🔥 BYPASS RLS: Deshabilitar temporalmente para este INSERT
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- Insert profile
  INSERT INTO public.profiles (
    id, email, full_name, avatar_url, role, tier,
    onboarding_completed,
    has_community_access
  ) VALUES (
    NEW.id, NEW.email, _full_name, _avatar_url,
    'member', 'no-paid',
    false,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_video_admin(check_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = check_user_id
    AND role IN ('admin', 'owner')
  );
$function$;

CREATE OR REPLACE FUNCTION public.notify_admin_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- un borrador no le notifica NADA a nadie (es invisible por RLS; avisarlo era filtrarlo)
  IF COALESCE(NEW.is_draft, false) = true THEN
    RETURN NEW;
  END IF;
  PERFORM public.emit_admin_post_notification(NEW);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_admin_post_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF COALESCE(OLD.is_draft, false) = true AND COALESCE(NEW.is_draft, false) = false THEN
    PERFORM public.emit_admin_post_notification(NEW);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_comment_reply()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_parent_author_id UUID;
  v_replier_name TEXT;
  v_replier_avatar TEXT;
  v_content_preview TEXT;
BEGIN
  -- Solo si es una respuesta (tiene parent_id)
  IF NEW.parent_id IS NOT NULL THEN
    -- Get parent comment author
    SELECT author_id INTO v_parent_author_id
    FROM comments
    WHERE id = NEW.parent_id;

    -- No notificar si el autor se responde a sí mismo
    IF v_parent_author_id IS NOT NULL AND v_parent_author_id != NEW.author_id THEN
      -- Get replier name and avatar
      SELECT full_name, avatar_url INTO v_replier_name, v_replier_avatar
      FROM profiles
      WHERE id = NEW.author_id;

      -- Get content preview (strip HTML)
      v_content_preview := LEFT(regexp_replace(NEW.content, '<[^>]+>', '', 'g'), 100);

      -- Create notification - CLEAN FORMAT
      INSERT INTO notifications (user_id, type, title, body, data, read, created_at, author_avatar)
      VALUES (
        v_parent_author_id,
        'reply',
        v_replier_name,
        v_content_preview,
        jsonb_build_object(
          'post_id', NEW.post_id,
          'comment_id', NEW.id,
          'parent_comment_id', NEW.parent_id,
          'from_user_id', NEW.author_id,
          'url', '/community?post=' || NEW.post_id::text || '#comment-' || NEW.id::text
        ),
        false,
        NOW(),
        v_replier_avatar
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_post_comment()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_post_author_id UUID;
  v_commenter_name TEXT;
  v_commenter_avatar TEXT;
  v_content_preview TEXT;
BEGIN
  -- Solo si NO es una respuesta (parent_id IS NULL)
  IF NEW.parent_id IS NULL THEN
    -- Get post author
    SELECT author_id INTO v_post_author_id
    FROM posts
    WHERE id = NEW.post_id;

    -- No notificar si el autor comenta en su propio post
    IF v_post_author_id IS NOT NULL AND v_post_author_id != NEW.author_id THEN
      -- Get commenter name and avatar
      SELECT full_name, avatar_url INTO v_commenter_name, v_commenter_avatar
      FROM profiles
      WHERE id = NEW.author_id;

      -- Get content preview (strip HTML)
      v_content_preview := LEFT(regexp_replace(NEW.content, '<[^>]+>', '', 'g'), 100);

      -- Create notification - CLEAN FORMAT
      INSERT INTO notifications (user_id, type, title, body, data, read, created_at, author_avatar)
      VALUES (
        v_post_author_id,
        'post_comment',
        v_commenter_name,
        v_content_preview,
        jsonb_build_object(
          'post_id', NEW.post_id,
          'comment_id', NEW.id,
          'from_user_id', NEW.author_id,
          'url', '/community?post=' || NEW.post_id::text || '#comment-' || NEW.id::text
        ),
        false,
        NOW(),
        v_commenter_avatar
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_video_call_started()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_room RECORD;
  v_starter_name TEXT;
  v_starter_avatar TEXT;
  v_user_ids UUID[];
BEGIN
  -- Get room details including creator
  SELECT id, name, slug, event_id, created_by
  INTO v_room
  FROM video_rooms
  WHERE id = NEW.room_id;

  IF v_room IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get room creator profile (the person who enabled the call)
  SELECT full_name, avatar_url
  INTO v_starter_name, v_starter_avatar
  FROM profiles
  WHERE id = v_room.created_by;

  IF v_starter_name IS NULL THEN
    v_starter_name := 'Un miembro';
  END IF;

  -- Get all community members except the creator
  v_user_ids := get_all_users_except(v_room.created_by);

  IF array_length(v_user_ids, 1) IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Create batch notifications
  PERFORM create_batch_notifications(
    v_user_ids,
    'video_call_started',
    'Llamada en vivo: ' || v_room.name,
    v_starter_name || ' inicio una videollamada. Unete ahora!',
    jsonb_build_object(
      'room_id', v_room.id,
      'from_user_id', v_room.created_by,
      'author_name', v_starter_name,
      'author_avatar', v_starter_avatar,
      'url', '/call/' || v_room.slug
    )
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_comment_points_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  padre RECORD;
  post_author UUID;
BEGIN
  -- Solo comentarios de humanos disparan pagos
  IF NEW.agent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id IS NULL THEN
    -- Comentario top-level: +2 al autor HUMANO del post
    SELECT author_id INTO post_author FROM posts
    WHERE id = NEW.post_id AND agent_author_id IS NULL;
    IF post_author IS NOT NULL AND post_author <> NEW.author_id THEN
      PERFORM add_points_to_user(post_author, 2, 'post_comment_received', NEW.id, 'comment');
    END IF;
  ELSE
    -- Respuesta: +2 al autor HUMANO del comentario padre
    SELECT author_id, agent_id INTO padre FROM comments WHERE id = NEW.parent_id;
    IF padre.author_id IS NOT NULL
       AND padre.agent_id IS NULL
       AND padre.author_id <> NEW.author_id THEN
      PERFORM add_points_to_user(padre.author_id, 2, 'comment_reply_received', NEW.id, 'comment');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_comment_points_v2_deleted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT user_id, points, action FROM point_transactions
    WHERE source_id = OLD.id AND source_type = 'comment'
      AND action IN ('post_comment_received', 'comment_reply_received') AND points > 0
  LOOP
    PERFORM remove_points_from_user(t.user_id, t.points, t.action || '_reverted', OLD.id, 'comment');
  END LOOP;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_like_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  content_author_id UUID;
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT author_id INTO content_author_id FROM posts WHERE id = NEW.post_id;
    IF content_author_id IS NOT NULL AND content_author_id != NEW.user_id THEN
      PERFORM add_points_to_user(
        content_author_id,
        1,
        'like_received_post',
        NEW.post_id,
        'post'
      );
    END IF;
  ELSIF NEW.comment_id IS NOT NULL THEN
    SELECT author_id INTO content_author_id FROM comments WHERE id = NEW.comment_id;
    IF content_author_id IS NOT NULL AND content_author_id != NEW.user_id THEN
      PERFORM add_points_to_user(
        content_author_id,
        1,
        'like_received_comment',
        NEW.comment_id,
        'comment'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_like_deleted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  content_author_id UUID;
BEGIN
  IF OLD.post_id IS NOT NULL THEN
    SELECT author_id INTO content_author_id FROM posts WHERE id = OLD.post_id;
    IF content_author_id IS NOT NULL AND content_author_id != OLD.user_id THEN
      PERFORM remove_points_from_user(
        content_author_id,
        1,
        'like_removed_post',
        OLD.post_id,
        'post'
      );
    END IF;
  ELSIF OLD.comment_id IS NOT NULL THEN
    SELECT author_id INTO content_author_id FROM comments WHERE id = OLD.comment_id;
    IF content_author_id IS NOT NULL AND content_author_id != OLD.user_id THEN
      PERFORM remove_points_from_user(
        content_author_id,
        1,
        'like_removed_comment',
        OLD.comment_id,
        'comment'
      );
    END IF;
  END IF;

  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_post_points_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  es_publicacion BOOLEAN;
BEGIN
  -- Solo humanos, solo posts que SALEN al feed (nunca borradores)
  IF NEW.agent_author_id IS NOT NULL OR COALESCE(NEW.is_draft, false) THEN
    RETURN NEW;
  END IF;
  -- Dispara en INSERT publicado, o en el momento en que un borrador se publica
  es_publicacion := (TG_OP = 'INSERT')
    OR (TG_OP = 'UPDATE' AND COALESCE(OLD.is_draft, false) AND NOT COALESCE(NEW.is_draft, false));
  IF NOT es_publicacion THEN
    RETURN NEW;
  END IF;

  -- PRESENTARSE +5: el primer post de la vida en la categoria de presentaciones
  -- (slug 'presentaciones'; cambialo si tu categoria se llama distinto).
  IF EXISTS (SELECT 1 FROM categories c WHERE c.id = NEW.category_id AND c.slug = 'presentaciones')
     AND NOT EXISTS (
       SELECT 1 FROM point_transactions
       WHERE user_id = NEW.author_id AND action = 'present_first_post'
     ) THEN
    PERFORM add_points_to_user(NEW.author_id, 5, 'present_first_post', NEW.id, 'post');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_post_points_v2_deleted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT user_id, points, action FROM point_transactions
    WHERE source_id = OLD.id AND source_type = 'post'
      AND action IN ('present_first_post') AND points > 0
  LOOP
    PERFORM remove_points_from_user(t.user_id, t.points, t.action || '_reverted', OLD.id, 'post');
  END LOOP;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.push_notification_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request_id bigint;
  v_url text;
  v_secret text;
BEGIN
  -- URL y secreto viven en public.app_config (ver README, seccion push y correos).
  SELECT value INTO v_url FROM public.app_config WHERE key = 'notifications_webhook_url';
  SELECT value INTO v_secret FROM public.app_config WHERE key = 'notifications_webhook_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;
  -- Only for push notification types (NOT email broadcasts)
  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', row_to_json(NEW),
      'old_record', NULL
    )::jsonb,
    timeout_milliseconds := 5000
  ) INTO v_request_id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_points_from_user(p_user_id uuid, p_points integer, p_action text, p_source_id uuid DEFAULT NULL::uuid, p_source_type text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_total INTEGER;
  new_level INTEGER;
BEGIN
  UPDATE profiles
  SET total_points = GREATEST(COALESCE(total_points, 0) - p_points, 0)
  WHERE id = p_user_id
  RETURNING total_points INTO new_total;

  new_level := calculate_level(new_total);
  -- Mismo ratchet: revertir puntos (anti-farm crear/borrar) tampoco baja nivel.
  UPDATE profiles
  SET current_level = GREATEST(COALESCE(current_level, 1), new_level)
  WHERE id = p_user_id;

  INSERT INTO point_transactions (user_id, points, action, source_id, source_type)
  VALUES (p_user_id, -p_points, p_action, p_source_id, p_source_type);
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_comment_like(p_comment_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_deleted int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  DELETE FROM likes
  WHERE user_id = v_user AND comment_id = p_comment_id AND post_id IS NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    RETURN false;
  END IF;

  INSERT INTO likes (user_id, post_id, comment_id)
  VALUES (v_user, NULL, p_comment_id)
  ON CONFLICT ON CONSTRAINT likes_user_id_post_id_comment_id_key DO NOTHING;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_post_like(p_post_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_deleted int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  DELETE FROM likes
  WHERE user_id = v_user AND post_id = p_post_id AND comment_id IS NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    RETURN false; -- estaba likeado -> unlike
  END IF;

  INSERT INTO likes (user_id, post_id, comment_id)
  VALUES (v_user, p_post_id, NULL)
  ON CONFLICT ON CONSTRAINT likes_user_id_post_id_comment_id_key DO NOTHING;

  RETURN true; -- like
END;
$function$;

CREATE OR REPLACE FUNCTION public.unvote_poll_option(option_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM poll_votes WHERE poll_option_id = option_id AND user_id = auth.uid();
  UPDATE poll_options SET votes_count = (SELECT COUNT(*) FROM poll_votes WHERE poll_option_id = option_id) WHERE id = option_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_comment_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.comment_id IS NOT NULL THEN
    UPDATE public.comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' AND OLD.comment_id IS NOT NULL THEN
    UPDATE public.comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_course_access_grants_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_lesson_comments_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lesson_id IS NOT NULL AND NEW.parent_id IS NULL THEN
      -- Only count top-level comments (not replies)
      UPDATE lessons SET comments_count = comments_count + 1
      WHERE id = NEW.lesson_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.lesson_id IS NOT NULL AND OLD.parent_id IS NULL THEN
      UPDATE lessons SET comments_count = GREATEST(0, comments_count - 1)
      WHERE id = OLD.lesson_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_level_rewards_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_post_comments_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_post_favorites_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN IF TG_OP = 'INSERT' THEN UPDATE posts SET favorites_count = favorites_count + 1 WHERE id = NEW.post_id; RETURN NEW; ELSIF TG_OP = 'DELETE' THEN UPDATE posts SET favorites_count = GREATEST(favorites_count - 1, 0) WHERE id = OLD.post_id; RETURN OLD; END IF; RETURN NULL; END; $function$;

CREATE OR REPLACE FUNCTION public.update_post_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.post_id IS NOT NULL THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.post_id IS NOT NULL THEN
    UPDATE public.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_video_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.video_class_attendance(p_class_id uuid)
 RETURNS TABLE(user_id uuid, minutes_attended numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH intervals AS (
    SELECT p.user_id,
      greatest(p.joined_at,s.started_at) AS a,
      least(p.left_at,s.ended_at) AS b
    FROM video_participants p JOIN video_sessions s ON s.id=p.session_id
    JOIN video_rooms r ON r.id=s.room_id JOIN events e ON e.id=r.event_id
    WHERE e.id=p_class_id AND coalesce(e.status,'programado') NOT IN ('cancelado','cancelled','canceled')
      AND s.ended_at IS NOT NULL AND p.left_at IS NOT NULL AND NOT coalesce(p.left_at_unreliable,false)
      AND coalesce(s.metadata->>'prueba','false') <> 'true'
      AND coalesce(r.settings->>'attendance_points_enabled','true') <> 'false'
  ), merged AS (
    SELECT user_id,range_agg(tstzrange(a,b,'[)')) AS spans FROM intervals WHERE b>a GROUP BY user_id
  )
  SELECT m.user_id,sum(extract(epoch FROM upper(span)-lower(span)))/60
    FROM merged m CROSS JOIN LATERAL unnest(m.spans) span GROUP BY m.user_id;
$function$;

CREATE OR REPLACE FUNCTION public.vote_poll_option(option_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_poll_id UUID;
  v_allow_multiple BOOLEAN;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT p.id, p.allow_multiple INTO v_poll_id, v_allow_multiple
  FROM poll_options po JOIN polls p ON p.id = po.poll_id WHERE po.id = option_id;

  IF v_poll_id IS NULL THEN RAISE EXCEPTION 'Poll option not found'; END IF;

  IF NOT v_allow_multiple THEN
    DELETE FROM poll_votes pv USING poll_options po
    WHERE pv.poll_option_id = po.id AND po.poll_id = v_poll_id AND pv.user_id = v_user_id;
    UPDATE poll_options SET votes_count = (SELECT COUNT(*) FROM poll_votes WHERE poll_option_id = poll_options.id) WHERE poll_id = v_poll_id;
  END IF;

  INSERT INTO poll_votes (poll_option_id, user_id) VALUES (option_id, v_user_id) ON CONFLICT (poll_option_id, user_id) DO NOTHING;
  UPDATE poll_options SET votes_count = (SELECT COUNT(*) FROM poll_votes WHERE poll_option_id = option_id) WHERE id = option_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.webhook_email_broadcast_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request_id bigint;
  v_url text;
  v_secret text;
BEGIN
  -- URL y secreto viven en public.app_config (ver README, seccion push y correos).
  SELECT value INTO v_url FROM public.app_config WHERE key = 'notifications_webhook_url';
  SELECT value INTO v_secret FROM public.app_config WHERE key = 'notifications_webhook_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;
  -- Solo trigger para admin_post_email_broadcast
  IF NEW.type = 'admin_post_email_broadcast' THEN
    -- Llamar webhook con pg_net (60s timeout para batch email sending)
    SELECT net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', row_to_json(NEW),
        'old_record', NULL
      )::jsonb,
      timeout_milliseconds := 60000
    ) INTO v_request_id;
    
    -- Log para debugging
    RAISE NOTICE 'Webhook enqueued with request_id: %', v_request_id;
  END IF;

  RETURN NEW;
END;
$function$;


-- ---------------- Triggers ----------------
drop trigger if exists "post_likes_count_trigger" on public."likes";
CREATE TRIGGER post_likes_count_trigger AFTER INSERT OR DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();
drop trigger if exists "comment_likes_count_trigger" on public."likes";
CREATE TRIGGER comment_likes_count_trigger AFTER INSERT OR DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();
drop trigger if exists "post_comments_count_trigger" on public."comments";
CREATE TRIGGER post_comments_count_trigger AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();
drop trigger if exists "profiles_updated_at" on public."profiles";
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
drop trigger if exists "posts_updated_at" on public."posts";
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
drop trigger if exists "comments_updated_at" on public."comments";
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
drop trigger if exists "courses_updated_at" on public."courses";
CREATE TRIGGER courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
drop trigger if exists "lessons_updated_at" on public."lessons";
CREATE TRIGGER lessons_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION update_updated_at();
drop trigger if exists "events_updated_at" on public."events";
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
drop trigger if exists "enforce_comment_nesting" on public."comments";
CREATE TRIGGER enforce_comment_nesting BEFORE INSERT OR UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION check_comment_nesting();
drop trigger if exists "mention_notification_trigger" on public."mentions";
CREATE TRIGGER mention_notification_trigger AFTER INSERT ON public.mentions FOR EACH ROW EXECUTE FUNCTION create_mention_notification();
drop trigger if exists "admin_post_notification_trigger" on public."posts";
CREATE TRIGGER admin_post_notification_trigger AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION notify_admin_post();
drop trigger if exists "comment_reply_notification_trigger" on public."comments";
CREATE TRIGGER comment_reply_notification_trigger AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION notify_comment_reply();
drop trigger if exists "post_comment_notification_trigger" on public."comments";
CREATE TRIGGER post_comment_notification_trigger AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION notify_post_comment();
drop trigger if exists "trigger_like_created" on public."likes";
CREATE TRIGGER trigger_like_created AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION on_like_created();
drop trigger if exists "trigger_like_deleted" on public."likes";
CREATE TRIGGER trigger_like_deleted AFTER DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION on_like_deleted();
drop trigger if exists "trigger_update_course_access_grants_updated_at" on public."course_access_grants";
CREATE TRIGGER trigger_update_course_access_grants_updated_at BEFORE UPDATE ON public.course_access_grants FOR EACH ROW EXECUTE FUNCTION update_course_access_grants_updated_at();
drop trigger if exists "on_auth_user_created" on auth."users";
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
drop trigger if exists "trigger_level_rewards_updated_at" on public."level_rewards";
CREATE TRIGGER trigger_level_rewards_updated_at BEFORE UPDATE ON public.level_rewards FOR EACH ROW EXECUTE FUNCTION update_level_rewards_updated_at();
drop trigger if exists "trigger_lesson_comments_count" on public."comments";
CREATE TRIGGER trigger_lesson_comments_count AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION update_lesson_comments_count();
drop trigger if exists "send_email_broadcast_webhook" on public."notifications";
CREATE TRIGGER send_email_broadcast_webhook AFTER INSERT ON public.notifications FOR EACH ROW WHEN (((new.type)::text = 'admin_post_email_broadcast'::text)) EXECUTE FUNCTION webhook_email_broadcast_only();
drop trigger if exists "push_notification_webhook" on public."notifications";
CREATE TRIGGER push_notification_webhook AFTER INSERT ON public.notifications FOR EACH ROW WHEN (((new.type)::text <> 'admin_post_email_broadcast'::text)) EXECUTE FUNCTION push_notification_webhook();
drop trigger if exists "video_rooms_updated_at" on public."video_rooms";
CREATE TRIGGER video_rooms_updated_at BEFORE UPDATE ON public.video_rooms FOR EACH ROW EXECUTE FUNCTION update_video_updated_at();
drop trigger if exists "video_room_settings_updated_at" on public."video_room_settings";
CREATE TRIGGER video_room_settings_updated_at BEFORE UPDATE ON public.video_room_settings FOR EACH ROW EXECUTE FUNCTION update_video_updated_at();
drop trigger if exists "video_call_started_notification_trigger" on public."video_sessions";
CREATE TRIGGER video_call_started_notification_trigger AFTER INSERT ON public.video_sessions FOR EACH ROW EXECUTE FUNCTION notify_video_call_started();
drop trigger if exists "trigger_update_post_favorites_count" on public."post_favorites";
CREATE TRIGGER trigger_update_post_favorites_count AFTER INSERT OR DELETE ON public.post_favorites FOR EACH ROW EXECUTE FUNCTION update_post_favorites_count();
drop trigger if exists "trg_bump_post_activity_on_comment" on public."comments";
CREATE TRIGGER trg_bump_post_activity_on_comment AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION bump_post_activity_on_comment();
drop trigger if exists "trg_enforce_post_rate_limit" on public."posts";
CREATE TRIGGER trg_enforce_post_rate_limit BEFORE INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION enforce_post_rate_limit();
drop trigger if exists "admin_post_published_notification_trigger" on public."posts";
CREATE TRIGGER admin_post_published_notification_trigger AFTER UPDATE OF is_draft ON public.posts FOR EACH ROW EXECUTE FUNCTION notify_admin_post_published();
drop trigger if exists "trigger_post_points_v2" on public."posts";
CREATE TRIGGER trigger_post_points_v2 AFTER INSERT OR UPDATE OF is_draft ON public.posts FOR EACH ROW EXECUTE FUNCTION on_post_points_v2();
drop trigger if exists "trigger_post_points_v2_deleted" on public."posts";
CREATE TRIGGER trigger_post_points_v2_deleted AFTER DELETE ON public.posts FOR EACH ROW EXECUTE FUNCTION on_post_points_v2_deleted();
drop trigger if exists "trigger_comment_points_v2" on public."comments";
CREATE TRIGGER trigger_comment_points_v2 AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION on_comment_points_v2();
drop trigger if exists "trigger_comment_points_v2_deleted" on public."comments";
CREATE TRIGGER trigger_comment_points_v2_deleted AFTER DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION on_comment_points_v2_deleted();

-- ---------------- RLS ----------------
alter table public."likes" enable row level security;
alter table public."lesson_progress" enable row level security;
alter table public."folders" enable row level security;
alter table public."post_favorites" enable row level security;
alter table public."categories" enable row level security;
alter table public."post_views" enable row level security;
alter table public."video_rooms" enable row level security;
alter table public."polls" enable row level security;
alter table public."poll_options" enable row level security;
alter table public."poll_votes" enable row level security;
alter table public."mentions" enable row level security;
alter table public."profiles" enable row level security;
alter table public."comments" enable row level security;
alter table public."video_participants" enable row level security;
alter table public."notifications" enable row level security;
alter table public."push_subscriptions" enable row level security;
alter table public."video_hand_raises" enable row level security;
alter table public."video_room_settings" enable row level security;
alter table public."video_sessions" enable row level security;
alter table public."point_transactions" enable row level security;
alter table public."video_turnos" enable row level security;
alter table public."community_settings" enable row level security;
alter table public."level_rewards" enable row level security;
alter table public."course_access_grants" enable row level security;
alter table public."courses" enable row level security;
alter table public."video_audio_events" enable row level security;
alter table public."video_recordings" enable row level security;
alter table public."posts" enable row level security;
alter table public."lessons" enable row level security;
alter table public."course_loves" enable row level security;
alter table public."admin_email_broadcast_log" enable row level security;
alter table public."events" enable row level security;
alter table public."event_series" enable row level security;
alter table public."event_reminders" enable row level security;
alter table public."push_send_log" enable row level security;
alter table public."video_entry_attempts" enable row level security;
create policy "admins_read_email_broadcast_log" on public."admin_email_broadcast_log" as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins and owners can modify categories" on public."categories" as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Categories visible to everyone" on public."categories" as permissive for select to public
  using (true);
create policy "Authenticated users can create comments" on public."comments" as permissive for insert to public
  with check (((auth.uid() IS NOT NULL) AND (auth.uid() = author_id)));
create policy "Comments visible to authenticated users" on public."comments" as permissive for select to authenticated
  using (true);
create policy "Users can delete own comments or admins/owners can delete any" on public."comments" as permissive for delete to public
  using (((auth.uid() = author_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])))))));
create policy "Users can update own comments or admins/owners can update any" on public."comments" as permissive for update to public
  using (((auth.uid() = author_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])))))));
create policy "Admins and owners can update community settings" on public."community_settings" as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Anyone can read community settings" on public."community_settings" as permissive for select to public
  using (true);
create policy "Admins can delete access grants" on public."course_access_grants" as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins can insert access grants" on public."course_access_grants" as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins can update access grants" on public."course_access_grants" as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins can view all access grants" on public."course_access_grants" as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Users can view own access grants" on public."course_access_grants" as permissive for select to public
  using ((auth.uid() = user_id));
create policy "course_loves_delete_own" on public."course_loves" as permissive for delete to authenticated
  using ((auth.uid() = user_id));
create policy "course_loves_insert_own" on public."course_loves" as permissive for insert to authenticated
  with check ((auth.uid() = user_id));
create policy "course_loves_select" on public."course_loves" as permissive for select to authenticated
  using (true);
create policy "Admins and owners can create courses" on public."courses" as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins and owners can delete courses" on public."courses" as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins and owners can update courses" on public."courses" as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Courses visibility policy" on public."courses" as permissive for select to public
  using (((published = true) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])))))));
create policy "event_reminders solo los propios" on public."event_reminders" as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy "event_series la administra el staff" on public."event_series" as permissive for all to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text]))))))
  with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text]))))));
create policy "event_series visible a miembros" on public."event_series" as permissive for select to authenticated
  using (true);
create policy "Events visible to authenticated users" on public."events" as permissive for select to authenticated
  using (true);
create policy "Owners admins and moderators can create events" on public."events" as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text]))))));
create policy "Owners admins and moderators can delete events" on public."events" as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text]))))));
create policy "Owners admins and moderators can update events" on public."events" as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text]))))));
create policy "Admins and owners can create folders" on public."folders" as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins and owners can delete folders" on public."folders" as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins and owners can update folders" on public."folders" as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Folders visible to authenticated users" on public."folders" as permissive for select to authenticated
  using (true);
create policy "Users can create own progress" on public."lesson_progress" as permissive for insert to public
  with check ((auth.uid() = user_id));
create policy "Users can delete own progress" on public."lesson_progress" as permissive for delete to public
  using ((auth.uid() = user_id));
create policy "Users can update own progress" on public."lesson_progress" as permissive for update to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy "Users can view own progress" on public."lesson_progress" as permissive for select to public
  using ((auth.uid() = user_id));
create policy "Admins and owners can create lessons" on public."lessons" as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins and owners can delete lessons" on public."lessons" as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins and owners can update lessons" on public."lessons" as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Lessons visible to authenticated users" on public."lessons" as permissive for select to authenticated
  using (true);
create policy "Admins can manage level rewards" on public."level_rewards" as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Anyone can read level rewards" on public."level_rewards" as permissive for select to public
  using (true);
create policy "Likes visible to authenticated users" on public."likes" as permissive for select to authenticated
  using (true);
create policy "Users can create own likes" on public."likes" as permissive for insert to public
  with check ((auth.uid() = user_id));
create policy "Users can delete own likes" on public."likes" as permissive for delete to public
  using ((auth.uid() = user_id));
create policy "Authenticated users can create mentions" on public."mentions" as permissive for insert to public
  with check ((auth.uid() = mentioned_by_user_id));
create policy "Mentions visible to authenticated users" on public."mentions" as permissive for select to authenticated
  using (true);
create policy "Users can delete own mentions" on public."mentions" as permissive for delete to public
  using ((auth.uid() = mentioned_by_user_id));
create policy "Authenticated users can create notifications" on public."notifications" as permissive for insert to authenticated
  with check (true);
create policy "Users can delete own notifications" on public."notifications" as permissive for delete to public
  using ((auth.uid() = user_id));
create policy "Users can update own notifications" on public."notifications" as permissive for update to public
  using ((auth.uid() = user_id));
create policy "Users can view own notifications" on public."notifications" as permissive for select to public
  using ((auth.uid() = user_id));
create policy "Point transactions visible to authenticated users" on public."point_transactions" as permissive for select to authenticated
  using (true);
create policy "Admins and owners can create any poll option" on public."poll_options" as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins and owners can delete poll options" on public."poll_options" as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins and owners can update poll options" on public."poll_options" as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Poll options visible to authenticated users" on public."poll_options" as permissive for select to authenticated
  using (true);
create policy "Users can create options for their polls" on public."poll_options" as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM (polls
     JOIN posts ON ((posts.id = polls.post_id)))
  WHERE ((polls.id = poll_options.poll_id) AND (posts.author_id = auth.uid())))));
create policy "Authenticated users can vote" on public."poll_votes" as permissive for insert to public
  with check ((auth.uid() = user_id));
create policy "Poll votes visible to authenticated users" on public."poll_votes" as permissive for select to authenticated
  using (true);
create policy "Users can remove their own votes" on public."poll_votes" as permissive for delete to public
  using ((auth.uid() = user_id));
create policy "Admins and owners can create any poll" on public."polls" as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Admins and owners can delete polls" on public."polls" as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
create policy "Polls visible to authenticated users" on public."polls" as permissive for select to authenticated
  using (true);
create policy "Users can create polls for their posts" on public."polls" as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM posts
  WHERE ((posts.id = polls.post_id) AND (posts.author_id = auth.uid())))));
create policy "Users can add favorites" on public."post_favorites" as permissive for insert to public
  with check ((auth.uid() = user_id));
create policy "Users can remove their own favorites" on public."post_favorites" as permissive for delete to public
  using ((auth.uid() = user_id));
create policy "Users can view their own favorites" on public."post_favorites" as permissive for select to public
  using ((auth.uid() = user_id));
create policy "Users can insert own post views" on public."post_views" as permissive for insert to public
  with check ((auth.uid() = user_id));
create policy "Users can update own post views" on public."post_views" as permissive for update to public
  using ((auth.uid() = user_id));
create policy "Users can view own post views" on public."post_views" as permissive for select to public
  using ((auth.uid() = user_id));
create policy "Posts visible to authenticated users" on public."posts" as permissive for select to authenticated
  using ((((is_draft = false) AND (hidden_from_feed = false)) OR (author_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])))))));
create policy "Users can create posts based on category permissions" on public."posts" as permissive for insert to public
  with check (((auth.uid() IS NOT NULL) AND (auth.uid() = author_id) AND ((EXISTS ( SELECT 1
   FROM categories c
  WHERE ((c.id = posts.category_id) AND ((c.permissions IS NULL) OR (c.permissions = 'members'::text))))) OR (EXISTS ( SELECT 1
   FROM (categories c
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((c.id = posts.category_id) AND (c.permissions = 'admins'::text) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))) OR (EXISTS ( SELECT 1
   FROM (categories c
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((c.id = posts.category_id) AND (c.permissions = 'vip'::text) AND ((p.tier = 'vip'::text) OR (p.role = ANY (ARRAY['admin'::text, 'owner'::text])))))) OR (EXISTS ( SELECT 1
   FROM (categories c
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((c.id = posts.category_id) AND (c.permissions = 'premium'::text) AND ((p.tier = ANY (ARRAY['standard'::text, 'vip'::text])) OR (p.role = ANY (ARRAY['admin'::text, 'owner'::text])))))))));
create policy "Users can delete own posts or admins/owners can delete any" on public."posts" as permissive for delete to public
  using (((auth.uid() = author_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])))))));
create policy "Users can update own posts or admins/owners can update any" on public."posts" as permissive for update to public
  using (((auth.uid() = author_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text])))))));
create policy "Admins can create agent profiles" on public."profiles" as permissive for insert to public
  with check (((EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) AND (is_agent = true)));
create policy "Admins can delete agent profiles" on public."profiles" as permissive for delete to public
  using (((is_agent = true) AND (EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
create policy "Admins can delete profiles" on public."profiles" as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
create policy "Admins can update agent profiles" on public."profiles" as permissive for update to public
  using (((is_agent = true) AND (EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
create policy "Admins can update any profile" on public."profiles" as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
create policy "Profiles visible to authenticated users" on public."profiles" as permissive for select to authenticated
  using (true);
create policy "Users can insert own profile" on public."profiles" as permissive for insert to authenticated
  with check ((auth.uid() = id));
create policy "Users can update own profile" on public."profiles" as permissive for update to public
  using ((auth.uid() = id));
create policy "Users can create own push subscriptions" on public."push_subscriptions" as permissive for insert to authenticated
  with check ((auth.uid() = user_id));
create policy "Users can delete own push subscriptions" on public."push_subscriptions" as permissive for delete to public
  using ((auth.uid() = user_id));
create policy "Users can update own push subscriptions" on public."push_subscriptions" as permissive for update to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy "Users can view own push subscriptions" on public."push_subscriptions" as permissive for select to public
  using ((auth.uid() = user_id));
create policy "Staff lee eventos de audio" on public."video_audio_events" as permissive for select to public
  using (is_video_admin(auth.uid()));
create policy "Hand raises visible to authenticated users" on public."video_hand_raises" as permissive for select to authenticated
  using (true);
create policy "Users can lower own hand or admin can manage" on public."video_hand_raises" as permissive for update to public
  using (((auth.uid() = user_id) OR is_video_admin(auth.uid())));
create policy "Users can raise their own hand" on public."video_hand_raises" as permissive for insert to public
  with check ((auth.uid() = user_id));
create policy "Users can join sessions" on public."video_participants" as permissive for insert to public
  with check ((auth.uid() = user_id));
create policy "Users can update own participation" on public."video_participants" as permissive for update to public
  using (((auth.uid() = user_id) OR is_video_admin(auth.uid())));
create policy "Video participants visible to authenticated users" on public."video_participants" as permissive for select to authenticated
  using (true);
create policy "Admins can delete recordings" on public."video_recordings" as permissive for delete to public
  using (is_video_admin(auth.uid()));
create policy "Admins can insert recordings" on public."video_recordings" as permissive for insert to public
  with check (is_video_admin(auth.uid()));
create policy "Admins can update recordings" on public."video_recordings" as permissive for update to public
  using (is_video_admin(auth.uid()));
create policy "Authenticated users can view recordings" on public."video_recordings" as permissive for select to public
  using ((auth.uid() IS NOT NULL));
create policy "Admins can delete room settings" on public."video_room_settings" as permissive for delete to public
  using (is_video_admin(auth.uid()));
create policy "Admins can insert room settings" on public."video_room_settings" as permissive for insert to public
  with check (is_video_admin(auth.uid()));
create policy "Admins can update room settings" on public."video_room_settings" as permissive for update to public
  using (is_video_admin(auth.uid()));
create policy "Room settings visible to authenticated users" on public."video_room_settings" as permissive for select to authenticated
  using (true);
create policy "Admins can create rooms" on public."video_rooms" as permissive for insert to public
  with check (is_video_admin(auth.uid()));
create policy "Admins can delete rooms" on public."video_rooms" as permissive for delete to public
  using (is_video_admin(auth.uid()));
create policy "Admins can update rooms" on public."video_rooms" as permissive for update to public
  using (is_video_admin(auth.uid()));
create policy "Video rooms visible to authenticated users" on public."video_rooms" as permissive for select to authenticated
  using (true);
create policy "Admins can delete sessions" on public."video_sessions" as permissive for delete to public
  using (is_video_admin(auth.uid()));
create policy "Admins can insert sessions" on public."video_sessions" as permissive for insert to public
  with check (is_video_admin(auth.uid()));
create policy "Admins can update sessions" on public."video_sessions" as permissive for update to public
  using (is_video_admin(auth.uid()));
create policy "Video sessions visible to authenticated users" on public."video_sessions" as permissive for select to authenticated
  using (true);
create policy "Turnos visibles para autenticados" on public."video_turnos" as permissive for select to authenticated
  using (true);

-- ---------------- Storage ----------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('lesson-files', 'lesson-files', false, 52428800, array['image/jpeg','image/png','image/gif','image/webp','application/pdf','video/mp4','video/webm']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/gif','image/webp']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('media', 'media', true, 10485760, array['image/jpeg','image/png','image/gif','image/webp']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('event-covers', 'event-covers', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('course-assets', 'course-assets', true, 5242880, array['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif','image/avif']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('post-attachments', 'post-attachments', true, 52428800, array['application/epub+zip','application/javascript','application/json','application/msword','application/octet-stream','application/pdf','application/typescript','application/vnd.ms-excel','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/x-python','application/x-rar','application/x-rar-compressed','application/x-zip-compressed','application/zip','audio/mp4','audio/mpeg','audio/ogg','audio/webm','image/gif','image/heic','image/heif','image/jpeg','image/png','image/webp','text/css','text/csv','text/html','text/javascript','text/markdown','text/plain','text/typescript','text/x-python','text/x-python-script']) on conflict (id) do nothing;
create policy "Admins can delete lesson files" on storage."objects" as permissive for delete to authenticated
  using (((bucket_id = 'lesson-files'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));
create policy "Admins can delete media" on storage."objects" as permissive for delete to public
  using (((bucket_id = 'media'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));
create policy "Admins can update lesson files" on storage."objects" as permissive for update to authenticated
  using (((bucket_id = 'lesson-files'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));
create policy "Admins can update media" on storage."objects" as permissive for update to public
  using (((bucket_id = 'media'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));
create policy "Admins can upload lesson files" on storage."objects" as permissive for insert to authenticated
  with check (((bucket_id = 'lesson-files'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));
create policy "Admins moderators and owner can delete event covers" on storage."objects" as permissive for delete to authenticated
  using (((bucket_id = 'event-covers'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text])))))));
create policy "Admins moderators and owner can update event covers" on storage."objects" as permissive for update to authenticated
  using (((bucket_id = 'event-covers'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text])))))))
  with check (((bucket_id = 'event-covers'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text])))))));
create policy "Admins moderators and owner can upload event covers" on storage."objects" as permissive for insert to authenticated
  with check (((bucket_id = 'event-covers'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text])))))));
create policy "Anyone can view course assets" on storage."objects" as permissive for select to public
  using ((bucket_id = 'course-assets'::text));
create policy "Anyone can view event covers" on storage."objects" as permissive for select to public
  using ((bucket_id = 'event-covers'::text));
create policy "Authenticated can view lesson files" on storage."objects" as permissive for select to authenticated
  using ((bucket_id = 'lesson-files'::text));
create policy "Authenticated users can upload media" on storage."objects" as permissive for insert to public
  with check (((bucket_id = 'media'::text) AND (auth.role() = 'authenticated'::text)));
create policy "Authenticated users can upload post attachments" on storage."objects" as permissive for insert to public
  with check (((bucket_id = 'post-attachments'::text) AND (auth.role() = 'authenticated'::text)));
create policy "Media: authenticated list" on storage."objects" as permissive for select to authenticated
  using ((bucket_id = 'media'::text));
create policy "Post attachments: admins list all" on storage."objects" as permissive for select to authenticated
  using (((bucket_id = 'post-attachments'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'owner'::text, 'moderator'::text])))))));
create policy "Post attachments: users list own folder" on storage."objects" as permissive for select to authenticated
  using (((bucket_id = 'post-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can delete their own attachments" on storage."objects" as permissive for delete to public
  using (((bucket_id = 'post-attachments'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
create policy "avatar_delete_authorized_v1" on storage."objects" as permissive for delete to authenticated
  using (((bucket_id = 'avatars'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR ( SELECT private.avatar_editor_aal2() AS avatar_editor_aal2))));
create policy "avatar_insert_authorized_v1" on storage."objects" as permissive for insert to authenticated
  with check (((bucket_id = 'avatars'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR ( SELECT private.avatar_editor_aal2() AS avatar_editor_aal2))));
create policy "avatar_read_authorized_v1" on storage."objects" as permissive for select to authenticated
  using (((bucket_id = 'avatars'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR ( SELECT private.avatar_editor_aal2() AS avatar_editor_aal2))));
create policy "avatar_update_authorized_v1" on storage."objects" as permissive for update to authenticated
  using (((bucket_id = 'avatars'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR ( SELECT private.avatar_editor_aal2() AS avatar_editor_aal2))))
  with check (((bucket_id = 'avatars'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR ( SELECT private.avatar_editor_aal2() AS avatar_editor_aal2))));

-- ---------------- Realtime ----------------
alter publication supabase_realtime add table public."profiles";
alter publication supabase_realtime add table public."posts";
alter publication supabase_realtime add table public."comments";
alter publication supabase_realtime add table public."notifications";
alter publication supabase_realtime add table public."video_sessions";
alter publication supabase_realtime add table public."video_hand_raises";
alter publication supabase_realtime add table public."video_turnos";
