CREATE TYPE "collection_source" AS ENUM('manual', 'dynamic', 'system');--> statement-breakpoint
CREATE TYPE "collection_system_key" AS ENUM('favorites');--> statement-breakpoint
CREATE TYPE "realm_unit_status" AS ENUM('pending', 'visible', 'hidden', 'removed');--> statement-breakpoint
ALTER TYPE "post_kind" ADD VALUE 'wiki';--> statement-breakpoint
ALTER TYPE "post_kind" ADD VALUE 'picture';--> statement-breakpoint
CREATE TABLE "content_structure_node" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"owner_unit_id" uuid NOT NULL,
	"parent_id" uuid,
	"content_unit_id" uuid,
	"title" text NOT NULL,
	"position" text NOT NULL,
	"content_rating" "content_rating",
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_structure_node_id_owner_key" UNIQUE("id","owner_unit_id"),
	CONSTRAINT "content_structure_node_title_not_blank" CHECK (btrim("title") <> ''),
	CONSTRAINT "content_structure_node_not_self_parent" CHECK ("parent_id" is null or "parent_id" <> "id"),
	CONSTRAINT "content_structure_node_deleted_at_check" CHECK ("deleted_at" is null or "deleted_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "credit_attribution" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unit_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role" text NOT NULL,
	"position" text DEFAULT 'V' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_attribution_unit_entity_role_key" UNIQUE("unit_id","entity_id","role"),
	CONSTRAINT "credit_attribution_role_not_blank" CHECK (btrim("role") <> ''),
	CONSTRAINT "credit_attribution_not_self_check" CHECK ("unit_id" <> "entity_id")
);
--> statement-breakpoint
CREATE TABLE "subject_attribution" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unit_id" uuid NOT NULL,
	"subject_entity_id" uuid NOT NULL,
	"role" text NOT NULL,
	"position" text DEFAULT 'V' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subject_attribution_unit_entity_role_key" UNIQUE("unit_id","subject_entity_id","role"),
	CONSTRAINT "subject_attribution_role_not_blank" CHECK (btrim("role") <> ''),
	CONSTRAINT "subject_attribution_not_self_check" CHECK ("unit_id" <> "subject_entity_id")
);
--> statement-breakpoint
CREATE TABLE "content_structure_node_progress" (
	"profile_id" uuid,
	"node_id" uuid,
	"completed_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_structure_node_progress_pkey" PRIMARY KEY("profile_id","node_id")
);
--> statement-breakpoint
CREATE TABLE "realm_dock" (
	"realm_id" uuid,
	"slot" text DEFAULT 'primary',
	"document" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_dock_pkey" PRIMARY KEY("realm_id","slot"),
	CONSTRAINT "realm_dock_slot_not_blank" CHECK (btrim("slot") <> '')
);
--> statement-breakpoint
CREATE TABLE "realm_unit" (
	"realm_id" uuid,
	"unit_id" uuid,
	"locked" boolean DEFAULT false NOT NULL,
	"status" "realm_unit_status" DEFAULT 'visible'::"realm_unit_status" NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_unit_pkey" PRIMARY KEY("realm_id","unit_id"),
	CONSTRAINT "realm_unit_not_self_check" CHECK ("realm_id" <> "unit_id")
);
--> statement-breakpoint
CREATE TABLE "realm_unit_status_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"realm_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"from_status" "realm_unit_status",
	"to_status" "realm_unit_status" NOT NULL,
	"changed_by_profile_id" uuid,
	"annotation_document" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_unit_status_event_transition_check" CHECK ("from_status" is null or "from_status" <> "to_status")
);
--> statement-breakpoint
CREATE TABLE "release" (
	"id" uuid PRIMARY KEY,
	"parent_unit_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"released_on" date,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_parent_version_key" UNIQUE("parent_unit_id","version_label"),
	CONSTRAINT "release_version_label_not_blank" CHECK (btrim("version_label") <> ''),
	CONSTRAINT "release_not_self_check" CHECK ("id" <> "parent_unit_id")
);
--> statement-breakpoint
CREATE TABLE "software" (
	"id" uuid PRIMARY KEY,
	"release_date" date,
	"version_label" text,
	"licensed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_requirement" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"software_id" uuid NOT NULL,
	"platform_entity_id" uuid,
	"tier" text NOT NULL,
	"language" text,
	"source_link_id" uuid,
	"hardware" jsonb NOT NULL,
	"raw_text" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "software_requirement_identity_key" UNIQUE NULLS NOT DISTINCT("software_id","platform_entity_id","tier","language"),
	CONSTRAINT "software_requirement_tier_not_blank" CHECK (btrim("tier") <> ''),
	CONSTRAINT "software_requirement_hardware_json_object_check" CHECK ("hardware" is null or jsonb_typeof("hardware") = 'object')
);
--> statement-breakpoint
CREATE TABLE "profile_unit_tag" (
	"profile_id" uuid,
	"unit_id" uuid,
	"tag_id" uuid,
	"position" text DEFAULT 'V' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_unit_tag_pkey" PRIMARY KEY("profile_id","unit_id","tag_id"),
	CONSTRAINT "profile_unit_tag_not_self_check" CHECK ("unit_id" <> "tag_id")
);
--> statement-breakpoint
CREATE TABLE "realm_tag_context" (
	"realm_id" uuid,
	"unit_id" uuid,
	"tag_id" uuid,
	"context_post_id" uuid NOT NULL,
	"created_by_profile_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_tag_context_pkey" PRIMARY KEY("realm_id","unit_id","tag_id"),
	CONSTRAINT "realm_tag_context_not_self_check" CHECK ("unit_id" <> "tag_id")
);
--> statement-breakpoint
CREATE TABLE "realm_tag_vote" (
	"realm_id" uuid,
	"unit_id" uuid,
	"tag_id" uuid,
	"profile_id" uuid,
	"value" integer NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_tag_vote_pkey" PRIMARY KEY("realm_id","unit_id","tag_id","profile_id"),
	CONSTRAINT "realm_tag_vote_value_check" CHECK ("value" in (-1, 1))
);
--> statement-breakpoint
CREATE TABLE "realm_unit_tag" (
	"realm_id" uuid,
	"unit_id" uuid,
	"tag_id" uuid,
	"position" text DEFAULT 'V' NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_unit_tag_pkey" PRIMARY KEY("realm_id","unit_id","tag_id"),
	CONSTRAINT "realm_unit_tag_not_self_check" CHECK ("unit_id" <> "tag_id")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_menu" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"zone_id" uuid NOT NULL,
	"slot" text DEFAULT 'primary' NOT NULL,
	"document" jsonb NOT NULL,
	"position" text DEFAULT 'V' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zone_menu_zone_slot_key" UNIQUE("zone_id","slot"),
	CONSTRAINT "zone_menu_slot_not_blank" CHECK (btrim("slot") <> '')
);
--> statement-breakpoint
ALTER TABLE "unit_progress" DROP CONSTRAINT "unit_progress_last_node_fkey";--> statement-breakpoint
ALTER TABLE "unit_tag" DROP CONSTRAINT "unit_tag_tag_id_unit_id_fkey";--> statement-breakpoint
ALTER TABLE "unit_tag_vote" DROP CONSTRAINT "unit_tag_vote_tag_id_unit_id_fkey";--> statement-breakpoint
ALTER TABLE "zone" DROP CONSTRAINT "zone_owner_realm_id_unit_id_fkey";--> statement-breakpoint
ALTER TABLE "game_requirement" DROP CONSTRAINT "game_requirement_game_id_game_id_fkey";--> statement-breakpoint
ALTER TABLE "content_node_progress" DROP CONSTRAINT "content_node_progress_node_id_content_node_id_fkey";--> statement-breakpoint
DROP TABLE "game";--> statement-breakpoint
DROP TABLE "game_requirement";--> statement-breakpoint
DROP TABLE "unit_credit";--> statement-breakpoint
DROP TABLE "content_node";--> statement-breakpoint
DROP TABLE "content_node_progress";--> statement-breakpoint
DROP TABLE "realm_content";--> statement-breakpoint
ALTER TABLE "zone" DROP CONSTRAINT "zone_not_owner_check";--> statement-breakpoint
ALTER TABLE "zone" DROP CONSTRAINT "zone_boundary_json_object_check";--> statement-breakpoint
ALTER TABLE "zone" DROP CONSTRAINT "zone_nav_json_object_check";--> statement-breakpoint
ALTER TABLE "zone" DROP CONSTRAINT "zone_theme_json_object_check";--> statement-breakpoint
ALTER TABLE "zone_page" DROP CONSTRAINT "zone_page_config_json_object_check";--> statement-breakpoint
ALTER TABLE "profile" DROP CONSTRAINT "profile_description_json_array_check";--> statement-breakpoint
ALTER TABLE "unit_localization" DROP CONSTRAINT "unit_localization_description_json_array_check";--> statement-breakpoint
ALTER TABLE "unit_localization" DROP CONSTRAINT "unit_localization_content_json_array_check";--> statement-breakpoint
ALTER TABLE "realm_rule" DROP CONSTRAINT "realm_rule_content_json_array_check";--> statement-breakpoint
DROP INDEX "collection_one_favorites_key";--> statement-breakpoint
DROP INDEX "unit_progress_last_node_idx";--> statement-breakpoint
DROP INDEX "zone_owner_realm_idx";--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "source" "collection_source" DEFAULT 'manual'::"collection_source" NOT NULL;--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "system_key" "collection_system_key";--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "definition_document" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "presentation_document" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_progress" ADD COLUMN "last_content_structure_node_id" uuid;--> statement-breakpoint
ALTER TABLE "zone" ADD COLUMN "managing_realm_id" uuid;--> statement-breakpoint
ALTER TABLE "zone" ADD COLUMN "boundary_document" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "zone" ADD COLUMN "theme_document" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "zone_page" ADD COLUMN "document" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "unit" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "unit_kind";--> statement-breakpoint
CREATE TYPE "unit_kind" AS ENUM('profile', 'book', 'software', 'media', 'release', 'entity', 'tag', 'series', 'zone', 'collection', 'post', 'poll', 'realm');--> statement-breakpoint
ALTER TABLE "unit" ALTER COLUMN "kind" SET DATA TYPE "unit_kind" USING "kind"::"unit_kind";--> statement-breakpoint
ALTER TABLE "moderation_case" ALTER COLUMN "target_kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "moderation_target_kind";--> statement-breakpoint
CREATE TYPE "moderation_target_kind" AS ENUM('unit', 'unit_field', 'profile', 'realm_unit', 'realm_member', 'feedback');--> statement-breakpoint
ALTER TABLE "moderation_case" ALTER COLUMN "target_kind" SET DATA TYPE "moderation_target_kind" USING "target_kind"::"moderation_target_kind";--> statement-breakpoint
ALTER TABLE "recommendation_event" ALTER COLUMN "surface" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "recommendation_metric_daily" ALTER COLUMN "surface" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "recommendation_surface";--> statement-breakpoint
CREATE TYPE "recommendation_surface" AS ENUM('home_feed', 'home_book', 'home_software', 'home_media', 'unit_related', 'post_related');--> statement-breakpoint
ALTER TABLE "recommendation_event" ALTER COLUMN "surface" SET DATA TYPE "recommendation_surface" USING "surface"::"recommendation_surface";--> statement-breakpoint
ALTER TABLE "recommendation_metric_daily" ALTER COLUMN "surface" SET DATA TYPE "recommendation_surface" USING "surface"::"recommendation_surface";--> statement-breakpoint
ALTER TABLE "collection" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "unit_progress" DROP COLUMN "last_read_node_id";--> statement-breakpoint
ALTER TABLE "zone" DROP COLUMN "owner_realm_id";--> statement-breakpoint
ALTER TABLE "zone" DROP COLUMN "boundary";--> statement-breakpoint
ALTER TABLE "zone" DROP COLUMN "nav";--> statement-breakpoint
ALTER TABLE "zone" DROP COLUMN "theme";--> statement-breakpoint
ALTER TABLE "zone_page" DROP COLUMN "config";--> statement-breakpoint
CREATE UNIQUE INDEX "collection_owner_system_key" ON "collection" ("owner_profile_id","system_key") WHERE "source" = 'system'::collection_source;--> statement-breakpoint
CREATE INDEX "content_structure_node_owner_parent_position_idx" ON "content_structure_node" ("owner_unit_id","parent_id","position","id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "content_structure_node_parent_idx" ON "content_structure_node" ("parent_id");--> statement-breakpoint
CREATE INDEX "content_structure_node_content_unit_idx" ON "content_structure_node" ("content_unit_id");--> statement-breakpoint
CREATE INDEX "credit_attribution_entity_role_idx" ON "credit_attribution" ("entity_id","role");--> statement-breakpoint
CREATE INDEX "credit_attribution_unit_position_idx" ON "credit_attribution" ("unit_id","position","id");--> statement-breakpoint
CREATE INDEX "subject_attribution_entity_role_idx" ON "subject_attribution" ("subject_entity_id","role");--> statement-breakpoint
CREATE INDEX "subject_attribution_unit_position_idx" ON "subject_attribution" ("unit_id","position","id");--> statement-breakpoint
CREATE INDEX "content_structure_node_progress_node_idx" ON "content_structure_node_progress" ("node_id");--> statement-breakpoint
CREATE INDEX "unit_progress_last_content_structure_node_idx" ON "unit_progress" ("last_content_structure_node_id");--> statement-breakpoint
CREATE INDEX "realm_unit_realm_status_created_idx" ON "realm_unit" ("realm_id","status","created_at" DESC NULLS LAST,"unit_id");--> statement-breakpoint
CREATE INDEX "realm_unit_unit_idx" ON "realm_unit" ("unit_id");--> statement-breakpoint
CREATE INDEX "realm_unit_status_event_history_idx" ON "realm_unit_status_event" ("realm_id","unit_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "realm_unit_status_event_actor_idx" ON "realm_unit_status_event" ("changed_by_profile_id");--> statement-breakpoint
CREATE INDEX "release_parent_released_on_idx" ON "release" ("parent_unit_id","released_on","id");--> statement-breakpoint
CREATE INDEX "software_requirement_platform_idx" ON "software_requirement" ("platform_entity_id");--> statement-breakpoint
CREATE INDEX "software_requirement_source_link_idx" ON "software_requirement" ("source_link_id");--> statement-breakpoint
CREATE INDEX "profile_unit_tag_unit_idx" ON "profile_unit_tag" ("unit_id","profile_id");--> statement-breakpoint
CREATE INDEX "profile_unit_tag_tag_idx" ON "profile_unit_tag" ("tag_id");--> statement-breakpoint
CREATE INDEX "realm_tag_context_tag_idx" ON "realm_tag_context" ("realm_id","tag_id");--> statement-breakpoint
CREATE INDEX "realm_tag_context_post_idx" ON "realm_tag_context" ("context_post_id");--> statement-breakpoint
CREATE INDEX "realm_tag_vote_profile_idx" ON "realm_tag_vote" ("profile_id");--> statement-breakpoint
CREATE INDEX "realm_unit_tag_tag_idx" ON "realm_unit_tag" ("realm_id","tag_id");--> statement-breakpoint
CREATE INDEX "zone_managing_realm_idx" ON "zone" ("managing_realm_id");--> statement-breakpoint
CREATE INDEX "zone_menu_zone_position_idx" ON "zone_menu" ("zone_id","position","id");--> statement-breakpoint
ALTER TABLE "content_structure_node" ADD CONSTRAINT "content_structure_node_owner_unit_id_unit_id_fkey" FOREIGN KEY ("owner_unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_structure_node" ADD CONSTRAINT "content_structure_node_content_unit_id_unit_id_fkey" FOREIGN KEY ("content_unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "content_structure_node" ADD CONSTRAINT "content_structure_node_parent_owner_fkey" FOREIGN KEY ("parent_id","owner_unit_id") REFERENCES "content_structure_node"("id","owner_unit_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "credit_attribution" ADD CONSTRAINT "credit_attribution_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "credit_attribution" ADD CONSTRAINT "credit_attribution_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "subject_attribution" ADD CONSTRAINT "subject_attribution_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "subject_attribution" ADD CONSTRAINT "subject_attribution_subject_entity_id_entity_id_fkey" FOREIGN KEY ("subject_entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "content_structure_node_progress" ADD CONSTRAINT "content_structure_node_progress_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_structure_node_progress" ADD CONSTRAINT "content_structure_node_progress_node_fkey" FOREIGN KEY ("node_id") REFERENCES "content_structure_node"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_progress" ADD CONSTRAINT "unit_progress_last_content_structure_node_fkey" FOREIGN KEY ("last_content_structure_node_id","unit_id") REFERENCES "content_structure_node"("id","owner_unit_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "realm_dock" ADD CONSTRAINT "realm_dock_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_unit" ADD CONSTRAINT "realm_unit_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_unit" ADD CONSTRAINT "realm_unit_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_unit_status_event" ADD CONSTRAINT "realm_unit_status_event_changed_by_profile_id_profile_id_fkey" FOREIGN KEY ("changed_by_profile_id") REFERENCES "profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "realm_unit_status_event" ADD CONSTRAINT "realm_unit_status_event_realm_unit_fkey" FOREIGN KEY ("realm_id","unit_id") REFERENCES "realm_unit"("realm_id","unit_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "release" ADD CONSTRAINT "release_parent_unit_id_unit_id_fkey" FOREIGN KEY ("parent_unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "software" ADD CONSTRAINT "software_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "software_requirement" ADD CONSTRAINT "software_requirement_software_id_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "software_requirement" ADD CONSTRAINT "software_requirement_platform_entity_id_entity_id_fkey" FOREIGN KEY ("platform_entity_id") REFERENCES "entity"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "software_requirement" ADD CONSTRAINT "software_requirement_source_link_id_unit_link_id_fkey" FOREIGN KEY ("source_link_id") REFERENCES "unit_link"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "profile_unit_tag" ADD CONSTRAINT "profile_unit_tag_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile_unit_tag" ADD CONSTRAINT "profile_unit_tag_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile_unit_tag" ADD CONSTRAINT "profile_unit_tag_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_tag_context" ADD CONSTRAINT "realm_tag_context_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_tag_context" ADD CONSTRAINT "realm_tag_context_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_tag_context" ADD CONSTRAINT "realm_tag_context_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_tag_context" ADD CONSTRAINT "realm_tag_context_context_post_id_post_id_fkey" FOREIGN KEY ("context_post_id") REFERENCES "post"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "realm_tag_context" ADD CONSTRAINT "realm_tag_context_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "realm_tag_context" ADD CONSTRAINT "realm_tag_context_post_realm_fkey" FOREIGN KEY ("realm_id","context_post_id") REFERENCES "realm_unit"("realm_id","unit_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "realm_tag_vote" ADD CONSTRAINT "realm_tag_vote_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_tag_vote" ADD CONSTRAINT "realm_tag_vote_context_fkey" FOREIGN KEY ("realm_id","unit_id","tag_id") REFERENCES "realm_tag_context"("realm_id","unit_id","tag_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_unit_tag" ADD CONSTRAINT "realm_unit_tag_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "realm_unit_tag" ADD CONSTRAINT "realm_unit_tag_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "realm_unit_tag" ADD CONSTRAINT "realm_unit_tag_realm_unit_fkey" FOREIGN KEY ("realm_id","unit_id") REFERENCES "realm_unit"("realm_id","unit_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_tag" ADD CONSTRAINT "unit_tag_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_tag_vote" ADD CONSTRAINT "unit_tag_vote_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_tag_vote" ADD CONSTRAINT "unit_tag_vote_unit_tag_fkey" FOREIGN KEY ("unit_id","tag_id") REFERENCES "unit_tag"("unit_id","tag_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_managing_realm_id_realm_id_fkey" FOREIGN KEY ("managing_realm_id") REFERENCES "realm"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "zone_menu" ADD CONSTRAINT "zone_menu_zone_id_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_source_system_key_check" CHECK (("source" = 'system'::collection_source) = ("system_key" is not null));--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_not_managing_realm_check" CHECK ("managing_realm_id" is null or "id" <> "managing_realm_id");--> statement-breakpoint
DROP TYPE "collection_kind";