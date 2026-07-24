-- Modify "profile_preference" table
ALTER TABLE "profile_preference" ADD COLUMN "default_score_realm_id" uuid NULL, ADD CONSTRAINT "profile_preference_default_score_realm_id_realm_id_fkey" FOREIGN KEY ("default_score_realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Create index "profile_preference_default_score_realm_idx" to table: "profile_preference"
CREATE INDEX "profile_preference_default_score_realm_idx" ON "profile_preference" ("default_score_realm_id");
-- Drop "global_score_context" table
DROP TABLE "global_score_context";
