SET search_path TO public;

-- Add value to enum type: "platform_capability"
ALTER TYPE "platform_capability" ADD VALUE 'platform.zone_theme.review' AFTER 'platform.development_preview.access';
-- Add value to enum type: "platform_capability"
ALTER TYPE "platform_capability" ADD VALUE 'platform.zone_theme.kill' AFTER 'platform.zone_theme.review';
-- Add value to enum type: "unit_permission"
ALTER TYPE "unit_permission" ADD VALUE 'zone.pages.manage' AFTER 'unit.realm-publication.manage';
-- Add value to enum type: "unit_permission"
ALTER TYPE "unit_permission" ADD VALUE 'zone.theme.manage' AFTER 'zone.pages.manage';
-- Create index "book_release_status_id_idx" to table: "book"
CREATE INDEX "book_release_status_id_idx" ON "book" ("release_status", "id");
-- Modify "profile_preference" table
ALTER TABLE "profile_preference" ADD COLUMN "custom_zone_themes_enabled" boolean NOT NULL DEFAULT true;
-- Modify "unit" table
ALTER TABLE "unit" DROP CONSTRAINT "unit_kind_check", ADD CONSTRAINT "unit_kind_check" CHECK (kind = ANY (ARRAY['slug_namespace'::text, 'profile'::text, 'book'::text, 'software'::text, 'media'::text, 'video'::text, 'audio'::text, 'release'::text, 'entity'::text, 'label'::text, 'tag'::text, 'structure'::text, 'series'::text, 'zone'::text, 'zone_page'::text, 'zone_theme'::text, 'collection'::text, 'post'::text, 'poll'::text, 'realm'::text, 'realm_rule'::text]));
-- Modify "unit_access_invitation" table
ALTER TABLE "unit_access_invitation" DROP CONSTRAINT "unit_access_invitation_permissions_check", ADD CONSTRAINT "unit_access_invitation_permissions_check" CHECK (((cardinality(permissions) >= 1) AND (cardinality(permissions) <= 28)) AND (array_position(permissions, 'unit.ownership.transfer'::unit_permission) IS NULL) AND (array_position(permissions, 'unit.delete'::unit_permission) IS NULL));
-- Create "zone_theme" table
CREATE TABLE "zone_theme" (
  "id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "zone_theme_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create "zone_theme_revision" table
CREATE TABLE "zone_theme_revision" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "theme_unit_id" uuid NOT NULL,
  "contract_version" text NOT NULL,
  "source_css" text NOT NULL,
  "transformed_css" text NOT NULL,
  "sha256" text NOT NULL,
  "state" text NOT NULL DEFAULT 'pending_automated',
  "automated_review" jsonb NOT NULL,
  "render_review" jsonb NULL,
  "ai_review" jsonb NULL,
  "submitted_by_profile_id" uuid NOT NULL,
  "human_reviewed_by_profile_id" uuid NULL,
  "human_reviewed_at" timestamptz(3) NULL,
  "decision_reason" text NULL,
  "killed_by_profile_id" uuid NULL,
  "killed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "zone_theme_revision_CE0z2L81XT9c_fkey" FOREIGN KEY ("human_reviewed_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "zone_theme_revision_killed_by_profile_id_profile_id_fkey" FOREIGN KEY ("killed_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "zone_theme_revision_submitted_by_profile_id_profile_id_fkey" FOREIGN KEY ("submitted_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "zone_theme_revision_theme_unit_id_zone_theme_id_fkey" FOREIGN KEY ("theme_unit_id") REFERENCES "zone_theme" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "zone_theme_revision_ai_review_json_object_check" CHECK ((ai_review IS NULL) OR (jsonb_typeof(ai_review) = 'object'::text)),
  CONSTRAINT "zone_theme_revision_human_review_shape_check" CHECK ((human_reviewed_at IS NULL) = (human_reviewed_by_profile_id IS NULL)),
  CONSTRAINT "zone_theme_revision_kill_shape_check" CHECK ((killed_at IS NULL) = (killed_by_profile_id IS NULL)),
  CONSTRAINT "zone_theme_revision_render_review_json_object_check" CHECK ((render_review IS NULL) OR (jsonb_typeof(render_review) = 'object'::text)),
  CONSTRAINT "zone_theme_revision_sha256_check" CHECK (sha256 ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "zone_theme_revision_source_size_check" CHECK (octet_length(source_css) <= 65536),
  CONSTRAINT "zone_theme_revision_state_check" CHECK (state = ANY (ARRAY['pending_automated'::text, 'pending_human'::text, 'approved'::text, 'rejected'::text, 'killed'::text, 'revalidation_required'::text])),
  CONSTRAINT "zone_theme_revision_transformed_size_check" CHECK (octet_length(transformed_css) <= 65536)
);
-- Create index "zone_theme_revision_approved_contract_id_idx" to table: "zone_theme_revision"
CREATE INDEX "zone_theme_revision_approved_contract_id_idx" ON "zone_theme_revision" ("contract_version", "id") WHERE (state = 'approved'::text);
-- Create index "zone_theme_revision_review_queue_idx" to table: "zone_theme_revision"
CREATE INDEX "zone_theme_revision_review_queue_idx" ON "zone_theme_revision" ("id") WHERE (state = ANY (ARRAY['pending_automated'::text, 'pending_human'::text, 'revalidation_required'::text]));
-- Create index "zone_theme_revision_theme_id_idx" to table: "zone_theme_revision"
CREATE INDEX "zone_theme_revision_theme_id_idx" ON "zone_theme_revision" ("theme_unit_id", "id");
-- Create "zone_theme_revision_asset" table
CREATE TABLE "zone_theme_revision_asset" (
  "revision_id" uuid NOT NULL,
  "asset_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("revision_id", "asset_id"),
  CONSTRAINT "zone_theme_revision_asset_asset_id_image_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "image_asset" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "zone_theme_revision_asset_qw0FLvzGu7k2_fkey" FOREIGN KEY ("revision_id") REFERENCES "zone_theme_revision" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "zone_theme_revision_asset_asset_idx" to table: "zone_theme_revision_asset"
CREATE INDEX "zone_theme_revision_asset_asset_idx" ON "zone_theme_revision_asset" ("asset_id", "revision_id");
