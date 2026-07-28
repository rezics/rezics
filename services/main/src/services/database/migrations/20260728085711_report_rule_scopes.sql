-- Modify "realm_rule" table
ALTER TABLE "realm_rule" ADD CONSTRAINT "realm_rule_id_revision_key" UNIQUE ("id", "revision_id");
-- Modify "realm_rule_revision" table
ALTER TABLE "realm_rule_revision" ADD CONSTRAINT "realm_rule_revision_realm_id_key" UNIQUE ("realm_id", "id");
-- Create "platform_unit_report" table
CREATE TABLE "platform_unit_report" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "case_id" uuid NOT NULL,
  "reporter_profile_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "rule_source_realm_id" uuid NOT NULL,
  "rule_revision_id" uuid NOT NULL,
  "rule_id" uuid NOT NULL,
  "details" text NULL,
  "reported_revision_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "platform_unit_report_case_reporter_key" UNIQUE ("case_id", "reporter_profile_id"),
  CONSTRAINT "platform_unit_report_case_id_moderation_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "moderation_case" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "platform_unit_report_reporter_profile_id_profile_id_fkey" FOREIGN KEY ("reporter_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "platform_unit_report_revision_unit_fkey" FOREIGN KEY ("reported_revision_id", "unit_id") REFERENCES "unit_revision" ("id", "unit_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "platform_unit_report_rule_id_realm_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "realm_rule" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "platform_unit_report_rule_revision_fkey" FOREIGN KEY ("rule_id", "rule_revision_id") REFERENCES "realm_rule" ("id", "revision_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "platform_unit_report_rule_revision_realm_fkey" FOREIGN KEY ("rule_source_realm_id", "rule_revision_id") REFERENCES "realm_rule_revision" ("realm_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "platform_unit_report_rule_source_realm_id_realm_id_fkey" FOREIGN KEY ("rule_source_realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "platform_unit_report_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "platform_unit_report_details_length" CHECK ((details IS NULL) OR (char_length(details) <= 2000)),
  CONSTRAINT "platform_unit_report_details_not_blank" CHECK ((details IS NULL) OR (btrim(details) <> ''::text)),
  CONSTRAINT "platform_unit_report_rule_source_check" CHECK (rule_source_realm_id = '019b76da-a800-7300-8000-000000000003'::uuid)
);
-- Create index "platform_unit_report_case_idx" to table: "platform_unit_report"
CREATE INDEX "platform_unit_report_case_idx" ON "platform_unit_report" ("case_id");
-- Create index "platform_unit_report_created_at_idx" to table: "platform_unit_report"
CREATE INDEX "platform_unit_report_created_at_idx" ON "platform_unit_report" ("created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "platform_unit_report_reporter_created_at_idx" to table: "platform_unit_report"
CREATE INDEX "platform_unit_report_reporter_created_at_idx" ON "platform_unit_report" ("reporter_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "platform_unit_report_rule_idx" to table: "platform_unit_report"
CREATE INDEX "platform_unit_report_rule_idx" ON "platform_unit_report" ("rule_id");
-- Create index "platform_unit_report_unit_created_at_idx" to table: "platform_unit_report"
CREATE INDEX "platform_unit_report_unit_created_at_idx" ON "platform_unit_report" ("unit_id", "created_at" DESC NULLS LAST);
-- Create "realm_unit_report" table
CREATE TABLE "realm_unit_report" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "case_id" uuid NOT NULL,
  "reporter_profile_id" uuid NOT NULL,
  "realm_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "rule_revision_id" uuid NOT NULL,
  "rule_id" uuid NOT NULL,
  "details" text NULL,
  "reported_revision_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "realm_unit_report_case_reporter_key" UNIQUE ("case_id", "reporter_profile_id"),
  CONSTRAINT "realm_unit_report_case_id_moderation_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "moderation_case" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_report_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_report_realm_unit_fkey" FOREIGN KEY ("realm_id", "unit_id") REFERENCES "realm_unit" ("realm_id", "unit_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_report_reporter_profile_id_profile_id_fkey" FOREIGN KEY ("reporter_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_report_revision_unit_fkey" FOREIGN KEY ("reported_revision_id", "unit_id") REFERENCES "unit_revision" ("id", "unit_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_report_rule_id_realm_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "realm_rule" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_report_rule_revision_fkey" FOREIGN KEY ("rule_id", "rule_revision_id") REFERENCES "realm_rule" ("id", "revision_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_report_rule_revision_realm_fkey" FOREIGN KEY ("realm_id", "rule_revision_id") REFERENCES "realm_rule_revision" ("realm_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_report_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_report_details_length" CHECK ((details IS NULL) OR (char_length(details) <= 2000)),
  CONSTRAINT "realm_unit_report_details_not_blank" CHECK ((details IS NULL) OR (btrim(details) <> ''::text))
);
-- Create index "realm_unit_report_case_idx" to table: "realm_unit_report"
CREATE INDEX "realm_unit_report_case_idx" ON "realm_unit_report" ("case_id");
-- Create index "realm_unit_report_realm_created_at_idx" to table: "realm_unit_report"
CREATE INDEX "realm_unit_report_realm_created_at_idx" ON "realm_unit_report" ("realm_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "realm_unit_report_realm_unit_created_at_idx" to table: "realm_unit_report"
CREATE INDEX "realm_unit_report_realm_unit_created_at_idx" ON "realm_unit_report" ("realm_id", "unit_id", "created_at" DESC NULLS LAST);
-- Create index "realm_unit_report_reporter_created_at_idx" to table: "realm_unit_report"
CREATE INDEX "realm_unit_report_reporter_created_at_idx" ON "realm_unit_report" ("reporter_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "realm_unit_report_rule_idx" to table: "realm_unit_report"
CREATE INDEX "realm_unit_report_rule_idx" ON "realm_unit_report" ("rule_id");
-- Create index "realm_unit_report_unit_idx" to table: "realm_unit_report"
CREATE INDEX "realm_unit_report_unit_idx" ON "realm_unit_report" ("unit_id");
-- Drop "report" table
DROP TABLE "report";
-- Drop enum type "report_reason"
DROP TYPE "report_reason";
