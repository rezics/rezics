CREATE TYPE "alias_kind" AS ENUM('common', 'abbreviation', 'transliteration', 'alternate_title', 'legacy_title', 'misspelling', 'other');--> statement-breakpoint
CREATE TYPE "collection_kind" AS ENUM('custom', 'favorites');--> statement-breakpoint
CREATE TYPE "poll_mode" AS ENUM('single', 'multiple');--> statement-breakpoint
CREATE TYPE "poll_result_visibility" AS ENUM('live', 'after_close');--> statement-breakpoint
CREATE TYPE "post_kind" AS ENUM('post', 'review', 'chapter');--> statement-breakpoint
CREATE TYPE "realm_join_policy" AS ENUM('open', 'approval');--> statement-breakpoint
CREATE TYPE "notification_email_status" AS ENUM('not_requested', 'pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "notification_kind" AS ENUM('reply', 'follow', 'direct_message', 'moderation', 'realm', 'system');--> statement-breakpoint
CREATE TYPE "progress_status" AS ENUM('backlog', 'active', 'paused', 'completed', 'dropped');--> statement-breakpoint
CREATE TYPE "reaction_kind" AS ENUM('upvote', 'downvote');--> statement-breakpoint
CREATE TYPE "ai_disclosure" AS ENUM('unknown', 'none', 'ai_assisted', 'ai_originated', 'machine_generated');--> statement-breakpoint
CREATE TYPE "collaborator_role" AS ENUM('owner', 'editor');--> statement-breakpoint
CREATE TYPE "content_rating" AS ENUM('general', 'r15', 'r18', 'r18g');--> statement-breakpoint
CREATE TYPE "content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "moderation_status" AS ENUM('approved', 'pending', 'removed');--> statement-breakpoint
CREATE TYPE "unit_kind" AS ENUM('profile', 'book', 'game', 'media', 'entity', 'tag', 'series', 'zone', 'collection', 'post', 'poll', 'realm');--> statement-breakpoint
CREATE TYPE "unit_revision_event" AS ENUM('create', 'update', 'delete', 'restore');--> statement-breakpoint
CREATE TYPE "unit_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "unit_visibility" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
CREATE TYPE "enforcement_kind" AS ENUM('warning', 'silence', 'suspension', 'ban', 'rate_limit', 'trust_restriction');--> statement-breakpoint
CREATE TYPE "feedback_kind" AS ENUM('report', 'bug', 'feature', 'other');--> statement-breakpoint
CREATE TYPE "moderation_action_kind" AS ENUM('approve', 'remove', 'restore', 'lock', 'unlock', 'field_lock', 'field_unlock', 'warning', 'silence', 'suspension', 'ban', 'rate_limit', 'trust_restriction', 'revoke_enforcement', 'mute_member', 'remove_member', 'ban_member', 'restore_member', 'escalate', 'reverse', 'note');--> statement-breakpoint
CREATE TYPE "moderation_authority" AS ENUM('platform', 'realm');--> statement-breakpoint
CREATE TYPE "moderation_case_state" AS ENUM('new', 'triaged', 'assigned', 'actioned', 'resolved', 'duplicate', 'rejected', 'escalated', 'reviewing');--> statement-breakpoint
CREATE TYPE "moderation_target_kind" AS ENUM('unit', 'unit_field', 'comment', 'profile', 'realm_content', 'realm_member', 'feedback');--> statement-breakpoint
CREATE TYPE "capability_authority" AS ENUM('platform', 'realm');--> statement-breakpoint
CREATE TYPE "realm_member_role" AS ENUM('owner', 'admin', 'moderator', 'member');--> statement-breakpoint
CREATE TYPE "realm_member_state" AS ENUM('active', 'pending', 'muted', 'removed', 'banned');--> statement-breakpoint
CREATE TYPE "realm_pin_kind" AS ENUM('pinned', 'highlight');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp(3) with time zone,
	"refresh_token_expires_at" timestamp(3) with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"expires_at" timestamp(3) with time zone NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book" (
	"id" uuid PRIMARY KEY,
	"isbn13" text,
	"publication_date" date,
	"page_count" integer,
	"format" text,
	"licensed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_isbn13_check" CHECK ("isbn13" is null or "isbn13" ~ '^[0-9]{13}$'),
	CONSTRAINT "book_page_count_check" CHECK ("page_count" is null or "page_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY,
	"owner_profile_id" uuid NOT NULL,
	"kind" "collection_kind" DEFAULT 'custom'::"collection_kind" NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity" (
	"id" uuid PRIMARY KEY,
	"kind" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"avatar" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_kind_not_blank" CHECK (btrim("kind") <> '')
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" uuid PRIMARY KEY,
	"release_date" date,
	"version_label" text,
	"licensed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_requirement" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"game_id" uuid NOT NULL,
	"platform_entity_id" uuid,
	"tier" text NOT NULL,
	"language" text,
	"source_link_id" uuid,
	"hardware" jsonb NOT NULL,
	"raw_text" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_requirement_identity_key" UNIQUE NULLS NOT DISTINCT("game_id","platform_entity_id","tier","language"),
	CONSTRAINT "game_requirement_tier_not_blank" CHECK (btrim("tier") <> ''),
	CONSTRAINT "game_requirement_hardware_json_object_check" CHECK ("hardware" is null or jsonb_typeof("hardware") = 'object')
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY,
	"kind" text NOT NULL,
	"release_date" date,
	"runtime_minutes" integer,
	"episode_count" integer,
	"season_count" integer,
	"licensed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_kind_not_blank" CHECK (btrim("kind") <> ''),
	CONSTRAINT "media_runtime_check" CHECK ("runtime_minutes" is null or "runtime_minutes" > 0),
	CONSTRAINT "media_episode_count_check" CHECK ("episode_count" is null or "episode_count" > 0),
	CONSTRAINT "media_season_count_check" CHECK ("season_count" is null or "season_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "poll" (
	"id" uuid PRIMARY KEY,
	"mode" "poll_mode" DEFAULT 'single'::"poll_mode" NOT NULL,
	"result_visibility" "poll_result_visibility" DEFAULT 'live'::"poll_result_visibility" NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"closes_at" timestamp(3) with time zone,
	"closed_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_closes_at_check" CHECK ("closes_at" is null or "closes_at" > "created_at"),
	CONSTRAINT "poll_closed_at_check" CHECK ("closed_at" is null or "closed_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY,
	"author_profile_id" uuid NOT NULL,
	"subject_unit_id" uuid,
	"kind" "post_kind" DEFAULT 'post'::"post_kind" NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_subject_not_self_check" CHECK ("subject_unit_id" is null or "subject_unit_id" <> "id"),
	CONSTRAINT "post_review_subject_check" CHECK ("kind" <> 'review'::post_kind or "subject_unit_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "realm" (
	"id" uuid PRIMARY KEY,
	"join_policy" "realm_join_policy" DEFAULT 'open'::"realm_join_policy" NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY,
	"kind" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_kind_not_blank" CHECK (btrim("kind") <> '')
);
--> statement-breakpoint
CREATE TABLE "series_release" (
	"series_id" uuid,
	"release_unit_id" uuid,
	"position" text NOT NULL,
	"label" text,
	"released_on" date,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_release_pkey" PRIMARY KEY("series_id","release_unit_id"),
	CONSTRAINT "series_release_not_self_check" CHECK ("series_id" <> "release_unit_id")
);
--> statement-breakpoint
CREATE TABLE "unit_alias" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unit_id" uuid NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"language" text,
	"kind" "alias_kind" DEFAULT 'common'::"alias_kind" NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"position" text,
	"created_by_profile_id" uuid,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_alias_value_not_blank" CHECK (btrim("value") <> '' and btrim("normalized_value") <> ''),
	CONSTRAINT "unit_alias_deleted_at_check" CHECK ("deleted_at" is null or "deleted_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "unit_alias_vote" (
	"alias_id" uuid,
	"profile_id" uuid,
	"value" integer NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_alias_vote_pkey" PRIMARY KEY("alias_id","profile_id"),
	CONSTRAINT "unit_alias_vote_value_check" CHECK ("value" in (-1, 1))
);
--> statement-breakpoint
CREATE TABLE "unit_credit" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unit_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role" text NOT NULL,
	"position" text DEFAULT 'V' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_credit_unit_entity_role_key" UNIQUE("unit_id","entity_id","role"),
	CONSTRAINT "unit_credit_role_not_blank" CHECK (btrim("role") <> ''),
	CONSTRAINT "unit_credit_not_self_check" CHECK ("unit_id" <> "entity_id")
);
--> statement-breakpoint
CREATE TABLE "unit_link" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unit_id" uuid NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"normalized_url_hash" text NOT NULL,
	"role" text DEFAULT 'related' NOT NULL,
	"label" text,
	"position" text DEFAULT 'V' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_link_unit_source_hash_key" UNIQUE("unit_id","source_entity_id","normalized_url_hash"),
	CONSTRAINT "unit_link_url_check" CHECK ("url" ~ '^https?://' and "normalized_url" ~ '^https?://'),
	CONSTRAINT "unit_link_hash_check" CHECK ("normalized_url_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "unit_link_role_not_blank" CHECK (btrim("role") <> '')
);
--> statement-breakpoint
CREATE TABLE "unit_tag" (
	"unit_id" uuid,
	"tag_id" uuid,
	"pinned" boolean DEFAULT false NOT NULL,
	"position" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_tag_pkey" PRIMARY KEY("unit_id","tag_id"),
	CONSTRAINT "unit_tag_not_self_check" CHECK ("unit_id" <> "tag_id")
);
--> statement-breakpoint
CREATE TABLE "unit_tag_vote" (
	"unit_id" uuid,
	"tag_id" uuid,
	"profile_id" uuid,
	"value" integer NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_tag_vote_pkey" PRIMARY KEY("unit_id","tag_id","profile_id"),
	CONSTRAINT "unit_tag_vote_not_self_check" CHECK ("unit_id" <> "tag_id"),
	CONSTRAINT "unit_tag_vote_value_check" CHECK ("value" in (-1, 1))
);
--> statement-breakpoint
CREATE TABLE "unit_variant" (
	"unit_id" uuid PRIMARY KEY,
	"canonical_unit_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_variant_not_self_check" CHECK ("unit_id" <> "canonical_unit_id")
);
--> statement-breakpoint
CREATE TABLE "zone" (
	"id" uuid PRIMARY KEY,
	"owner_realm_id" uuid NOT NULL,
	"boundary" jsonb NOT NULL,
	"nav" jsonb NOT NULL,
	"theme" jsonb NOT NULL,
	"starts_at" timestamp(3) with time zone,
	"ends_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zone_not_owner_check" CHECK ("id" <> "owner_realm_id"),
	CONSTRAINT "zone_time_range_check" CHECK ("ends_at" is null or "starts_at" is null or "ends_at" > "starts_at"),
	CONSTRAINT "zone_boundary_json_object_check" CHECK ("boundary" is null or jsonb_typeof("boundary") = 'object'),
	CONSTRAINT "zone_nav_json_object_check" CHECK ("nav" is null or jsonb_typeof("nav") = 'object'),
	CONSTRAINT "zone_theme_json_object_check" CHECK ("theme" is null or jsonb_typeof("theme") = 'object')
);
--> statement-breakpoint
CREATE TABLE "zone_page" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"zone_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"config" jsonb NOT NULL,
	"position" text DEFAULT 'V' NOT NULL,
	"home" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zone_page_zone_slug_key" UNIQUE("zone_id","slug"),
	CONSTRAINT "zone_page_slug_not_blank" CHECK (btrim("slug") <> ''),
	CONSTRAINT "zone_page_config_json_object_check" CHECK ("config" is null or jsonb_typeof("config") = 'object')
);
--> statement-breakpoint
CREATE TABLE "zone_subscription" (
	"profile_id" uuid,
	"zone_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zone_subscription_pkey" PRIMARY KEY("profile_id","zone_id")
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"participant_low_profile_id" uuid NOT NULL,
	"participant_high_profile_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_participant_pair_key" UNIQUE("participant_low_profile_id","participant_high_profile_id"),
	CONSTRAINT "conversation_participant_order_check" CHECK ("participant_low_profile_id" < "participant_high_profile_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_read" (
	"conversation_id" uuid,
	"profile_id" uuid,
	"last_read_message_id" uuid,
	"read_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_read_pkey" PRIMARY KEY("conversation_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"conversation_id" uuid NOT NULL,
	"sender_profile_id" uuid NOT NULL,
	"content" text,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_content_state_check" CHECK (("deleted_at" is null and nullif(btrim("content"), '') is not null) or ("deleted_at" is not null and "content" is null)),
	CONSTRAINT "message_deleted_at_check" CHECK ("deleted_at" is null or "deleted_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"recipient_profile_id" uuid NOT NULL,
	"actor_profile_id" uuid,
	"kind" "notification_kind" NOT NULL,
	"subject_unit_id" uuid,
	"subject_comment_id" uuid,
	"payload" jsonb,
	"dedupe_key" text,
	"in_app_visible" boolean DEFAULT true NOT NULL,
	"read_at" timestamp(3) with time zone,
	"email_status" "notification_email_status" DEFAULT 'not_requested'::"notification_email_status" NOT NULL,
	"emailed_at" timestamp(3) with time zone,
	"email_error" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_not_self_check" CHECK ("actor_profile_id" is null or "actor_profile_id" <> "recipient_profile_id"),
	CONSTRAINT "notification_subject_check" CHECK (not ("subject_unit_id" is not null and "subject_comment_id" is not null)),
	CONSTRAINT "notification_read_at_check" CHECK ("read_at" is null or "read_at" >= "created_at"),
	CONSTRAINT "notification_email_state_check" CHECK (("email_status" = 'sent'::notification_email_status and "emailed_at" is not null and "email_error" is null) or ("email_status" = 'failed'::notification_email_status and "emailed_at" is null and nullif(btrim("email_error"), '') is not null) or ("email_status" in ('not_requested', 'pending') and "emailed_at" is null and "email_error" is null)),
	CONSTRAINT "notification_payload_json_object_check" CHECK ("payload" is null or jsonb_typeof("payload") = 'object')
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"profile_id" uuid,
	"kind" "notification_kind",
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preference_pkey" PRIMARY KEY("profile_id","kind")
);
--> statement-breakpoint
CREATE TABLE "collection_item" (
	"collection_id" uuid,
	"unit_id" uuid,
	"role" text DEFAULT 'item' NOT NULL,
	"position" text DEFAULT 'V' NOT NULL,
	"added_by_profile_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_pkey" PRIMARY KEY("collection_id","unit_id"),
	CONSTRAINT "collection_item_role_not_blank" CHECK (btrim("role") <> ''),
	CONSTRAINT "collection_item_not_self_check" CHECK ("collection_id" <> "unit_id")
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"root_post_id" uuid NOT NULL,
	"realm_id" uuid,
	"parent_id" uuid,
	"author_profile_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"language" text NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"moderation_status" "moderation_status" DEFAULT 'approved'::"moderation_status" NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_id_root_key" UNIQUE("id","root_post_id"),
	CONSTRAINT "comment_language_check" CHECK (btrim("language") <> '' and char_length("language") <= 35),
	CONSTRAINT "comment_not_self_parent" CHECK ("parent_id" is null or "parent_id" <> "id"),
	CONSTRAINT "comment_depth_check" CHECK ("depth" between 0 and 64),
	CONSTRAINT "comment_deleted_at_check" CHECK ("deleted_at" is null or "deleted_at" >= "created_at"),
	CONSTRAINT "comment_content_json_array_check" CHECK ("content" is null or jsonb_typeof("content") = 'array')
);
--> statement-breakpoint
CREATE TABLE "comment_reaction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"profile_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"realm_id" uuid,
	"reaction" "reaction_kind" NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reaction_identity_key" UNIQUE NULLS NOT DISTINCT("profile_id","comment_id","realm_id")
);
--> statement-breakpoint
CREATE TABLE "content_node" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"book_id" uuid NOT NULL,
	"parent_id" uuid,
	"chapter_id" uuid,
	"title" text NOT NULL,
	"position" text NOT NULL,
	"content_rating" "content_rating",
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_node_id_book_key" UNIQUE("id","book_id"),
	CONSTRAINT "content_node_title_not_blank" CHECK (btrim("title") <> ''),
	CONSTRAINT "content_node_not_self_parent" CHECK ("parent_id" is null or "parent_id" <> "id"),
	CONSTRAINT "content_node_deleted_at_check" CHECK ("deleted_at" is null or "deleted_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "content_node_progress" (
	"profile_id" uuid,
	"node_id" uuid,
	"completed_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_node_progress_pkey" PRIMARY KEY("profile_id","node_id")
);
--> statement-breakpoint
CREATE TABLE "poll_option" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"poll_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" text NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_option_poll_id_key" UNIQUE("poll_id","id"),
	CONSTRAINT "poll_option_label_not_blank" CHECK (btrim("label") <> ''),
	CONSTRAINT "poll_option_deleted_at_check" CHECK ("deleted_at" is null or "deleted_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "poll_vote" (
	"poll_id" uuid,
	"profile_id" uuid,
	"option_id" uuid,
	"realm_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_vote_pkey" PRIMARY KEY("poll_id","profile_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "score" (
	"profile_id" uuid,
	"unit_id" uuid,
	"realm_id" uuid,
	"value" integer NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "score_pkey" PRIMARY KEY("profile_id","unit_id","realm_id"),
	CONSTRAINT "score_value_check" CHECK ("value" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "unit_progress" (
	"profile_id" uuid,
	"unit_id" uuid,
	"progress" double precision DEFAULT 0 NOT NULL,
	"status" "progress_status" DEFAULT 'backlog'::"progress_status" NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"total_time_ms" bigint DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"last_read_node_id" uuid,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_progress_pkey" PRIMARY KEY("profile_id","unit_id"),
	CONSTRAINT "unit_progress_value_check" CHECK ("progress" between 0 and 1),
	CONSTRAINT "unit_progress_count_check" CHECK ("completed_count" >= 0 and "total_time_ms" >= 0),
	CONSTRAINT "unit_progress_seen_check" CHECK ("last_seen_at" >= "first_seen_at"),
	CONSTRAINT "unit_progress_deleted_at_check" CHECK ("deleted_at" is null or "deleted_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "unit_reaction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"profile_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"realm_id" uuid,
	"reaction" "reaction_kind" NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_reaction_identity_key" UNIQUE NULLS NOT DISTINCT("profile_id","unit_id","realm_id")
);
--> statement-breakpoint
CREATE TABLE "unit_share" (
	"profile_id" uuid,
	"unit_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_share_pkey" PRIMARY KEY("profile_id","unit_id")
);
--> statement-breakpoint
CREATE TABLE "api_token" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL CONSTRAINT "api_token_prefix_key" UNIQUE,
	"token_hash" text NOT NULL CONSTRAINT "api_token_hash_key" UNIQUE,
	"scopes" text[] DEFAULT array[]::text[] NOT NULL,
	"expires_at" timestamp(3) with time zone,
	"last_used_at" timestamp(3) with time zone,
	"revoked_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_token_name_not_blank" CHECK (btrim("name") <> ''),
	CONSTRAINT "api_token_scopes_check" CHECK ("scopes" <@ array['read','profile:write','content:write','interaction:write','realm:manage']::text[])
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" uuid PRIMARY KEY,
	"auth_user_id" uuid NOT NULL CONSTRAINT "profile_auth_user_id_key" UNIQUE,
	"name" text,
	"avatar" text,
	"summary" text,
	"description" jsonb,
	"joined_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_name_not_blank" CHECK ("name" is null or btrim("name") <> ''),
	CONSTRAINT "profile_description_json_array_check" CHECK ("description" is null or jsonb_typeof("description") = 'array')
);
--> statement-breakpoint
CREATE TABLE "profile_block" (
	"blocker_profile_id" uuid,
	"blocked_profile_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_block_pkey" PRIMARY KEY("blocker_profile_id","blocked_profile_id"),
	CONSTRAINT "profile_block_not_self_check" CHECK ("blocker_profile_id" <> "blocked_profile_id")
);
--> statement-breakpoint
CREATE TABLE "profile_follow" (
	"follower_profile_id" uuid,
	"followed_profile_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_follow_pkey" PRIMARY KEY("follower_profile_id","followed_profile_id"),
	CONSTRAINT "profile_follow_not_self_check" CHECK ("follower_profile_id" <> "followed_profile_id")
);
--> statement-breakpoint
CREATE TABLE "profile_preference" (
	"profile_id" uuid PRIMARY KEY,
	"default_license" text,
	"default_realm_manage_mode" boolean DEFAULT false NOT NULL,
	"personalized_feed" boolean DEFAULT false NOT NULL,
	"collection_config" jsonb,
	"content_ratings" "content_rating"[] DEFAULT array[]::"content_rating"[] NOT NULL,
	"preferred_languages" text[] DEFAULT array['zh-hant']::text[] NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_preference_default_license_check" CHECK ("default_license" is null or btrim("default_license") <> ''),
	CONSTRAINT "profile_preference_languages_check" CHECK (cardinality("preferred_languages") > 0),
	CONSTRAINT "profile_preference_collection_config_json_object_check" CHECK ("collection_config" is null or jsonb_typeof("collection_config") = 'object')
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"kind" "unit_kind" NOT NULL,
	"slug" text,
	"status" "unit_status" DEFAULT 'draft'::"unit_status" NOT NULL,
	"visibility" "unit_visibility" DEFAULT 'public'::"unit_visibility" NOT NULL,
	"content_rating" "content_rating" DEFAULT 'general'::"content_rating" NOT NULL,
	"ai_disclosure" "ai_disclosure" DEFAULT 'unknown'::"ai_disclosure" NOT NULL,
	"license" text,
	"metadata" jsonb,
	"cover_key" text,
	"cover_focal_x" double precision,
	"cover_focal_y" double precision,
	"moderation_status" "moderation_status" DEFAULT 'approved'::"moderation_status" NOT NULL,
	"published_at" timestamp(3) with time zone,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_slug_not_blank" CHECK ("slug" is null or btrim("slug") <> ''),
	CONSTRAINT "unit_cover_shape_check" CHECK (("cover_key" is null and "cover_focal_x" is null and "cover_focal_y" is null) or ("cover_key" is not null and "cover_focal_x" between 0 and 1 and "cover_focal_y" between 0 and 1)),
	CONSTRAINT "unit_publication_check" CHECK ("status" <> 'published'::unit_status or "published_at" is not null),
	CONSTRAINT "unit_deleted_at_check" CHECK ("deleted_at" is null or "deleted_at" >= "created_at"),
	CONSTRAINT "unit_metadata_json_object_check" CHECK ("metadata" is null or jsonb_typeof("metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "unit_collaborator" (
	"unit_id" uuid,
	"profile_id" uuid,
	"role" "collaborator_role" NOT NULL,
	"added_by_profile_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_collaborator_pkey" PRIMARY KEY("unit_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "unit_field_lock" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unit_id" uuid NOT NULL,
	"path" text NOT NULL,
	"locked_by_profile_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_field_lock_unit_path_key" UNIQUE("unit_id","path"),
	CONSTRAINT "unit_field_lock_path_check" CHECK ("path" ~ '^/')
);
--> statement-breakpoint
CREATE TABLE "unit_localization" (
	"unit_id" uuid,
	"language" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"title" text,
	"summary" text,
	"description" jsonb,
	"content" jsonb,
	"content_status" "content_status",
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_localization_pkey" PRIMARY KEY("unit_id","language"),
	CONSTRAINT "unit_localization_language_check" CHECK (btrim("language") <> '' and char_length("language") <= 35),
	CONSTRAINT "unit_localization_value_check" CHECK ("title" is not null or "summary" is not null or "description" is not null or "content" is not null),
	CONSTRAINT "unit_localization_content_state_check" CHECK (("content" is null) = ("content_status" is null)),
	CONSTRAINT "unit_localization_description_json_array_check" CHECK ("description" is null or jsonb_typeof("description") = 'array'),
	CONSTRAINT "unit_localization_content_json_array_check" CHECK ("content" is null or jsonb_typeof("content") = 'array')
);
--> statement-breakpoint
CREATE TABLE "unit_revision" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unit_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"event" "unit_revision_event" NOT NULL,
	"snapshot" jsonb NOT NULL,
	"actor_profile_id" uuid,
	"message" text,
	"restore_from_sequence" integer,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_revision_unit_sequence_key" UNIQUE("unit_id","sequence"),
	CONSTRAINT "unit_revision_sequence_check" CHECK ("sequence" > 0),
	CONSTRAINT "unit_revision_restore_source_check" CHECK (("event" = 'restore'::unit_revision_event) = ("restore_from_sequence" is not null)),
	CONSTRAINT "unit_revision_snapshot_json_object_check" CHECK ("snapshot" is null or jsonb_typeof("snapshot") = 'object')
);
--> statement-breakpoint
CREATE TABLE "account_enforcement" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"profile_id" uuid NOT NULL,
	"kind" "enforcement_kind" NOT NULL,
	"starts_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp(3) with time zone,
	"decision_action_id" uuid NOT NULL CONSTRAINT "account_enforcement_decision_action_key" UNIQUE,
	"revocation_action_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_enforcement_time_check" CHECK ("expires_at" is null or "expires_at" > "starts_at"),
	CONSTRAINT "account_enforcement_action_check" CHECK ("revocation_action_id" is null or "revocation_action_id" <> "decision_action_id")
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"actor_profile_id" uuid,
	"action" text NOT NULL,
	"decision_code" text NOT NULL,
	"request_id" text,
	"reason" text NOT NULL,
	"subject_kind" text,
	"subject_id" uuid,
	"subject_path" text,
	"metadata" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_event_action_check" CHECK (btrim("action") <> '' and btrim("decision_code") <> '' and btrim("reason") <> ''),
	CONSTRAINT "audit_event_subject_check" CHECK (("subject_kind" is null) = ("subject_id" is null)),
	CONSTRAINT "audit_event_metadata_json_object_check" CHECK ("metadata" is null or jsonb_typeof("metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"profile_id" uuid NOT NULL,
	"kind" "feedback_kind" DEFAULT 'report'::"feedback_kind" NOT NULL,
	"content" text NOT NULL,
	"url" text,
	"subject_unit_id" uuid,
	"subject_comment_id" uuid,
	"resolution" text,
	"resolved_by_profile_id" uuid,
	"resolved_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_content_not_blank" CHECK (btrim("content") <> ''),
	CONSTRAINT "feedback_subject_check" CHECK (not ("subject_unit_id" is not null and "subject_comment_id" is not null)),
	CONSTRAINT "feedback_resolution_check" CHECK (("resolved_at" is null and "resolved_by_profile_id" is null and "resolution" is null) or ("resolved_at" is not null and "resolved_by_profile_id" is not null and nullif(btrim("resolution"), '') is not null))
);
--> statement-breakpoint
CREATE TABLE "moderation_action" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"case_id" uuid NOT NULL,
	"actor_profile_id" uuid NOT NULL,
	"kind" "moderation_action_kind" NOT NULL,
	"resulting_status" "moderation_status",
	"resulting_locked" boolean,
	"reason_code" text NOT NULL,
	"reason" text,
	"public_message" text,
	"reverses_action_id" uuid,
	"request_id" text,
	"idempotency_key" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_action_reason_code_check" CHECK (btrim("reason_code") <> ''),
	CONSTRAINT "moderation_action_not_self_reverse" CHECK ("reverses_action_id" is null or "reverses_action_id" <> "id"),
	CONSTRAINT "moderation_action_reversal_check" CHECK (("kind" in ('reverse', 'revoke_enforcement')) = ("reverses_action_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "moderation_case" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"state" "moderation_case_state" DEFAULT 'new'::"moderation_case_state" NOT NULL,
	"authority" "moderation_authority" DEFAULT 'platform'::"moderation_authority" NOT NULL,
	"realm_id" uuid,
	"target_kind" "moderation_target_kind" NOT NULL,
	"target_id" uuid NOT NULL,
	"target_path" text,
	"reporter_profile_id" uuid,
	"assigned_profile_id" uuid,
	"duplicate_of_case_id" uuid,
	"reason" text,
	"safe_summary" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_case_authority_check" CHECK (("authority" = 'realm'::moderation_authority) = ("realm_id" is not null)),
	CONSTRAINT "moderation_case_path_check" CHECK (("target_kind" = 'unit_field'::moderation_target_kind) = (nullif(btrim("target_path"), '') is not null)),
	CONSTRAINT "moderation_case_duplicate_state_check" CHECK (("state" = 'duplicate'::moderation_case_state) = ("duplicate_of_case_id" is not null)),
	CONSTRAINT "moderation_case_not_self_duplicate" CHECK ("duplicate_of_case_id" is null or "duplicate_of_case_id" <> "id")
);
--> statement-breakpoint
CREATE TABLE "capability_grant" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"authority" "capability_authority" NOT NULL,
	"realm_id" uuid,
	"profile_id" uuid NOT NULL,
	"capability" text NOT NULL,
	"granted_by_profile_id" uuid NOT NULL,
	"expires_at" timestamp(3) with time zone,
	"revoked_at" timestamp(3) with time zone,
	"revoked_by_profile_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capability_grant_identity_key" UNIQUE NULLS NOT DISTINCT("authority","realm_id","profile_id","capability"),
	CONSTRAINT "capability_grant_authority_check" CHECK (("authority" = 'realm'::capability_authority) = ("realm_id" is not null)),
	CONSTRAINT "capability_grant_capability_not_blank" CHECK (btrim("capability") <> ''),
	CONSTRAINT "capability_grant_revocation_check" CHECK (("revoked_at" is null) = ("revoked_by_profile_id" is null)),
	CONSTRAINT "capability_grant_expiry_check" CHECK ("expires_at" is null or "expires_at" > "created_at")
);
--> statement-breakpoint
CREATE TABLE "realm_content" (
	"realm_id" uuid,
	"unit_id" uuid,
	"locked" boolean DEFAULT false NOT NULL,
	"moderation_status" "moderation_status" DEFAULT 'approved'::"moderation_status" NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_content_pkey" PRIMARY KEY("realm_id","unit_id"),
	CONSTRAINT "realm_content_not_self_check" CHECK ("realm_id" <> "unit_id")
);
--> statement-breakpoint
CREATE TABLE "realm_member" (
	"realm_id" uuid,
	"profile_id" uuid,
	"role" "realm_member_role" DEFAULT 'member'::"realm_member_role" NOT NULL,
	"state" "realm_member_state" DEFAULT 'active'::"realm_member_state" NOT NULL,
	"joined_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_member_pkey" PRIMARY KEY("realm_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "realm_pin" (
	"realm_id" uuid,
	"unit_id" uuid,
	"kind" "realm_pin_kind" DEFAULT 'pinned'::"realm_pin_kind" NOT NULL,
	"position" text DEFAULT 'V' NOT NULL,
	"created_by_profile_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_pin_pkey" PRIMARY KEY("realm_id","unit_id"),
	CONSTRAINT "realm_pin_not_self_check" CHECK ("realm_id" <> "unit_id")
);
--> statement-breakpoint
CREATE TABLE "realm_rule" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"revision_id" uuid NOT NULL,
	"position" text NOT NULL,
	"language" text NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_rule_language_check" CHECK (btrim("language") <> '' and char_length("language") <= 35),
	CONSTRAINT "realm_rule_title_not_blank" CHECK (btrim("title") <> ''),
	CONSTRAINT "realm_rule_content_json_array_check" CHECK ("content" is null or jsonb_typeof("content") = 'array')
);
--> statement-breakpoint
CREATE TABLE "realm_rule_acceptance" (
	"revision_id" uuid,
	"profile_id" uuid,
	"language" text,
	"accepted_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_rule_acceptance_pkey" PRIMARY KEY("revision_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "realm_rule_revision" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"realm_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"require_on_join" boolean DEFAULT false NOT NULL,
	"require_on_post" boolean DEFAULT false NOT NULL,
	"require_on_update" boolean DEFAULT true NOT NULL,
	"created_by_profile_id" uuid,
	"published_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_rule_revision_realm_version_key" UNIQUE("realm_id","version"),
	CONSTRAINT "realm_rule_revision_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "realm_subscription" (
	"profile_id" uuid,
	"realm_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_subscription_pkey" PRIMARY KEY("profile_id","realm_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_id_account_id_key" ON "accounts" ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "book_isbn13_key" ON "book" ("isbn13") WHERE "isbn13" is not null;--> statement-breakpoint
CREATE INDEX "book_publication_date_idx" ON "book" ("publication_date");--> statement-breakpoint
CREATE INDEX "collection_owner_created_at_idx" ON "collection" ("owner_profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "collection_one_favorites_key" ON "collection" ("owner_profile_id") WHERE "kind" = 'favorites'::collection_kind;--> statement-breakpoint
CREATE INDEX "entity_kind_idx" ON "entity" ("kind");--> statement-breakpoint
CREATE INDEX "game_requirement_platform_idx" ON "game_requirement" ("platform_entity_id");--> statement-breakpoint
CREATE INDEX "game_requirement_source_link_idx" ON "game_requirement" ("source_link_id");--> statement-breakpoint
CREATE INDEX "media_kind_release_date_idx" ON "media" ("kind","release_date");--> statement-breakpoint
CREATE INDEX "post_author_created_at_idx" ON "post" ("author_profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "post_subject_created_at_idx" ON "post" ("subject_unit_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "post_kind_created_at_idx" ON "post" ("kind","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "series_kind_idx" ON "series" ("kind");--> statement-breakpoint
CREATE INDEX "series_release_position_idx" ON "series_release" ("series_id","position","release_unit_id");--> statement-breakpoint
CREATE INDEX "series_release_unit_idx" ON "series_release" ("release_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_alias_unit_normalized_key" ON "unit_alias" ("unit_id","normalized_value") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "unit_alias_unit_pinned_position_idx" ON "unit_alias" ("unit_id","pinned","position","id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "unit_alias_normalized_idx" ON "unit_alias" ("normalized_value");--> statement-breakpoint
CREATE INDEX "unit_alias_created_by_idx" ON "unit_alias" ("created_by_profile_id");--> statement-breakpoint
CREATE INDEX "unit_alias_vote_profile_idx" ON "unit_alias_vote" ("profile_id");--> statement-breakpoint
CREATE INDEX "unit_credit_entity_role_idx" ON "unit_credit" ("entity_id","role");--> statement-breakpoint
CREATE INDEX "unit_credit_unit_position_idx" ON "unit_credit" ("unit_id","position","id");--> statement-breakpoint
CREATE INDEX "unit_link_unit_position_idx" ON "unit_link" ("unit_id","position","id");--> statement-breakpoint
CREATE INDEX "unit_link_source_entity_idx" ON "unit_link" ("source_entity_id");--> statement-breakpoint
CREATE INDEX "unit_tag_tag_idx" ON "unit_tag" ("tag_id");--> statement-breakpoint
CREATE INDEX "unit_tag_unit_position_idx" ON "unit_tag" ("unit_id","pinned","position","tag_id");--> statement-breakpoint
CREATE INDEX "unit_tag_vote_tag_idx" ON "unit_tag_vote" ("tag_id");--> statement-breakpoint
CREATE INDEX "unit_tag_vote_profile_idx" ON "unit_tag_vote" ("profile_id");--> statement-breakpoint
CREATE INDEX "unit_variant_canonical_idx" ON "unit_variant" ("canonical_unit_id");--> statement-breakpoint
CREATE INDEX "zone_owner_realm_idx" ON "zone" ("owner_realm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zone_page_one_home_key" ON "zone_page" ("zone_id") WHERE "home";--> statement-breakpoint
CREATE INDEX "zone_page_zone_position_idx" ON "zone_page" ("zone_id","position","id");--> statement-breakpoint
CREATE INDEX "zone_subscription_zone_created_at_idx" ON "zone_subscription" ("zone_id","created_at" DESC NULLS LAST,"profile_id");--> statement-breakpoint
CREATE INDEX "conversation_low_profile_idx" ON "conversation" ("participant_low_profile_id");--> statement-breakpoint
CREATE INDEX "conversation_high_profile_idx" ON "conversation" ("participant_high_profile_id");--> statement-breakpoint
CREATE INDEX "conversation_read_profile_idx" ON "conversation_read" ("profile_id");--> statement-breakpoint
CREATE INDEX "conversation_read_last_message_idx" ON "conversation_read" ("last_read_message_id");--> statement-breakpoint
CREATE INDEX "message_conversation_created_at_idx" ON "message" ("conversation_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "message_sender_created_at_idx" ON "message" ("sender_profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "notification_recipient_dedupe_key" ON "notification" ("recipient_profile_id","dedupe_key") WHERE "dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX "notification_recipient_created_at_idx" ON "notification" ("recipient_profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "in_app_visible";--> statement-breakpoint
CREATE INDEX "notification_recipient_unread_idx" ON "notification" ("recipient_profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "in_app_visible" and "read_at" is null;--> statement-breakpoint
CREATE INDEX "notification_actor_idx" ON "notification" ("actor_profile_id");--> statement-breakpoint
CREATE INDEX "notification_subject_unit_idx" ON "notification" ("subject_unit_id");--> statement-breakpoint
CREATE INDEX "notification_subject_comment_idx" ON "notification" ("subject_comment_id");--> statement-breakpoint
CREATE INDEX "notification_preference_kind_idx" ON "notification_preference" ("kind");--> statement-breakpoint
CREATE INDEX "collection_item_collection_position_idx" ON "collection_item" ("collection_id","position","unit_id");--> statement-breakpoint
CREATE INDEX "collection_item_unit_idx" ON "collection_item" ("unit_id");--> statement-breakpoint
CREATE INDEX "collection_item_added_by_idx" ON "collection_item" ("added_by_profile_id");--> statement-breakpoint
CREATE INDEX "comment_root_created_at_idx" ON "comment" ("root_post_id","created_at","id");--> statement-breakpoint
CREATE INDEX "comment_parent_created_at_idx" ON "comment" ("parent_id","created_at","id");--> statement-breakpoint
CREATE INDEX "comment_author_created_at_idx" ON "comment" ("author_profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "comment_realm_idx" ON "comment" ("realm_id");--> statement-breakpoint
CREATE INDEX "comment_moderation_status_idx" ON "comment" ("moderation_status");--> statement-breakpoint
CREATE INDEX "comment_reaction_comment_kind_realm_idx" ON "comment_reaction" ("comment_id","reaction","realm_id");--> statement-breakpoint
CREATE INDEX "comment_reaction_realm_idx" ON "comment_reaction" ("realm_id");--> statement-breakpoint
CREATE INDEX "comment_reaction_profile_created_at_idx" ON "comment_reaction" ("profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "content_node_book_parent_position_idx" ON "content_node" ("book_id","parent_id","position","id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "content_node_parent_idx" ON "content_node" ("parent_id");--> statement-breakpoint
CREATE INDEX "content_node_chapter_idx" ON "content_node" ("chapter_id");--> statement-breakpoint
CREATE INDEX "content_node_progress_node_idx" ON "content_node_progress" ("node_id");--> statement-breakpoint
CREATE INDEX "poll_option_poll_position_idx" ON "poll_option" ("poll_id","position","id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "poll_vote_option_idx" ON "poll_vote" ("option_id");--> statement-breakpoint
CREATE INDEX "poll_vote_profile_created_at_idx" ON "poll_vote" ("profile_id","created_at" DESC NULLS LAST,"poll_id");--> statement-breakpoint
CREATE INDEX "poll_vote_realm_idx" ON "poll_vote" ("realm_id");--> statement-breakpoint
CREATE INDEX "score_unit_realm_value_idx" ON "score" ("unit_id","realm_id","value");--> statement-breakpoint
CREATE INDEX "score_realm_idx" ON "score" ("realm_id");--> statement-breakpoint
CREATE INDEX "unit_progress_unit_status_idx" ON "unit_progress" ("unit_id","status");--> statement-breakpoint
CREATE INDEX "unit_progress_profile_seen_idx" ON "unit_progress" ("profile_id","last_seen_at" DESC NULLS LAST,"unit_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "unit_progress_last_node_idx" ON "unit_progress" ("last_read_node_id");--> statement-breakpoint
CREATE INDEX "unit_reaction_unit_kind_realm_idx" ON "unit_reaction" ("unit_id","reaction","realm_id");--> statement-breakpoint
CREATE INDEX "unit_reaction_realm_idx" ON "unit_reaction" ("realm_id");--> statement-breakpoint
CREATE INDEX "unit_reaction_profile_created_at_idx" ON "unit_reaction" ("profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "unit_share_unit_created_at_idx" ON "unit_share" ("unit_id","created_at" DESC NULLS LAST,"profile_id");--> statement-breakpoint
CREATE INDEX "api_token_profile_created_at_idx" ON "api_token" ("profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "profile_block_blocked_idx" ON "profile_block" ("blocked_profile_id");--> statement-breakpoint
CREATE INDEX "profile_follow_followed_created_at_idx" ON "profile_follow" ("followed_profile_id","created_at" DESC NULLS LAST,"follower_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_kind_slug_key" ON "unit" ("kind","slug") WHERE "slug" is not null;--> statement-breakpoint
CREATE INDEX "unit_kind_status_created_at_idx" ON "unit" ("kind","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "unit_status_visibility_created_at_idx" ON "unit" ("status","visibility","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "unit_moderation_status_idx" ON "unit" ("moderation_status");--> statement-breakpoint
CREATE INDEX "unit_collaborator_profile_role_idx" ON "unit_collaborator" ("profile_id","role");--> statement-breakpoint
CREATE INDEX "unit_collaborator_added_by_idx" ON "unit_collaborator" ("added_by_profile_id");--> statement-breakpoint
CREATE INDEX "unit_field_lock_locked_by_idx" ON "unit_field_lock" ("locked_by_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_localization_one_default_key" ON "unit_localization" ("unit_id") WHERE "is_default";--> statement-breakpoint
CREATE INDEX "unit_localization_language_unit_idx" ON "unit_localization" ("language","unit_id");--> statement-breakpoint
CREATE INDEX "unit_localization_content_status_idx" ON "unit_localization" ("content_status","updated_at");--> statement-breakpoint
CREATE INDEX "unit_revision_unit_created_at_idx" ON "unit_revision" ("unit_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "unit_revision_actor_created_at_idx" ON "unit_revision" ("actor_profile_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "account_enforcement_revocation_action_key" ON "account_enforcement" ("revocation_action_id") WHERE "revocation_action_id" is not null;--> statement-breakpoint
CREATE INDEX "account_enforcement_profile_kind_expiry_idx" ON "account_enforcement" ("profile_id","kind","expires_at");--> statement-breakpoint
CREATE INDEX "audit_event_actor_created_at_idx" ON "audit_event" ("actor_profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_event_action_created_at_idx" ON "audit_event" ("action","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_event_subject_idx" ON "audit_event" ("subject_kind","subject_id");--> statement-breakpoint
CREATE INDEX "audit_event_request_idx" ON "audit_event" ("request_id");--> statement-breakpoint
CREATE INDEX "feedback_profile_created_at_idx" ON "feedback" ("profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "feedback_open_created_at_idx" ON "feedback" ("created_at","id") WHERE "resolved_at" is null;--> statement-breakpoint
CREATE INDEX "feedback_subject_unit_idx" ON "feedback" ("subject_unit_id");--> statement-breakpoint
CREATE INDEX "feedback_subject_comment_idx" ON "feedback" ("subject_comment_id");--> statement-breakpoint
CREATE INDEX "feedback_resolved_by_idx" ON "feedback" ("resolved_by_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_action_idempotency_key" ON "moderation_action" ("idempotency_key") WHERE "idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "moderation_action_case_created_at_idx" ON "moderation_action" ("case_id","created_at","id");--> statement-breakpoint
CREATE INDEX "moderation_action_actor_created_at_idx" ON "moderation_action" ("actor_profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "moderation_action_reverses_idx" ON "moderation_action" ("reverses_action_id");--> statement-breakpoint
CREATE INDEX "moderation_case_authority_state_created_idx" ON "moderation_case" ("authority","state","created_at","id");--> statement-breakpoint
CREATE INDEX "moderation_case_realm_state_created_idx" ON "moderation_case" ("realm_id","state","created_at","id");--> statement-breakpoint
CREATE INDEX "moderation_case_assignee_state_idx" ON "moderation_case" ("assigned_profile_id","state","created_at","id");--> statement-breakpoint
CREATE INDEX "moderation_case_target_idx" ON "moderation_case" ("target_kind","target_id");--> statement-breakpoint
CREATE INDEX "moderation_case_reporter_idx" ON "moderation_case" ("reporter_profile_id");--> statement-breakpoint
CREATE INDEX "moderation_case_duplicate_idx" ON "moderation_case" ("duplicate_of_case_id");--> statement-breakpoint
CREATE INDEX "capability_grant_profile_expiry_idx" ON "capability_grant" ("profile_id","expires_at");--> statement-breakpoint
CREATE INDEX "capability_grant_realm_idx" ON "capability_grant" ("realm_id");--> statement-breakpoint
CREATE INDEX "capability_grant_granted_by_idx" ON "capability_grant" ("granted_by_profile_id");--> statement-breakpoint
CREATE INDEX "capability_grant_revoked_by_idx" ON "capability_grant" ("revoked_by_profile_id");--> statement-breakpoint
CREATE INDEX "realm_content_realm_status_created_idx" ON "realm_content" ("realm_id","moderation_status","created_at" DESC NULLS LAST,"unit_id");--> statement-breakpoint
CREATE INDEX "realm_content_unit_idx" ON "realm_content" ("unit_id");--> statement-breakpoint
CREATE INDEX "realm_member_realm_state_role_idx" ON "realm_member" ("realm_id","state","role");--> statement-breakpoint
CREATE INDEX "realm_member_profile_idx" ON "realm_member" ("profile_id");--> statement-breakpoint
CREATE INDEX "realm_pin_realm_kind_position_idx" ON "realm_pin" ("realm_id","kind","position","unit_id");--> statement-breakpoint
CREATE INDEX "realm_pin_unit_idx" ON "realm_pin" ("unit_id");--> statement-breakpoint
CREATE INDEX "realm_pin_created_by_idx" ON "realm_pin" ("created_by_profile_id");--> statement-breakpoint
CREATE INDEX "realm_rule_revision_position_idx" ON "realm_rule" ("revision_id","position","id");--> statement-breakpoint
CREATE INDEX "realm_rule_acceptance_profile_idx" ON "realm_rule_acceptance" ("profile_id","accepted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "realm_rule_revision_realm_published_idx" ON "realm_rule_revision" ("realm_id","version" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "realm_rule_revision_created_by_idx" ON "realm_rule_revision" ("created_by_profile_id");--> statement-breakpoint
CREATE INDEX "realm_subscription_realm_created_at_idx" ON "realm_subscription" ("realm_id","created_at" DESC NULLS LAST,"profile_id");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "book" ADD CONSTRAINT "book_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_owner_profile_id_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_requirement" ADD CONSTRAINT "game_requirement_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_requirement" ADD CONSTRAINT "game_requirement_platform_entity_id_entity_id_fkey" FOREIGN KEY ("platform_entity_id") REFERENCES "entity"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "game_requirement" ADD CONSTRAINT "game_requirement_source_link_id_unit_link_id_fkey" FOREIGN KEY ("source_link_id") REFERENCES "unit_link"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "poll" ADD CONSTRAINT "poll_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_author_profile_id_profile_id_fkey" FOREIGN KEY ("author_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_subject_unit_id_unit_id_fkey" FOREIGN KEY ("subject_unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "realm" ADD CONSTRAINT "realm_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "series_release" ADD CONSTRAINT "series_release_series_id_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "series_release" ADD CONSTRAINT "series_release_release_unit_id_unit_id_fkey" FOREIGN KEY ("release_unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_alias" ADD CONSTRAINT "unit_alias_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_alias" ADD CONSTRAINT "unit_alias_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "unit_alias_vote" ADD CONSTRAINT "unit_alias_vote_alias_id_unit_alias_id_fkey" FOREIGN KEY ("alias_id") REFERENCES "unit_alias"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_alias_vote" ADD CONSTRAINT "unit_alias_vote_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_credit" ADD CONSTRAINT "unit_credit_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_credit" ADD CONSTRAINT "unit_credit_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_link" ADD CONSTRAINT "unit_link_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_link" ADD CONSTRAINT "unit_link_source_entity_id_entity_id_fkey" FOREIGN KEY ("source_entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_tag" ADD CONSTRAINT "unit_tag_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_tag" ADD CONSTRAINT "unit_tag_tag_id_unit_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_tag_vote" ADD CONSTRAINT "unit_tag_vote_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_tag_vote" ADD CONSTRAINT "unit_tag_vote_tag_id_unit_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_tag_vote" ADD CONSTRAINT "unit_tag_vote_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_variant" ADD CONSTRAINT "unit_variant_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_variant" ADD CONSTRAINT "unit_variant_canonical_unit_id_unit_id_fkey" FOREIGN KEY ("canonical_unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_owner_realm_id_unit_id_fkey" FOREIGN KEY ("owner_realm_id") REFERENCES "unit"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "zone_page" ADD CONSTRAINT "zone_page_zone_id_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "zone_subscription" ADD CONSTRAINT "zone_subscription_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "zone_subscription" ADD CONSTRAINT "zone_subscription_zone_id_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_participant_low_profile_id_profile_id_fkey" FOREIGN KEY ("participant_low_profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_participant_high_profile_id_profile_id_fkey" FOREIGN KEY ("participant_high_profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversation_read" ADD CONSTRAINT "conversation_read_conversation_id_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversation_read" ADD CONSTRAINT "conversation_read_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversation_read" ADD CONSTRAINT "conversation_read_last_read_message_id_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "message"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_profile_id_profile_id_fkey" FOREIGN KEY ("sender_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_profile_id_profile_id_fkey" FOREIGN KEY ("recipient_profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_profile_id_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_subject_unit_id_unit_id_fkey" FOREIGN KEY ("subject_unit_id") REFERENCES "unit"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_subject_comment_id_comment_id_fkey" FOREIGN KEY ("subject_comment_id") REFERENCES "comment"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_collection_id_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_added_by_profile_id_profile_id_fkey" FOREIGN KEY ("added_by_profile_id") REFERENCES "profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_root_post_id_post_id_fkey" FOREIGN KEY ("root_post_id") REFERENCES "post"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_profile_id_profile_id_fkey" FOREIGN KEY ("author_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_parent_root_fkey" FOREIGN KEY ("parent_id","root_post_id") REFERENCES "comment"("id","root_post_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "comment_reaction" ADD CONSTRAINT "comment_reaction_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comment_reaction" ADD CONSTRAINT "comment_reaction_comment_id_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comment"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comment_reaction" ADD CONSTRAINT "comment_reaction_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_node" ADD CONSTRAINT "content_node_book_id_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "book"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_node" ADD CONSTRAINT "content_node_chapter_id_post_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "post"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "content_node" ADD CONSTRAINT "content_node_parent_book_fkey" FOREIGN KEY ("parent_id","book_id") REFERENCES "content_node"("id","book_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "content_node_progress" ADD CONSTRAINT "content_node_progress_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_node_progress" ADD CONSTRAINT "content_node_progress_node_id_content_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "content_node"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "poll_option" ADD CONSTRAINT "poll_option_poll_id_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "poll"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_poll_id_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "poll"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_option_fkey" FOREIGN KEY ("poll_id","option_id") REFERENCES "poll_option"("poll_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_progress" ADD CONSTRAINT "unit_progress_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_progress" ADD CONSTRAINT "unit_progress_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_progress" ADD CONSTRAINT "unit_progress_last_node_fkey" FOREIGN KEY ("last_read_node_id","unit_id") REFERENCES "content_node"("id","book_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_reaction" ADD CONSTRAINT "unit_reaction_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_reaction" ADD CONSTRAINT "unit_reaction_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_reaction" ADD CONSTRAINT "unit_reaction_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_share" ADD CONSTRAINT "unit_share_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_share" ADD CONSTRAINT "unit_share_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "profile_block" ADD CONSTRAINT "profile_block_blocker_profile_id_profile_id_fkey" FOREIGN KEY ("blocker_profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile_block" ADD CONSTRAINT "profile_block_blocked_profile_id_profile_id_fkey" FOREIGN KEY ("blocked_profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile_follow" ADD CONSTRAINT "profile_follow_follower_profile_id_profile_id_fkey" FOREIGN KEY ("follower_profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile_follow" ADD CONSTRAINT "profile_follow_followed_profile_id_profile_id_fkey" FOREIGN KEY ("followed_profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile_preference" ADD CONSTRAINT "profile_preference_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_collaborator" ADD CONSTRAINT "unit_collaborator_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_collaborator" ADD CONSTRAINT "unit_collaborator_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_collaborator" ADD CONSTRAINT "unit_collaborator_added_by_profile_id_profile_id_fkey" FOREIGN KEY ("added_by_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_field_lock" ADD CONSTRAINT "unit_field_lock_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_field_lock" ADD CONSTRAINT "unit_field_lock_locked_by_profile_id_profile_id_fkey" FOREIGN KEY ("locked_by_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_localization" ADD CONSTRAINT "unit_localization_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_revision" ADD CONSTRAINT "unit_revision_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_revision" ADD CONSTRAINT "unit_revision_actor_profile_id_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "account_enforcement" ADD CONSTRAINT "account_enforcement_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "account_enforcement" ADD CONSTRAINT "account_enforcement_uDabDcwN9p4k_fkey" FOREIGN KEY ("decision_action_id") REFERENCES "moderation_action"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "account_enforcement" ADD CONSTRAINT "account_enforcement_0u72xwXJHy8M_fkey" FOREIGN KEY ("revocation_action_id") REFERENCES "moderation_action"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_profile_id_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_subject_unit_id_unit_id_fkey" FOREIGN KEY ("subject_unit_id") REFERENCES "unit"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_subject_comment_id_comment_id_fkey" FOREIGN KEY ("subject_comment_id") REFERENCES "comment"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_resolved_by_profile_id_profile_id_fkey" FOREIGN KEY ("resolved_by_profile_id") REFERENCES "profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "moderation_action" ADD CONSTRAINT "moderation_action_case_id_moderation_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "moderation_case"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "moderation_action" ADD CONSTRAINT "moderation_action_actor_profile_id_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "moderation_action" ADD CONSTRAINT "moderation_action_reverses_fkey" FOREIGN KEY ("reverses_action_id") REFERENCES "moderation_action"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "moderation_case" ADD CONSTRAINT "moderation_case_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "moderation_case" ADD CONSTRAINT "moderation_case_reporter_profile_id_profile_id_fkey" FOREIGN KEY ("reporter_profile_id") REFERENCES "profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "moderation_case" ADD CONSTRAINT "moderation_case_assigned_profile_id_profile_id_fkey" FOREIGN KEY ("assigned_profile_id") REFERENCES "profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "moderation_case" ADD CONSTRAINT "moderation_case_duplicate_fkey" FOREIGN KEY ("duplicate_of_case_id") REFERENCES "moderation_case"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "capability_grant" ADD CONSTRAINT "capability_grant_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "capability_grant" ADD CONSTRAINT "capability_grant_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "capability_grant" ADD CONSTRAINT "capability_grant_granted_by_profile_id_profile_id_fkey" FOREIGN KEY ("granted_by_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "capability_grant" ADD CONSTRAINT "capability_grant_revoked_by_profile_id_profile_id_fkey" FOREIGN KEY ("revoked_by_profile_id") REFERENCES "profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "realm_content" ADD CONSTRAINT "realm_content_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_content" ADD CONSTRAINT "realm_content_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_member" ADD CONSTRAINT "realm_member_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_member" ADD CONSTRAINT "realm_member_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_pin" ADD CONSTRAINT "realm_pin_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_pin" ADD CONSTRAINT "realm_pin_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_pin" ADD CONSTRAINT "realm_pin_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "realm_rule" ADD CONSTRAINT "realm_rule_revision_id_realm_rule_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "realm_rule_revision"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_rule_acceptance" ADD CONSTRAINT "realm_rule_acceptance_revision_id_realm_rule_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "realm_rule_revision"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_rule_acceptance" ADD CONSTRAINT "realm_rule_acceptance_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_rule_revision" ADD CONSTRAINT "realm_rule_revision_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_rule_revision" ADD CONSTRAINT "realm_rule_revision_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "realm_subscription" ADD CONSTRAINT "realm_subscription_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_subscription" ADD CONSTRAINT "realm_subscription_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;