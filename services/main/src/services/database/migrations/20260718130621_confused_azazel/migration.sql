CREATE TYPE "unit_access_realm_relation" AS ENUM('member', 'content_editor', 'governor');--> statement-breakpoint
CREATE TYPE "unit_access_role" AS ENUM('viewer', 'editor', 'publisher', 'maintainer', 'owner');--> statement-breakpoint
CREATE TYPE "unit_access_subject_kind" AS ENUM('profile', 'realm', 'authenticated');--> statement-breakpoint
CREATE TYPE "unit_permission" AS ENUM('unit.read', 'unit.update', 'unit.publish', 'unit.history.restore', 'unit.access.manage', 'unit.protection.manage', 'unit.delete');--> statement-breakpoint
CREATE TYPE "unit_protection_mode" AS ENUM('frozen', 'owner_only');--> statement-breakpoint
CREATE TABLE "unit_access_binding" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unit_id" uuid NOT NULL,
	"subject_kind" "unit_access_subject_kind" NOT NULL,
	"profile_id" uuid,
	"realm_id" uuid,
	"realm_relation" "unit_access_realm_relation",
	"role" "unit_access_role" NOT NULL,
	"scope" text[] DEFAULT array[]::text[] NOT NULL,
	"granted_by_profile_id" uuid NOT NULL,
	"expires_at" timestamp(3) with time zone,
	"revoked_at" timestamp(3) with time zone,
	"revoked_by_profile_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_access_binding_subject_shape_check" CHECK ((
				"subject_kind" = 'profile' and "profile_id" is not null and "realm_id" is null and "realm_relation" is null
			) or (
				"subject_kind" = 'realm' and "profile_id" is null and "realm_id" is not null and "realm_relation" is not null
			) or (
				"subject_kind" = 'authenticated' and "profile_id" is null and "realm_id" is null and "realm_relation" is null
			)),
	CONSTRAINT "unit_access_binding_scope_check" CHECK (cardinality("scope") <= 8 and (
		cardinality("scope") = 0 or
		array_to_string("scope", '/') ~ '^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$'
	)),
	CONSTRAINT "unit_access_binding_expiry_check" CHECK ("expires_at" is null or "expires_at" > "created_at"),
	CONSTRAINT "unit_access_binding_revocation_shape_check" CHECK (("revoked_at" is null) = ("revoked_by_profile_id" is null))
);
--> statement-breakpoint
CREATE TABLE "unit_access_restriction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unit_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"permission" "unit_permission" NOT NULL,
	"scope" text[] DEFAULT array[]::text[] NOT NULL,
	"reason" text NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"expires_at" timestamp(3) with time zone,
	"revoked_at" timestamp(3) with time zone,
	"revoked_by_profile_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_access_restriction_scope_check" CHECK (cardinality("scope") <= 8 and (
		cardinality("scope") = 0 or
		array_to_string("scope", '/') ~ '^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$'
	)),
	CONSTRAINT "unit_access_restriction_reason_check" CHECK (btrim("reason") <> ''),
	CONSTRAINT "unit_access_restriction_expiry_check" CHECK ("expires_at" is null or "expires_at" > "created_at"),
	CONSTRAINT "unit_access_restriction_revocation_shape_check" CHECK (("revoked_at" is null) = ("revoked_by_profile_id" is null))
);
--> statement-breakpoint
CREATE TABLE "unit_protection" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unit_id" uuid NOT NULL,
	"scope" text[] DEFAULT array[]::text[] NOT NULL,
	"mode" "unit_protection_mode" NOT NULL,
	"reason" text NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"expires_at" timestamp(3) with time zone,
	"revoked_at" timestamp(3) with time zone,
	"revoked_by_profile_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_protection_scope_check" CHECK (cardinality("scope") <= 8 and (
		cardinality("scope") = 0 or
		array_to_string("scope", '/') ~ '^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$'
	)),
	CONSTRAINT "unit_protection_reason_check" CHECK (btrim("reason") <> ''),
	CONSTRAINT "unit_protection_expiry_check" CHECK ("expires_at" is null or "expires_at" > "created_at"),
	CONSTRAINT "unit_protection_revocation_shape_check" CHECK (("revoked_at" is null) = ("revoked_by_profile_id" is null))
);
--> statement-breakpoint
CREATE TABLE "unit_follow" (
	"follower_profile_id" uuid,
	"unit_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_follow_pkey" PRIMARY KEY("follower_profile_id","unit_id"),
	CONSTRAINT "unit_follow_not_self_check" CHECK ("follower_profile_id" <> "unit_id")
);
--> statement-breakpoint
CREATE TABLE "zone_navigation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"zone_id" uuid NOT NULL,
	"key" text NOT NULL,
	"document" jsonb NOT NULL,
	"position" text collate "C" NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zone_navigation_zone_key" UNIQUE("zone_id","key"),
	CONSTRAINT "zone_navigation_key_check" CHECK ("key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("key") <= 64)
);
--> statement-breakpoint
CREATE TABLE "zone_page" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"zone_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title_unit_id" uuid NOT NULL,
	"document" jsonb NOT NULL,
	"position" text collate "C" NOT NULL,
	"home" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zone_page_zone_slug_key" UNIQUE("zone_id","slug"),
	CONSTRAINT "zone_page_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("slug") <= 100)
);
--> statement-breakpoint
ALTER TABLE "zone" DROP CONSTRAINT "zone_managing_realm_id_realm_id_fkey";--> statement-breakpoint
DROP TABLE "profile_follow";--> statement-breakpoint
DROP TABLE "unit_collaborator";--> statement-breakpoint
DROP TABLE "unit_field_lock";--> statement-breakpoint
DROP TABLE "realm_subscription";--> statement-breakpoint
DROP TABLE "zone_subscription";--> statement-breakpoint
ALTER TABLE "zone" DROP CONSTRAINT "zone_not_managing_realm_check";--> statement-breakpoint
DROP INDEX "zone_managing_realm_idx";--> statement-breakpoint
ALTER TABLE "zone" ADD COLUMN "dock_document" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "collection" ALTER COLUMN "source" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "collection" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint
DROP TYPE "collection_source";--> statement-breakpoint
CREATE TYPE "collection_source" AS ENUM('manual', 'search', 'system');--> statement-breakpoint
ALTER TABLE "collection" ALTER COLUMN "source" SET DATA TYPE "collection_source" USING "source"::"collection_source";--> statement-breakpoint
ALTER TABLE "collection" ALTER COLUMN "source" SET DEFAULT 'manual'::"collection_source";--> statement-breakpoint
ALTER TABLE "moderation_action" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "moderation_action_kind";--> statement-breakpoint
CREATE TYPE "moderation_action_kind" AS ENUM('approve', 'remove', 'restore', 'lock', 'unlock', 'protect', 'unprotect', 'warning', 'silence', 'suspension', 'ban', 'rate_limit', 'trust_restriction', 'revoke_enforcement', 'mute_member', 'remove_member', 'ban_member', 'restore_member', 'escalate', 'reverse', 'note');--> statement-breakpoint
ALTER TABLE "moderation_action" ALTER COLUMN "kind" SET DATA TYPE "moderation_action_kind" USING "kind"::"moderation_action_kind";--> statement-breakpoint
ALTER TABLE "zone" DROP COLUMN "managing_realm_id";--> statement-breakpoint
CREATE UNIQUE INDEX "unit_access_binding_active_subject_scope_key" ON "unit_access_binding" ("unit_id","subject_kind",coalesce("profile_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("realm_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("realm_relation"::text, ''),"scope") WHERE "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "unit_access_binding_profile_active_idx" ON "unit_access_binding" ("profile_id","unit_id","role") WHERE "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "unit_access_binding_realm_active_idx" ON "unit_access_binding" ("realm_id","unit_id","realm_relation","role") WHERE "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "unit_access_binding_granted_by_idx" ON "unit_access_binding" ("granted_by_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_access_restriction_active_subject_scope_key" ON "unit_access_restriction" ("unit_id","profile_id","permission","scope") WHERE "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "unit_access_restriction_profile_active_idx" ON "unit_access_restriction" ("profile_id","unit_id","permission") WHERE "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "unit_access_restriction_created_by_idx" ON "unit_access_restriction" ("created_by_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_protection_active_scope_key" ON "unit_protection" ("unit_id","scope") WHERE "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "unit_protection_created_by_idx" ON "unit_protection" ("created_by_profile_id");--> statement-breakpoint
CREATE INDEX "unit_follow_unit_created_at_idx" ON "unit_follow" ("unit_id","created_at" DESC NULLS LAST,"follower_profile_id");--> statement-breakpoint
CREATE INDEX "zone_navigation_zone_position_idx" ON "zone_navigation" ("zone_id","position","id");--> statement-breakpoint
CREATE UNIQUE INDEX "zone_page_one_home_key" ON "zone_page" ("zone_id") WHERE "home";--> statement-breakpoint
CREATE INDEX "zone_page_zone_position_idx" ON "zone_page" ("zone_id","position","id");--> statement-breakpoint
CREATE INDEX "zone_page_title_unit_idx" ON "zone_page" ("title_unit_id");--> statement-breakpoint
ALTER TABLE "unit_access_binding" ADD CONSTRAINT "unit_access_binding_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_access_binding" ADD CONSTRAINT "unit_access_binding_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_access_binding" ADD CONSTRAINT "unit_access_binding_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_access_binding" ADD CONSTRAINT "unit_access_binding_granted_by_profile_id_profile_id_fkey" FOREIGN KEY ("granted_by_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_access_binding" ADD CONSTRAINT "unit_access_binding_revoked_by_profile_id_profile_id_fkey" FOREIGN KEY ("revoked_by_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_access_restriction" ADD CONSTRAINT "unit_access_restriction_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_access_restriction" ADD CONSTRAINT "unit_access_restriction_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_access_restriction" ADD CONSTRAINT "unit_access_restriction_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_access_restriction" ADD CONSTRAINT "unit_access_restriction_revoked_by_profile_id_profile_id_fkey" FOREIGN KEY ("revoked_by_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_protection" ADD CONSTRAINT "unit_protection_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_protection" ADD CONSTRAINT "unit_protection_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_protection" ADD CONSTRAINT "unit_protection_revoked_by_profile_id_profile_id_fkey" FOREIGN KEY ("revoked_by_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_follow" ADD CONSTRAINT "unit_follow_follower_profile_id_profile_id_fkey" FOREIGN KEY ("follower_profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_follow" ADD CONSTRAINT "unit_follow_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "zone_navigation" ADD CONSTRAINT "zone_navigation_zone_id_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "zone_page" ADD CONSTRAINT "zone_page_zone_id_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "zone_page" ADD CONSTRAINT "zone_page_title_unit_id_unit_id_fkey" FOREIGN KEY ("title_unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT;--> statement-breakpoint
DROP TYPE "collaborator_role";