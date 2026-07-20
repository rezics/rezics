-- Modify "unit_follow" table
ALTER TABLE "unit_follow" ADD COLUMN "position" text NOT NULL DEFAULT (('a0'::text || replace((uuidv7())::text, '-'::text, ''::text)) || 'V'::text) COLLATE "C", ADD COLUMN "favorite" boolean NOT NULL DEFAULT false, ADD COLUMN "updated_at" timestamptz(3) NOT NULL DEFAULT now();
-- Create index "unit_follow_follower_favorite_position_idx" to table: "unit_follow"
CREATE INDEX "unit_follow_follower_favorite_position_idx" ON "unit_follow" ("follower_profile_id", "favorite" DESC NULLS LAST, "position", "unit_id");
