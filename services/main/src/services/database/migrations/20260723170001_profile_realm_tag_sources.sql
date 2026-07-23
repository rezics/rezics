-- Create "profile_realm_tag_subscription" table
CREATE TABLE "profile_realm_tag_subscription" (
  "profile_id" uuid NOT NULL,
  "realm_id" uuid NOT NULL,
  "position" text NOT NULL DEFAULT (('a0'::text || replace((uuidv7())::text, '-'::text, ''::text)) || 'V'::text) COLLATE "C",
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("profile_id", "realm_id"),
  CONSTRAINT "profile_realm_tag_subscription_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "profile_realm_tag_subscription_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "profile_realm_tag_subscription_profile_position_idx" to table: "profile_realm_tag_subscription"
CREATE INDEX "profile_realm_tag_subscription_profile_position_idx" ON "profile_realm_tag_subscription" ("profile_id", "position", "realm_id");
-- Create index "profile_realm_tag_subscription_realm_idx" to table: "profile_realm_tag_subscription"
CREATE INDEX "profile_realm_tag_subscription_realm_idx" ON "profile_realm_tag_subscription" ("realm_id", "profile_id");
-- Modify "unit_tag" table
ALTER TABLE "unit_tag" ADD COLUMN "created_by_profile_id" uuid NULL, ADD CONSTRAINT "unit_tag_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Create index "unit_tag_created_by_idx" to table: "unit_tag"
CREATE INDEX "unit_tag_created_by_idx" ON "unit_tag" ("created_by_profile_id");
