
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_email_broadcast_log": {
                  Row: {
                    "created_at": string,"errors": NonNullable<Json>,"failed": number,"id": string,"notification_id": string | null,"post_id": string | null,"recipients_total": number,"sent": number,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"errors"?: NonNullable<Json>,"failed"?: number,"id"?: string,"notification_id"?: string | null,"post_id"?: string | null,"recipients_total"?: number,"sent"?: number,"status": string
                  }
                  Update: {
                    "created_at"?: string,"errors"?: NonNullable<Json>,"failed"?: number,"id"?: string,"notification_id"?: string | null,"post_id"?: string | null,"recipients_total"?: number,"sent"?: number,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_email_broadcast_log_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"app_config": {
                  Row: {
                    "key": string,"updated_at": string,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": string
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "color": string | null,"created_at": string | null,"description": string | null,"emoji": string | null,"id": string,"name": string,"order_position": number | null,"permissions": string | null,"slug": string,"sort_method": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string | null,"description"?: string | null,"emoji"?: string | null,"id"?: string,"name": string,"order_position"?: number | null,"permissions"?: string | null,"slug": string,"sort_method"?: string | null
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string | null,"description"?: string | null,"emoji"?: string | null,"id"?: string,"name"?: string,"order_position"?: number | null,"permissions"?: string | null,"slug"?: string,"sort_method"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"comments": {
                  Row: {
                    "agent_id": string | null,"audio_url": string | null,"author_id": string | null,"content": string,"created_at": string | null,"id": string,"lesson_id": string | null,"likes_count": number | null,"media_urls": Json | null,"parent_id": string | null,"post_id": string | null,"updated_at": string | null,"video_embed_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_id"?: string | null,"audio_url"?: string | null,"author_id"?: string | null,"content": string,"created_at"?: string | null,"id"?: string,"lesson_id"?: string | null,"likes_count"?: number | null,"media_urls"?: Json | null,"parent_id"?: string | null,"post_id"?: string | null,"updated_at"?: string | null,"video_embed_url"?: string | null
                  }
                  Update: {
                    "agent_id"?: string | null,"audio_url"?: string | null,"author_id"?: string | null,"content"?: string,"created_at"?: string | null,"id"?: string,"lesson_id"?: string | null,"likes_count"?: number | null,"media_urls"?: Json | null,"parent_id"?: string | null,"post_id"?: string | null,"updated_at"?: string | null,"video_embed_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"community_settings": {
                  Row: {
                    "cover_image_url": string | null,"created_at": string | null,"description": string | null,"id": string,"logo_url": string | null,"name": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_image_url"?: string | null,"created_at"?: string | null,"description"?: string | null,"id"?: string,"logo_url"?: string | null,"name"?: string,"updated_at"?: string | null
                  }
                  Update: {
                    "cover_image_url"?: string | null,"created_at"?: string | null,"description"?: string | null,"id"?: string,"logo_url"?: string | null,"name"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"course_access_grants": {
                  Row: {
                    "course_id": string,"created_at": string | null,"expires_at": string | null,"grant_type": string,"granted_at": string,"granted_by": string | null,"id": string,"metadata": Json | null,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string | null,"expires_at"?: string | null,"grant_type": string,"granted_at"?: string,"granted_by"?: string | null,"id"?: string,"metadata"?: Json | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string | null,"expires_at"?: string | null,"grant_type"?: string,"granted_at"?: string,"granted_by"?: string | null,"id"?: string,"metadata"?: Json | null,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_access_grants_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_access_grants_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_access_grants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"course_loves": {
                  Row: {
                    "course_id": string,"created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_loves_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_loves_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"courses": {
                  Row: {
                    "access_type": string,"created_at": string | null,"created_by": string,"description": string | null,"id": string,"order_position": number | null,"price_cents": number | null,"published": boolean | null,"thumbnail_url": string | null,"tier_bypass_enabled": boolean | null,"tier_bypass_min": string | null,"title": string,"unlock_after_days": number | null,"unlock_level": number | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_type"?: string,"created_at"?: string | null,"created_by": string,"description"?: string | null,"id"?: string,"order_position"?: number | null,"price_cents"?: number | null,"published"?: boolean | null,"thumbnail_url"?: string | null,"tier_bypass_enabled"?: boolean | null,"tier_bypass_min"?: string | null,"title": string,"unlock_after_days"?: number | null,"unlock_level"?: number | null,"updated_at"?: string | null
                  }
                  Update: {
                    "access_type"?: string,"created_at"?: string | null,"created_by"?: string,"description"?: string | null,"id"?: string,"order_position"?: number | null,"price_cents"?: number | null,"published"?: boolean | null,"thumbnail_url"?: string | null,"tier_bypass_enabled"?: boolean | null,"tier_bypass_min"?: string | null,"title"?: string,"unlock_after_days"?: number | null,"unlock_level"?: number | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "courses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_reminders": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"lead_minutes": number,"sent_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"lead_minutes"?: number,"sent_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"lead_minutes"?: number,"sent_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_reminders_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_reminders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_series": {
                  Row: {
                    "cover_image_url": string | null,"created_at": string,"created_by": string,"description": string | null,"duration_minutes": number,"host_id": string,"id": string,"required_level": number,"required_tier": string,"rrule": string,"status": string,"timezone": string,"title": string,"updated_at": string,"use_native_room": boolean,"visible_to_tier": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_image_url"?: string | null,"created_at"?: string,"created_by": string,"description"?: string | null,"duration_minutes"?: number,"host_id": string,"id"?: string,"required_level"?: number,"required_tier"?: string,"rrule": string,"status"?: string,"timezone"?: string,"title": string,"updated_at"?: string,"use_native_room"?: boolean,"visible_to_tier"?: string
                  }
                  Update: {
                    "cover_image_url"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"duration_minutes"?: number,"host_id"?: string,"id"?: string,"required_level"?: number,"required_tier"?: string,"rrule"?: string,"status"?: string,"timezone"?: string,"title"?: string,"updated_at"?: string,"use_native_room"?: boolean,"visible_to_tier"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_series_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_series_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cover_image_url": string | null,"created_at": string | null,"created_by": string,"description": string | null,"duration_minutes": number | null,"end_time": string | null,"google_meet_link": string | null,"host_id": string | null,"id": string,"is_exception": boolean,"is_recurring": boolean | null,"modo_sala": string | null,"parent_event_id": string | null,"recording_url": string | null,"recurrence_pattern": Json | null,"required_level": number,"required_tier": string,"series_id": string | null,"start_time": string,"status": string,"timezone": string | null,"title": string,"updated_at": string | null,"visible_to_tier": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cover_image_url"?: string | null,"created_at"?: string | null,"created_by": string,"description"?: string | null,"duration_minutes"?: number | null,"end_time"?: string | null,"google_meet_link"?: string | null,"host_id"?: string | null,"id"?: string,"is_exception"?: boolean,"is_recurring"?: boolean | null,"modo_sala"?: string | null,"parent_event_id"?: string | null,"recording_url"?: string | null,"recurrence_pattern"?: Json | null,"required_level"?: number,"required_tier"?: string,"series_id"?: string | null,"start_time": string,"status"?: string,"timezone"?: string | null,"title": string,"updated_at"?: string | null,"visible_to_tier"?: string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cover_image_url"?: string | null,"created_at"?: string | null,"created_by"?: string,"description"?: string | null,"duration_minutes"?: number | null,"end_time"?: string | null,"google_meet_link"?: string | null,"host_id"?: string | null,"id"?: string,"is_exception"?: boolean,"is_recurring"?: boolean | null,"modo_sala"?: string | null,"parent_event_id"?: string | null,"recording_url"?: string | null,"recurrence_pattern"?: Json | null,"required_level"?: number,"required_tier"?: string,"series_id"?: string | null,"start_time"?: string,"status"?: string,"timezone"?: string | null,"title"?: string,"updated_at"?: string | null,"visible_to_tier"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_parent_event_id_fkey"
      columns: ["parent_event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_series_id_fkey"
      columns: ["series_id"]
isOneToOne: false
      referencedRelation: "event_series"
      referencedColumns: ["id"]
    }
                  ]
                },"folders": {
                  Row: {
                    "course_id": string | null,"created_at": string | null,"id": string,"module_id": string | null,"order_position": number | null,"published": boolean | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id"?: string | null,"created_at"?: string | null,"id"?: string,"module_id"?: string | null,"order_position"?: number | null,"published"?: boolean | null,"title": string
                  }
                  Update: {
                    "course_id"?: string | null,"created_at"?: string | null,"id"?: string,"module_id"?: string | null,"order_position"?: number | null,"published"?: boolean | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "folders_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_progress": {
                  Row: {
                    "completed": boolean | null,"completed_at": string | null,"created_at": string | null,"id": string,"lesson_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed"?: boolean | null,"completed_at"?: string | null,"created_at"?: string | null,"id"?: string,"lesson_id": string,"user_id": string
                  }
                  Update: {
                    "completed"?: boolean | null,"completed_at"?: string | null,"created_at"?: string | null,"id"?: string,"lesson_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_progress_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_progress_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"lessons": {
                  Row: {
                    "attachments": Json | null,"comments_count": number | null,"content": string | null,"content_format": string,"content_v2": string | null,"course_id": string | null,"created_at": string | null,"file_urls": Json | null,"folder_id": string | null,"id": string,"linked_post_id": string | null,"order_position": number | null,"published": boolean | null,"search_text": string | null,"title": string,"updated_at": string | null,"video_embed_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attachments"?: Json | null,"comments_count"?: number | null,"content"?: string | null,"content_format"?: string,"content_v2"?: string | null,"course_id"?: string | null,"created_at"?: string | null,"file_urls"?: Json | null,"folder_id"?: string | null,"id"?: string,"linked_post_id"?: string | null,"order_position"?: number | null,"published"?: boolean | null,"search_text"?: string | null,"title": string,"updated_at"?: string | null,"video_embed_url"?: string | null
                  }
                  Update: {
                    "attachments"?: Json | null,"comments_count"?: number | null,"content"?: string | null,"content_format"?: string,"content_v2"?: string | null,"course_id"?: string | null,"created_at"?: string | null,"file_urls"?: Json | null,"folder_id"?: string | null,"id"?: string,"linked_post_id"?: string | null,"order_position"?: number | null,"published"?: boolean | null,"search_text"?: string | null,"title"?: string,"updated_at"?: string | null,"video_embed_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_linked_post_id_fkey"
      columns: ["linked_post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"level_rewards": {
                  Row: {
                    "agent_rewards": Json | null,"created_at": string | null,"description": string,"expanded_description": string | null,"expanded_title": string | null,"icon": string,"id": string,"is_active": boolean | null,"level": number,"preview_image_url": string | null,"repo_config": Json | null,"rewards": Json | null,"title": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_rewards"?: Json | null,"created_at"?: string | null,"description": string,"expanded_description"?: string | null,"expanded_title"?: string | null,"icon"?: string,"id"?: string,"is_active"?: boolean | null,"level": number,"preview_image_url"?: string | null,"repo_config"?: Json | null,"rewards"?: Json | null,"title": string,"updated_at"?: string | null
                  }
                  Update: {
                    "agent_rewards"?: Json | null,"created_at"?: string | null,"description"?: string,"expanded_description"?: string | null,"expanded_title"?: string | null,"icon"?: string,"id"?: string,"is_active"?: boolean | null,"level"?: number,"preview_image_url"?: string | null,"repo_config"?: Json | null,"rewards"?: Json | null,"title"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"likes": {
                  Row: {
                    "comment_id": string | null,"created_at": string | null,"id": string,"post_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment_id"?: string | null,"created_at"?: string | null,"id"?: string,"post_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "comment_id"?: string | null,"created_at"?: string | null,"id"?: string,"post_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "likes_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "likes_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"mentions": {
                  Row: {
                    "comment_id": string | null,"created_at": string | null,"id": string,"mentioned_by_user_id": string,"mentioned_user_id": string,"post_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "comment_id"?: string | null,"created_at"?: string | null,"id"?: string,"mentioned_by_user_id": string,"mentioned_user_id": string,"post_id"?: string | null
                  }
                  Update: {
                    "comment_id"?: string | null,"created_at"?: string | null,"id"?: string,"mentioned_by_user_id"?: string,"mentioned_user_id"?: string,"post_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mentions_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mentions_mentioned_by_user_id_fkey"
      columns: ["mentioned_by_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mentions_mentioned_user_id_fkey"
      columns: ["mentioned_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mentions_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "author_avatar": string | null,"body": string | null,"created_at": string | null,"data": Json | null,"id": string,"read": boolean | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_avatar"?: string | null,"body"?: string | null,"created_at"?: string | null,"data"?: Json | null,"id"?: string,"read"?: boolean | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "author_avatar"?: string | null,"body"?: string | null,"created_at"?: string | null,"data"?: Json | null,"id"?: string,"read"?: boolean | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"point_transactions": {
                  Row: {
                    "action": string,"created_at": string | null,"id": string,"is_retroactive": boolean,"points": number,"source_id": string | null,"source_type": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string | null,"id"?: string,"is_retroactive"?: boolean,"points": number,"source_id"?: string | null,"source_type"?: string | null,"user_id": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string | null,"id"?: string,"is_retroactive"?: boolean,"points"?: number,"source_id"?: string | null,"source_type"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "point_transactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"poll_options": {
                  Row: {
                    "created_at": string | null,"id": string,"order_position": number | null,"poll_id": string,"text": string,"votes_count": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"order_position"?: number | null,"poll_id": string,"text": string,"votes_count"?: number | null
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"order_position"?: number | null,"poll_id"?: string,"text"?: string,"votes_count"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_options_poll_id_fkey"
      columns: ["poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["id"]
    }
                  ]
                },"poll_votes": {
                  Row: {
                    "created_at": string | null,"id": string,"poll_option_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"poll_option_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"poll_option_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_votes_poll_option_id_fkey"
      columns: ["poll_option_id"]
isOneToOne: false
      referencedRelation: "poll_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_votes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"polls": {
                  Row: {
                    "allow_multiple": boolean | null,"created_at": string | null,"id": string,"post_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_multiple"?: boolean | null,"created_at"?: string | null,"id"?: string,"post_id": string
                  }
                  Update: {
                    "allow_multiple"?: boolean | null,"created_at"?: string | null,"id"?: string,"post_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "polls_post_id_fkey"
      columns: ["post_id"]
isOneToOne: true
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"post_favorites": {
                  Row: {
                    "created_at": string,"id": string,"post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"post_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_favorites_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_views": {
                  Row: {
                    "id": string,"post_id": string,"user_id": string,"viewed_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"post_id": string,"user_id": string,"viewed_at"?: string
                  }
                  Update: {
                    "id"?: string,"post_id"?: string,"user_id"?: string,"viewed_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_views_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_views_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "agent_author_id": string | null,"author_id": string,"category_id": string,"comments_count": number | null,"content": string,"created_at": string | null,"favorites_count": number | null,"hidden_at": string | null,"hidden_from_feed": boolean,"hidden_reason": string | null,"id": string,"is_draft": boolean | null,"last_activity_at": string,"likes_count": number | null,"media_urls": Json | null,"notificar_comunidad": boolean,"pin_order": number | null,"pinned": boolean | null,"pinned_until": string | null,"send_email_notification": boolean | null,"title": string | null,"updated_at": string | null,"video_embed_url": string | null,"emit_admin_post_notification": undefined | null
                  }
                  ComputedFields: "emit_admin_post_notification"
                  Insert: {
                    "agent_author_id"?: string | null,"author_id": string,"category_id": string,"comments_count"?: number | null,"content": string,"created_at"?: string | null,"favorites_count"?: number | null,"hidden_at"?: string | null,"hidden_from_feed"?: boolean,"hidden_reason"?: string | null,"id"?: string,"is_draft"?: boolean | null,"last_activity_at"?: string,"likes_count"?: number | null,"media_urls"?: Json | null,"notificar_comunidad"?: boolean,"pin_order"?: number | null,"pinned"?: boolean | null,"pinned_until"?: string | null,"send_email_notification"?: boolean | null,"title"?: string | null,"updated_at"?: string | null,"video_embed_url"?: string | null
                  }
                  Update: {
                    "agent_author_id"?: string | null,"author_id"?: string,"category_id"?: string,"comments_count"?: number | null,"content"?: string,"created_at"?: string | null,"favorites_count"?: number | null,"hidden_at"?: string | null,"hidden_from_feed"?: boolean,"hidden_reason"?: string | null,"id"?: string,"is_draft"?: boolean | null,"last_activity_at"?: string,"likes_count"?: number | null,"media_urls"?: Json | null,"notificar_comunidad"?: boolean,"pin_order"?: number | null,"pinned"?: boolean | null,"pinned_until"?: string | null,"send_email_notification"?: boolean | null,"title"?: string | null,"updated_at"?: string | null,"video_embed_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"created_at": string | null,"current_level": number | null,"email": string | null,"email_notifications_enabled": boolean | null,"first_name": string | null,"full_name": string,"github_username": string | null,"has_community_access": boolean,"id": string,"is_agent": boolean | null,"last_name": string | null,"last_seen": string | null,"location_city": string | null,"location_country": string | null,"location_lat": number | null,"location_lng": number | null,"location_visible": boolean | null,"onboarding_completed": boolean | null,"role": string,"show_in_leaderboard": boolean | null,"tier": string,"timezone": string | null,"total_points": number | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string | null,"current_level"?: number | null,"email"?: string | null,"email_notifications_enabled"?: boolean | null,"first_name"?: string | null,"full_name": string,"github_username"?: string | null,"has_community_access"?: boolean,"id": string,"is_agent"?: boolean | null,"last_name"?: string | null,"last_seen"?: string | null,"location_city"?: string | null,"location_country"?: string | null,"location_lat"?: number | null,"location_lng"?: number | null,"location_visible"?: boolean | null,"onboarding_completed"?: boolean | null,"role"?: string,"show_in_leaderboard"?: boolean | null,"tier"?: string,"timezone"?: string | null,"total_points"?: number | null,"updated_at"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string | null,"current_level"?: number | null,"email"?: string | null,"email_notifications_enabled"?: boolean | null,"first_name"?: string | null,"full_name"?: string,"github_username"?: string | null,"has_community_access"?: boolean,"id"?: string,"is_agent"?: boolean | null,"last_name"?: string | null,"last_seen"?: string | null,"location_city"?: string | null,"location_country"?: string | null,"location_lat"?: number | null,"location_lng"?: number | null,"location_visible"?: boolean | null,"onboarding_completed"?: boolean | null,"role"?: string,"show_in_leaderboard"?: boolean | null,"tier"?: string,"timezone"?: string | null,"total_points"?: number | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"push_send_log": {
                  Row: {
                    "created_at": string,"error": string | null,"id": number,"notification_type": string | null,"outcome": string,"platform": string,"status_code": number | null,"subscription_id": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"id"?: never,"notification_type"?: string | null,"outcome": string,"platform": string,"status_code"?: number | null,"subscription_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"id"?: never,"notification_type"?: string | null,"outcome"?: string,"platform"?: string,"status_code"?: number | null,"subscription_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"browser": string | null,"created_at": string,"device_name": string | null,"endpoint": string,"failed_attempts": number,"id": string,"last_failure_at": string | null,"last_used_at": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"browser"?: string | null,"created_at"?: string,"device_name"?: string | null,"endpoint": string,"failed_attempts"?: number,"id"?: string,"last_failure_at"?: string | null,"last_used_at"?: string,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"browser"?: string | null,"created_at"?: string,"device_name"?: string | null,"endpoint"?: string,"failed_attempts"?: number,"id"?: string,"last_failure_at"?: string | null,"last_used_at"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"video_audio_events": {
                  Row: {
                    "client_ts": string,"created_at": string,"detail": NonNullable<Json>,"event": string,"id": string,"participant_sid": string | null,"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_ts": string,"created_at"?: string,"detail"?: NonNullable<Json>,"event": string,"id"?: string,"participant_sid"?: string | null,"session_id": string,"user_id": string
                  }
                  Update: {
                    "client_ts"?: string,"created_at"?: string,"detail"?: NonNullable<Json>,"event"?: string,"id"?: string,"participant_sid"?: string | null,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_audio_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "video_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_audio_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"video_entry_attempts": {
                  Row: {
                    "client_status": string | null,"created_at": string,"error_code": string | null,"http_status": number | null,"id": string,"room_id": string | null,"session_id": string | null,"token_status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_status"?: string | null,"created_at"?: string,"error_code"?: string | null,"http_status"?: number | null,"id"?: string,"room_id"?: string | null,"session_id"?: string | null,"token_status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "client_status"?: string | null,"created_at"?: string,"error_code"?: string | null,"http_status"?: number | null,"id"?: string,"room_id"?: string | null,"session_id"?: string | null,"token_status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_entry_attempts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"video_hand_raises": {
                  Row: {
                    "acknowledged_at": string | null,"created_at": string | null,"id": string,"lowered_at": string | null,"position_in_queue": number | null,"priority": string | null,"raised_at": string | null,"session_id": string,"user_id": string,"was_addressed": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string | null,"created_at"?: string | null,"id"?: string,"lowered_at"?: string | null,"position_in_queue"?: number | null,"priority"?: string | null,"raised_at"?: string | null,"session_id": string,"user_id": string,"was_addressed"?: boolean | null
                  }
                  Update: {
                    "acknowledged_at"?: string | null,"created_at"?: string | null,"id"?: string,"lowered_at"?: string | null,"position_in_queue"?: number | null,"priority"?: string | null,"raised_at"?: string | null,"session_id"?: string,"user_id"?: string,"was_addressed"?: boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_hand_raises_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "video_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_hand_raises_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"video_participants": {
                  Row: {
                    "connection_quality_avg": number | null,"created_at": string | null,"device_info": Json | null,"had_audio": boolean | null,"had_screen_share": boolean | null,"had_video": boolean | null,"id": string,"joined_at": string | null,"left_at": string | null,"left_at_unreliable": boolean,"nota_calidad": string | null,"participant_sid": string | null,"points_awarded": number | null,"role": string,"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_quality_avg"?: number | null,"created_at"?: string | null,"device_info"?: Json | null,"had_audio"?: boolean | null,"had_screen_share"?: boolean | null,"had_video"?: boolean | null,"id"?: string,"joined_at"?: string | null,"left_at"?: string | null,"left_at_unreliable"?: boolean,"nota_calidad"?: string | null,"participant_sid"?: string | null,"points_awarded"?: number | null,"role"?: string,"session_id": string,"user_id": string
                  }
                  Update: {
                    "connection_quality_avg"?: number | null,"created_at"?: string | null,"device_info"?: Json | null,"had_audio"?: boolean | null,"had_screen_share"?: boolean | null,"had_video"?: boolean | null,"id"?: string,"joined_at"?: string | null,"left_at"?: string | null,"left_at_unreliable"?: boolean,"nota_calidad"?: string | null,"participant_sid"?: string | null,"points_awarded"?: number | null,"role"?: string,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_participants_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "video_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"video_recordings": {
                  Row: {
                    "action_items": Json | null,"calidad": string | null,"calidad_detalle": Json | null,"community_post_id": string | null,"created_at": string | null,"diarized_transcript": string | null,"duration_seconds": number | null,"egress_id": string | null,"file_size_bytes": number | null,"format": string | null,"id": string,"lesson_id": string | null,"processing_status": string | null,"recording_type": string | null,"session_id": string,"status": string | null,"storage_path": string | null,"storage_url": string | null,"summary_text": string | null,"thumbnail_url": string | null,"transcript_text": string | null,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action_items"?: Json | null,"calidad"?: string | null,"calidad_detalle"?: Json | null,"community_post_id"?: string | null,"created_at"?: string | null,"diarized_transcript"?: string | null,"duration_seconds"?: number | null,"egress_id"?: string | null,"file_size_bytes"?: number | null,"format"?: string | null,"id"?: string,"lesson_id"?: string | null,"processing_status"?: string | null,"recording_type"?: string | null,"session_id": string,"status"?: string | null,"storage_path"?: string | null,"storage_url"?: string | null,"summary_text"?: string | null,"thumbnail_url"?: string | null,"transcript_text"?: string | null,"video_url"?: string | null
                  }
                  Update: {
                    "action_items"?: Json | null,"calidad"?: string | null,"calidad_detalle"?: Json | null,"community_post_id"?: string | null,"created_at"?: string | null,"diarized_transcript"?: string | null,"duration_seconds"?: number | null,"egress_id"?: string | null,"file_size_bytes"?: number | null,"format"?: string | null,"id"?: string,"lesson_id"?: string | null,"processing_status"?: string | null,"recording_type"?: string | null,"session_id"?: string,"status"?: string | null,"storage_path"?: string | null,"storage_url"?: string | null,"summary_text"?: string | null,"thumbnail_url"?: string | null,"transcript_text"?: string | null,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_recordings_community_post_id_fkey"
      columns: ["community_post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_recordings_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_recordings_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "video_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"video_room_settings": {
                  Row: {
                    "allow_chat": boolean | null,"allow_hand_raise": boolean | null,"allow_recording": boolean | null,"allow_screen_share": boolean | null,"auto_record": boolean | null,"created_at": string | null,"id": string,"layout_default": string | null,"max_duration_minutes": number | null,"min_level_for_camera": number | null,"min_level_for_mic": number | null,"min_level_for_screen_share": number | null,"mute_on_join": boolean | null,"presupuesto_total_segundos": number,"require_recording_consent": boolean | null,"required_tier": string | null,"room_id": string,"turno_max_segundos": number,"updated_at": string | null,"waiting_room_enabled": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_chat"?: boolean | null,"allow_hand_raise"?: boolean | null,"allow_recording"?: boolean | null,"allow_screen_share"?: boolean | null,"auto_record"?: boolean | null,"created_at"?: string | null,"id"?: string,"layout_default"?: string | null,"max_duration_minutes"?: number | null,"min_level_for_camera"?: number | null,"min_level_for_mic"?: number | null,"min_level_for_screen_share"?: number | null,"mute_on_join"?: boolean | null,"presupuesto_total_segundos"?: number,"require_recording_consent"?: boolean | null,"required_tier"?: string | null,"room_id": string,"turno_max_segundos"?: number,"updated_at"?: string | null,"waiting_room_enabled"?: boolean | null
                  }
                  Update: {
                    "allow_chat"?: boolean | null,"allow_hand_raise"?: boolean | null,"allow_recording"?: boolean | null,"allow_screen_share"?: boolean | null,"auto_record"?: boolean | null,"created_at"?: string | null,"id"?: string,"layout_default"?: string | null,"max_duration_minutes"?: number | null,"min_level_for_camera"?: number | null,"min_level_for_mic"?: number | null,"min_level_for_screen_share"?: number | null,"mute_on_join"?: boolean | null,"presupuesto_total_segundos"?: number,"require_recording_consent"?: boolean | null,"required_tier"?: string | null,"room_id"?: string,"turno_max_segundos"?: number,"updated_at"?: string | null,"waiting_room_enabled"?: boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_room_settings_room_id_fkey"
      columns: ["room_id"]
isOneToOne: true
      referencedRelation: "video_rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"video_rooms": {
                  Row: {
                    "created_at": string | null,"created_by": string,"event_id": string | null,"id": string,"livekit_room_name": string | null,"max_participants": number | null,"name": string,"room_type": string,"settings": Json | null,"slug": string,"status": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"created_by": string,"event_id"?: string | null,"id"?: string,"livekit_room_name"?: string | null,"max_participants"?: number | null,"name": string,"room_type"?: string,"settings"?: Json | null,"slug": string,"status"?: string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"created_by"?: string,"event_id"?: string | null,"id"?: string,"livekit_room_name"?: string | null,"max_participants"?: number | null,"name"?: string,"room_type"?: string,"settings"?: Json | null,"slug"?: string,"status"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_rooms_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_rooms_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"video_sessions": {
                  Row: {
                    "anfitrion_entro_at": string | null,"cerrada_por": string | null,"cierre_at": string | null,"created_at": string | null,"ended_at": string | null,"estado_version": number,"id": string,"metadata": Json | null,"modo": string,"modo_cambiado_at": string | null,"peak_participants": number | null,"reconciliado_at": string | null,"recording_status": string | null,"room_id": string,"started_at": string | null,"total_unique_participants": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anfitrion_entro_at"?: string | null,"cerrada_por"?: string | null,"cierre_at"?: string | null,"created_at"?: string | null,"ended_at"?: string | null,"estado_version"?: number,"id"?: string,"metadata"?: Json | null,"modo"?: string,"modo_cambiado_at"?: string | null,"peak_participants"?: number | null,"reconciliado_at"?: string | null,"recording_status"?: string | null,"room_id": string,"started_at"?: string | null,"total_unique_participants"?: number | null
                  }
                  Update: {
                    "anfitrion_entro_at"?: string | null,"cerrada_por"?: string | null,"cierre_at"?: string | null,"created_at"?: string | null,"ended_at"?: string | null,"estado_version"?: number,"id"?: string,"metadata"?: Json | null,"modo"?: string,"modo_cambiado_at"?: string | null,"peak_participants"?: number | null,"reconciliado_at"?: string | null,"recording_status"?: string | null,"room_id"?: string,"started_at"?: string | null,"total_unique_participants"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_sessions_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "video_rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"video_turnos": {
                  Row: {
                    "bonus_segundos": number,"concedido_at": string,"concedido_por": string | null,"created_at": string,"id": string,"identity": string,"motivo_fin": string | null,"session_id": string,"terminado_at": string | null,"vence_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bonus_segundos"?: number,"concedido_at"?: string,"concedido_por"?: string | null,"created_at"?: string,"id"?: string,"identity": string,"motivo_fin"?: string | null,"session_id": string,"terminado_at"?: string | null,"vence_at": string
                  }
                  Update: {
                    "bonus_segundos"?: number,"concedido_at"?: string,"concedido_por"?: string | null,"created_at"?: string,"id"?: string,"identity"?: string,"motivo_fin"?: string | null,"session_id"?: string,"terminado_at"?: string | null,"vence_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_turnos_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "video_sessions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_points_to_user":
{ Args: { "p_action": string,"p_points": number,"p_source_id"?: string,"p_source_type"?: string,"p_user_id": string }; Returns: undefined
                           },
"award_class_attendance":
{ Args: { "p_class_id": string,"p_user_ids": (string)[] }; Returns: number
                           },
"award_video_session_attendance":
{ Args: { "p_session_id": string }; Returns: number
                           },
"calculate_level":
{ Args: { "points": number }; Returns: number
                           },
"create_batch_notifications":
{ Args: { "p_body": string,"p_data"?: Json,"p_title": string,"p_type": string,"p_user_ids": (string)[] }; Returns: number
                           },
"create_email_broadcast_notification":
{ Args: { "p_author_avatar": string,"p_author_id": string,"p_author_name": string,"p_media_urls": Json,"p_post_content": string,"p_post_id": string,"p_post_title": string }; Returns: undefined
                           },
"emit_admin_post_notification":
{ Args: { "p": Omit<Database["public"]['Tables']["posts"]['Row'], Database["public"]['Tables']["posts"]['ComputedFields']> }; Returns: undefined
                           },
"ensure_event_video_room":
{ Args: { "p_event_id": string }; Returns: Json
                           },
"get_all_users_except":
{ Args: { "excluded_user_id": string }; Returns: (string)[]
                           },
"get_email_eligible_members":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"full_name": string,"user_id": string
            }[]
                           },
"get_leaderboard_by_period":
{ Args: { "period_type": string,"result_limit"?: number }; Returns: {
              "avatar_url": string,"current_level": number,"full_name": string,"is_annual": boolean,"points_in_period": number,"rank": number,"total_points": number,"user_id": string
            }[]
                           },
"get_level_distribution":
{ Args: Record<PropertyKey, never>; Returns: {
              "level": number,"member_count": number
            }[]
                           },
"is_video_admin":
{ Args: { "check_user_id": string }; Returns: boolean
                           },
"remove_points_from_user":
{ Args: { "p_action": string,"p_points": number,"p_source_id"?: string,"p_source_type"?: string,"p_user_id": string }; Returns: undefined
                           },
"toggle_comment_like":
{ Args: { "p_comment_id": string }; Returns: boolean
                           },
"toggle_post_like":
{ Args: { "p_post_id": string }; Returns: boolean
                           },
"unvote_poll_option":
{ Args: { "option_id": string }; Returns: undefined
                           },
"video_class_attendance":
{ Args: { "p_class_id": string }; Returns: {
              "minutes_attended": number,"user_id": string
            }[]
                           },
"vote_poll_option":
{ Args: { "option_id": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
