SET search_path TO public;

-- This is the reviewed fresh-target Auth/Entity replacement, not an in-place legacy account conversion.
DO 'BEGIN
  IF EXISTS(SELECT 1 FROM public.profile) OR EXISTS(SELECT 1 FROM public.unit_access_grant)
    OR EXISTS(SELECT 1 FROM public.unit_access_restriction) THEN
    RAISE EXCEPTION ''Auth/Entity replacement requires an empty legacy participation target; use the separate offline conversion'';
  END IF;
END';
-- Atlas cannot remove enum labels; these subject alternatives acquire their new Auth meaning only on an empty target.
ALTER TYPE public.unit_access_subject_kind RENAME VALUE 'profile' TO 'auth';
ALTER TYPE public.unit_access_restriction_subject_kind RENAME VALUE 'profile' TO 'auth';
-- These old column-specific triggers are replaced by the new owning contracts after the typed DDL.
DROP TRIGGER IF EXISTS book_chapter_progress_stat_maintain ON public.content_structure_node_progress;
DROP TRIGGER IF EXISTS notification_recipient_stat_maintain ON public.notification;
DROP TRIGGER IF EXISTS reject_merged_unit_credit_attribution_credited_unit_id ON public.credit_attribution;
DROP TRIGGER IF EXISTS studio_editor_candidate_from_grant ON public.unit_access_grant;
DROP TRIGGER IF EXISTS unit_progress_stats_maintain ON public.unit_progress;

-- Create index "distribution_named_form_active_idx" to table: "distribution_named_form"
CREATE INDEX "distribution_named_form_active_idx" ON "distribution_named_form" ("owner_id", "id") WHERE (state = 'active'::text);
-- Create index "entity_named_form_active_idx" to table: "entity_named_form"
CREATE INDEX "entity_named_form_active_idx" ON "entity_named_form" ("owner_id", "id") WHERE (state = 'active'::text);
-- Create index "grouping_named_form_active_idx" to table: "grouping_named_form"
CREATE INDEX "grouping_named_form_active_idx" ON "grouping_named_form" ("owner_id", "id") WHERE (state = 'active'::text);
-- Create index "music_named_form_active_idx" to table: "music_named_form"
CREATE INDEX "music_named_form_active_idx" ON "music_named_form" ("owner_id", "id") WHERE (state = 'active'::text);
-- Create index "program_named_form_active_idx" to table: "program_named_form"
CREATE INDEX "program_named_form_active_idx" ON "program_named_form" ("owner_id", "id") WHERE (state = 'active'::text);
-- Create index "publishing_named_form_active_idx" to table: "publishing_named_form"
CREATE INDEX "publishing_named_form_active_idx" ON "publishing_named_form" ("owner_id", "id") WHERE (state = 'active'::text);
-- Create index "reference_named_form_active_idx" to table: "reference_named_form"
CREATE INDEX "reference_named_form_active_idx" ON "reference_named_form" ("owner_id", "id") WHERE (state = 'active'::text);
-- Create index "software_named_form_active_idx" to table: "software_named_form"
CREATE INDEX "software_named_form_active_idx" ON "software_named_form" ("owner_id", "id") WHERE (state = 'active'::text);
-- Modify "users" table
ALTER TABLE "users" ADD CONSTRAINT "users_principal_kind_check" CHECK (principal_kind = ANY (ARRAY['human'::text, 'service'::text])), ADD COLUMN "principal_kind" text NOT NULL DEFAULT 'human', ADD COLUMN "erased_at" timestamptz(3) NULL;
-- Modify "account_enforcement" table
ALTER TABLE "account_enforcement" DROP COLUMN "profile_id", ADD COLUMN "auth_user_id" uuid NOT NULL, ADD CONSTRAINT "account_enforcement_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Create index "account_enforcement_auth_user_kind_expiry_idx" to table: "account_enforcement"
CREATE INDEX "account_enforcement_auth_user_kind_expiry_idx" ON "account_enforcement" ("auth_user_id", "kind", "expires_at");
-- Drop index "account_enforcement_action_actor_created_idx" from table: "account_enforcement_action"
DROP INDEX "account_enforcement_action_actor_created_idx";
-- Drop index "account_enforcement_action_target_created_idx" from table: "account_enforcement_action"
DROP INDEX "account_enforcement_action_target_created_idx";
-- Modify "account_enforcement_action" table
ALTER TABLE "account_enforcement_action" DROP COLUMN "actor_profile_id", DROP COLUMN "target_profile_id", ADD COLUMN "actor_auth_user_id" uuid NOT NULL, ADD COLUMN "target_auth_user_id" uuid NOT NULL, ADD CONSTRAINT "account_enforcement_action_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "account_enforcement_action_target_auth_user_id_users_id_fkey" FOREIGN KEY ("target_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "account_enforcement_action_actor_created_idx" to table: "account_enforcement_action"
CREATE INDEX "account_enforcement_action_actor_created_idx" ON "account_enforcement_action" ("actor_auth_user_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "account_enforcement_action_target_created_idx" to table: "account_enforcement_action"
CREATE INDEX "account_enforcement_action_target_created_idx" ON "account_enforcement_action" ("target_auth_user_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create "account_entity_block" table
CREATE TABLE "account_entity_block" (
  "blocker_auth_user_id" uuid NOT NULL,
  "blocked_entity_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("blocker_auth_user_id", "blocked_entity_id"),
  CONSTRAINT "account_entity_block_blocked_entity_id_entity_identity_id_fkey" FOREIGN KEY ("blocked_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "account_entity_block_blocker_auth_user_id_users_id_fkey" FOREIGN KEY ("blocker_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "account_entity_block_blocked_idx" to table: "account_entity_block"
CREATE INDEX "account_entity_block_blocked_idx" ON "account_entity_block" ("blocked_entity_id");
-- Create "account_erasure" table
CREATE TABLE "account_erasure" (
  "auth_user_id" uuid NOT NULL,
  "self_entity_id" uuid NULL,
  "prior_email" text NULL,
  "stage" text NOT NULL DEFAULT 'sessions',
  "completed_batches" integer NOT NULL DEFAULT 0,
  "available_at" timestamptz(3) NOT NULL DEFAULT now(),
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "completed_at" timestamptz(3) NULL,
  PRIMARY KEY ("auth_user_id"),
  CONSTRAINT "account_erasure_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "account_erasure_self_entity_id_entity_identity_id_fkey" FOREIGN KEY ("self_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "account_erasure_complete_check" CHECK (((stage = 'complete'::text) = (completed_at IS NOT NULL)) AND ((stage <> 'complete'::text) OR ((prior_email IS NULL) AND (self_entity_id IS NULL)))),
  CONSTRAINT "account_erasure_stage_check" CHECK (stage = ANY (ARRAY['sessions'::text, 'credentials'::text, 'api_tokens'::text, 'verification'::text, 'auth_mail'::text, 'preferences'::text, 'notifications'::text, 'notification_preferences'::text, 'progress_entries'::text, 'progress_nodes'::text, 'progress'::text, 'recommendation_events'::text, 'recommendation_exclusions'::text, 'studio_visits'::text, 'complete'::text]))
);
-- Create index "account_erasure_ready_idx" to table: "account_erasure"
CREATE INDEX "account_erasure_ready_idx" ON "account_erasure" ("available_at", "auth_user_id") WHERE (completed_at IS NULL);
-- Create "account_preference" table
CREATE TABLE "account_preference" (
  "auth_user_id" uuid NOT NULL,
  "default_licenses" text[] NOT NULL DEFAULT '{}',
  "default_realm_manage_mode" boolean NOT NULL DEFAULT false,
  "default_score_realm_id" uuid NULL,
  "score_visibility" "resource_visibility" NOT NULL DEFAULT 'public',
  "progress_visibility" "resource_visibility" NOT NULL DEFAULT 'public',
  "personalized_feed" boolean NOT NULL DEFAULT true,
  "custom_themes_enabled" boolean NOT NULL DEFAULT true,
  "filter_feed_by_preferred_languages" boolean NOT NULL DEFAULT false,
  "always_show_spoilers" boolean NOT NULL DEFAULT false,
  "always_show_nsfw" boolean NOT NULL DEFAULT false,
  "collection_config" jsonb NULL,
  "interface_locale" text NOT NULL DEFAULT 'zh-Hant',
  "chinese_content_display" text NOT NULL DEFAULT 'original',
  "content_ratings" "content_rating"[] NOT NULL DEFAULT ARRAY['general'::content_rating, 'r15'::content_rating],
  "preferred_languages" text[] NOT NULL DEFAULT ARRAY['en'::text],
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("auth_user_id"),
  CONSTRAINT "account_preference_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "account_preference_default_score_realm_id_realm_id_fkey" FOREIGN KEY ("default_score_realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "account_preference_chinese_content_display_check" CHECK (chinese_content_display = ANY (ARRAY['original'::text, 'hant'::text, 'hans'::text])),
  CONSTRAINT "account_preference_collection_config_json_object_check" CHECK ((collection_config IS NULL) OR (jsonb_typeof(collection_config) = 'object'::text)),
  CONSTRAINT "account_preference_content_ratings_check" CHECK (cardinality(content_ratings) > 0),
  CONSTRAINT "account_preference_interface_locale_check" CHECK (interface_locale = ANY (ARRAY['en'::text, 'zh-Hant'::text, 'zh-Hans'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text])),
  CONSTRAINT "account_preference_languages_check" CHECK ((cardinality(preferred_languages) > 0) AND (preferred_languages <@ ARRAY['zh'::text, 'en'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text]) AND (cardinality(array_positions(preferred_languages, 'zh'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'en'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'ja'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'ko'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'de'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'fr'::text)) <= 1) AND (cardinality(array_positions(preferred_languages, 'es'::text)) <= 1))
);
-- Create index "account_preference_default_score_realm_idx" to table: "account_preference"
CREATE INDEX "account_preference_default_score_realm_idx" ON "account_preference" ("default_score_realm_id");
-- Modify "api_account_quota_binding" table
ALTER TABLE "api_account_quota_binding" DROP CONSTRAINT "api_account_quota_binding_4WtImkXpd3J0_fkey", ADD CONSTRAINT "api_account_quota_binding_ZZlk1pdWJCuD_fkey" FOREIGN KEY ("assigned_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "api_quota_policy_revision" table
ALTER TABLE "api_quota_policy_revision" DROP CONSTRAINT "api_quota_policy_revision_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "api_quota_policy_revision_zkoUYQIxLnKc_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "api_token_quota_binding" table
ALTER TABLE "api_token_quota_binding" DROP CONSTRAINT "api_token_quota_binding_assigned_by_profile_id_profile_id_fkey", ADD CONSTRAINT "api_token_quota_binding_IIuLI11WsNiD_fkey" FOREIGN KEY ("assigned_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "api_token_quota_override" table
ALTER TABLE "api_token_quota_override" DROP CONSTRAINT "api_token_quota_override_updated_by_profile_id_profile_id_fkey", ADD CONSTRAINT "api_token_quota_override_rOHmeT2qOlP3_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "audit_event" table
ALTER TABLE "audit_event" DROP CONSTRAINT "audit_event_actor_profile_id_profile_id_fkey", DROP CONSTRAINT "audit_event_actor_check", ADD CONSTRAINT "audit_event_actor_check" CHECK (((actor_kind = 'profile'::audit_actor_kind) = (actor_profile_id IS NOT NULL)) AND ((actor_kind <> 'auth'::audit_actor_kind) OR (actor_auth_user_id IS NOT NULL))), ADD COLUMN "actor_auth_user_id" uuid NULL, ADD CONSTRAINT "audit_event_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "audit_event_actor_profile_id_entity_identity_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create "auth_entity" table
CREATE TABLE "auth_entity" (
  "auth_user_id" uuid NOT NULL,
  "entity_id" uuid NOT NULL,
  "revision" bigint NOT NULL DEFAULT 1,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("auth_user_id"),
  CONSTRAINT "auth_entity_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "auth_entity_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "auth_entity_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "auth_entity_state_check" CHECK (state = ANY (ARRAY['active'::text, 'suspended'::text]))
);
-- Create index "auth_entity_self_key" to table: "auth_entity"
CREATE UNIQUE INDEX "auth_entity_self_key" ON "auth_entity" ("entity_id");
-- Modify "book_chapter_draft_job" table
ALTER TABLE "book_chapter_draft_job" DROP CONSTRAINT "book_chapter_draft_job_requested_by_profile_id_profile_id_fkey", ADD CONSTRAINT "book_chapter_draft_job_kcN9nKZKng3r_fkey" FOREIGN KEY ("requested_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "book_chapter_progress_stat" table
ALTER TABLE "book_chapter_progress_stat" DROP CONSTRAINT "book_chapter_progress_stat_pkey", DROP COLUMN "profile_id", ADD COLUMN "auth_user_id" uuid NOT NULL, ADD PRIMARY KEY ("auth_user_id", "book_unit_id"), ADD CONSTRAINT "book_chapter_progress_stat_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "collection_item" table
ALTER TABLE "collection_item" DROP CONSTRAINT "collection_item_added_by_profile_id_profile_id_fkey", ADD CONSTRAINT "collection_item_added_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("added_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "collection_structure_revision" table
ALTER TABLE "collection_structure_revision" DROP CONSTRAINT "collection_structure_revision_actor_profile_id_profile_id_fkey", ADD CONSTRAINT "collection_structure_revision_BG83sflmKulT_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "content_governance_action" table
ALTER TABLE "content_governance_action" DROP CONSTRAINT "content_governance_action_actor_profile_id_profile_id_fkey", ADD CONSTRAINT "content_governance_action_WAyORPVbYaVQ_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "content_report" table
ALTER TABLE "content_report" DROP CONSTRAINT "content_report_reporter_profile_id_profile_id_fkey", ADD CONSTRAINT "content_report_reporter_profile_id_entity_identity_id_fkey" FOREIGN KEY ("reporter_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "content_review_case" table
ALTER TABLE "content_review_case" DROP CONSTRAINT "content_review_case_assigned_profile_id_profile_id_fkey", ADD CONSTRAINT "content_review_case_assigned_profile_id_entity_identity_id_fkey" FOREIGN KEY ("assigned_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "content_structure_node_progress" table
ALTER TABLE "content_structure_node_progress" DROP CONSTRAINT "content_structure_node_progress_pkey", DROP COLUMN "profile_id", ADD COLUMN "auth_user_id" uuid NOT NULL, ADD PRIMARY KEY ("auth_user_id", "node_id"), ADD CONSTRAINT "content_structure_node_progress_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "content_structure_revision" table
ALTER TABLE "content_structure_revision" DROP CONSTRAINT "content_structure_revision_actor_profile_id_profile_id_fkey", ADD CONSTRAINT "content_structure_revision_01NqHKaYyrfy_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "conversation" table
ALTER TABLE "conversation" DROP CONSTRAINT "conversation_participant_pair_key", DROP CONSTRAINT "conversation_participant_order_check", ADD CONSTRAINT "conversation_participant_order_check" CHECK (participant_low_auth_user_id < participant_high_auth_user_id), DROP COLUMN "participant_low_profile_id", DROP COLUMN "participant_high_profile_id", ADD COLUMN "participant_low_entity_id" uuid NOT NULL, ADD COLUMN "participant_high_entity_id" uuid NOT NULL, ADD COLUMN "participant_low_auth_user_id" uuid NOT NULL, ADD COLUMN "participant_high_auth_user_id" uuid NOT NULL, ADD CONSTRAINT "conversation_participant_pair_key" UNIQUE ("participant_low_auth_user_id", "participant_high_auth_user_id"), ADD CONSTRAINT "conversation_participant_high_auth_user_id_users_id_fkey" FOREIGN KEY ("participant_high_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, ADD CONSTRAINT "conversation_participant_high_entity_id_entity_identity_id_fkey" FOREIGN KEY ("participant_high_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "conversation_participant_low_auth_user_id_users_id_fkey" FOREIGN KEY ("participant_low_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, ADD CONSTRAINT "conversation_participant_low_entity_id_entity_identity_id_fkey" FOREIGN KEY ("participant_low_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "conversation_high_auth_user_idx" to table: "conversation"
CREATE INDEX "conversation_high_auth_user_idx" ON "conversation" ("participant_high_auth_user_id");
-- Create index "conversation_low_auth_user_idx" to table: "conversation"
CREATE INDEX "conversation_low_auth_user_idx" ON "conversation" ("participant_low_auth_user_id");
-- Modify "conversation_participant_stat" table
ALTER TABLE "conversation_participant_stat" DROP CONSTRAINT "conversation_participant_stat_pkey", DROP COLUMN "profile_id", ADD COLUMN "auth_user_id" uuid NOT NULL, ADD PRIMARY KEY ("conversation_id", "auth_user_id"), ADD CONSTRAINT "conversation_participant_stat_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Create index "conversation_participant_stat_auth_user_sort_idx" to table: "conversation_participant_stat"
CREATE INDEX "conversation_participant_stat_auth_user_sort_idx" ON "conversation_participant_stat" ("auth_user_id", "sort_at" DESC NULLS LAST, "conversation_id" DESC NULLS LAST);
-- Modify "conversation_read" table
ALTER TABLE "conversation_read" DROP CONSTRAINT "conversation_read_pkey", DROP COLUMN "profile_id", ADD COLUMN "auth_user_id" uuid NOT NULL, ADD PRIMARY KEY ("conversation_id", "auth_user_id"), ADD CONSTRAINT "conversation_read_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Create index "conversation_read_auth_user_idx" to table: "conversation_read"
CREATE INDEX "conversation_read_auth_user_idx" ON "conversation_read" ("auth_user_id");
-- Drop index "credit_attribution_publisher_search_source_idx" from table: "credit_attribution"
DROP INDEX "credit_attribution_publisher_search_source_idx";
-- Drop index "credit_attribution_search_source_idx" from table: "credit_attribution"
DROP INDEX "credit_attribution_search_source_idx";
-- Modify "credit_attribution" table
ALTER TABLE "credit_attribution" DROP CONSTRAINT "credit_attribution_source_credited_role_key", DROP CONSTRAINT "credit_attribution_not_self_check", ADD CONSTRAINT "credit_attribution_not_self_check" CHECK (source_unit_id <> credited_entity_id), DROP COLUMN "credited_unit_id", ADD COLUMN "credited_entity_id" uuid NOT NULL, ADD CONSTRAINT "credit_attribution_source_credited_role_key" UNIQUE ("source_unit_id", "credited_entity_id", "role"), ADD CONSTRAINT "credit_attribution_credited_entity_id_entity_identity_id_fkey" FOREIGN KEY ("credited_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "credit_attribution_publisher_search_source_idx" to table: "credit_attribution"
CREATE INDEX "credit_attribution_publisher_search_source_idx" ON "credit_attribution" ("credited_entity_id", "source_unit_id") WHERE (role = 'publisher'::text);
-- Create index "credit_attribution_search_source_idx" to table: "credit_attribution"
CREATE INDEX "credit_attribution_search_source_idx" ON "credit_attribution" ("credited_entity_id", "source_unit_id");
-- Create index "credit_attribution_credited_entity_role_idx" to table: "credit_attribution"
CREATE INDEX "credit_attribution_credited_entity_role_idx" ON "credit_attribution" ("credited_entity_id", "role");
-- Modify "custom_theme_execution_control" table
ALTER TABLE "custom_theme_execution_control" DROP CONSTRAINT "custom_theme_execution_control_3FOcvNRbsJce_fkey", ADD CONSTRAINT "custom_theme_execution_control_6Z3yyPi0BBaj_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "custom_theme_revision" table
ALTER TABLE "custom_theme_revision" DROP CONSTRAINT "custom_theme_revision_killed_by_profile_id_profile_id_fkey", DROP CONSTRAINT "custom_theme_revision_reviewed_by_profile_id_profile_id_fkey", DROP CONSTRAINT "custom_theme_revision_submitted_by_profile_id_profile_id_fkey", ADD CONSTRAINT "custom_theme_revision_2YNOpKGimCS8_fkey" FOREIGN KEY ("submitted_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "custom_theme_revision_MmJxwiGYMAss_fkey" FOREIGN KEY ("killed_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "custom_theme_revision_PfZe3ZuwSd46_fkey" FOREIGN KEY ("reviewed_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "custom_theme_revision_review_event" table
ALTER TABLE "custom_theme_revision_review_event" DROP CONSTRAINT "custom_theme_revision_review_event_xV1geV2KbhfR_fkey", ADD CONSTRAINT "custom_theme_revision_review_event_hBuNpvkNua5i_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "dock_revision" table
ALTER TABLE "dock_revision" DROP CONSTRAINT "dock_revision_actor_profile_id_profile_id_fkey", ADD CONSTRAINT "dock_revision_actor_profile_id_entity_identity_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create "entity_participation" table
CREATE TABLE "entity_participation" (
  "entity_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("entity_id"),
  CONSTRAINT "entity_participation_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_participation_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "entity_participation_state_check" CHECK (state = ANY (ARRAY['active'::text, 'recovery_required'::text]))
);
-- Modify "image_asset" table
ALTER TABLE "image_asset" DROP CONSTRAINT "image_asset_owner_profile_id_profile_id_fkey", DROP CONSTRAINT "image_asset_uploader_profile_id_profile_id_fkey", ADD CONSTRAINT "image_asset_owner_profile_id_entity_identity_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "image_asset_uploader_profile_id_entity_identity_id_fkey" FOREIGN KEY ("uploader_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create "entity_presentation" table
CREATE TABLE "entity_presentation" (
  "entity_id" uuid NOT NULL,
  "language" text NOT NULL,
  "name_id" uuid NULL,
  "name_revision" bigint NULL,
  "avatar_type" text NULL,
  "avatar_asset_id" uuid NULL,
  "avatar_emoji" text NULL,
  "avatar_icon_prefix" text NULL,
  "avatar_icon_name" text NULL,
  "banner_asset_id" uuid NULL,
  "summary" text NULL,
  "description" jsonb NULL,
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("entity_id", "language"),
  CONSTRAINT "entity_presentation_avatar_asset_id_image_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "image_asset" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_presentation_banner_asset_id_image_asset_id_fkey" FOREIGN KEY ("banner_asset_id") REFERENCES "image_asset" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_presentation_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_presentation_name_fk" FOREIGN KEY ("entity_id", "name_id", "name_revision") REFERENCES "entity_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_presentation_avatar_check" CHECK (((avatar_type IS NULL) AND (num_nonnulls(avatar_asset_id, avatar_emoji, avatar_icon_prefix, avatar_icon_name) = 0)) OR ((avatar_type = 'image'::text) AND (avatar_asset_id IS NOT NULL) AND (num_nonnulls(avatar_emoji, avatar_icon_prefix, avatar_icon_name) = 0)) OR ((avatar_type = 'emoji'::text) AND (avatar_emoji IS NOT NULL) AND ((char_length(avatar_emoji) >= 1) AND (char_length(avatar_emoji) <= 64)) AND (num_nonnulls(avatar_asset_id, avatar_icon_prefix, avatar_icon_name) = 0)) OR ((avatar_type = 'icon'::text) AND (avatar_asset_id IS NULL) AND (avatar_emoji IS NULL) AND (avatar_icon_prefix = ANY (ARRAY['fas'::text, 'fab'::text])) AND (avatar_icon_name IS NOT NULL) AND (avatar_icon_name ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text) AND (char_length(avatar_icon_name) <= 128))),
  CONSTRAINT "entity_presentation_avatar_type_check" CHECK (avatar_type = ANY (ARRAY['image'::text, 'emoji'::text, 'icon'::text])),
  CONSTRAINT "entity_presentation_description_check" CHECK ((description IS NULL) OR ((jsonb_typeof(description) = 'object'::text) AND (octet_length((description)::text) <= 1048576))),
  CONSTRAINT "entity_presentation_language_check" CHECK ((octet_length(language) >= 1) AND (octet_length(language) <= 255)),
  CONSTRAINT "entity_presentation_name_shape_check" CHECK (num_nonnulls(name_id, name_revision) = ANY (ARRAY[0, 2])),
  CONSTRAINT "entity_presentation_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "entity_presentation_summary_check" CHECK ((summary IS NULL) OR (char_length(summary) <= 500))
);
-- Create "entity_presentation_revision" table
CREATE TABLE "entity_presentation_revision" (
  "entity_id" uuid NOT NULL,
  "language" text NOT NULL,
  "revision" bigint NOT NULL,
  "snapshot" jsonb NOT NULL,
  "operator_auth_user_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("entity_id", "language", "revision"),
  CONSTRAINT "entity_presentation_revision_identity_fk" FOREIGN KEY ("entity_id", "language") REFERENCES "entity_presentation" ("entity_id", "language") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_presentation_revision_uFvOqcozddUf_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_presentation_revision_snapshot_check" CHECK ((jsonb_typeof(snapshot) = 'object'::text) AND (octet_length((snapshot)::text) <= 1100000))
);
-- Modify "entity_catalog_profile_revision" table
ALTER TABLE "entity_catalog_profile_revision" ADD COLUMN "removed" boolean NOT NULL DEFAULT false;
-- Create "entity_profile_source_occurrence" table
CREATE TABLE "entity_profile_source_occurrence" (
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "revision" bigint NOT NULL,
  PRIMARY KEY ("source_record_id", "snapshot_id", "owner_id"),
  CONSTRAINT "entity_profile_source_history_fk" FOREIGN KEY ("owner_id", "revision") REFERENCES "entity_catalog_profile_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_profile_source_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_profile_source_values" CHECK (("left"(source_path, 1) = '/'::text) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((revision >= 1) AND (revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "entity_recovery_event" table
CREATE TABLE "entity_recovery_event" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "entity_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "operator_auth_user_id" uuid NOT NULL,
  "recipient_auth_user_id" uuid NOT NULL,
  "evidence" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "entity_recovery_event_lPOtzAZv6Vus_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_participation" ("entity_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_recovery_event_operator_auth_user_id_users_id_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_recovery_event_recipient_auth_user_id_users_id_fkey" FOREIGN KEY ("recipient_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_recovery_event_evidence_check" CHECK ((octet_length(evidence) >= 1) AND (octet_length(evidence) <= 16384))
);
-- Create index "entity_recovery_event_revision_key" to table: "entity_recovery_event"
CREATE UNIQUE INDEX "entity_recovery_event_revision_key" ON "entity_recovery_event" ("entity_id", "revision");
-- Create "entity_source_profile_application_change" table
CREATE TABLE "entity_source_profile_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "entity_profile_app_after_fk" FOREIGN KEY ("owner_id", "after_revision") REFERENCES "entity_catalog_profile_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_profile_app_before_fk" FOREIGN KEY ("owner_id", "before_revision") REFERENCES "entity_catalog_profile_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_profile_app_journal_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_profile_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "entity_source_profile_baseline" table
CREATE TABLE "entity_source_profile_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'entity',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id"),
  CONSTRAINT "entity_profile_baseline_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_profile_baseline_current_fk" FOREIGN KEY ("owner_id", "current_revision") REFERENCES "entity_catalog_profile_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_profile_baseline_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_profile_baseline_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_profile_baseline_source_fk" FOREIGN KEY ("owner_id", "source_revision") REFERENCES "entity_catalog_profile_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_profile_baseline_owner" CHECK (mapping_owner = 'entity'::text),
  CONSTRAINT "entity_profile_baseline_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Modify "governance_decision" table
ALTER TABLE "governance_decision" DROP CONSTRAINT "governance_decision_actor_profile_id_profile_id_fkey", ADD CONSTRAINT "governance_decision_actor_profile_id_entity_identity_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "message_sender_created_at_idx" from table: "message"
DROP INDEX "message_sender_created_at_idx";
-- Modify "message" table
ALTER TABLE "message" DROP COLUMN "sender_profile_id", ADD COLUMN "sender_entity_id" uuid NOT NULL, ADD COLUMN "sender_auth_user_id" uuid NOT NULL, ADD CONSTRAINT "message_sender_auth_user_id_users_id_fkey" FOREIGN KEY ("sender_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "message_sender_entity_id_entity_identity_id_fkey" FOREIGN KEY ("sender_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "message_sender_created_at_idx" to table: "message"
CREATE INDEX "message_sender_created_at_idx" ON "message" ("sender_auth_user_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Drop index "notification_recipient_created_at_idx" from table: "notification"
DROP INDEX "notification_recipient_created_at_idx";
-- Drop index "notification_recipient_dedupe_key" from table: "notification"
DROP INDEX "notification_recipient_dedupe_key";
-- Drop index "notification_recipient_unread_idx" from table: "notification"
DROP INDEX "notification_recipient_unread_idx";
-- Modify "notification" table
ALTER TABLE "notification" DROP CONSTRAINT "notification_actor_profile_id_profile_id_fkey", DROP CONSTRAINT "notification_not_self_check", ADD CONSTRAINT "notification_not_self_check" CHECK ((actor_profile_id IS NULL) OR (actor_profile_id <> recipient_auth_user_id)), DROP COLUMN "recipient_profile_id", ADD COLUMN "recipient_auth_user_id" uuid NOT NULL, ADD CONSTRAINT "notification_actor_profile_id_entity_identity_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL, ADD CONSTRAINT "notification_recipient_auth_user_id_users_id_fkey" FOREIGN KEY ("recipient_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Create index "notification_recipient_created_at_idx" to table: "notification"
CREATE INDEX "notification_recipient_created_at_idx" ON "notification" ("recipient_auth_user_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE in_app_visible;
-- Create index "notification_recipient_dedupe_key" to table: "notification"
CREATE UNIQUE INDEX "notification_recipient_dedupe_key" ON "notification" ("recipient_auth_user_id", "dedupe_key") WHERE (dedupe_key IS NOT NULL);
-- Create index "notification_recipient_unread_idx" to table: "notification"
CREATE INDEX "notification_recipient_unread_idx" ON "notification" ("recipient_auth_user_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (in_app_visible AND (read_at IS NULL));
-- Modify "notification_preference" table
ALTER TABLE "notification_preference" DROP CONSTRAINT "notification_preference_pkey", DROP COLUMN "profile_id", ADD COLUMN "auth_user_id" uuid NOT NULL, ADD PRIMARY KEY ("auth_user_id", "kind"), ADD CONSTRAINT "notification_preference_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "notification_recipient_stat" table
ALTER TABLE "notification_recipient_stat" DROP CONSTRAINT "notification_recipient_stat_pkey", DROP COLUMN "profile_id", ADD COLUMN "auth_user_id" uuid NOT NULL, ADD PRIMARY KEY ("auth_user_id"), ADD CONSTRAINT "notification_recipient_stat_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Create "service_principal" table
CREATE TABLE "service_principal" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "auth_user_id" uuid NOT NULL,
  "entity_id" uuid NOT NULL,
  "name" text NOT NULL,
  "credential_digest" text NOT NULL,
  "created_by_auth_user_id" uuid NULL,
  "revision" bigint NOT NULL DEFAULT 1,
  "revoked_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "service_principal_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "service_principal_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "service_principal_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "service_principal_credential_digest_check" CHECK (credential_digest ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "service_principal_name_check" CHECK ((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 160)),
  CONSTRAINT "service_principal_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint))
);
-- Create index "service_principal_auth_key" to table: "service_principal"
CREATE UNIQUE INDEX "service_principal_auth_key" ON "service_principal" ("auth_user_id");
-- Create index "service_principal_controller_idx" to table: "service_principal"
CREATE INDEX "service_principal_controller_idx" ON "service_principal" ("created_by_auth_user_id", "id") WHERE (revoked_at IS NULL);
-- Create index "service_principal_credential_key" to table: "service_principal"
CREATE UNIQUE INDEX "service_principal_credential_key" ON "service_principal" ("credential_digest");
-- Create index "service_principal_entity_key" to table: "service_principal"
CREATE UNIQUE INDEX "service_principal_entity_key" ON "service_principal" ("entity_id");
-- Create "participation_grant" table
CREATE TABLE "participation_grant" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "auth_user_id" uuid NULL,
  "service_principal_id" uuid NULL,
  "acting_entity_id" uuid NOT NULL,
  "capability" text NOT NULL,
  "proposal_source_record_id" uuid NULL,
  "proposal_id" uuid NULL,
  "publishing_id" uuid NULL,
  "music_id" uuid NULL,
  "program_id" uuid NULL,
  "software_id" uuid NULL,
  "entity_id" uuid NULL,
  "grouping_id" uuid NULL,
  "reference_id" uuid NULL,
  "distribution_id" uuid NULL,
  "revision" bigint NOT NULL DEFAULT 1,
  "expires_at" timestamptz(3) NULL,
  "revoked_at" timestamptz(3) NULL,
  "created_by_auth_user_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "participation_grant_TOTuXkjmPKyS_fkey" FOREIGN KEY ("service_principal_id") REFERENCES "service_principal" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "participation_grant_UvKj8r1hJUP9_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "participation_grant_acting_entity_id_entity_identity_id_fkey" FOREIGN KEY ("acting_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "participation_grant_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "participation_grant_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "participation_grant_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "participation_grant_grouping_id_grouping_identity_id_fkey" FOREIGN KEY ("grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "participation_grant_music_id_music_identity_id_fkey" FOREIGN KEY ("music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "participation_grant_program_id_program_identity_id_fkey" FOREIGN KEY ("program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "participation_grant_proposal_fk" FOREIGN KEY ("proposal_source_record_id", "proposal_id") REFERENCES "catalog_source_adoption_proposal" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "participation_grant_publishing_id_publishing_identity_id_fkey" FOREIGN KEY ("publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "participation_grant_reference_id_reference_identity_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "participation_grant_software_id_software_identity_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "participation_grant_capability_check" CHECK (capability = ANY (ARRAY['catalog.read'::text, 'catalog.edit'::text, 'entity.publish'::text, 'entity.membership'::text, 'entity.security'::text, 'proposal.adopt'::text])),
  CONSTRAINT "participation_grant_principal_check" CHECK (num_nonnulls(auth_user_id, service_principal_id) = 1),
  CONSTRAINT "participation_grant_proposal_scope_check" CHECK (((capability = 'proposal.adopt'::text) AND (num_nonnulls(proposal_source_record_id, proposal_id) = 2)) OR ((capability <> 'proposal.adopt'::text) AND (num_nonnulls(proposal_source_record_id, proposal_id) = 0))),
  CONSTRAINT "participation_grant_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "participation_grant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id, distribution_id) = 1)
);
-- Create index "participation_grant_active_auth_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_active_auth_idx" ON "participation_grant" ("auth_user_id", "id") WHERE (revoked_at IS NULL);
-- Create index "participation_grant_active_security_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_active_security_idx" ON "participation_grant" ("acting_entity_id", "auth_user_id") WHERE ((revoked_at IS NULL) AND (capability = 'entity.security'::text));
-- Create index "participation_grant_auth_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_auth_idx" ON "participation_grant" ("auth_user_id", "id");
-- Create index "participation_grant_entity_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_entity_idx" ON "participation_grant" ("acting_entity_id", "id");
-- Create index "participation_grant_service_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_service_idx" ON "participation_grant" ("service_principal_id", "id") WHERE ((service_principal_id IS NOT NULL) AND (revoked_at IS NULL));
-- Create index "participation_grant_target_0_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_target_0_idx" ON "participation_grant" ("publishing_id", "id") WHERE (publishing_id IS NOT NULL);
-- Create index "participation_grant_target_1_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_target_1_idx" ON "participation_grant" ("music_id", "id") WHERE (music_id IS NOT NULL);
-- Create index "participation_grant_target_2_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_target_2_idx" ON "participation_grant" ("program_id", "id") WHERE (program_id IS NOT NULL);
-- Create index "participation_grant_target_3_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_target_3_idx" ON "participation_grant" ("software_id", "id") WHERE (software_id IS NOT NULL);
-- Create index "participation_grant_target_4_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_target_4_idx" ON "participation_grant" ("entity_id", "id") WHERE (entity_id IS NOT NULL);
-- Create index "participation_grant_target_5_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_target_5_idx" ON "participation_grant" ("grouping_id", "id") WHERE (grouping_id IS NOT NULL);
-- Create index "participation_grant_target_6_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_target_6_idx" ON "participation_grant" ("reference_id", "id") WHERE (reference_id IS NOT NULL);
-- Create index "participation_grant_target_7_idx" to table: "participation_grant"
CREATE INDEX "participation_grant_target_7_idx" ON "participation_grant" ("distribution_id", "id") WHERE (distribution_id IS NOT NULL);
-- Create "participation_grant_event" table
CREATE TABLE "participation_grant_event" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "grant_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "operation" text NOT NULL,
  "operator_auth_user_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "participation_grant_event_grant_id_participation_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "participation_grant" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "participation_grant_event_operator_auth_user_id_users_id_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "participation_grant_event_operation_check" CHECK (operation = ANY (ARRAY['grant'::text, 'revoke'::text]))
);
-- Create index "participation_grant_event_revision_key" to table: "participation_grant_event"
CREATE UNIQUE INDEX "participation_grant_event_revision_key" ON "participation_grant_event" ("grant_id", "revision");
-- Drop index "platform_capability_grant_active_capability_expiry_idx" from table: "platform_capability_grant"
DROP INDEX "platform_capability_grant_active_capability_expiry_idx";
-- Drop index "platform_capability_grant_active_key" from table: "platform_capability_grant"
DROP INDEX "platform_capability_grant_active_key";
-- Drop index "platform_capability_grant_granted_by_idx" from table: "platform_capability_grant"
DROP INDEX "platform_capability_grant_granted_by_idx";
-- Drop index "platform_capability_grant_revoked_by_idx" from table: "platform_capability_grant"
DROP INDEX "platform_capability_grant_revoked_by_idx";
-- Modify "platform_capability_grant" table
ALTER TABLE "platform_capability_grant" DROP CONSTRAINT "platform_capability_grant_revocation_check", ADD CONSTRAINT "platform_capability_grant_revocation_check" CHECK ((revoked_at IS NULL) = (revoked_by_auth_user_id IS NULL)), DROP COLUMN "profile_id", DROP COLUMN "granted_by_profile_id", DROP COLUMN "revoked_by_profile_id", ADD COLUMN "auth_user_id" uuid NOT NULL, ADD COLUMN "granted_by_auth_user_id" uuid NOT NULL, ADD COLUMN "revoked_by_auth_user_id" uuid NULL, ADD CONSTRAINT "platform_capability_grant_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, ADD CONSTRAINT "platform_capability_grant_granted_by_auth_user_id_users_id_fkey" FOREIGN KEY ("granted_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "platform_capability_grant_revoked_by_auth_user_id_users_id_fkey" FOREIGN KEY ("revoked_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Create index "platform_capability_grant_active_capability_expiry_idx" to table: "platform_capability_grant"
CREATE INDEX "platform_capability_grant_active_capability_expiry_idx" ON "platform_capability_grant" ("capability", "expires_at", "auth_user_id") WHERE (revoked_at IS NULL);
-- Create index "platform_capability_grant_active_key" to table: "platform_capability_grant"
CREATE UNIQUE INDEX "platform_capability_grant_active_key" ON "platform_capability_grant" ("auth_user_id", "capability") WHERE (revoked_at IS NULL);
-- Create index "platform_capability_grant_granted_by_idx" to table: "platform_capability_grant"
CREATE INDEX "platform_capability_grant_granted_by_idx" ON "platform_capability_grant" ("granted_by_auth_user_id");
-- Create index "platform_capability_grant_revoked_by_idx" to table: "platform_capability_grant"
CREATE INDEX "platform_capability_grant_revoked_by_idx" ON "platform_capability_grant" ("revoked_by_auth_user_id");
-- Create index "platform_capability_grant_auth_user_expiry_idx" to table: "platform_capability_grant"
CREATE INDEX "platform_capability_grant_auth_user_expiry_idx" ON "platform_capability_grant" ("auth_user_id", "expires_at");
-- Modify "poll_vote" table
ALTER TABLE "poll_vote" DROP CONSTRAINT "poll_vote_profile_id_profile_id_fkey", ADD CONSTRAINT "poll_vote_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "profile_favorites_collection" table
ALTER TABLE "profile_favorites_collection" DROP CONSTRAINT "profile_favorites_collection_profile_id_profile_id_fkey", ADD CONSTRAINT "profile_favorites_collection_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "profile_realm_tag_subscription" table
ALTER TABLE "profile_realm_tag_subscription" DROP CONSTRAINT "profile_realm_tag_subscription_profile_id_profile_id_fkey", ADD CONSTRAINT "profile_realm_tag_subscription_0KCUL2ZIbTHN_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "profile_resource_participation" table
ALTER TABLE "profile_resource_participation" DROP CONSTRAINT "profile_resource_participation_profile_id_profile_id_fkey", ADD CONSTRAINT "profile_resource_participation_r08jj48uq1p3_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "profile_unit_tag" table
ALTER TABLE "profile_unit_tag" DROP CONSTRAINT "profile_unit_tag_profile_id_profile_id_fkey", ADD CONSTRAINT "profile_unit_tag_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "realm_member" table
ALTER TABLE "realm_member" DROP CONSTRAINT "realm_member_profile_id_profile_id_fkey", ADD CONSTRAINT "realm_member_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "realm_pin" table
ALTER TABLE "realm_pin" DROP CONSTRAINT "realm_pin_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "realm_pin_created_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "realm_rule_acceptance" table
ALTER TABLE "realm_rule_acceptance" DROP CONSTRAINT "realm_rule_acceptance_profile_id_profile_id_fkey", ADD CONSTRAINT "realm_rule_acceptance_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "realm_rule_revision" table
ALTER TABLE "realm_rule_revision" DROP CONSTRAINT "realm_rule_revision_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "realm_rule_revision_4IzxNznfGj8m_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "realm_tag_context" table
ALTER TABLE "realm_tag_context" DROP CONSTRAINT "realm_tag_context_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "realm_tag_context_created_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "realm_tag_judgment" table
ALTER TABLE "realm_tag_judgment" DROP CONSTRAINT "realm_tag_judgment_profile_id_profile_id_fkey", ADD CONSTRAINT "realm_tag_judgment_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "realm_tag_path" table
ALTER TABLE "realm_tag_path" DROP CONSTRAINT "realm_tag_path_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "realm_tag_path_created_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "realm_tag_path_sense" table
ALTER TABLE "realm_tag_path_sense" DROP CONSTRAINT "realm_tag_path_sense_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "realm_tag_path_sense_vYe0SEd3sMe9_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "realm_tag_path_vote" table
ALTER TABLE "realm_tag_path_vote" DROP CONSTRAINT "realm_tag_path_vote_profile_id_profile_id_fkey", ADD CONSTRAINT "realm_tag_path_vote_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "realm_unit_publication_event" table
ALTER TABLE "realm_unit_publication_event" DROP CONSTRAINT "realm_unit_publication_event_EI9OF02bgNWn_fkey", ADD CONSTRAINT "realm_unit_publication_event_duValjr5u1Qk_fkey" FOREIGN KEY ("changed_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "realm_unit_status_event" table
ALTER TABLE "realm_unit_status_event" DROP CONSTRAINT "realm_unit_status_event_changed_by_profile_id_profile_id_fkey", ADD CONSTRAINT "realm_unit_status_event_mCEImGpLzyjY_fkey" FOREIGN KEY ("changed_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "realm_unit_tag" table
ALTER TABLE "realm_unit_tag" DROP CONSTRAINT "realm_unit_tag_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "realm_unit_tag_created_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "realm_unit_tag_path_application" table
ALTER TABLE "realm_unit_tag_path_application" DROP CONSTRAINT "realm_unit_tag_path_application_qDMxreMGiMF3_fkey", ADD CONSTRAINT "realm_unit_tag_path_application_g5Uo1sIoSV1k_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "realm_unit_tag_path_application_judgment" table
ALTER TABLE "realm_unit_tag_path_application_judgment" DROP CONSTRAINT "realm_unit_tag_path_application_judgment_GE7QUeiiaNZD_fkey", ADD CONSTRAINT "realm_unit_tag_path_application_judgment_qkBo4OAltGP4_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "recommendation_event" table
ALTER TABLE "recommendation_event" DROP CONSTRAINT "recommendation_event_profile_id_profile_id_fkey", ADD CONSTRAINT "recommendation_event_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "recommendation_exclusion" table
ALTER TABLE "recommendation_exclusion" DROP CONSTRAINT "recommendation_exclusion_profile_id_profile_id_fkey", ADD CONSTRAINT "recommendation_exclusion_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "score" table
ALTER TABLE "score" DROP CONSTRAINT "score_profile_id_profile_id_fkey", ADD CONSTRAINT "score_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "shared_search_query" table
ALTER TABLE "shared_search_query" DROP CONSTRAINT "shared_search_query_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "shared_search_query_nkNhS3isMOYF_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "studio_resource_visit_profile_recent_idx" from table: "studio_resource_visit"
DROP INDEX "studio_resource_visit_profile_recent_idx";
-- Drop index "studio_resource_visit_resource_merge_idx" from table: "studio_resource_visit"
DROP INDEX "studio_resource_visit_resource_merge_idx";
-- Modify "studio_resource_visit" table
ALTER TABLE "studio_resource_visit" DROP CONSTRAINT "studio_resource_visit_pkey", DROP COLUMN "profile_id", ADD COLUMN "auth_user_id" uuid NOT NULL, ADD PRIMARY KEY ("auth_user_id", "resource_unit_id"), ADD CONSTRAINT "studio_resource_visit_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Create index "studio_resource_visit_profile_recent_idx" to table: "studio_resource_visit"
CREATE INDEX "studio_resource_visit_profile_recent_idx" ON "studio_resource_visit" ("auth_user_id", "last_visited_at" DESC NULLS LAST, "resource_unit_id" DESC NULLS LAST);
-- Create index "studio_resource_visit_resource_merge_idx" to table: "studio_resource_visit"
CREATE INDEX "studio_resource_visit_resource_merge_idx" ON "studio_resource_visit" ("resource_unit_id", "auth_user_id");
-- Modify "subject_association_judgment" table
ALTER TABLE "subject_association_judgment" DROP CONSTRAINT "subject_association_judgment_profile_id_profile_id_fkey", ADD CONSTRAINT "subject_association_judgment_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "tag_expression" table
ALTER TABLE "tag_expression" DROP CONSTRAINT "tag_expression_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "tag_expression_created_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "tag_expression_inference_rule" table
ALTER TABLE "tag_expression_inference_rule" DROP CONSTRAINT "tag_expression_inference_rule_ceJs4fI4KzGn_fkey", ADD CONSTRAINT "tag_expression_inference_rule_VVcZeQ083svO_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "tag_expression_presentation_revision" table
ALTER TABLE "tag_expression_presentation_revision" DROP CONSTRAINT "tag_expression_presentation_revision_8tm4v6dm9WVJ_fkey", ADD CONSTRAINT "tag_expression_presentation_revision_MmhSKqhIjfPS_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "tag_path" table
ALTER TABLE "tag_path" DROP CONSTRAINT "tag_path_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "tag_path_created_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "tag_path_merge" table
ALTER TABLE "tag_path_merge" DROP CONSTRAINT "tag_path_merge_proposed_by_profile_id_profile_id_fkey", DROP CONSTRAINT "tag_path_merge_resolved_by_profile_id_profile_id_fkey", ADD CONSTRAINT "tag_path_merge_proposed_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("proposed_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "tag_path_merge_resolved_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("resolved_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "tag_path_sense" table
ALTER TABLE "tag_path_sense" DROP CONSTRAINT "tag_path_sense_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "tag_path_sense_created_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "tag_path_vote" table
ALTER TABLE "tag_path_vote" DROP CONSTRAINT "tag_path_vote_profile_id_profile_id_fkey", ADD CONSTRAINT "tag_path_vote_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "tag_relation" table
ALTER TABLE "tag_relation" DROP CONSTRAINT "tag_relation_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "tag_relation_created_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Drop index "unit_access_grant_granted_by_idx" from table: "unit_access_grant"
DROP INDEX "unit_access_grant_granted_by_idx";
-- Drop index "unit_access_grant_unit_transfer_candidate_idx" from table: "unit_access_grant"
DROP INDEX "unit_access_grant_unit_transfer_candidate_idx";
-- Modify "unit_access_grant" table
ALTER TABLE "unit_access_grant" DROP CONSTRAINT "unit_access_grant_revocation_shape_check", ADD CONSTRAINT "unit_access_grant_revocation_shape_check" CHECK ((revoked_at IS NULL) = (revoked_by_auth_user_id IS NULL)), DROP CONSTRAINT "unit_access_grant_subject_shape_check", ADD CONSTRAINT "unit_access_grant_subject_shape_check" CHECK (((subject_kind = 'auth'::unit_access_subject_kind) AND (auth_user_id IS NOT NULL) AND (realm_id IS NULL) AND (realm_relation IS NULL)) OR ((subject_kind = 'realm'::unit_access_subject_kind) AND (auth_user_id IS NULL) AND (realm_id IS NOT NULL) AND (realm_relation IS NOT NULL)) OR ((subject_kind = 'authenticated'::unit_access_subject_kind) AND (auth_user_id IS NULL) AND (realm_id IS NULL) AND (realm_relation IS NULL))), DROP COLUMN "profile_id", DROP COLUMN "granted_by_profile_id", DROP COLUMN "revoked_by_profile_id", ADD COLUMN "auth_user_id" uuid NULL, ADD COLUMN "granted_by_auth_user_id" uuid NULL, ADD COLUMN "revoked_by_auth_user_id" uuid NULL, ADD CONSTRAINT "unit_access_grant_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, ADD CONSTRAINT "unit_access_grant_granted_by_auth_user_id_users_id_fkey" FOREIGN KEY ("granted_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "unit_access_grant_revoked_by_auth_user_id_users_id_fkey" FOREIGN KEY ("revoked_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "unit_access_grant_granted_by_idx" to table: "unit_access_grant"
CREATE INDEX "unit_access_grant_granted_by_idx" ON "unit_access_grant" ("granted_by_auth_user_id");
-- Create index "unit_access_grant_unit_transfer_candidate_idx" to table: "unit_access_grant"
CREATE INDEX "unit_access_grant_unit_transfer_candidate_idx" ON "unit_access_grant" ("unit_id", "permission", "auth_user_id") WHERE ((revoked_at IS NULL) AND (expires_at IS NULL) AND (subject_kind = 'auth'::unit_access_subject_kind) AND (cardinality(scope) = 0));
-- Create index "unit_access_grant_active_auth_user_scope_key" to table: "unit_access_grant"
CREATE UNIQUE INDEX "unit_access_grant_active_auth_user_scope_key" ON "unit_access_grant" ("unit_id", "auth_user_id", "permission", "scope") WHERE ((revoked_at IS NULL) AND (subject_kind = 'auth'::unit_access_subject_kind));
-- Create index "unit_access_grant_auth_user_active_idx" to table: "unit_access_grant"
CREATE INDEX "unit_access_grant_auth_user_active_idx" ON "unit_access_grant" ("auth_user_id", "unit_id", "permission") WHERE (revoked_at IS NULL);
-- Drop index "unit_access_invitation_invited_by_idx" from table: "unit_access_invitation"
DROP INDEX "unit_access_invitation_invited_by_idx";
-- Drop index "unit_access_invitation_resolved_by_idx" from table: "unit_access_invitation"
DROP INDEX "unit_access_invitation_resolved_by_idx";
-- Drop index "unit_access_invitation_unit_transfer_candidate_idx" from table: "unit_access_invitation"
DROP INDEX "unit_access_invitation_unit_transfer_candidate_idx";
-- Modify "unit_access_invitation" table
ALTER TABLE "unit_access_invitation" DROP CONSTRAINT "unit_access_invitation_profiles_differ_check", DROP CONSTRAINT "unit_access_invitation_resolution_shape_check", ADD CONSTRAINT "unit_access_invitation_resolution_shape_check" CHECK (((resolution IS NULL) AND (resolved_at IS NULL) AND (resolved_by_auth_user_id IS NULL)) OR ((resolution IS NOT NULL) AND (resolved_at IS NOT NULL) AND (resolved_by_auth_user_id IS NOT NULL))), ADD CONSTRAINT "unit_access_invitation_accounts_differ_check" CHECK (invited_auth_user_id <> invited_by_auth_user_id), DROP COLUMN "invited_profile_id", DROP COLUMN "invited_by_profile_id", DROP COLUMN "resolved_by_profile_id", ADD COLUMN "invited_auth_user_id" uuid NOT NULL, ADD COLUMN "invited_by_auth_user_id" uuid NOT NULL, ADD COLUMN "resolved_by_auth_user_id" uuid NULL, ADD CONSTRAINT "unit_access_invitation_invited_auth_user_id_users_id_fkey" FOREIGN KEY ("invited_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, ADD CONSTRAINT "unit_access_invitation_invited_by_auth_user_id_users_id_fkey" FOREIGN KEY ("invited_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "unit_access_invitation_resolved_by_auth_user_id_users_id_fkey" FOREIGN KEY ("resolved_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "unit_access_invitation_invited_by_idx" to table: "unit_access_invitation"
CREATE INDEX "unit_access_invitation_invited_by_idx" ON "unit_access_invitation" ("invited_by_auth_user_id");
-- Create index "unit_access_invitation_resolved_by_idx" to table: "unit_access_invitation"
CREATE INDEX "unit_access_invitation_resolved_by_idx" ON "unit_access_invitation" ("resolved_by_auth_user_id");
-- Create index "unit_access_invitation_unit_transfer_candidate_idx" to table: "unit_access_invitation"
CREATE INDEX "unit_access_invitation_unit_transfer_candidate_idx" ON "unit_access_invitation" ("unit_id", "invited_auth_user_id") WHERE ((resolution = 'accepted'::unit_access_invitation_resolution) AND (access_expires_at IS NULL) AND (cardinality(scope) = 0));
-- Create index "unit_access_invitation_auth_user_unresolved_idx" to table: "unit_access_invitation"
CREATE INDEX "unit_access_invitation_auth_user_unresolved_idx" ON "unit_access_invitation" ("invited_auth_user_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (resolution IS NULL);
-- Drop index "unit_access_restriction_created_by_idx" from table: "unit_access_restriction"
DROP INDEX "unit_access_restriction_created_by_idx";
-- Modify "unit_access_restriction" table
ALTER TABLE "unit_access_restriction" DROP CONSTRAINT "unit_access_restriction_revocation_shape_check", ADD CONSTRAINT "unit_access_restriction_revocation_shape_check" CHECK ((revoked_at IS NULL) = (revoked_by_auth_user_id IS NULL)), DROP CONSTRAINT "unit_access_restriction_subject_shape_check", ADD CONSTRAINT "unit_access_restriction_subject_shape_check" CHECK (((subject_kind = 'auth'::unit_access_restriction_subject_kind) AND (auth_user_id IS NOT NULL) AND (realm_id IS NULL) AND (realm_relation IS NULL)) OR ((subject_kind = 'realm'::unit_access_restriction_subject_kind) AND (auth_user_id IS NULL) AND (realm_id IS NOT NULL) AND (realm_relation IS NOT NULL))), DROP COLUMN "profile_id", DROP COLUMN "created_by_profile_id", DROP COLUMN "revoked_by_profile_id", ADD COLUMN "auth_user_id" uuid NULL, ADD COLUMN "created_by_auth_user_id" uuid NOT NULL, ADD COLUMN "revoked_by_auth_user_id" uuid NULL, ADD CONSTRAINT "unit_access_restriction_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, ADD CONSTRAINT "unit_access_restriction_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "unit_access_restriction_revoked_by_auth_user_id_users_id_fkey" FOREIGN KEY ("revoked_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "unit_access_restriction_created_by_idx" to table: "unit_access_restriction"
CREATE INDEX "unit_access_restriction_created_by_idx" ON "unit_access_restriction" ("created_by_auth_user_id");
-- Create index "unit_access_restriction_active_auth_user_scope_key" to table: "unit_access_restriction"
CREATE UNIQUE INDEX "unit_access_restriction_active_auth_user_scope_key" ON "unit_access_restriction" ("unit_id", "auth_user_id", "permission", "scope") WHERE ((revoked_at IS NULL) AND (subject_kind = 'auth'::unit_access_restriction_subject_kind));
-- Create index "unit_access_restriction_auth_user_active_idx" to table: "unit_access_restriction"
CREATE INDEX "unit_access_restriction_auth_user_active_idx" ON "unit_access_restriction" ("auth_user_id", "unit_id", "permission") WHERE ((revoked_at IS NULL) AND (subject_kind = 'auth'::unit_access_restriction_subject_kind));
-- Modify "unit_alias" table
ALTER TABLE "unit_alias" DROP CONSTRAINT "unit_alias_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_alias_created_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "unit_alias_vote" table
ALTER TABLE "unit_alias_vote" DROP CONSTRAINT "unit_alias_vote_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_alias_vote_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "unit_association_proposal" table
ALTER TABLE "unit_association_proposal" DROP CONSTRAINT "unit_association_proposal_created_by_profile_id_profile_id_fkey", DROP CONSTRAINT "unit_association_proposal_xg3ooPLi5GS2_fkey", ADD CONSTRAINT "unit_association_proposal_nFb4edBVHb39_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "unit_association_proposal_siV03U1PCfDF_fkey" FOREIGN KEY ("resolved_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "unit_custom_theme_installation" table
ALTER TABLE "unit_custom_theme_installation" DROP CONSTRAINT "unit_custom_theme_installation_vl1o62kbqKVu_fkey", ADD CONSTRAINT "unit_custom_theme_installation_unJl3WFijTY1_fkey" FOREIGN KEY ("installed_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "unit_external_link" table
ALTER TABLE "unit_external_link" DROP CONSTRAINT "unit_external_link_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_external_link_3eeNxOZA38BN_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "unit_external_link_vote" table
ALTER TABLE "unit_external_link_vote" DROP CONSTRAINT "unit_external_link_vote_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_external_link_vote_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "unit_follow" table
ALTER TABLE "unit_follow" DROP CONSTRAINT "unit_follow_follower_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_follow_follower_profile_id_entity_identity_id_fkey" FOREIGN KEY ("follower_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "unit_merge_request" table
ALTER TABLE "unit_merge_request" DROP CONSTRAINT "unit_merge_request_proposer_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_merge_request_proposer_profile_id_entity_identity_id_fkey" FOREIGN KEY ("proposer_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "unit_merge_review" table
ALTER TABLE "unit_merge_review" DROP CONSTRAINT "unit_merge_review_reviewer_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_merge_review_reviewer_profile_id_entity_identity_id_fkey" FOREIGN KEY ("reviewer_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "unit_ownership" table
ALTER TABLE "unit_ownership" DROP CONSTRAINT "unit_ownership_assigned_by_profile_id_profile_id_fkey", DROP CONSTRAINT "unit_ownership_profile_id_profile_id_fkey", DROP CONSTRAINT "unit_ownership_revoked_by_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_ownership_assigned_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("assigned_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "unit_ownership_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "unit_ownership_revoked_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("revoked_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "unit_ownership_claim" table
ALTER TABLE "unit_ownership_claim" DROP CONSTRAINT "unit_ownership_claim_claimant_profile_id_profile_id_fkey", DROP CONSTRAINT "unit_ownership_claim_resolved_by_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_ownership_claim_Ll6Wv9l84eGK_fkey" FOREIGN KEY ("claimant_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "unit_ownership_claim_tqCzLuWayn1t_fkey" FOREIGN KEY ("resolved_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "unit_presentation_revision" table
ALTER TABLE "unit_presentation_revision" DROP CONSTRAINT "unit_presentation_revision_actor_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_presentation_revision_OFFd5cN7vl3i_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "unit_progress" table
ALTER TABLE "unit_progress" DROP CONSTRAINT "unit_progress_pkey", DROP COLUMN "profile_id", ADD COLUMN "auth_user_id" uuid NOT NULL, ADD PRIMARY KEY ("auth_user_id", "unit_id"), ADD CONSTRAINT "unit_progress_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Create index "unit_progress_auth_user_seen_idx" to table: "unit_progress"
CREATE INDEX "unit_progress_auth_user_seen_idx" ON "unit_progress" ("auth_user_id", "last_seen_at" DESC NULLS LAST, "unit_id") WHERE (deleted_at IS NULL);
-- Create index "unit_progress_public_auth_user_seen_idx" to table: "unit_progress"
CREATE INDEX "unit_progress_public_auth_user_seen_idx" ON "unit_progress" ("auth_user_id", "last_seen_at" DESC NULLS LAST, "unit_id") WHERE ((deleted_at IS NULL) AND (visibility = 'public'::resource_visibility));
-- Modify "unit_progress_entry" table
ALTER TABLE "unit_progress_entry" DROP COLUMN "profile_id", ADD COLUMN "auth_user_id" uuid NOT NULL, ADD CONSTRAINT "unit_progress_entry_id_auth_user_unit_key" UNIQUE ("id", "auth_user_id", "unit_id"), ADD CONSTRAINT "unit_progress_entry_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Create index "unit_progress_entry_auth_user_unit_created_idx" to table: "unit_progress_entry"
CREATE INDEX "unit_progress_entry_auth_user_unit_created_idx" ON "unit_progress_entry" ("auth_user_id", "unit_id", "created_at" DESC NULLS LAST) WHERE (deleted_at IS NULL);
-- Create index "unit_progress_entry_auth_user_unit_sort_idx" to table: "unit_progress_entry"
CREATE INDEX "unit_progress_entry_auth_user_unit_sort_idx" ON "unit_progress_entry" ("auth_user_id", "unit_id", (COALESCE(occurred_at, created_at)) DESC, "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (deleted_at IS NULL);
-- Create index "unit_progress_entry_auth_user_unit_status_sort_idx" to table: "unit_progress_entry"
CREATE INDEX "unit_progress_entry_auth_user_unit_status_sort_idx" ON "unit_progress_entry" ("auth_user_id", "unit_id", "status", (COALESCE(occurred_at, created_at)) DESC, "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (deleted_at IS NULL);
-- Modify "unit_reaction" table
ALTER TABLE "unit_reaction" DROP CONSTRAINT "unit_reaction_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_reaction_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "unit_revision" table
ALTER TABLE "unit_revision" DROP CONSTRAINT "unit_revision_actor_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_revision_actor_profile_id_entity_identity_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "unit_share" table
ALTER TABLE "unit_share" DROP CONSTRAINT "unit_share_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_share_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "unit_status_event" table
ALTER TABLE "unit_status_event" DROP CONSTRAINT "unit_status_event_changed_by_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_status_event_changed_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("changed_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "unit_tag" table
ALTER TABLE "unit_tag" DROP CONSTRAINT "unit_tag_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_tag_created_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "unit_tag_judgment" table
ALTER TABLE "unit_tag_judgment" DROP CONSTRAINT "unit_tag_judgment_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_tag_judgment_profile_id_entity_identity_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "unit_tag_path_application" table
ALTER TABLE "unit_tag_path_application" DROP CONSTRAINT "unit_tag_path_application_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_tag_path_application_sgfjGlsToOIK_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "unit_tag_path_application_judgment" table
ALTER TABLE "unit_tag_path_application_judgment" DROP CONSTRAINT "unit_tag_path_application_judgment_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_tag_path_application_judgment_qFMHbn2zXv5I_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "user_account_state_updated_by_idx" from table: "user_account_state"
DROP INDEX "user_account_state_updated_by_idx";
-- Modify "user_account_state" table
ALTER TABLE "user_account_state" DROP COLUMN "updated_by_profile_id", ADD COLUMN "updated_by_auth_user_id" uuid NOT NULL, ADD CONSTRAINT "user_account_state_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "user_account_state_updated_by_idx" to table: "user_account_state"
CREATE INDEX "user_account_state_updated_by_idx" ON "user_account_state" ("updated_by_auth_user_id");
-- Modify "vocabulary_node" table
ALTER TABLE "vocabulary_node" DROP CONSTRAINT "vocabulary_node_created_by_profile_id_profile_id_fkey", ADD CONSTRAINT "vocabulary_node_created_by_profile_id_entity_identity_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "reference_catalog_profile_revision" table
ALTER TABLE "reference_catalog_profile_revision" ADD COLUMN "removed" boolean NOT NULL DEFAULT false;
-- Create "reference_profile_source_occurrence" table
CREATE TABLE "reference_profile_source_occurrence" (
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "revision" bigint NOT NULL,
  PRIMARY KEY ("source_record_id", "snapshot_id", "owner_id"),
  CONSTRAINT "reference_profile_source_history_fk" FOREIGN KEY ("owner_id", "revision") REFERENCES "reference_catalog_profile_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_profile_source_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_profile_source_values" CHECK (("left"(source_path, 1) = '/'::text) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((revision >= 1) AND (revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "reference_source_profile_application_change" table
CREATE TABLE "reference_source_profile_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "reference_profile_app_after_fk" FOREIGN KEY ("owner_id", "after_revision") REFERENCES "reference_catalog_profile_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_profile_app_before_fk" FOREIGN KEY ("owner_id", "before_revision") REFERENCES "reference_catalog_profile_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_profile_app_journal_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_profile_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "reference_source_profile_baseline" table
CREATE TABLE "reference_source_profile_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'reference',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id"),
  CONSTRAINT "reference_profile_baseline_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_profile_baseline_current_fk" FOREIGN KEY ("owner_id", "current_revision") REFERENCES "reference_catalog_profile_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_profile_baseline_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_profile_baseline_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_profile_baseline_source_fk" FOREIGN KEY ("owner_id", "source_revision") REFERENCES "reference_catalog_profile_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_profile_baseline_owner" CHECK (mapping_owner = 'reference'::text),
  CONSTRAINT "reference_profile_baseline_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Modify "unit" table
ALTER TABLE "unit" DROP CONSTRAINT "unit_kind_check", ADD CONSTRAINT "unit_kind_check" CHECK (kind = ANY (ARRAY['slug_namespace'::text, 'book'::text, 'software'::text, 'media'::text, 'video'::text, 'audio'::text, 'release'::text, 'entity'::text, 'label'::text, 'tag'::text, 'tag_path'::text, 'series'::text, 'zone'::text, 'zone_page'::text, 'custom_theme'::text, 'collection'::text, 'post'::text, 'poll'::text, 'realm'::text, 'realm_rule'::text]));
-- Create "studio_auth_editor_candidate" table
CREATE TABLE "studio_auth_editor_candidate" (
  "auth_user_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "owner_since" timestamptz(3) NULL,
  "direct_grant_since" timestamptz(3) NULL,
  "direct_grant_last_at" timestamptz(3) NULL,
  "relevant_at" timestamptz(3) NOT NULL,
  "valid_until" timestamptz(3) NULL,
  "projection_updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("auth_user_id", "unit_id"),
  CONSTRAINT "studio_auth_editor_candidate_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "studio_auth_editor_candidate_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "studio_auth_editor_candidate_direct_grant_time_check" CHECK (((direct_grant_since IS NULL) AND (direct_grant_last_at IS NULL)) OR ((direct_grant_since IS NOT NULL) AND (direct_grant_last_at IS NOT NULL) AND (direct_grant_since <= direct_grant_last_at))),
  CONSTRAINT "studio_auth_editor_candidate_relevant_at_check" CHECK (relevant_at = GREATEST(owner_since, direct_grant_last_at)),
  CONSTRAINT "studio_auth_editor_candidate_source_check" CHECK ((owner_since IS NOT NULL) OR (direct_grant_since IS NOT NULL)),
  CONSTRAINT "studio_auth_editor_candidate_validity_check" CHECK ((valid_until IS NULL) OR (direct_grant_since IS NOT NULL))
);
-- Create index "studio_auth_editor_candidate_expiry_idx" to table: "studio_auth_editor_candidate"
CREATE INDEX "studio_auth_editor_candidate_expiry_idx" ON "studio_auth_editor_candidate" ("valid_until", "auth_user_id", "unit_id") WHERE (valid_until IS NOT NULL);
-- Create index "studio_auth_editor_candidate_profile_recent_idx" to table: "studio_auth_editor_candidate"
CREATE INDEX "studio_auth_editor_candidate_profile_recent_idx" ON "studio_auth_editor_candidate" ("auth_user_id", "relevant_at" DESC NULLS LAST, "unit_id" DESC NULLS LAST);
-- Create index "studio_auth_editor_candidate_unit_idx" to table: "studio_auth_editor_candidate"
CREATE INDEX "studio_auth_editor_candidate_unit_idx" ON "studio_auth_editor_candidate" ("unit_id", "auth_user_id");
-- Modify "unit_license_grant" table
ALTER TABLE "unit_license_grant" DROP CONSTRAINT "unit_license_grant_granted_by_profile_id_profile_id_fkey", DROP CONSTRAINT "unit_license_grant_offering_ended_by_profile_id_profile_id_fkey", ADD CONSTRAINT "unit_license_grant_granted_by_profile_id_profile_id_fkey" FOREIGN KEY ("granted_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "unit_license_grant_offering_ended_by_profile_id_profile_id_fkey" FOREIGN KEY ("offering_ended_by_profile_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop "profile_block" table
DROP TABLE "profile_block";
-- Drop "profile_preference" table
DROP TABLE "profile_preference";
-- Drop "studio_profile_editor_candidate" table
DROP TABLE "studio_profile_editor_candidate";
-- Drop "profile" table
DROP TABLE "profile";

-- Atlas Community omits physical children from inspection; create them before canonical per-leaf guards.
DO $$ DECLARE owner_name text; family text; parent_name text; partition_number integer;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['entity','reference'] LOOP
    FOREACH family IN ARRAY ARRAY['profile_source_occurrence','source_profile_application_change','source_profile_baseline'] LOOP
      parent_name := owner_name || '_' || family;
      FOR partition_number IN 0..63 LOOP
        EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)', parent_name || '_p' || lpad(partition_number::text,2,'0'),parent_name,partition_number);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Private account admission and immutable public-participation evidence.
CREATE OR REPLACE FUNCTION public.participation_guard_self_binding()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE account_kind text; identity_shape text; erased timestamptz;
BEGIN
  SELECT principal_kind, erased_at INTO account_kind, erased FROM public.users WHERE id = NEW.auth_user_id FOR SHARE;
  SELECT shape INTO identity_shape FROM public.entity_identity WHERE id = NEW.entity_id FOR SHARE;
  IF account_kind IS DISTINCT FROM 'human' OR identity_shape IS DISTINCT FROM 'person' OR erased IS NOT NULL THEN
    RAISE EXCEPTION 'Self participation requires an active human account and a person identity' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.auth_user_id <> OLD.auth_user_id OR NEW.entity_id <> OLD.entity_id OR NEW.revision <> OLD.revision + 1) THEN
    RAISE EXCEPTION 'Self identity is immutable and authorization revisions must advance exactly once' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_self_binding_guard ON public.auth_entity;
CREATE TRIGGER participation_self_binding_guard BEFORE INSERT OR UPDATE ON public.auth_entity
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_self_binding();

CREATE OR REPLACE FUNCTION public.participation_guard_account_kind()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.principal_kind <> OLD.principal_kind AND
     (EXISTS(SELECT 1 FROM public.auth_entity WHERE auth_user_id = OLD.id) OR EXISTS(SELECT 1 FROM public.service_principal WHERE auth_user_id = OLD.id)) THEN
    RAISE EXCEPTION 'An admitted principal cannot change its authentication kind' USING ERRCODE = '23514';
  END IF;
  IF OLD.erased_at IS NOT NULL AND (NEW.erased_at IS DISTINCT FROM OLD.erased_at OR NEW.name <> '' OR NEW.image IS NOT NULL OR NEW.email_verified OR NEW.email IS DISTINCT FROM OLD.email OR NEW.principal_kind <> OLD.principal_kind) THEN
    RAISE EXCEPTION 'Erased authentication accounts cannot be restored' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_account_kind_guard ON public.users;
CREATE TRIGGER participation_account_kind_guard BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_account_kind();

CREATE OR REPLACE FUNCTION public.participation_guard_entity_shape()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.shape <> OLD.shape AND
     (EXISTS(SELECT 1 FROM public.auth_entity WHERE entity_id = OLD.id) OR EXISTS(SELECT 1 FROM public.service_principal WHERE entity_id = OLD.id)) THEN
    RAISE EXCEPTION 'An admitted participant cannot change identity shape' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_entity_shape_guard ON public.entity_identity;
CREATE TRIGGER participation_entity_shape_guard BEFORE UPDATE OF shape ON public.entity_identity
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_entity_shape();

CREATE OR REPLACE FUNCTION public.participation_guard_service()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE account_kind text; identity_shape text;
BEGIN
  SELECT principal_kind INTO account_kind FROM public.users WHERE id = NEW.auth_user_id FOR SHARE;
  SELECT shape INTO identity_shape FROM public.entity_identity WHERE id = NEW.entity_id FOR SHARE;
  IF account_kind IS DISTINCT FROM 'service' OR identity_shape IS DISTINCT FROM 'service_actor' THEN
    RAISE EXCEPTION 'Machine credentials require a distinct service principal and service actor' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.auth_user_id <> OLD.auth_user_id OR NEW.entity_id <> OLD.entity_id OR
     NEW.created_by_auth_user_id IS DISTINCT FROM OLD.created_by_auth_user_id OR NEW.revision <> OLD.revision + 1 OR OLD.revoked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Service identity is immutable and revoked credentials cannot be restored' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_service_guard ON public.service_principal;
CREATE TRIGGER participation_service_guard BEFORE INSERT OR UPDATE ON public.service_principal
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_service();

CREATE OR REPLACE FUNCTION public.participation_guard_grant()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Participation grants retain their immutable scope and revocation history' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND ((to_jsonb(NEW) - ARRAY['revision','revoked_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['revision','revoked_at']) OR
     NEW.revision <> OLD.revision + 1 OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Only a consecutive, one-way grant revocation is permitted' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_grant_guard ON public.participation_grant;
CREATE TRIGGER participation_grant_guard BEFORE UPDATE OR DELETE ON public.participation_grant
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_grant();

CREATE OR REPLACE FUNCTION public.participation_require_grant_event()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.participation_grant_event WHERE grant_id = NEW.id AND revision = NEW.revision) THEN
    RAISE EXCEPTION 'Every participation authorization revision requires immutable operator evidence' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_grant_event_required ON public.participation_grant;
CREATE CONSTRAINT TRIGGER participation_grant_event_required AFTER INSERT OR UPDATE ON public.participation_grant
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.participation_require_grant_event();

CREATE OR REPLACE FUNCTION public.participation_guard_immutable_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Participation evidence is immutable' USING ERRCODE = '23514';
END $$;
DROP TRIGGER IF EXISTS participation_grant_event_immutable ON public.participation_grant_event;
CREATE TRIGGER participation_grant_event_immutable BEFORE UPDATE OR DELETE ON public.participation_grant_event
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_immutable_evidence();
DROP TRIGGER IF EXISTS entity_recovery_event_immutable ON public.entity_recovery_event;
CREATE TRIGGER entity_recovery_event_immutable BEFORE UPDATE OR DELETE ON public.entity_recovery_event
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_immutable_evidence();
DROP TRIGGER IF EXISTS entity_presentation_revision_immutable ON public.entity_presentation_revision;
CREATE TRIGGER entity_presentation_revision_immutable BEFORE UPDATE OR DELETE ON public.entity_presentation_revision
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_immutable_evidence();

CREATE OR REPLACE FUNCTION public.participation_guard_presentation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND (NEW.entity_id <> OLD.entity_id OR NEW.language <> OLD.language OR NEW.revision <> OLD.revision + 1)) THEN
    RAISE EXCEPTION 'Entity presentation identities are retained and revisions advance exactly once' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS entity_presentation_guard ON public.entity_presentation;
CREATE TRIGGER entity_presentation_guard BEFORE UPDATE OR DELETE ON public.entity_presentation
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_presentation();

CREATE OR REPLACE FUNCTION public.participation_require_presentation_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.entity_presentation_revision WHERE entity_id = NEW.entity_id AND language = NEW.language AND revision = NEW.revision) THEN
    RAISE EXCEPTION 'Entity presentation requires its immutable revision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS entity_presentation_revision_required ON public.entity_presentation;
CREATE CONSTRAINT TRIGGER entity_presentation_revision_required AFTER INSERT OR UPDATE ON public.entity_presentation
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.participation_require_presentation_revision();

CREATE OR REPLACE FUNCTION public.participation_require_unerased_account()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE subject_id uuid; erased timestamptz;
BEGIN
  subject_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  IF subject_id IS NULL THEN RETURN NEW; END IF;
  SELECT erased_at INTO erased FROM public.users WHERE id = subject_id FOR SHARE;
  IF NOT FOUND OR erased IS NOT NULL THEN
    RAISE EXCEPTION 'An erased account cannot create new private state' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.sessions;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF user_id ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.accounts;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF user_id ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.apikeys;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF reference_id ON public.apikeys
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('reference_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_preference;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_preference
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.notification;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF recipient_auth_user_id ON public.notification
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('recipient_auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.notification_preference;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.notification_preference
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.notification_recipient_stat;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.notification_recipient_stat
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_progress;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.unit_progress
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_progress_entry;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.unit_progress_entry
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.content_structure_node_progress;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.content_structure_node_progress
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_access_grant;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.unit_access_grant
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_access_restriction;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.unit_access_restriction
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_access_invitation;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF invited_auth_user_id ON public.unit_access_invitation
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('invited_auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.platform_capability_grant;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.platform_capability_grant
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_enforcement;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_enforcement
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_evidence_truncate_guard ON public.participation_grant;
CREATE TRIGGER participation_evidence_truncate_guard BEFORE TRUNCATE ON public.participation_grant
FOR EACH STATEMENT EXECUTE FUNCTION public.participation_guard_immutable_evidence();

DROP TRIGGER IF EXISTS participation_evidence_truncate_guard ON public.participation_grant_event;
CREATE TRIGGER participation_evidence_truncate_guard BEFORE TRUNCATE ON public.participation_grant_event
FOR EACH STATEMENT EXECUTE FUNCTION public.participation_guard_immutable_evidence();

DROP TRIGGER IF EXISTS participation_evidence_truncate_guard ON public.entity_recovery_event;
CREATE TRIGGER participation_evidence_truncate_guard BEFORE TRUNCATE ON public.entity_recovery_event
FOR EACH STATEMENT EXECUTE FUNCTION public.participation_guard_immutable_evidence();

DROP TRIGGER IF EXISTS participation_evidence_truncate_guard ON public.entity_presentation_revision;
CREATE TRIGGER participation_evidence_truncate_guard BEFORE TRUNCATE ON public.entity_presentation_revision
FOR EACH STATEMENT EXECUTE FUNCTION public.participation_guard_immutable_evidence();


-- Refresh one Auth/Unit candidate from authoritative ownership and direct grants.
CREATE OR REPLACE FUNCTION public.refresh_studio_auth_editor_candidate(
    candidate_auth_user_id uuid,
    candidate_unit_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    current_owner_since timestamp(3) with time zone;
    current_direct_since timestamp(3) with time zone;
    current_direct_last_at timestamp(3) with time zone;
    current_direct_valid_until timestamp(3) with time zone;
    has_non_expiring_direct boolean;
BEGIN
    IF candidate_auth_user_id IS NULL OR candidate_unit_id IS NULL THEN
        RETURN;
    END IF;

    PERFORM 1 FROM public.users WHERE id = candidate_auth_user_id AND erased_at IS NULL FOR SHARE;
    IF NOT FOUND THEN
      DELETE FROM public.studio_auth_editor_candidate WHERE auth_user_id = candidate_auth_user_id AND unit_id = candidate_unit_id;
      RETURN;
    END IF;
    SELECT min(ownership.created_at)
    INTO current_owner_since
    FROM public.unit_ownership AS ownership
    JOIN public.auth_entity binding ON binding.entity_id = ownership.profile_id
    WHERE binding.auth_user_id = candidate_auth_user_id
      AND ownership.unit_id = candidate_unit_id
      AND ownership.revoked_at IS NULL;

    SELECT
        min(access_grant.created_at),
        max(access_grant.created_at),
        bool_or(access_grant.expires_at IS NULL),
        max(access_grant.expires_at)
    INTO
        current_direct_since,
        current_direct_last_at,
        has_non_expiring_direct,
        current_direct_valid_until
    FROM public.unit_access_grant AS access_grant
    WHERE access_grant.subject_kind = 'auth'::public.unit_access_subject_kind
      AND access_grant.auth_user_id = candidate_auth_user_id
      AND access_grant.unit_id = candidate_unit_id
      AND access_grant.permission = 'unit.update'::public.unit_permission
      AND access_grant.revoked_at IS NULL;

    IF current_owner_since IS NULL AND current_direct_since IS NULL THEN
        DELETE FROM public.studio_auth_editor_candidate
        WHERE auth_user_id = candidate_auth_user_id
          AND unit_id = candidate_unit_id;
        RETURN;
    END IF;

    INSERT INTO public.studio_auth_editor_candidate (
        auth_user_id,
        unit_id,
        owner_since,
        direct_grant_since,
        direct_grant_last_at,
        relevant_at,
        valid_until,
        projection_updated_at
    ) VALUES (
        candidate_auth_user_id,
        candidate_unit_id,
        current_owner_since,
        current_direct_since,
        current_direct_last_at,
        greatest(current_owner_since, current_direct_last_at),
        CASE
            WHEN current_owner_since IS NOT NULL OR coalesce(has_non_expiring_direct, false)
                THEN NULL
            ELSE current_direct_valid_until
        END,
        clock_timestamp()
    )
    ON CONFLICT (auth_user_id, unit_id) DO UPDATE SET
        owner_since = excluded.owner_since,
        direct_grant_since = excluded.direct_grant_since,
        direct_grant_last_at = excluded.direct_grant_last_at,
        relevant_at = excluded.relevant_at,
        valid_until = excluded.valid_until,
        projection_updated_at = excluded.projection_updated_at;
END
$$;

-- Refresh one Realm-relation/Unit candidate without fanning out Realm members.
CREATE OR REPLACE FUNCTION public.refresh_studio_realm_editor_candidate(
    candidate_realm_id uuid,
    candidate_realm_relation public.realm_access_subject_relation,
    candidate_unit_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    current_grant_since timestamp(3) with time zone;
    current_grant_last_at timestamp(3) with time zone;
    current_valid_until timestamp(3) with time zone;
    has_non_expiring_grant boolean;
BEGIN
    IF candidate_realm_id IS NULL
        OR candidate_realm_relation IS NULL
        OR candidate_unit_id IS NULL
    THEN
        RETURN;
    END IF;

    SELECT
        min(access_grant.created_at),
        max(access_grant.created_at),
        bool_or(access_grant.expires_at IS NULL),
        max(access_grant.expires_at)
    INTO
        current_grant_since,
        current_grant_last_at,
        has_non_expiring_grant,
        current_valid_until
    FROM public.unit_access_grant AS access_grant
    WHERE access_grant.subject_kind = 'realm'::public.unit_access_subject_kind
      AND access_grant.realm_id = candidate_realm_id
      AND access_grant.realm_relation = candidate_realm_relation
      AND access_grant.unit_id = candidate_unit_id
      AND access_grant.permission = 'unit.update'::public.unit_permission
      AND access_grant.revoked_at IS NULL;

    IF current_grant_since IS NULL THEN
        DELETE FROM public.studio_realm_editor_candidate
        WHERE realm_id = candidate_realm_id
          AND realm_relation = candidate_realm_relation
          AND unit_id = candidate_unit_id;
        RETURN;
    END IF;

    INSERT INTO public.studio_realm_editor_candidate (
        realm_id,
        realm_relation,
        unit_id,
        grant_since,
        relevant_at,
        valid_until,
        projection_updated_at
    ) VALUES (
        candidate_realm_id,
        candidate_realm_relation,
        candidate_unit_id,
        current_grant_since,
        current_grant_last_at,
        CASE
            WHEN coalesce(has_non_expiring_grant, false) THEN NULL
            ELSE current_valid_until
        END,
        clock_timestamp()
    )
    ON CONFLICT (realm_id, realm_relation, unit_id) DO UPDATE SET
        grant_since = excluded.grant_since,
        relevant_at = excluded.relevant_at,
        valid_until = excluded.valid_until,
        projection_updated_at = excluded.projection_updated_at;
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_studio_editor_candidate_from_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        PERFORM public.refresh_studio_auth_editor_candidate((SELECT auth_user_id FROM public.auth_entity WHERE entity_id = OLD.profile_id), OLD.unit_id);
    END IF;
    IF TG_OP <> 'DELETE' THEN
        PERFORM public.refresh_studio_auth_editor_candidate((SELECT auth_user_id FROM public.auth_entity WHERE entity_id = NEW.profile_id), NEW.unit_id);
    END IF;
    RETURN coalesce(NEW, OLD);
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_studio_editor_candidate_from_grant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP <> 'INSERT' AND OLD.permission = 'unit.update'::public.unit_permission THEN
        IF OLD.subject_kind = 'auth'::public.unit_access_subject_kind THEN
            PERFORM public.refresh_studio_auth_editor_candidate(OLD.auth_user_id, OLD.unit_id);
        ELSIF OLD.subject_kind = 'realm'::public.unit_access_subject_kind THEN
            PERFORM public.refresh_studio_realm_editor_candidate(
                OLD.realm_id,
                OLD.realm_relation,
                OLD.unit_id
            );
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' AND NEW.permission = 'unit.update'::public.unit_permission THEN
        IF NEW.subject_kind = 'auth'::public.unit_access_subject_kind THEN
            PERFORM public.refresh_studio_auth_editor_candidate(NEW.auth_user_id, NEW.unit_id);
        ELSIF NEW.subject_kind = 'realm'::public.unit_access_subject_kind THEN
            PERFORM public.refresh_studio_realm_editor_candidate(
                NEW.realm_id,
                NEW.realm_relation,
                NEW.unit_id
            );
        END IF;
    END IF;
    RETURN coalesce(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS studio_editor_candidate_from_ownership ON public.unit_ownership;
CREATE TRIGGER studio_editor_candidate_from_ownership
AFTER INSERT OR DELETE OR UPDATE OF
    profile_id,
    unit_id,
    revoked_at,
    created_at
ON public.unit_ownership
FOR EACH ROW EXECUTE FUNCTION public.maintain_studio_editor_candidate_from_ownership();

DROP TRIGGER IF EXISTS studio_editor_candidate_from_grant ON public.unit_access_grant;
CREATE TRIGGER studio_editor_candidate_from_grant
AFTER INSERT OR DELETE OR UPDATE OF
    unit_id,
    subject_kind,
    auth_user_id,
    realm_id,
    realm_relation,
    permission,
    expires_at,
    revoked_at,
    created_at
ON public.unit_access_grant
FOR EACH ROW EXECUTE FUNCTION public.maintain_studio_editor_candidate_from_grant();


DROP FUNCTION IF EXISTS public.refresh_studio_profile_editor_candidate(uuid, uuid);


CREATE OR REPLACE FUNCTION public.maintain_unit_progress_stats() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE row_data unit_progress%ROWTYPE; direction bigint;
signal_kind text; signal_weight double precision;
change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF row_data.deleted_at IS NULL AND row_data.status IN ('active', 'completed', 'dropped') THEN
      PERFORM apply_unit_engagement_stat(
        row_data.unit_id,
        p_active_progress => direction * (row_data.status = 'active')::int,
        p_completions => direction * (row_data.status = 'completed')::int,
        p_negative_progress => direction * (row_data.status = 'dropped')::int
      );
      signal_kind := CASE row_data.status WHEN 'active' THEN 'progress_active'
        WHEN 'completed' THEN 'progress_completed' ELSE 'progress_dropped' END;
      signal_weight := CASE row_data.status WHEN 'active' THEN 3
        WHEN 'completed' THEN 5 ELSE -4 END;
      IF signal_weight > 0 THEN
        PERFORM apply_recommendation_unit_signal(
          row_data.unit_id, row_data.last_seen_at, signal_kind, direction,
          direction * signal_weight
        );
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS unit_progress_stats_maintain ON public.unit_progress;
CREATE TRIGGER unit_progress_stats_maintain AFTER INSERT OR DELETE OR UPDATE OF auth_user_id, unit_id, status, last_seen_at, deleted_at ON public.unit_progress FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_progress_stats();


-- Private conversation membership uses Auth; public sender identity is an immutable snapshot.
CREATE OR REPLACE FUNCTION public.participation_guard_conversation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE admitted integer;
BEGIN
  SELECT count(*) INTO admitted FROM (
    SELECT account.id FROM public.users account JOIN public.auth_entity self ON self.auth_user_id = account.id
    WHERE account.erased_at IS NULL AND self.state = 'active' AND
      ((account.id = NEW.participant_low_auth_user_id AND self.entity_id = NEW.participant_low_entity_id) OR
       (account.id = NEW.participant_high_auth_user_id AND self.entity_id = NEW.participant_high_entity_id))
    ORDER BY account.id FOR SHARE OF account, self
  ) admitted_accounts;
  IF admitted <> 2 THEN RAISE EXCEPTION 'Conversation participants require two current private accounts' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('direct-message:' || NEW.participant_low_auth_user_id::text || ':' || NEW.participant_high_auth_user_id::text, 0));
  IF EXISTS(SELECT 1 FROM public.account_entity_block WHERE
      (blocker_auth_user_id = NEW.participant_low_auth_user_id AND blocked_entity_id = NEW.participant_high_entity_id) OR
      (blocker_auth_user_id = NEW.participant_high_auth_user_id AND blocked_entity_id = NEW.participant_low_entity_id)) THEN
    RAISE EXCEPTION 'Direct messaging is blocked' USING ERRCODE = '23514', CONSTRAINT = 'direct_message_blocked';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_conversation_guard ON public.conversation;
CREATE TRIGGER participation_conversation_guard BEFORE INSERT ON public.conversation
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_conversation();

CREATE OR REPLACE FUNCTION public.participation_guard_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE pair public.conversation%ROWTYPE; admitted integer;
BEGIN
  SELECT * INTO pair FROM public.conversation WHERE id = NEW.conversation_id;
  IF NOT FOUND OR NOT ((NEW.sender_auth_user_id = pair.participant_low_auth_user_id AND NEW.sender_entity_id = pair.participant_low_entity_id) OR
    (NEW.sender_auth_user_id = pair.participant_high_auth_user_id AND NEW.sender_entity_id = pair.participant_high_entity_id)) THEN
    RAISE EXCEPTION 'Message sender is not the admitted participant' USING ERRCODE = '23514';
  END IF;
  SELECT count(*) INTO admitted FROM (
    SELECT id FROM public.users WHERE id IN (pair.participant_low_auth_user_id, pair.participant_high_auth_user_id)
      AND erased_at IS NULL ORDER BY id FOR SHARE
  ) accounts;
  IF admitted <> 2 THEN RAISE EXCEPTION 'Conversation account is unavailable' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('direct-message:' || pair.participant_low_auth_user_id::text || ':' || pair.participant_high_auth_user_id::text, 0));
  IF EXISTS(SELECT 1 FROM public.account_entity_block WHERE
    (blocker_auth_user_id = pair.participant_low_auth_user_id AND blocked_entity_id = pair.participant_high_entity_id) OR
    (blocker_auth_user_id = pair.participant_high_auth_user_id AND blocked_entity_id = pair.participant_low_entity_id)) THEN
    RAISE EXCEPTION 'Direct messaging is blocked' USING ERRCODE = '23514', CONSTRAINT = 'direct_message_blocked';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_message_guard ON public.message;
CREATE TRIGGER participation_message_guard BEFORE INSERT ON public.message
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_message();

CREATE OR REPLACE FUNCTION public.participation_guard_account_block()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE target_auth uuid;
BEGIN
  SELECT auth_user_id INTO target_auth FROM public.auth_entity WHERE entity_id = NEW.blocked_entity_id;
  IF target_auth = NEW.blocker_auth_user_id THEN
    RAISE EXCEPTION 'An account cannot block its own self identity' USING ERRCODE = '23514';
  END IF;
  IF target_auth IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('direct-message:' || least(target_auth, NEW.blocker_auth_user_id)::text || ':' || greatest(target_auth, NEW.blocker_auth_user_id)::text, 0));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_account_block_guard ON public.account_entity_block;
CREATE TRIGGER participation_account_block_guard BEFORE INSERT ON public.account_entity_block
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_account_block();

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_entity_block;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF blocker_auth_user_id ON public.account_entity_block
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('blocker_auth_user_id');
DROP TRIGGER IF EXISTS participation_private_account_guard ON public.conversation_read;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.conversation_read
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');
CREATE OR REPLACE FUNCTION public.initialize_conversation_stats()
 RETURNS trigger
 LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  INSERT INTO conversation_stat (conversation_id) VALUES (NEW.id);
  INSERT INTO conversation_participant_stat (conversation_id, auth_user_id, sort_at)
  VALUES (NEW.id, NEW.participant_low_auth_user_id, NEW.created_at),
    (NEW.id, NEW.participant_high_auth_user_id, NEW.created_at);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_message_stats()
 RETURNS trigger
 LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE recipient_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conversation_stat SET last_message_id = NEW.id, last_message_at = NEW.created_at,
      updated_at = now()
    WHERE conversation_id = NEW.conversation_id
      AND (last_message_at IS NULL OR (last_message_at, last_message_id) < (NEW.created_at, NEW.id));
    UPDATE conversation_participant_stat SET last_message_id = NEW.id,
      last_message_at = NEW.created_at, sort_at = NEW.created_at, updated_at = now()
    WHERE conversation_id = NEW.conversation_id
      AND (last_message_at IS NULL OR (last_message_at, last_message_id) < (NEW.created_at, NEW.id));
    SELECT CASE WHEN participant_low_auth_user_id = NEW.sender_auth_user_id
      THEN participant_high_auth_user_id ELSE participant_low_auth_user_id END
    INTO recipient_id FROM conversation WHERE id = NEW.conversation_id;
    IF NEW.deleted_at IS NULL AND message_is_unread(
      NEW.conversation_id, recipient_id, NEW.created_at, NEW.id
    ) THEN
      UPDATE conversation_participant_stat SET unread_count = unread_count + 1,
        updated_at = now()
      WHERE conversation_id = NEW.conversation_id AND auth_user_id = recipient_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    SELECT CASE WHEN participant_low_auth_user_id = NEW.sender_auth_user_id
      THEN participant_high_auth_user_id ELSE participant_low_auth_user_id END
    INTO recipient_id FROM conversation WHERE id = NEW.conversation_id;
    IF message_is_unread(NEW.conversation_id, recipient_id, NEW.created_at, NEW.id) THEN
      UPDATE conversation_participant_stat SET
        unread_count = unread_count + CASE
          WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN -1
          WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN 1 ELSE 0 END,
        updated_at = now()
      WHERE conversation_id = NEW.conversation_id AND auth_user_id = recipient_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT CASE WHEN participant_low_auth_user_id = OLD.sender_auth_user_id
      THEN participant_high_auth_user_id ELSE participant_low_auth_user_id END
    INTO recipient_id FROM conversation WHERE id = OLD.conversation_id;
    IF recipient_id IS NOT NULL AND OLD.deleted_at IS NULL AND message_is_unread(
      OLD.conversation_id, recipient_id, OLD.created_at, OLD.id
    ) THEN
      UPDATE conversation_participant_stat SET unread_count = unread_count - 1,
        updated_at = now()
      WHERE conversation_id = OLD.conversation_id AND auth_user_id = recipient_id;
    END IF;
    PERFORM refresh_conversation_last_message(OLD.conversation_id);
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.message_is_unread(p_conversation_id uuid, p_recipient_id uuid, p_message_created_at timestamp with time zone, p_message_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
SET search_path = pg_catalog, public
AS $function$
  SELECT marker.id IS NULL OR (p_message_created_at, p_message_id) > (marker.created_at, marker.id)
  FROM (SELECT 1) seed
  LEFT JOIN conversation_read read_state
    ON read_state.conversation_id = p_conversation_id AND read_state.auth_user_id = p_recipient_id
  LEFT JOIN message marker ON marker.id = read_state.last_read_message_id;
$function$;

CREATE OR REPLACE FUNCTION public.protect_conversation_aggregate_identity()
 RETURNS trigger
 LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (OLD.id, OLD.participant_low_auth_user_id, OLD.participant_high_auth_user_id, OLD.participant_low_entity_id, OLD.participant_high_entity_id, OLD.created_at)
    IS DISTINCT FROM
    (NEW.id, NEW.participant_low_auth_user_id, NEW.participant_high_auth_user_id, NEW.participant_low_entity_id, NEW.participant_high_entity_id, NEW.created_at) THEN
    RAISE EXCEPTION 'conversation aggregate identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_conversation_read_identity()
 RETURNS trigger
 LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (OLD.conversation_id, OLD.auth_user_id) IS DISTINCT FROM (NEW.conversation_id, NEW.auth_user_id) THEN
    RAISE EXCEPTION 'conversation read identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_message_aggregate_identity()
 RETURNS trigger
 LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (OLD.id, OLD.conversation_id, OLD.sender_auth_user_id, OLD.sender_entity_id, OLD.created_at)
    IS DISTINCT FROM (NEW.id, NEW.conversation_id, NEW.sender_auth_user_id, NEW.sender_entity_id, NEW.created_at) THEN
    RAISE EXCEPTION 'message aggregate identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_conversation_last_message(p_conversation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE latest message%ROWTYPE;
created_at_value timestamptz;
BEGIN
  SELECT * INTO latest FROM message
  WHERE conversation_id = p_conversation_id
  ORDER BY created_at DESC, id DESC LIMIT 1;
  SELECT created_at INTO created_at_value FROM conversation WHERE id = p_conversation_id;
  IF created_at_value IS NULL THEN RETURN; END IF;
  UPDATE conversation_stat SET last_message_id = latest.id,
    last_message_at = latest.created_at, updated_at = now()
  WHERE conversation_id = p_conversation_id;
  UPDATE conversation_participant_stat SET last_message_id = latest.id,
    last_message_at = latest.created_at,
    sort_at = coalesce(latest.created_at, created_at_value), updated_at = now()
  WHERE conversation_id = p_conversation_id;
END;
$function$;

DROP TRIGGER IF EXISTS conversation_aggregate_identity_protect ON public.conversation;
CREATE TRIGGER conversation_aggregate_identity_protect BEFORE UPDATE ON public.conversation FOR EACH ROW EXECUTE FUNCTION protect_conversation_aggregate_identity();

DROP TRIGGER IF EXISTS conversation_stats_initialize ON public.conversation;
CREATE TRIGGER conversation_stats_initialize AFTER INSERT ON public.conversation FOR EACH ROW EXECUTE FUNCTION initialize_conversation_stats();

DROP TRIGGER IF EXISTS conversation_read_identity_protect ON public.conversation_read;
CREATE TRIGGER conversation_read_identity_protect BEFORE UPDATE ON public.conversation_read FOR EACH ROW EXECUTE FUNCTION protect_conversation_read_identity();

DROP TRIGGER IF EXISTS message_aggregate_identity_protect ON public.message;
CREATE TRIGGER message_aggregate_identity_protect BEFORE UPDATE ON public.message FOR EACH ROW EXECUTE FUNCTION protect_message_aggregate_identity();

DROP TRIGGER IF EXISTS message_stats_maintain ON public.message;
CREATE TRIGGER message_stats_maintain AFTER INSERT OR DELETE OR UPDATE OF deleted_at ON public.message FOR EACH ROW EXECUTE FUNCTION maintain_message_stats();



-- Auth-owned personal notification delivery and read-watermark serialization.
CREATE OR REPLACE FUNCTION public.prepare_notification_recipient_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    boundary_created_at timestamp(3) with time zone;
    boundary_id uuid;
BEGIN
    PERFORM pg_advisory_xact_lock(
        hashtextextended('notification-recipient:' || NEW.recipient_auth_user_id::text, 0)
    );

    INSERT INTO public.notification_recipient_stat (auth_user_id)
    VALUES (NEW.recipient_auth_user_id)
    ON CONFLICT (auth_user_id) DO NOTHING;

    SELECT read_through_created_at, read_through_id
    INTO boundary_created_at, boundary_id
    FROM public.notification_recipient_stat
    WHERE auth_user_id = NEW.recipient_auth_user_id;

    IF NEW.in_app_visible
        AND NEW.read_at IS NULL
        AND boundary_created_at IS NOT NULL
        AND (
            NEW.created_at < boundary_created_at
            OR (NEW.created_at = boundary_created_at AND NEW.id <= boundary_id)
        )
    THEN
        NEW.created_at := greatest(
            clock_timestamp(),
            boundary_created_at + interval '1 millisecond'
        );
        NEW.updated_at := greatest(NEW.updated_at, NEW.created_at);
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS notification_recipient_state_prepare ON public.notification;
CREATE TRIGGER notification_recipient_state_prepare
BEFORE INSERT ON public.notification
FOR EACH ROW EXECUTE FUNCTION public.prepare_notification_recipient_state();

-- The aggregate counts only notifications above the recipient watermark.
-- Recipient rows are locked in UUID order before a move is accounted for,
-- preventing two cross-recipient updates from taking opposite lock orders.
CREATE OR REPLACE FUNCTION public.maintain_notification_recipient_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    old_unread boolean := false;
    new_unread boolean := false;
    old_boundary_created_at timestamp(3) with time zone;
    old_boundary_id uuid;
    new_boundary_created_at timestamp(3) with time zone;
    new_boundary_id uuid;
    old_delta bigint := 0;
    new_delta bigint := 0;
    old_auth_user_id uuid;
    new_auth_user_id uuid;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        old_auth_user_id := OLD.recipient_auth_user_id;
        INSERT INTO public.notification_recipient_stat (auth_user_id)
        VALUES (old_auth_user_id)
        ON CONFLICT (auth_user_id) DO NOTHING;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        new_auth_user_id := NEW.recipient_auth_user_id;
        INSERT INTO public.notification_recipient_stat (auth_user_id)
        VALUES (new_auth_user_id)
        ON CONFLICT (auth_user_id) DO NOTHING;
    END IF;

    PERFORM 1
    FROM public.notification_recipient_stat
    WHERE auth_user_id IN (old_auth_user_id, new_auth_user_id)
    ORDER BY auth_user_id
    FOR UPDATE;

    IF TG_OP <> 'INSERT' THEN
        SELECT read_through_created_at, read_through_id
        INTO old_boundary_created_at, old_boundary_id
        FROM public.notification_recipient_stat
        WHERE auth_user_id = OLD.recipient_auth_user_id;
        old_unread := OLD.in_app_visible
            AND OLD.read_at IS NULL
            AND (
                old_boundary_created_at IS NULL
                OR OLD.created_at > old_boundary_created_at
                OR (OLD.created_at = old_boundary_created_at AND OLD.id > old_boundary_id)
            );
        old_delta := CASE WHEN old_unread THEN -1 ELSE 0 END;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        SELECT read_through_created_at, read_through_id
        INTO new_boundary_created_at, new_boundary_id
        FROM public.notification_recipient_stat
        WHERE auth_user_id = NEW.recipient_auth_user_id;
        new_unread := NEW.in_app_visible
            AND NEW.read_at IS NULL
            AND (
                new_boundary_created_at IS NULL
                OR NEW.created_at > new_boundary_created_at
                OR (NEW.created_at = new_boundary_created_at AND NEW.id > new_boundary_id)
            );
        new_delta := CASE WHEN new_unread THEN 1 ELSE 0 END;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.recipient_auth_user_id = NEW.recipient_auth_user_id THEN
        IF old_delta + new_delta <> 0 THEN
            UPDATE public.notification_recipient_stat
            SET unread_count = unread_count + old_delta + new_delta,
                updated_at = clock_timestamp()
            WHERE auth_user_id = NEW.recipient_auth_user_id;
        END IF;
    ELSE
        IF old_delta <> 0 THEN
            UPDATE public.notification_recipient_stat
            SET unread_count = unread_count + old_delta,
                updated_at = clock_timestamp()
            WHERE auth_user_id = OLD.recipient_auth_user_id;
        END IF;
        IF new_delta <> 0 THEN
            UPDATE public.notification_recipient_stat
            SET unread_count = unread_count + new_delta,
                updated_at = clock_timestamp()
            WHERE auth_user_id = NEW.recipient_auth_user_id;
        END IF;
    END IF;
    RETURN coalesce(NEW, OLD);
END
$$;

DROP TRIGGER IF EXISTS notification_recipient_stat_maintain ON public.notification;
CREATE TRIGGER notification_recipient_stat_maintain
AFTER INSERT OR DELETE OR UPDATE OF
    recipient_auth_user_id,
    in_app_visible,
    read_at,
    created_at
ON public.notification
FOR EACH ROW EXECUTE FUNCTION public.maintain_notification_recipient_stat();


-- Canonical current definitions for Book Chapter occurrence progress.
--
-- Only explicit Chapter occurrences contribute. Book and Label occurrences are
-- structural or navigational; the database never traverses a referenced Book.

CREATE OR REPLACE FUNCTION public.apply_book_chapter_delta(
    p_book_unit_id uuid,
    p_node_id uuid,
    p_all_delta bigint,
    p_public_delta bigint
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_all_delta = 0 AND p_public_delta = 0 THEN
        RETURN;
    END IF;

    IF p_all_delta < 0 OR p_public_delta < 0 THEN
        UPDATE public.book_chapter_stat SET
            all_count = all_count + p_all_delta,
            public_count = public_count + p_public_delta,
            updated_at = now()
        WHERE book_unit_id = p_book_unit_id;

        UPDATE public.book_chapter_progress_stat AS stat SET
            all_completed_count = stat.all_completed_count + p_all_delta,
            public_completed_count = stat.public_completed_count + p_public_delta,
            updated_at = now()
        FROM public.content_structure_node_progress AS progress
        WHERE progress.node_id = p_node_id
          AND stat.auth_user_id = progress.auth_user_id
          AND stat.book_unit_id = p_book_unit_id;
    ELSE
        UPDATE public.book_chapter_stat SET
            all_count = all_count + p_all_delta,
            public_count = public_count + p_public_delta,
            updated_at = now()
        WHERE book_unit_id = p_book_unit_id;
        IF NOT FOUND THEN
            INSERT INTO public.book_chapter_stat (book_unit_id, all_count, public_count)
            VALUES (p_book_unit_id, p_all_delta, p_public_delta);
        END IF;

        UPDATE public.book_chapter_progress_stat AS stat SET
            all_completed_count = stat.all_completed_count + p_all_delta,
            public_completed_count = stat.public_completed_count + p_public_delta,
            updated_at = now()
        FROM public.content_structure_node_progress AS progress
        WHERE progress.node_id = p_node_id
          AND stat.auth_user_id = progress.auth_user_id
          AND stat.book_unit_id = p_book_unit_id;

        INSERT INTO public.book_chapter_progress_stat (
            auth_user_id, book_unit_id, all_completed_count, public_completed_count
        )
        SELECT progress.auth_user_id, p_book_unit_id, p_all_delta, p_public_delta
        FROM public.content_structure_node_progress AS progress
        WHERE progress.node_id = p_node_id
          AND NOT EXISTS (
              SELECT 1 FROM public.book_chapter_progress_stat AS existing
              WHERE existing.auth_user_id = progress.auth_user_id
                AND existing.book_unit_id = p_book_unit_id
          );
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.book_chapter_node_scope(
    p_structure_id uuid,
    p_content_unit_id uuid,
    p_node_deleted_at timestamp with time zone
) RETURNS TABLE(book_unit_id uuid, all_eligible boolean, public_eligible boolean)
LANGUAGE sql STABLE
AS $$
SELECT
    structure.owner_unit_id,
    structure.kind = 'book.contents'
        AND structure.deleted_at IS NULL
        AND p_node_deleted_at IS NULL
        AND content_unit.kind = 'post'
        AND content_unit.deleted_at IS NULL
        AND content_post.kind = 'chapter' AS all_eligible,
    structure.kind = 'book.contents'
        AND structure.deleted_at IS NULL
        AND p_node_deleted_at IS NULL
        AND content_unit.kind = 'post'
        AND content_unit.deleted_at IS NULL
        AND content_post.kind = 'chapter'
        AND content_unit.status = 'published'
        AND content_unit.visibility IN ('public', 'unlisted') AS public_eligible
FROM public.content_structure AS structure
JOIN public.unit AS content_unit ON content_unit.id = p_content_unit_id
LEFT JOIN public.post AS content_post ON content_post.id = content_unit.id
WHERE structure.id = p_structure_id
$$;

CREATE OR REPLACE FUNCTION public.maintain_book_chapter_from_node() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_scope record;
    new_scope record;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT * INTO old_scope FROM public.book_chapter_node_scope(
            OLD.structure_id, OLD.content_unit_id, OLD.deleted_at
        );
        IF old_scope.all_eligible THEN
            PERFORM public.apply_book_chapter_delta(
                old_scope.book_unit_id,
                OLD.id,
                -1,
                CASE WHEN old_scope.public_eligible THEN -1 ELSE 0 END
            );
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        SELECT * INTO new_scope FROM public.book_chapter_node_scope(
            NEW.structure_id, NEW.content_unit_id, NEW.deleted_at
        );
        IF new_scope.all_eligible THEN
            PERFORM public.apply_book_chapter_delta(
                new_scope.book_unit_id,
                NEW.id,
                1,
                CASE WHEN new_scope.public_eligible THEN 1 ELSE 0 END
            );
        END IF;
    END IF;
    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_book_chapter_from_post() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    occurrence record;
    content_unit public.unit%ROWTYPE;
    old_chapter boolean := TG_OP <> 'INSERT' AND OLD.kind = 'chapter';
    new_chapter boolean := TG_OP <> 'DELETE' AND NEW.kind = 'chapter';
    common_active boolean;
BEGIN
    SELECT * INTO content_unit FROM public.unit WHERE id = coalesce(NEW.id, OLD.id);
    FOR occurrence IN
        SELECT node.id, node.deleted_at, structure.owner_unit_id,
               structure.kind, structure.deleted_at AS structure_deleted_at
        FROM public.content_structure_node AS node
        JOIN public.content_structure AS structure ON structure.id = node.structure_id
        WHERE node.content_unit_id = coalesce(NEW.id, OLD.id)
    LOOP
        common_active := occurrence.kind = 'book.contents'
            AND occurrence.structure_deleted_at IS NULL
            AND occurrence.deleted_at IS NULL
            AND content_unit.kind = 'post'
            AND content_unit.deleted_at IS NULL;
        PERFORM public.apply_book_chapter_delta(
            occurrence.owner_unit_id,
            occurrence.id,
            (CASE WHEN common_active AND new_chapter THEN 1 ELSE 0 END)
                - (CASE WHEN common_active AND old_chapter THEN 1 ELSE 0 END),
            (CASE WHEN common_active AND new_chapter AND content_unit.status = 'published'
                    AND content_unit.visibility IN ('public', 'unlisted') THEN 1 ELSE 0 END)
                - (CASE WHEN common_active AND old_chapter AND content_unit.status = 'published'
                    AND content_unit.visibility IN ('public', 'unlisted') THEN 1 ELSE 0 END)
        );
    END LOOP;
    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_book_chapter_from_progress() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    scope record;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT chapter_scope.* INTO scope
        FROM public.content_structure_node AS node
        CROSS JOIN LATERAL public.book_chapter_node_scope(
            node.structure_id, node.content_unit_id, node.deleted_at
        ) AS chapter_scope
        WHERE node.id = OLD.node_id;
        IF scope.all_eligible THEN
            UPDATE public.book_chapter_progress_stat SET
                all_completed_count = all_completed_count - 1,
                public_completed_count = public_completed_count
                    - CASE WHEN scope.public_eligible THEN 1 ELSE 0 END,
                updated_at = now()
            WHERE auth_user_id = OLD.auth_user_id AND book_unit_id = scope.book_unit_id;
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        SELECT chapter_scope.* INTO scope
        FROM public.content_structure_node AS node
        CROSS JOIN LATERAL public.book_chapter_node_scope(
            node.structure_id, node.content_unit_id, node.deleted_at
        ) AS chapter_scope
        WHERE node.id = NEW.node_id;
        IF scope.all_eligible THEN
            INSERT INTO public.book_chapter_progress_stat (
                auth_user_id, book_unit_id, all_completed_count, public_completed_count
            ) VALUES (
                NEW.auth_user_id,
                scope.book_unit_id,
                1,
                CASE WHEN scope.public_eligible THEN 1 ELSE 0 END
            )
            ON CONFLICT (auth_user_id, book_unit_id) DO UPDATE SET
                all_completed_count = public.book_chapter_progress_stat.all_completed_count + 1,
                public_completed_count = public.book_chapter_progress_stat.public_completed_count
                    + EXCLUDED.public_completed_count,
                updated_at = now();
        END IF;
    END IF;
    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_book_chapter_from_structure() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    occurrence record;
    old_active boolean := TG_OP <> 'INSERT'
        AND OLD.kind = 'book.contents' AND OLD.deleted_at IS NULL;
    new_active boolean := TG_OP <> 'DELETE'
        AND NEW.kind = 'book.contents' AND NEW.deleted_at IS NULL;
BEGIN
    IF old_active = new_active THEN
        RETURN NULL;
    END IF;
    FOR occurrence IN
        SELECT node.id, node.owner_unit_id, content_unit.status, content_unit.visibility
        FROM public.content_structure_node AS node
        JOIN public.unit AS content_unit ON content_unit.id = node.content_unit_id
        JOIN public.post AS content_post ON content_post.id = content_unit.id
        WHERE node.structure_id = coalesce(NEW.id, OLD.id)
          AND node.deleted_at IS NULL
          AND content_unit.kind = 'post'
          AND content_unit.deleted_at IS NULL
          AND content_post.kind = 'chapter'
    LOOP
        PERFORM public.apply_book_chapter_delta(
            occurrence.owner_unit_id,
            occurrence.id,
            (CASE WHEN new_active THEN 1 ELSE 0 END)
                - (CASE WHEN old_active THEN 1 ELSE 0 END),
            (CASE WHEN new_active AND occurrence.status = 'published'
                    AND occurrence.visibility IN ('public', 'unlisted') THEN 1 ELSE 0 END)
                - (CASE WHEN old_active AND occurrence.status = 'published'
                    AND occurrence.visibility IN ('public', 'unlisted') THEN 1 ELSE 0 END)
        );
    END LOOP;
    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_book_chapter_from_unit() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    occurrence record;
    is_chapter boolean;
    old_all boolean;
    old_public boolean;
    new_all boolean;
    new_public boolean;
BEGIN
    SELECT kind = 'chapter' INTO is_chapter FROM public.post WHERE id = NEW.id;
    IF NOT coalesce(is_chapter, false) THEN
        RETURN NULL;
    END IF;
    FOR occurrence IN
        SELECT node.id, node.deleted_at, structure.owner_unit_id,
               structure.kind, structure.deleted_at AS structure_deleted_at
        FROM public.content_structure_node AS node
        JOIN public.content_structure AS structure ON structure.id = node.structure_id
        WHERE node.content_unit_id = NEW.id
    LOOP
        old_all := occurrence.kind = 'book.contents'
            AND occurrence.structure_deleted_at IS NULL
            AND occurrence.deleted_at IS NULL
            AND OLD.kind = 'post' AND OLD.deleted_at IS NULL;
        new_all := occurrence.kind = 'book.contents'
            AND occurrence.structure_deleted_at IS NULL
            AND occurrence.deleted_at IS NULL
            AND NEW.kind = 'post' AND NEW.deleted_at IS NULL;
        old_public := old_all AND OLD.status = 'published'
            AND OLD.visibility IN ('public', 'unlisted');
        new_public := new_all AND NEW.status = 'published'
            AND NEW.visibility IN ('public', 'unlisted');
        PERFORM public.apply_book_chapter_delta(
            occurrence.owner_unit_id,
            occurrence.id,
            (CASE WHEN new_all THEN 1 ELSE 0 END) - (CASE WHEN old_all THEN 1 ELSE 0 END),
            (CASE WHEN new_public THEN 1 ELSE 0 END)
                - (CASE WHEN old_public THEN 1 ELSE 0 END)
        );
    END LOOP;
    RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS book_chapter_node_stat_maintain ON public.content_structure_node;
CREATE TRIGGER book_chapter_node_stat_maintain
AFTER INSERT OR DELETE OR UPDATE OF structure_id, content_unit_id, deleted_at
ON public.content_structure_node
FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_node();

DROP TRIGGER IF EXISTS book_chapter_post_stat_maintain ON public.post;
CREATE TRIGGER book_chapter_post_stat_maintain
AFTER INSERT OR DELETE OR UPDATE OF kind
ON public.post
FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_post();

DROP TRIGGER IF EXISTS book_chapter_progress_stat_maintain
ON public.content_structure_node_progress;
CREATE TRIGGER book_chapter_progress_stat_maintain
AFTER INSERT OR DELETE OR UPDATE OF auth_user_id, node_id
ON public.content_structure_node_progress
FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_progress();

DROP TRIGGER IF EXISTS book_chapter_structure_stat_maintain ON public.content_structure;
CREATE TRIGGER book_chapter_structure_stat_maintain
AFTER INSERT OR DELETE OR UPDATE OF kind, deleted_at
ON public.content_structure
FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_structure();

DROP TRIGGER IF EXISTS book_chapter_unit_stat_maintain ON public.unit;
CREATE TRIGGER book_chapter_unit_stat_maintain
AFTER UPDATE OF kind, status, visibility, deleted_at
ON public.unit
FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_unit();


CREATE OR REPLACE FUNCTION public.catalog_source_validate_application_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE history public.music_component_revision%ROWTYPE; application public.catalog_source_application%ROWTYPE; proposal_state text; after_sequence bigint;
BEGIN
  SELECT * INTO STRICT application FROM public.catalog_source_application WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action;
  SELECT state INTO STRICT proposal_state FROM public.catalog_source_adoption_proposal WHERE source_record_id=NEW.source_record_id AND id=NEW.proposal_id;
  IF NEW.position >= application.change_count OR (NEW.action='apply' AND proposal_state <> 'pending') OR (NEW.action='withdraw' AND proposal_state <> 'applied') THEN
    RAISE EXCEPTION 'Native change must belong to its in-progress application' USING ERRCODE = '23514';
  END IF;
  IF TG_ARGV[0] = 'music' THEN
    SELECT * INTO STRICT history FROM public.music_component_revision WHERE owner_id = NEW.owner_id AND id = NEW.after_revision_id;
    IF history.component <> NEW.component OR history.component_key <> NEW.component_key THEN
      RAISE EXCEPTION 'Music application history has a different component key' USING ERRCODE = '23514';
    END IF;
    after_sequence := history.component_sequence;
    IF NEW.before_revision_id IS NOT NULL THEN
      SELECT * INTO STRICT history FROM public.music_component_revision WHERE owner_id = NEW.owner_id AND id = NEW.before_revision_id;
      IF history.component <> NEW.component OR history.component_key <> NEW.component_key OR history.component_sequence >= after_sequence THEN
        RAISE EXCEPTION 'Music application before history has a different component or order' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_source_require_application_complete()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE application public.catalog_source_application%ROWTYPE; proposal public.catalog_source_adoption_proposal%ROWTYPE;
  actual_count integer; unique_positions integer; first_position integer; last_position integer;
BEGIN
  SELECT * INTO STRICT application FROM public.catalog_source_application
    WHERE source_record_id = NEW.source_record_id AND proposal_id = NEW.proposal_id AND action = NEW.action;
  SELECT * INTO STRICT proposal FROM public.catalog_source_adoption_proposal
    WHERE source_record_id = NEW.source_record_id AND id = NEW.proposal_id;
  IF (application.action = 'apply' AND proposal.state NOT IN ('applied','withdrawn'))
    OR (application.action = 'withdraw' AND proposal.state <> 'withdrawn') THEN
    RAISE EXCEPTION 'Native application must commit its corresponding proposal decision' USING ERRCODE = '23514';
  END IF;
  SELECT count(*), count(DISTINCT position), min(position), max(position)
    INTO actual_count, unique_positions, first_position, last_position FROM (
      SELECT position FROM public.music_source_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_component_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_record_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_context_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_participation_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_profile_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_profile_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
    ) changes;
  IF actual_count <> application.change_count OR unique_positions <> actual_count
    OR (actual_count > 0 AND (first_position <> 0 OR last_position <> actual_count - 1)) THEN
    RAISE EXCEPTION 'Native application requires a complete contiguous change manifest' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;

DO $$
DECLARE relation_name text; physical record;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change','publishing_source_semantic_application_change','publishing_source_name_application_change','publishing_source_authority_application_change','music_source_semantic_application_change','music_source_name_application_change','music_source_authority_application_change','program_source_semantic_application_change','program_source_name_application_change','program_source_authority_application_change','software_source_semantic_application_change','software_source_name_application_change','software_source_authority_application_change','entity_source_semantic_application_change','entity_source_name_application_change','entity_source_authority_application_change','grouping_source_semantic_application_change','grouping_source_name_application_change','grouping_source_authority_application_change','reference_source_semantic_application_change','reference_source_name_application_change','reference_source_authority_application_change','distribution_source_semantic_application_change','distribution_source_name_application_change','distribution_source_authority_application_change','software_source_context_application_change','software_source_participation_application_change','entity_source_profile_application_change','reference_source_profile_application_change'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_application_immutable ON public.%I', relation_name);
    EXECUTE format('CREATE TRIGGER catalog_source_application_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()', relation_name);
    IF relation_name NOT IN ('catalog_source_application','music_source_application_change') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_application_change_guard ON public.%I', relation_name);
      EXECUTE format('CREATE TRIGGER catalog_source_application_change_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_validate_application_change()', relation_name);
    END IF;
  END LOOP;
  FOR physical IN
    WITH RECURSIVE roots AS (
      SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change','publishing_source_semantic_application_change','publishing_source_name_application_change','publishing_source_authority_application_change','music_source_semantic_application_change','music_source_name_application_change','music_source_authority_application_change','program_source_semantic_application_change','program_source_name_application_change','program_source_authority_application_change','software_source_semantic_application_change','software_source_name_application_change','software_source_authority_application_change','entity_source_semantic_application_change','entity_source_name_application_change','entity_source_authority_application_change','grouping_source_semantic_application_change','grouping_source_name_application_change','grouping_source_authority_application_change','reference_source_semantic_application_change','reference_source_name_application_change','reference_source_authority_application_change','distribution_source_semantic_application_change','distribution_source_name_application_change','distribution_source_authority_application_change','software_source_context_application_change','software_source_participation_application_change','entity_source_profile_application_change','reference_source_profile_application_change')
      UNION ALL SELECT i.inhrelid FROM pg_inherits i JOIN roots r ON r.oid=i.inhparent
    ) SELECT c.oid::regclass AS name, c.relname AS local_name FROM roots r JOIN pg_class c ON c.oid=r.oid WHERE c.relkind='r'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_application_complete ON %s', physical.name);
    IF physical.local_name LIKE 'catalog_source_application%' THEN
      EXECUTE format('CREATE CONSTRAINT TRIGGER catalog_source_application_complete AFTER INSERT ON %s DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_source_require_application_complete()', physical.name);
    END IF;
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS music_source_application_exact_component ON public.music_source_application_change;
CREATE TRIGGER music_source_application_exact_component BEFORE INSERT ON public.music_source_application_change
  FOR EACH ROW EXECUTE FUNCTION public.catalog_source_validate_application_change('music');

CREATE OR REPLACE FUNCTION public.catalog_source_guard_proposal()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Source proposal decisions are retained evidence' USING ERRCODE='23514'; END IF;
  IF (NEW.source_record_id,NEW.id,NEW.snapshot_id,NEW.mapping_key,NEW.mapping_owner,NEW.mapping_version,NEW.expected_target_revision,NEW.expected_binding_revision,NEW.expected_policy_revision,NEW.created_at)
    IS DISTINCT FROM (OLD.source_record_id,OLD.id,OLD.snapshot_id,OLD.mapping_key,OLD.mapping_owner,OLD.mapping_version,OLD.expected_target_revision,OLD.expected_binding_revision,OLD.expected_policy_revision,OLD.created_at)
    OR (NEW.proposer_auth_user_id IS DISTINCT FROM OLD.proposer_auth_user_id AND NEW.proposer_auth_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Source proposal scope and preconditions are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.state = OLD.state THEN
    IF (NEW.decided_at,NEW.decision_reason,NEW.applied_target_revision) IS DISTINCT FROM (OLD.decided_at,OLD.decision_reason,OLD.applied_target_revision) THEN
      RAISE EXCEPTION 'Source proposal decisions are immutable without an allowed transition' USING ERRCODE='23514';
    END IF;
  ELSIF NOT ((OLD.state='pending' AND NEW.state IN ('applied','rejected','superseded')) OR (OLD.state='applied' AND NEW.state='withdrawn')) THEN
    RAISE EXCEPTION 'Source proposal transition is not allowed' USING ERRCODE='23514';
  END IF;
  IF NEW.state IN ('applied','withdrawn') AND NOT EXISTS (
    SELECT 1 FROM public.catalog_source_application WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.id
      AND action=CASE WHEN NEW.state='applied' THEN 'apply' ELSE 'withdraw' END AND after_revision=NEW.applied_target_revision
  ) THEN
    RAISE EXCEPTION 'Source proposal decision requires its exact native application' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catalog_source_proposal_guard ON public.catalog_source_adoption_proposal;
CREATE TRIGGER catalog_source_proposal_guard BEFORE UPDATE OR DELETE ON public.catalog_source_adoption_proposal
  FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_proposal();


CREATE OR REPLACE FUNCTION public.catalog_validate_profile_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE valid boolean;
BEGIN
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE owner_id=$1 AND revision=$2 AND NOT removed)',TG_ARGV[0] || '_catalog_profile_revision') INTO valid USING NEW.owner_id,NEW.revision;
  IF NOT valid THEN RAISE EXCEPTION 'Profile source occurrence requires exact present native history' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_validate_profile_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE valid boolean; current_revision bigint;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Profile source baselines are retained correspondence' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (OLD.source_record_id,OLD.mapping_key,OLD.mapping_owner,OLD.owner_id) IS DISTINCT FROM (NEW.source_record_id,NEW.mapping_key,NEW.mapping_owner,NEW.owner_id) THEN
    RAISE EXCEPTION 'Profile source baseline identity is immutable' USING ERRCODE='23514';
  END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND source_path=$4 AND revision=$5)',TG_ARGV[0] || '_profile_source_occurrence') INTO valid USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.source_path,NEW.source_revision;
  IF NOT valid THEN RAISE EXCEPTION 'Profile baseline requires exact immutable source occurrence' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT revision FROM public.%I WHERE owner_id=$1 ORDER BY revision DESC LIMIT 1',TG_ARGV[0] || '_catalog_profile_revision') INTO current_revision USING NEW.owner_id;
  IF current_revision IS DISTINCT FROM NEW.current_revision THEN RAISE EXCEPTION 'Profile baseline must identify the current native profile head' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I c JOIN public.catalog_source_adoption_proposal p ON p.source_record_id=c.source_record_id AND p.id=c.proposal_id WHERE c.source_record_id=$1 AND c.proposal_id=$2 AND c.action=$3 AND c.owner_id=$4 AND c.after_revision=$5 AND p.mapping_key=$6)',TG_ARGV[0] || '_source_profile_application_change') INTO valid USING NEW.source_record_id,NEW.last_proposal_id,NEW.last_action,NEW.owner_id,NEW.current_revision,NEW.mapping_key;
  IF NOT valid THEN RAISE EXCEPTION 'Profile baseline requires its exact native application' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE owner_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['entity','reference'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_source_immutable ON public.%I',owner_name || '_profile_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_profile_source_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()',owner_name || '_profile_source_occurrence');
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_source_exact ON public.%I',owner_name || '_profile_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_profile_source_exact BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_profile_source(%L)',owner_name || '_profile_source_occurrence',owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_baseline_exact ON public.%I',owner_name || '_source_profile_baseline');
    EXECUTE format('CREATE TRIGGER catalog_profile_baseline_exact BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_profile_baseline(%L)',owner_name || '_source_profile_baseline',owner_name);
  END LOOP;
END $$;
