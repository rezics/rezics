-- Create enum type "resource_visibility"
CREATE TYPE "resource_visibility" AS ENUM ('public', 'unlisted', 'private');
-- Modify "profile_preference" table
ALTER TABLE "profile_preference" ADD COLUMN "score_visibility" "resource_visibility" NOT NULL DEFAULT 'private', ADD COLUMN "progress_visibility" "resource_visibility" NOT NULL DEFAULT 'private';
-- Modify "score" table
ALTER TABLE "score" ADD COLUMN "visibility" "resource_visibility" NOT NULL DEFAULT 'private';
-- Create index "score_public_profile_updated_at_idx" to table: "score"
CREATE INDEX "score_public_profile_updated_at_idx" ON "score" ("profile_id", "updated_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (visibility = 'public'::resource_visibility);
-- Modify "unit" table
DROP TRIGGER "reply_unit_state_maintain" ON "unit";
ALTER TABLE "unit" ALTER COLUMN "visibility" DROP DEFAULT;
ALTER TABLE "unit" ALTER COLUMN "visibility" TYPE "resource_visibility" USING "visibility"::text::"resource_visibility";
ALTER TABLE "unit" ALTER COLUMN "visibility" SET DEFAULT 'public';
CREATE TRIGGER "reply_unit_state_maintain"
AFTER UPDATE OF status, visibility, moderation_status, deleted_at ON "unit"
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status
  OR OLD.visibility IS DISTINCT FROM NEW.visibility
  OR OLD.moderation_status IS DISTINCT FROM NEW.moderation_status
  OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION maintain_reply_unit_state();
-- Modify "unit_progress" table
ALTER TABLE "unit_progress" ADD COLUMN "visibility" "resource_visibility" NOT NULL DEFAULT 'private';
-- Create index "unit_progress_public_profile_seen_idx" to table: "unit_progress"
CREATE INDEX "unit_progress_public_profile_seen_idx" ON "unit_progress" ("profile_id", "last_seen_at" DESC NULLS LAST, "unit_id") WHERE ((deleted_at IS NULL) AND (visibility = 'public'::resource_visibility));
-- Drop enum type "unit_visibility"
DROP TYPE "unit_visibility";
