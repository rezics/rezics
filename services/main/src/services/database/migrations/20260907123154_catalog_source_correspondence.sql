SET search_path TO public;

-- The stopped-site replacement uses Auth-owned private tag data; this is a renamed phase, not an alias.
ALTER TYPE public.unit_merge_operation_phase RENAME VALUE 'profile_unit_tags' TO 'account_unit_tags';

-- Remove the old dependent keys before Atlas replaces their referenced keys.
-- The generated diff recreates each foreign key with its exact correspondence.
ALTER TABLE public.publishing_name_source_occurrence DROP CONSTRAINT publishing_name_source_occurrence_binding_fk;
ALTER TABLE public.music_name_source_occurrence DROP CONSTRAINT music_name_source_occurrence_binding_fk;
ALTER TABLE public.software_name_source_occurrence DROP CONSTRAINT software_name_source_occurrence_binding_fk;
ALTER TABLE public.program_name_source_occurrence DROP CONSTRAINT program_name_source_occurrence_binding_fk;
ALTER TABLE public.entity_name_source_occurrence DROP CONSTRAINT entity_name_source_occurrence_binding_fk;
ALTER TABLE public.reference_name_source_occurrence DROP CONSTRAINT reference_name_source_occurrence_binding_fk;
ALTER TABLE public.grouping_name_source_occurrence DROP CONSTRAINT grouping_name_source_occurrence_binding_fk;
ALTER TABLE public.distribution_name_source_occurrence DROP CONSTRAINT distribution_name_source_occurrence_binding_fk;

-- Modify "account_erasure" table
ALTER TABLE "account_erasure" DROP CONSTRAINT "account_erasure_stage_check", ADD CONSTRAINT "account_erasure_stage_check" CHECK (stage = ANY (ARRAY['sessions'::text, 'credentials'::text, 'quota_account_leases'::text, 'quota_account_daily'::text, 'quota_account_rates'::text, 'quota_reservations'::text, 'quota_account_binding'::text, 'api_tokens'::text, 'verification'::text, 'auth_mail'::text, 'preferences'::text, 'notifications'::text, 'notification_preferences'::text, 'notification_stats'::text, 'sent_messages'::text, 'conversation_reads'::text, 'conversation_stats'::text, 'account_blocks'::text, 'progress'::text, 'progress_entries'::text, 'progress_nodes'::text, 'progress_stats'::text, 'recommendation_events'::text, 'recommendation_exclusions'::text, 'studio_visits'::text, 'studio_candidates'::text, 'favorite_history'::text, 'favorites'::text, 'favorites_state'::text, 'tag_subscriptions'::text, 'personal_tags'::text, 'private_images'::text, 'complete'::text]));
-- Create index "email_outbox_recipient_erasure_idx" to table: "email_outbox"
CREATE INDEX "email_outbox_recipient_erasure_idx" ON "email_outbox" ("recipient_email", "id") WHERE (recipient_email IS NOT NULL);
-- Modify "message" table
ALTER TABLE "message" ADD CONSTRAINT "message_content_byte_size_check" CHECK ((content IS NULL) OR (octet_length(content) <= 80000));
-- Create index "message_sender_erasure_idx" to table: "message"
CREATE INDEX "message_sender_erasure_idx" ON "message" ("sender_auth_user_id", "id") WHERE (content IS NOT NULL);
-- Modify "notification" table
ALTER TABLE "notification" DROP CONSTRAINT "notification_not_self_check";
-- Create index "notification_recipient_erasure_idx" to table: "notification"
CREATE INDEX "notification_recipient_erasure_idx" ON "notification" ("recipient_auth_user_id", "id");
-- Drop index "studio_auth_editor_candidate_profile_recent_idx" from table: "studio_auth_editor_candidate"
DROP INDEX "studio_auth_editor_candidate_profile_recent_idx";
-- Create index "studio_auth_editor_candidate_auth_recent_idx" to table: "studio_auth_editor_candidate"
CREATE INDEX "studio_auth_editor_candidate_auth_recent_idx" ON "studio_auth_editor_candidate" ("auth_user_id", "relevant_at" DESC NULLS LAST, "unit_id" DESC NULLS LAST);
-- Drop index "studio_resource_visit_profile_recent_idx" from table: "studio_resource_visit"
DROP INDEX "studio_resource_visit_profile_recent_idx";
-- Create index "studio_resource_visit_auth_recent_idx" to table: "studio_resource_visit"
CREATE INDEX "studio_resource_visit_auth_recent_idx" ON "studio_resource_visit" ("auth_user_id", "last_visited_at" DESC NULLS LAST, "resource_unit_id" DESC NULLS LAST);
-- Create index "unit_progress_entry_auth_erasure_idx" to table: "unit_progress_entry"
CREATE INDEX "unit_progress_entry_auth_erasure_idx" ON "unit_progress_entry" ("auth_user_id", "id");
-- Create "account_favorite" table
CREATE TABLE "account_favorite" (
  "auth_user_id" uuid NOT NULL,
  "target_unit_id" uuid NOT NULL,
  "position" text NOT NULL COLLATE "C",
  "note" text NULL,
  "snapshot" jsonb NOT NULL,
  "revision" bigint NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("auth_user_id", "target_unit_id"),
  CONSTRAINT "account_favorite_position_key" UNIQUE ("auth_user_id", "position"),
  CONSTRAINT "account_favorite_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "account_favorite_target_unit_id_unit_id_fkey" FOREIGN KEY ("target_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "account_favorite_note_check" CHECK ((note IS NULL) OR (octet_length(note) <= 65536)),
  CONSTRAINT "account_favorite_position_check" CHECK (octet_length("position") <= 1024),
  CONSTRAINT "account_favorite_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "account_favorite_snapshot_check" CHECK ((jsonb_typeof(snapshot) = 'object'::text) AND (octet_length((snapshot)::text) <= 8192))
);
-- Create index "account_favorite_target_idx" to table: "account_favorite"
CREATE INDEX "account_favorite_target_idx" ON "account_favorite" ("target_unit_id", "auth_user_id");
-- Create "account_favorite_revision" table
CREATE TABLE "account_favorite_revision" (
  "auth_user_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "target_unit_id" uuid NOT NULL,
  "operation" text NOT NULL,
  "snapshot" jsonb NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("auth_user_id", "revision"),
  CONSTRAINT "account_favorite_revision_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "account_favorite_revision_target_unit_id_unit_id_fkey" FOREIGN KEY ("target_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "account_favorite_revision_number_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "account_favorite_revision_operation_check" CHECK (operation = ANY (ARRAY['save'::text, 'update'::text, 'delete'::text, 'restore'::text])),
  CONSTRAINT "account_favorite_revision_snapshot_check" CHECK (((operation = 'delete'::text) AND (snapshot IS NULL)) OR ((operation <> 'delete'::text) AND (jsonb_typeof(snapshot) = 'object'::text) AND (octet_length((snapshot)::text) <= 98304)))
);
-- Create index "account_favorite_revision_target_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_idx" ON "account_favorite_revision" ("auth_user_id", "target_unit_id", "revision" DESC NULLS LAST);
-- Create index "account_favorite_revision_target_merge_idx" to table: "account_favorite_revision"
CREATE INDEX "account_favorite_revision_target_merge_idx" ON "account_favorite_revision" ("target_unit_id", "auth_user_id");
-- Create "account_favorites_state" table
CREATE TABLE "account_favorites_state" (
  "auth_user_id" uuid NOT NULL,
  "revision" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("auth_user_id"),
  CONSTRAINT "account_favorites_state_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "account_favorites_state_revision_check" CHECK ((revision >= 0) AND (revision <= '9007199254740991'::bigint))
);
-- Create "account_realm_tag_subscription" table
CREATE TABLE "account_realm_tag_subscription" (
  "auth_user_id" uuid NOT NULL,
  "realm_id" uuid NOT NULL,
  "position" text NOT NULL DEFAULT (('a0'::text || replace((uuidv7())::text, '-'::text, ''::text)) || 'V'::text) COLLATE "C",
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("auth_user_id", "realm_id"),
  CONSTRAINT "account_realm_tag_subscription_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "account_realm_tag_subscription_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "account_realm_tag_subscription_position_byte_length_check" CHECK (octet_length("position") <= 1024)
);
-- Create index "account_realm_tag_subscription_auth_position_idx" to table: "account_realm_tag_subscription"
CREATE INDEX "account_realm_tag_subscription_auth_position_idx" ON "account_realm_tag_subscription" ("auth_user_id", "position", "realm_id");
-- Create index "account_realm_tag_subscription_realm_idx" to table: "account_realm_tag_subscription"
CREATE INDEX "account_realm_tag_subscription_realm_idx" ON "account_realm_tag_subscription" ("realm_id", "auth_user_id");
-- Create "account_unit_tag" table
CREATE TABLE "account_unit_tag" (
  "auth_user_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "position" text NOT NULL DEFAULT 'a0' COLLATE "C",
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("auth_user_id", "unit_id", "tag_id"),
  CONSTRAINT "account_unit_tag_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "account_unit_tag_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "account_unit_tag_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "account_unit_tag_not_self_check" CHECK (unit_id <> tag_id),
  CONSTRAINT "account_unit_tag_position_byte_length_check" CHECK (octet_length("position") <= 1024)
);
-- Create index "account_unit_tag_auth_tag_idx" to table: "account_unit_tag"
CREATE INDEX "account_unit_tag_auth_tag_idx" ON "account_unit_tag" ("auth_user_id", "tag_id", "unit_id");
-- Create index "account_unit_tag_tag_idx" to table: "account_unit_tag"
CREATE INDEX "account_unit_tag_tag_idx" ON "account_unit_tag" ("tag_id");
-- Create index "account_unit_tag_unit_idx" to table: "account_unit_tag"
CREATE INDEX "account_unit_tag_unit_idx" ON "account_unit_tag" ("unit_id", "auth_user_id");
-- Create "catalog_definition_term" table
CREATE TABLE "catalog_definition_term" (
  "definition_revision_id" uuid NOT NULL,
  "concept_id" uuid NOT NULL,
  PRIMARY KEY ("definition_revision_id"),
  CONSTRAINT "catalog_definition_term_7fmNrnuhkEJk_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_definition_term_concept_id_reference_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "reference_concept" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "catalog_definition_term_concept_idx" to table: "catalog_definition_term"
CREATE INDEX "catalog_definition_term_concept_idx" ON "catalog_definition_term" ("concept_id", "definition_revision_id");
-- Create "catalog_definition_term_support" table
CREATE TABLE "catalog_definition_term_support" (
  "definition_revision_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  PRIMARY KEY ("definition_revision_id", "source_record_id", "snapshot_id", "source_path"),
  CONSTRAINT "catalog_definition_term_support_6yYjEzfWJMHH_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_term" ("definition_revision_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_definition_term_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_definition_term_support_path_check" CHECK (("left"(source_path, 1) = '/'::text) AND (octet_length(source_path) <= 1024))
) PARTITION BY HASH ("source_record_id");
-- Create index "catalog_definition_term_support_source_idx" to table: "catalog_definition_term_support"
CREATE INDEX "catalog_definition_term_support_source_idx" ON "catalog_definition_term_support" ("source_record_id", "snapshot_id", "definition_revision_id", "source_path");
-- Modify "catalog_source_binding_revision" table
ALTER TABLE "catalog_source_binding_revision" ADD CONSTRAINT "catalog_source_binding_correspondence_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND ((policy_revision >= 1) AND (policy_revision <= '9007199254740991'::bigint)) AND ((correspondence_revision >= 1) AND (correspondence_revision <= revision))), ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "catalog_source_binding_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "catalog_source_application" table
ALTER TABLE "catalog_source_application" ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "previous_observed_snapshot_id" uuid NULL, ADD COLUMN "previous_correspondence_revision" bigint NULL, ADD CONSTRAINT "catalog_source_application_previous_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "previous_correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "catalog_source_application_previous_observation_fk" FOREIGN KEY ("source_record_id", "previous_observed_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "catalog_source_mapping_claim" table
ALTER TABLE "catalog_source_mapping_claim" ADD CONSTRAINT "catalog_source_mapping_revisions_check" CHECK (((binding_revision >= 1) AND (binding_revision <= '9007199254740991'::bigint)) AND ((policy_revision >= 1) AND (policy_revision <= '9007199254740991'::bigint)) AND ((correspondence_revision >= 1) AND (correspondence_revision <= binding_revision)) AND ((applied_correspondence_revision IS NULL) OR ((applied_correspondence_revision >= 1) AND (applied_correspondence_revision <= binding_revision)))), ADD COLUMN "correspondence_revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "applied_correspondence_revision" bigint NULL, ADD CONSTRAINT "catalog_source_mapping_applied_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "applied_correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "distribution_name_source_binding" table
ALTER TABLE "distribution_name_source_binding" DROP CONSTRAINT "distribution_name_source_binding_key", DROP CONSTRAINT "distribution_name_source_binding_owner_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "distribution_name_source_binding_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key"), ADD CONSTRAINT "distribution_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id"), ADD CONSTRAINT "distribution_name_source_binding_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "distribution_name_source_occurrence_snapshot_idx" from table: "distribution_name_source_occurrence"
DROP INDEX "distribution_name_source_occurrence_snapshot_idx";
-- Modify "distribution_name_source_occurrence" table
ALTER TABLE "distribution_name_source_occurrence" DROP CONSTRAINT "distribution_name_source_occurrence_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "distribution_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key", "snapshot_id"), ADD CONSTRAINT "distribution_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") REFERENCES "distribution_name_source_binding" ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "distribution_name_source_occurrence_snapshot_idx" to table: "distribution_name_source_occurrence"
CREATE INDEX "distribution_name_source_occurrence_snapshot_idx" ON "distribution_name_source_occurrence" ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id");
-- Modify "entity_name_source_binding" table
ALTER TABLE "entity_name_source_binding" DROP CONSTRAINT "entity_name_source_binding_key", DROP CONSTRAINT "entity_name_source_binding_owner_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "entity_name_source_binding_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key"), ADD CONSTRAINT "entity_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id"), ADD CONSTRAINT "entity_name_source_binding_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "entity_name_source_occurrence_snapshot_idx" from table: "entity_name_source_occurrence"
DROP INDEX "entity_name_source_occurrence_snapshot_idx";
-- Modify "entity_name_source_occurrence" table
ALTER TABLE "entity_name_source_occurrence" DROP CONSTRAINT "entity_name_source_occurrence_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "entity_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key", "snapshot_id"), ADD CONSTRAINT "entity_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") REFERENCES "entity_name_source_binding" ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "entity_name_source_occurrence_snapshot_idx" to table: "entity_name_source_occurrence"
CREATE INDEX "entity_name_source_occurrence_snapshot_idx" ON "entity_name_source_occurrence" ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id");
-- Modify "grouping_name_source_binding" table
ALTER TABLE "grouping_name_source_binding" DROP CONSTRAINT "grouping_name_source_binding_key", DROP CONSTRAINT "grouping_name_source_binding_owner_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "grouping_name_source_binding_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key"), ADD CONSTRAINT "grouping_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id"), ADD CONSTRAINT "grouping_name_source_binding_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "grouping_name_source_occurrence_snapshot_idx" from table: "grouping_name_source_occurrence"
DROP INDEX "grouping_name_source_occurrence_snapshot_idx";
-- Modify "grouping_name_source_occurrence" table
ALTER TABLE "grouping_name_source_occurrence" DROP CONSTRAINT "grouping_name_source_occurrence_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "grouping_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key", "snapshot_id"), ADD CONSTRAINT "grouping_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") REFERENCES "grouping_name_source_binding" ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "grouping_name_source_occurrence_snapshot_idx" to table: "grouping_name_source_occurrence"
CREATE INDEX "grouping_name_source_occurrence_snapshot_idx" ON "grouping_name_source_occurrence" ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id");
-- Drop index "image_asset_owner_status_idx" from table: "image_asset"
DROP INDEX "image_asset_owner_status_idx";
-- Drop index "image_asset_uploader_status_idx" from table: "image_asset"
DROP INDEX "image_asset_uploader_status_idx";
-- Modify "image_asset" table
ALTER TABLE "image_asset" ADD CONSTRAINT "image_asset_content_erasure_check" CHECK ((content_erased_at IS NULL) OR ((deleted_at IS NOT NULL) AND (erasure_fence_version_id IS NOT NULL))), ADD CONSTRAINT "image_asset_erasure_fence_check" CHECK ((erasure_fence_version_id IS NULL) OR ((octet_length(erasure_fence_version_id) >= 1) AND (octet_length(erasure_fence_version_id) <= 4096))), DROP COLUMN "uploader_profile_id", DROP COLUMN "owner_profile_id", ADD COLUMN "uploader_auth_user_id" uuid NOT NULL, ADD COLUMN "owner_auth_user_id" uuid NOT NULL, ADD COLUMN "content_erased_at" timestamptz(3) NULL, ADD COLUMN "erasure_fence_version_id" text NULL, ADD CONSTRAINT "image_asset_owner_auth_user_id_users_id_fkey" FOREIGN KEY ("owner_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "image_asset_uploader_auth_user_id_users_id_fkey" FOREIGN KEY ("uploader_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "image_asset_owner_status_idx" to table: "image_asset"
CREATE INDEX "image_asset_owner_status_idx" ON "image_asset" ("owner_auth_user_id", "status", "created_at");
-- Create index "image_asset_uploader_status_idx" to table: "image_asset"
CREATE INDEX "image_asset_uploader_status_idx" ON "image_asset" ("uploader_auth_user_id", "status", "created_at");
-- Create index "image_asset_private_erasure_idx" to table: "image_asset"
CREATE INDEX "image_asset_private_erasure_idx" ON "image_asset" ("owner_auth_user_id", "id") WHERE ((content_erased_at IS NULL) AND ((access = 'private'::image_asset_access) OR (status <> 'ready'::image_asset_status)));
-- Modify "music_name_source_binding" table
ALTER TABLE "music_name_source_binding" DROP CONSTRAINT "music_name_source_binding_key", DROP CONSTRAINT "music_name_source_binding_owner_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "music_name_source_binding_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key"), ADD CONSTRAINT "music_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id"), ADD CONSTRAINT "music_name_source_binding_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "music_name_source_occurrence_snapshot_idx" from table: "music_name_source_occurrence"
DROP INDEX "music_name_source_occurrence_snapshot_idx";
-- Modify "music_name_source_occurrence" table
ALTER TABLE "music_name_source_occurrence" DROP CONSTRAINT "music_name_source_occurrence_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "music_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key", "snapshot_id"), ADD CONSTRAINT "music_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") REFERENCES "music_name_source_binding" ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "music_name_source_occurrence_snapshot_idx" to table: "music_name_source_occurrence"
CREATE INDEX "music_name_source_occurrence_snapshot_idx" ON "music_name_source_occurrence" ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id");
-- Modify "program_name_source_binding" table
ALTER TABLE "program_name_source_binding" DROP CONSTRAINT "program_name_source_binding_key", DROP CONSTRAINT "program_name_source_binding_owner_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "program_name_source_binding_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key"), ADD CONSTRAINT "program_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id"), ADD CONSTRAINT "program_name_source_binding_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "program_name_source_occurrence_snapshot_idx" from table: "program_name_source_occurrence"
DROP INDEX "program_name_source_occurrence_snapshot_idx";
-- Modify "program_name_source_occurrence" table
ALTER TABLE "program_name_source_occurrence" DROP CONSTRAINT "program_name_source_occurrence_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "program_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key", "snapshot_id"), ADD CONSTRAINT "program_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") REFERENCES "program_name_source_binding" ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "program_name_source_occurrence_snapshot_idx" to table: "program_name_source_occurrence"
CREATE INDEX "program_name_source_occurrence_snapshot_idx" ON "program_name_source_occurrence" ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id");
-- Modify "publishing_name_source_binding" table
ALTER TABLE "publishing_name_source_binding" DROP CONSTRAINT "publishing_name_source_binding_key", DROP CONSTRAINT "publishing_name_source_binding_owner_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "publishing_name_source_binding_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key"), ADD CONSTRAINT "publishing_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id"), ADD CONSTRAINT "publishing_name_source_binding_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "publishing_name_source_occurrence_snapshot_idx" from table: "publishing_name_source_occurrence"
DROP INDEX "publishing_name_source_occurrence_snapshot_idx";
-- Modify "publishing_name_source_occurrence" table
ALTER TABLE "publishing_name_source_occurrence" DROP CONSTRAINT "publishing_name_source_occurrence_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "publishing_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key", "snapshot_id"), ADD CONSTRAINT "publishing_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") REFERENCES "publishing_name_source_binding" ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "publishing_name_source_occurrence_snapshot_idx" to table: "publishing_name_source_occurrence"
CREATE INDEX "publishing_name_source_occurrence_snapshot_idx" ON "publishing_name_source_occurrence" ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id");
-- Modify "recommendation_event" table
ALTER TABLE "recommendation_event" DROP COLUMN "profile_id", ADD COLUMN "auth_user_id" uuid NULL, ADD CONSTRAINT "recommendation_event_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Create index "recommendation_event_auth_occurred_at_idx" to table: "recommendation_event"
CREATE INDEX "recommendation_event_auth_occurred_at_idx" ON "recommendation_event" ("auth_user_id", "occurred_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Drop index "recommendation_exclusion_unit_idx" from table: "recommendation_exclusion"
DROP INDEX "recommendation_exclusion_unit_idx";
-- Modify "recommendation_exclusion" table
ALTER TABLE "recommendation_exclusion" DROP CONSTRAINT "recommendation_exclusion_pkey", DROP COLUMN "profile_id", ADD COLUMN "auth_user_id" uuid NOT NULL, ADD PRIMARY KEY ("auth_user_id", "unit_id"), ADD CONSTRAINT "recommendation_exclusion_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Create index "recommendation_exclusion_unit_idx" to table: "recommendation_exclusion"
CREATE INDEX "recommendation_exclusion_unit_idx" ON "recommendation_exclusion" ("unit_id", "auth_user_id");
-- Modify "reference_name_source_binding" table
ALTER TABLE "reference_name_source_binding" DROP CONSTRAINT "reference_name_source_binding_key", DROP CONSTRAINT "reference_name_source_binding_owner_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "reference_name_source_binding_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key"), ADD CONSTRAINT "reference_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id"), ADD CONSTRAINT "reference_name_source_binding_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "reference_name_source_occurrence_snapshot_idx" from table: "reference_name_source_occurrence"
DROP INDEX "reference_name_source_occurrence_snapshot_idx";
-- Modify "reference_name_source_occurrence" table
ALTER TABLE "reference_name_source_occurrence" DROP CONSTRAINT "reference_name_source_occurrence_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "reference_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key", "snapshot_id"), ADD CONSTRAINT "reference_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") REFERENCES "reference_name_source_binding" ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "reference_name_source_occurrence_snapshot_idx" to table: "reference_name_source_occurrence"
CREATE INDEX "reference_name_source_occurrence_snapshot_idx" ON "reference_name_source_occurrence" ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id");
-- Modify "software_component_source_occurrence" table
ALTER TABLE "software_component_source_occurrence" DROP CONSTRAINT "software_component_source_occurrence_pkey", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id", "component", "component_key"), ADD CONSTRAINT "software_component_source_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_name_source_binding" table
ALTER TABLE "software_name_source_binding" DROP CONSTRAINT "software_name_source_binding_key", DROP CONSTRAINT "software_name_source_binding_owner_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "software_name_source_binding_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key"), ADD CONSTRAINT "software_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id"), ADD CONSTRAINT "software_name_source_binding_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "software_name_source_occurrence_snapshot_idx" from table: "software_name_source_occurrence"
DROP INDEX "software_name_source_occurrence_snapshot_idx";
-- Modify "software_name_source_occurrence" table
ALTER TABLE "software_name_source_occurrence" DROP CONSTRAINT "software_name_source_occurrence_key", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD CONSTRAINT "software_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "namespace", "local_key", "snapshot_id"), ADD CONSTRAINT "software_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") REFERENCES "software_name_source_binding" ("owner_id", "source_record_id", "mapping_key", "correspondence_revision", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "software_name_source_occurrence_snapshot_idx" to table: "software_name_source_occurrence"
CREATE INDEX "software_name_source_occurrence_snapshot_idx" ON "software_name_source_occurrence" ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id");
-- Modify "software_participation_credit_source_occurrence" table
ALTER TABLE "software_participation_credit_source_occurrence" DROP CONSTRAINT "software_participation_credit_source_occurrence_pkey", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "source_path"), ADD CONSTRAINT "software_participation_credit_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_participation_source_occurrence" table
ALTER TABLE "software_participation_source_occurrence" DROP CONSTRAINT "software_participation_source_occurrence_pkey", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "namespace", "local_key"), ADD CONSTRAINT "software_context_occurrence_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_record_source_occurrence" table
ALTER TABLE "software_record_source_occurrence" DROP CONSTRAINT "software_record_source_occurrence_pkey", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id"), ADD CONSTRAINT "software_record_source_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop "profile_favorites_collection" table
DROP TABLE "profile_favorites_collection";
-- Drop "profile_realm_tag_subscription" table
DROP TABLE "profile_realm_tag_subscription";
-- Drop "profile_unit_tag" table
DROP TABLE "profile_unit_tag";

DO $$ DECLARE partition_number integer;
BEGIN
  FOR partition_number IN 0..63 LOOP
    EXECUTE format('CREATE TABLE public.%I PARTITION OF public.catalog_definition_term_support FOR VALUES WITH (MODULUS 64, REMAINDER %s)', 'catalog_definition_term_support_p' || lpad(partition_number::text,2,'0'),partition_number);
  END LOOP;
END $$;

-- Private history is append-only during account lifetime and physically removable by account erasure.
CREATE OR REPLACE FUNCTION public.participation_guard_private_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND EXISTS(SELECT 1 FROM public.users WHERE id = OLD.auth_user_id AND erased_at IS NOT NULL) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Private Favorites history is retained until account erasure' USING ERRCODE = '23514';
END $$;
DROP TRIGGER IF EXISTS participation_private_history_guard ON public.account_favorite_revision;
CREATE TRIGGER participation_private_history_guard BEFORE UPDATE OR DELETE ON public.account_favorite_revision
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_private_history();

CREATE OR REPLACE FUNCTION public.participation_guard_favorite_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF (NEW.auth_user_id, NEW.target_unit_id, NEW.created_at) IS DISTINCT FROM (OLD.auth_user_id, OLD.target_unit_id, OLD.created_at) OR NEW.revision <= OLD.revision THEN
    RAISE EXCEPTION 'Favorite ownership and target are immutable; revisions must advance' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_favorite_identity_guard ON public.account_favorite;
CREATE TRIGGER participation_favorite_identity_guard BEFORE UPDATE ON public.account_favorite
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_favorite_identity();

CREATE OR REPLACE FUNCTION public.participation_guard_image_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE erased timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id, NEW.owner_auth_user_id, NEW.uploader_auth_user_id, NEW.access, NEW.created_at) IS DISTINCT FROM
    (OLD.id, OLD.owner_auth_user_id, OLD.uploader_auth_user_id, OLD.access, OLD.created_at) THEN
    RAISE EXCEPTION 'Image identity, account ownership and access are immutable' USING ERRCODE = '23514';
  END IF;
  SELECT erased_at INTO erased FROM public.users WHERE id = NEW.owner_auth_user_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Image requires an Auth owner' USING ERRCODE = '23514'; END IF;
  IF erased IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.deleted_at IS NULL OR
    (to_jsonb(NEW) - ARRAY['deleted_at','content_erased_at','erasure_fence_version_id','updated_at']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['deleted_at','content_erased_at','erasure_fence_version_id','updated_at'])) THEN
    RAISE EXCEPTION 'Erased accounts cannot write image content' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required';
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.content_erased_at IS NOT NULL AND NEW.content_erased_at IS DISTINCT FROM OLD.content_erased_at OR
    OLD.erasure_fence_version_id IS NOT NULL AND NEW.erasure_fence_version_id IS DISTINCT FROM OLD.erasure_fence_version_id) THEN
    RAISE EXCEPTION 'Private image erasure is irreversible' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_image_owner_guard ON public.image_asset;
CREATE TRIGGER participation_image_owner_guard BEFORE INSERT OR UPDATE ON public.image_asset
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_image_owner();

CREATE OR REPLACE FUNCTION public.participation_guard_image_child()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM 1 FROM public.image_asset asset JOIN public.users account ON account.id = asset.owner_auth_user_id
    WHERE asset.id = NEW.asset_id AND asset.deleted_at IS NULL AND account.erased_at IS NULL FOR SHARE OF account, asset;
  IF NOT FOUND THEN RAISE EXCEPTION 'Image content requires an active Auth owner' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_image_child_guard ON public.image_object;
CREATE TRIGGER participation_image_child_guard BEFORE INSERT OR UPDATE ON public.image_object
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_image_child();
DROP TRIGGER IF EXISTS participation_image_child_guard ON public.image_asset_presentation;
CREATE TRIGGER participation_image_child_guard BEFORE INSERT OR UPDATE ON public.image_asset_presentation
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_image_child();

CREATE OR REPLACE FUNCTION public.participation_guard_quota_subject()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE subject_id uuid;
BEGIN
  subject_id := coalesce(to_jsonb(NEW) ->> 'account_user_id', to_jsonb(NEW) ->> 'user_id')::uuid;
  IF subject_id IS NULL THEN
    SELECT reference_id INTO subject_id FROM public.apikeys WHERE id = (to_jsonb(NEW) ->> 'token_id')::uuid;
  END IF;
  PERFORM 1 FROM public.users WHERE id = subject_id AND erased_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quota state requires an active Auth account' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.participation_guard_conversation_member()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE marker_id uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.conversation WHERE id = NEW.conversation_id AND NEW.auth_user_id IN (participant_low_auth_user_id, participant_high_auth_user_id)) THEN
    RAISE EXCEPTION 'Private conversation state requires an admitted participant' USING ERRCODE = '23514';
  END IF;
  marker_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  IF marker_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.message WHERE id = marker_id AND conversation_id = NEW.conversation_id) THEN
    RAISE EXCEPTION 'Conversation marker must belong to the same conversation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS participation_conversation_member_guard ON public.conversation_read;
CREATE TRIGGER participation_conversation_member_guard BEFORE INSERT OR UPDATE ON public.conversation_read
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_conversation_member('last_read_message_id');
DROP TRIGGER IF EXISTS participation_conversation_member_guard ON public.conversation_participant_stat;
CREATE TRIGGER participation_conversation_member_guard BEFORE INSERT OR UPDATE ON public.conversation_participant_stat
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_conversation_member('last_message_id');

-- Favorites engagement is derived from the private relation without exposing the owning account.
DROP TRIGGER IF EXISTS favorite_item_stats_maintain ON public.collection_item;
DROP FUNCTION IF EXISTS public.maintain_favorite_item_stats();
CREATE OR REPLACE FUNCTION public.maintain_account_favorite_stats()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE row_data public.account_favorite%ROWTYPE; direction bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN row_data := NEW; direction := 1;
  ELSE row_data := OLD; direction := -1; END IF;
  PERFORM public.apply_unit_engagement_stat(row_data.target_unit_id, p_favorites => direction);
  PERFORM public.apply_recommendation_unit_signal(row_data.target_unit_id, row_data.created_at, 'favorite', direction, direction * 5);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS account_favorite_stats_maintain ON public.account_favorite;
CREATE TRIGGER account_favorite_stats_maintain AFTER INSERT OR DELETE ON public.account_favorite
FOR EACH ROW EXECUTE FUNCTION public.maintain_account_favorite_stats();

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.recommendation_event;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.recommendation_event
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.recommendation_exclusion;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.recommendation_exclusion
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.studio_resource_visit;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.studio_resource_visit
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.studio_auth_editor_candidate;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.studio_auth_editor_candidate
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_favorites_state;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_favorites_state
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_favorite;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_favorite
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_favorite_revision;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_favorite_revision
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_realm_tag_subscription;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_realm_tag_subscription
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_unit_tag;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.book_chapter_progress_stat;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.book_chapter_progress_stat
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.conversation_participant_stat;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.conversation_participant_stat
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.api_token_creation_reservation;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF account_user_id ON public.api_token_creation_reservation
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('account_user_id');

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_account_quota_binding;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_account_quota_binding
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_token_quota_binding;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_token_quota_binding
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_token_quota_override;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_token_quota_override
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_quota_rate_state;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_quota_rate_state
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_quota_daily_usage;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_quota_daily_usage
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_quota_request_lease;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_quota_request_lease
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

-- Aggregate recommendation signals outlive event-log retention; event erasure removes private attribution only.
CREATE OR REPLACE FUNCTION public.maintain_recommendation_event_signals() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE row_data recommendation_event%ROWTYPE; direction bigint;
unit_weight double precision;
change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF row_data.auth_user_id IS NOT NULL
      AND row_data.type IN ('impression', 'open', 'dwell_30s', 'not_interested') THEN
      unit_weight := CASE row_data.type WHEN 'open' THEN 1 WHEN 'dwell_30s' THEN 2 ELSE 0 END;
      PERFORM apply_recommendation_unit_signal(
        row_data.target_unit_id, row_data.occurred_at,
        row_data.type::text, direction, direction * unit_weight
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS recommendation_event_signals_maintain ON public.recommendation_event;
CREATE TRIGGER recommendation_event_signals_maintain AFTER INSERT OR UPDATE ON public.recommendation_event
FOR EACH ROW EXECUTE FUNCTION public.maintain_recommendation_event_signals();


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
  IF TG_OP = 'UPDATE' AND NEW.content IS NULL AND NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
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
CREATE TRIGGER participation_message_guard BEFORE INSERT OR UPDATE OF content, deleted_at ON public.message
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
    IF NEW.actor_profile_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.auth_entity WHERE auth_user_id = NEW.recipient_auth_user_id AND entity_id = NEW.actor_profile_id) THEN
      RAISE EXCEPTION 'An account does not notify itself as its own Entity' USING ERRCODE = '23514', CONSTRAINT = 'notification_not_self';
    END IF;
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


CREATE OR REPLACE FUNCTION public.catalog_source_guard_record()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
    (NEW.id <> OLD.id OR NEW.source <> OLD.source OR NEW.object_type <> OLD.object_type OR
     NEW.external_id <> OLD.external_id OR NEW.acquisition_generation < OLD.acquisition_generation OR
     NEW.accepted_generation < OLD.accepted_generation)) THEN
    RAISE EXCEPTION 'Source natural identity is immutable and acquisition generations cannot regress'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_identity_immutable';
  END IF;
  IF NEW.head_snapshot_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.catalog_source_snapshot WHERE source_record_id = NEW.id AND id = NEW.head_snapshot_id
  ) THEN
    RAISE EXCEPTION 'Source head must reference its own immutable snapshot'
      USING ERRCODE = '23503', CONSTRAINT = 'catalog_source_exact_head';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_source_guard_immutable_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Source snapshots, binding revisions and completed check receipts are immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_evidence_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_source_guard_mapping()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
    (NEW.source_record_id <> OLD.source_record_id OR NEW.path <> OLD.path OR
     NEW.mapping_key <> OLD.mapping_key OR NEW.owner <> OLD.owner OR
     NEW.binding_revision < OLD.binding_revision OR NEW.binding_revision > OLD.binding_revision + 1 OR
     NEW.policy_revision < OLD.policy_revision OR
     NEW.correspondence_revision < OLD.correspondence_revision OR
     (NEW.correspondence_revision <> OLD.correspondence_revision AND NEW.binding_revision <> OLD.binding_revision + 1) OR
     (NEW.mapping_version <> OLD.mapping_version AND NEW.binding_revision <> OLD.binding_revision + 1) OR
     ((NEW.state <> OLD.state OR NEW.policy_revision <> OLD.policy_revision) AND NEW.binding_revision <> OLD.binding_revision + 1))) THEN
    RAISE EXCEPTION 'Source mapping identity is immutable and authority edits require the next revision'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_mapping_transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_source_require_binding_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE claim public.catalog_source_mapping_claim%ROWTYPE; binding_row public.catalog_source_binding_revision%ROWTYPE; native_target uuid;
BEGIN
  SELECT * INTO claim FROM public.catalog_source_mapping_claim
    WHERE source_record_id = NEW.source_record_id AND mapping_key = NEW.mapping_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF to_jsonb(NEW) ? 'revision' AND (to_jsonb(NEW)->>'revision')::bigint > claim.binding_revision THEN
    RAISE EXCEPTION 'An appended source binding revision must be published in its transaction'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_binding_revision_published';
  END IF;
  SELECT r.* INTO binding_row FROM public.catalog_source_binding_revision r
    WHERE r.source_record_id = claim.source_record_id AND r.mapping_key = claim.mapping_key AND r.revision = claim.binding_revision;
  IF NOT FOUND OR binding_row.owner <> claim.owner OR binding_row.policy_revision <> claim.policy_revision OR binding_row.state <> claim.state OR binding_row.mapping_version <> claim.mapping_version OR binding_row.correspondence_revision <> claim.correspondence_revision THEN
    RAISE EXCEPTION 'Source mapping must commit its exact immutable binding and policy revision'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_binding_head_required';
  END IF;
  IF claim.applied_correspondence_revision IS NOT NULL AND (claim.observed_snapshot_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.catalog_source_binding_revision a WHERE a.source_record_id=claim.source_record_id AND a.mapping_key=claim.mapping_key AND a.revision=claim.applied_correspondence_revision AND a.correspondence_revision=a.revision AND a.owner=claim.owner
  )) THEN RAISE EXCEPTION 'Applied source correspondence must retain an exact observed snapshot and epoch anchor' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT owner_id FROM public.%I WHERE source_record_id = $1 AND mapping_key = $2', claim.owner || '_source_binding')
    INTO native_target USING claim.source_record_id, claim.mapping_key;
  IF native_target IS NULL OR native_target IS DISTINCT FROM (to_jsonb(binding_row)->>(claim.owner || '_id'))::uuid THEN
    RAISE EXCEPTION 'Source binding target must equal its committed revision target'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_binding_exact_target';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS catalog_source_record_guard ON public.catalog_source_record;
CREATE TRIGGER catalog_source_record_guard BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_source_record
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_record();
DROP TRIGGER IF EXISTS catalog_source_mapping_guard ON public.catalog_source_mapping_claim;
CREATE TRIGGER catalog_source_mapping_guard BEFORE UPDATE OR DELETE ON public.catalog_source_mapping_claim
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_mapping();

DO $$
DECLARE relation_name text; physical record;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['catalog_source_snapshot', 'catalog_source_binding_revision', 'catalog_source_check_receipt'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_evidence_guard ON public.%I', relation_name);
    EXECUTE format('CREATE TRIGGER catalog_source_evidence_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()', relation_name);
  END LOOP;
  -- Constraint triggers are installed on concrete leaves, including an unpartitioned fresh target.
  FOR physical IN
    WITH RECURSIVE roots AS (
      SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('catalog_source_mapping_claim','catalog_source_binding_revision','publishing_source_binding','music_source_binding','program_source_binding','software_source_binding','entity_source_binding','grouping_source_binding','reference_source_binding','distribution_source_binding')
      UNION ALL SELECT i.inhrelid FROM pg_inherits i JOIN roots r ON r.oid=i.inhparent
    ) SELECT c.oid::regclass AS name FROM roots r JOIN pg_class c ON c.oid=r.oid WHERE c.relkind='r'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_binding_head_required ON %s', physical.name);
    EXECUTE format('CREATE CONSTRAINT TRIGGER catalog_source_binding_head_required AFTER INSERT OR UPDATE ON %s DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_source_require_binding_head()', physical.name);
  END LOOP;
END;
$$;


CREATE OR REPLACE FUNCTION public.catalog_source_guard_binding_correspondence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE previous public.catalog_source_binding_revision%ROWTYPE; anchor public.catalog_source_binding_revision%ROWTYPE; same_meaning boolean;
BEGIN
  IF NEW.revision=1 THEN
    IF NEW.correspondence_revision<>1 THEN RAISE EXCEPTION 'Initial source correspondence must anchor itself' USING ERRCODE='23514'; END IF;
  ELSE
    SELECT * INTO previous FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND revision=NEW.revision-1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Source binding revisions must be contiguous' USING ERRCODE='23514'; END IF;
    same_meaning := (NEW.owner,NEW.mapping_version,NEW.publishing_id,NEW.music_id,NEW.program_id,NEW.software_id,NEW.entity_id,NEW.grouping_id,NEW.reference_id,NEW.distribution_id)
      IS NOT DISTINCT FROM (previous.owner,previous.mapping_version,previous.publishing_id,previous.music_id,previous.program_id,previous.software_id,previous.entity_id,previous.grouping_id,previous.reference_id,previous.distribution_id);
    IF NEW.correspondence_revision <> (CASE WHEN same_meaning THEN previous.correspondence_revision ELSE NEW.revision END) THEN
      RAISE EXCEPTION 'Correspondence changes only with native target or mapping meaning' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.correspondence_revision<>NEW.revision THEN
    SELECT * INTO anchor FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND revision=NEW.correspondence_revision;
    IF NOT FOUND OR anchor.correspondence_revision<>anchor.revision OR
      (NEW.owner,NEW.mapping_version,NEW.publishing_id,NEW.music_id,NEW.program_id,NEW.software_id,NEW.entity_id,NEW.grouping_id,NEW.reference_id,NEW.distribution_id)
      IS DISTINCT FROM (anchor.owner,anchor.mapping_version,anchor.publishing_id,anchor.music_id,anchor.program_id,anchor.software_id,anchor.entity_id,anchor.grouping_id,anchor.reference_id,anchor.distribution_id) THEN
      RAISE EXCEPTION 'Correspondence requires the exact self-anchored target and mapping meaning' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catalog_source_binding_correspondence_guard ON public.catalog_source_binding_revision;
CREATE TRIGGER catalog_source_binding_correspondence_guard BEFORE INSERT ON public.catalog_source_binding_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_binding_correspondence();

CREATE OR REPLACE FUNCTION public.catalog_source_guard_child_correspondence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE anchor public.catalog_source_binding_revision%ROWTYPE;
BEGIN
  SELECT * INTO anchor FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND revision=NEW.correspondence_revision;
  IF NOT FOUND OR anchor.correspondence_revision<>anchor.revision THEN RAISE EXCEPTION 'Source child correspondence requires its exact epoch anchor' USING ERRCODE='23514'; END IF;
  IF TG_ARGV[0]='software-context' THEN
    IF anchor.owner<>'software' OR anchor.software_id IS DISTINCT FROM NEW.content_id THEN
      RAISE EXCEPTION 'Source context correspondence must target its exact software content' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_ARGV[0]='software-owner' THEN
    IF anchor.owner<>'software' OR anchor.software_id IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Source scalar or component correspondence must target its exact software owner' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS software_context_correspondence_guard ON public.software_participation_source_occurrence;
CREATE TRIGGER software_context_correspondence_guard BEFORE INSERT ON public.software_participation_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-context');
DROP TRIGGER IF EXISTS software_credit_correspondence_guard ON public.software_participation_credit_source_occurrence;
CREATE TRIGGER software_credit_correspondence_guard BEFORE INSERT ON public.software_participation_credit_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-context');
DROP TRIGGER IF EXISTS software_record_correspondence_guard ON public.software_record_source_occurrence;
CREATE TRIGGER software_record_correspondence_guard BEFORE INSERT ON public.software_record_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-owner');
DROP TRIGGER IF EXISTS software_component_correspondence_guard ON public.software_component_source_occurrence;
CREATE TRIGGER software_component_correspondence_guard BEFORE INSERT ON public.software_component_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-owner');
DO $$ DECLARE owner_name text; family text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    FOREACH family IN ARRAY ARRAY['name_source_binding','name_source_occurrence'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS catalog_name_correspondence_guard ON public.%I',owner_name || '_' || family);
      EXECUTE format('CREATE TRIGGER catalog_name_correspondence_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence(%L)',owner_name || '_' || family,'name');
    END LOOP;
  END LOOP;
END $$;


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
  IF application.mapping_key <> proposal.mapping_key THEN RAISE EXCEPTION 'Native application must retain the exact proposal mapping' USING ERRCODE='23514'; END IF;
  IF application.previous_correspondence_revision IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.catalog_source_binding_revision b WHERE b.source_record_id=application.source_record_id AND b.mapping_key=application.mapping_key AND b.revision=application.previous_correspondence_revision AND b.correspondence_revision=b.revision
  ) THEN RAISE EXCEPTION 'Previous native source correspondence must reference an epoch anchor' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.catalog_source_binding_revision b WHERE b.source_record_id=proposal.source_record_id AND b.mapping_key=proposal.mapping_key AND b.revision=proposal.expected_binding_revision AND
    application.previous_snapshot_id IS NOT DISTINCT FROM CASE WHEN application.previous_correspondence_revision=b.correspondence_revision THEN application.previous_observed_snapshot_id ELSE NULL END
  ) THEN RAISE EXCEPTION 'Effective previous source snapshot must match the proposal correspondence epoch' USING ERRCODE='23514'; END IF;
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


CREATE OR REPLACE FUNCTION public.catalog_guard_definition_term()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Exact definition terms and their source evidence are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'catalog_definition_term' AND NOT EXISTS (
    SELECT 1 FROM public.catalog_definition_revision r
    JOIN public.catalog_definition d ON d.id = r.definition_id
    WHERE r.id = NEW.definition_revision_id AND d.kind IN ('class', 'vocabulary')
  ) THEN
    RAISE EXCEPTION 'Only governed classes and vocabularies designate definition terms' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS catalog_definition_term_guard ON public.catalog_definition_term;
CREATE TRIGGER catalog_definition_term_guard BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_definition_term
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_definition_term();

DROP TRIGGER IF EXISTS catalog_definition_term_support_guard ON public.catalog_definition_term_support;
CREATE TRIGGER catalog_definition_term_support_guard BEFORE UPDATE OR DELETE ON public.catalog_definition_term_support
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_definition_term();
