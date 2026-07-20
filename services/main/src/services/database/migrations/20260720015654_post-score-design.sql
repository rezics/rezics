-- Modify "governance_post_binding" table
ALTER TABLE "governance_post_binding" DROP COLUMN "revision_id";
-- Create "global_score_context" table
CREATE TABLE "global_score_context" (
  "singleton" boolean NOT NULL DEFAULT true,
  "context_post_id" uuid NOT NULL,
  "created_by_profile_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("singleton"),
  CONSTRAINT "global_score_context_context_post_id_key" UNIQUE ("context_post_id"),
  CONSTRAINT "global_score_context_context_post_id_post_id_fkey" FOREIGN KEY ("context_post_id") REFERENCES "post" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "global_score_context_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "global_score_context_singleton_check" CHECK (singleton)
);
-- Modify "score" table
ALTER TABLE "score" DROP CONSTRAINT "score_pkey", ADD COLUMN "id" uuid NOT NULL DEFAULT uuidv7(), ADD PRIMARY KEY ("id"), ADD CONSTRAINT "score_profile_unit_realm_key" UNIQUE ("profile_id", "unit_id", "realm_id");
-- Create "post_score" table
CREATE TABLE "post_score" (
  "post_id" uuid NOT NULL,
  "score_id" uuid NOT NULL,
  "position" text NOT NULL COLLATE "C",
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("post_id", "score_id"),
  CONSTRAINT "post_score_post_position_key" UNIQUE ("post_id", "position"),
  CONSTRAINT "post_score_post_id_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "post_score_score_id_score_id_fkey" FOREIGN KEY ("score_id") REFERENCES "score" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "post_score_score_idx" to table: "post_score"
CREATE INDEX "post_score_score_idx" ON "post_score" ("score_id");
-- Create "realm_score_context" table
CREATE TABLE "realm_score_context" (
  "realm_id" uuid NOT NULL,
  "context_post_id" uuid NOT NULL,
  "created_by_profile_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id"),
  CONSTRAINT "realm_score_context_context_post_id_post_id_fkey" FOREIGN KEY ("context_post_id") REFERENCES "post" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_score_context_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "realm_score_context_post_realm_fkey" FOREIGN KEY ("realm_id", "context_post_id") REFERENCES "realm_unit" ("realm_id", "unit_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_score_context_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "realm_score_context_post_idx" to table: "realm_score_context"
CREATE INDEX "realm_score_context_post_idx" ON "realm_score_context" ("context_post_id");
