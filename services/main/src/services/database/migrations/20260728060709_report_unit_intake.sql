-- Remove the retired Feedback intake and any moderation records that exclusively targeted it.
DELETE FROM "governance_post_binding"
WHERE "subject_kind" = 'feedback'::"governance_note_subject_kind";
--> statement-breakpoint
DELETE FROM "governance_post_binding"
WHERE "subject_kind" = 'moderation_action'::"governance_note_subject_kind"
	AND "subject_id" IN (
		SELECT "id"
		FROM "moderation_action"
		WHERE "case_id" IN (
			SELECT "id" FROM "moderation_case" WHERE "target_kind" = 'feedback'::"moderation_target_kind"
			UNION
			SELECT duplicate."id"
			FROM "moderation_case" duplicate
			INNER JOIN "moderation_case" original
				ON original."id" = duplicate."duplicate_of_case_id"
			WHERE original."target_kind" = 'feedback'::"moderation_target_kind"
		)
	);
--> statement-breakpoint
DELETE FROM "governance_post_binding"
WHERE "subject_kind" = 'moderation_case'::"governance_note_subject_kind"
	AND "subject_id" IN (
		SELECT "id" FROM "moderation_case" WHERE "target_kind" = 'feedback'::"moderation_target_kind"
		UNION
		SELECT duplicate."id"
		FROM "moderation_case" duplicate
		INNER JOIN "moderation_case" original
			ON original."id" = duplicate."duplicate_of_case_id"
		WHERE original."target_kind" = 'feedback'::"moderation_target_kind"
	);
--> statement-breakpoint
DELETE FROM "account_enforcement"
WHERE "decision_action_id" IN (
		SELECT action."id"
		FROM "moderation_action" action
		INNER JOIN "moderation_case" moderation_case
			ON moderation_case."id" = action."case_id"
		WHERE moderation_case."target_kind" = 'feedback'::"moderation_target_kind"
	)
	OR "revocation_action_id" IN (
		SELECT action."id"
		FROM "moderation_action" action
		INNER JOIN "moderation_case" moderation_case
			ON moderation_case."id" = action."case_id"
		WHERE moderation_case."target_kind" = 'feedback'::"moderation_target_kind"
	);
--> statement-breakpoint
DELETE FROM "moderation_action"
WHERE "case_id" IN (
	SELECT "id" FROM "moderation_case" WHERE "target_kind" = 'feedback'::"moderation_target_kind"
	UNION
	SELECT duplicate."id"
	FROM "moderation_case" duplicate
	INNER JOIN "moderation_case" original
		ON original."id" = duplicate."duplicate_of_case_id"
	WHERE original."target_kind" = 'feedback'::"moderation_target_kind"
);
--> statement-breakpoint
DELETE FROM "moderation_case"
WHERE "duplicate_of_case_id" IN (
	SELECT "id" FROM "moderation_case" WHERE "target_kind" = 'feedback'::"moderation_target_kind"
);
--> statement-breakpoint
DELETE FROM "moderation_case"
WHERE "target_kind" = 'feedback'::"moderation_target_kind";
--> statement-breakpoint
DROP TABLE "feedback";
--> statement-breakpoint
DROP TYPE "feedback_kind";
--> statement-breakpoint

-- PostgreSQL enum labels cannot be removed in place, so rebuild the two affected contracts.
ALTER TABLE "moderation_case" DROP CONSTRAINT "moderation_case_path_check";
--> statement-breakpoint
ALTER TYPE "moderation_target_kind" RENAME TO "moderation_target_kind_old";
--> statement-breakpoint
CREATE TYPE "moderation_target_kind" AS ENUM (
	'unit',
	'unit_field',
	'profile',
	'realm_unit',
	'realm_member'
);
--> statement-breakpoint
ALTER TABLE "moderation_case"
	ALTER COLUMN "target_kind" TYPE "moderation_target_kind"
	USING "target_kind"::text::"moderation_target_kind";
--> statement-breakpoint
ALTER TABLE "moderation_case"
	ADD CONSTRAINT "moderation_case_path_check"
	CHECK (
		("target_kind" = 'unit_field'::"moderation_target_kind")
		= (nullif(btrim("target_path"), '') IS NOT NULL)
	);
--> statement-breakpoint
DROP TYPE "moderation_target_kind_old";
--> statement-breakpoint

ALTER TYPE "governance_note_subject_kind" RENAME TO "governance_note_subject_kind_old";
--> statement-breakpoint
CREATE TYPE "governance_note_subject_kind" AS ENUM (
	'moderation_case',
	'moderation_action',
	'unit_access_restriction',
	'realm_unit_status_event'
);
--> statement-breakpoint
ALTER TABLE "governance_post_binding"
	ALTER COLUMN "subject_kind" TYPE "governance_note_subject_kind"
	USING "subject_kind"::text::"governance_note_subject_kind";
--> statement-breakpoint
DROP TYPE "governance_note_subject_kind_old";
--> statement-breakpoint

ALTER TABLE "moderation_case" DROP COLUMN "reporter_profile_id";
--> statement-breakpoint

CREATE TYPE "report_reason" AS ENUM (
	'realm_rules',
	'spam',
	'harassment',
	'unsafe_content',
	'other'
);
--> statement-breakpoint
ALTER TYPE "moderation_action_kind" ADD VALUE 'dismiss';
--> statement-breakpoint
CREATE TABLE "report" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"case_id" uuid NOT NULL,
	"reporter_profile_id" uuid NOT NULL,
	"realm_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"reported_revision_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_case_reporter_key" UNIQUE ("case_id", "reporter_profile_id"),
	CONSTRAINT "report_details_not_blank" CHECK ("details" IS NULL OR btrim("details") <> ''),
	CONSTRAINT "report_details_length" CHECK ("details" IS NULL OR char_length("details") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "report"
	ADD CONSTRAINT "report_case_id_moderation_case_id_fkey"
	FOREIGN KEY ("case_id") REFERENCES "moderation_case" ("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "report"
	ADD CONSTRAINT "report_reporter_profile_id_profile_id_fkey"
	FOREIGN KEY ("reporter_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "report"
	ADD CONSTRAINT "report_realm_id_realm_id_fkey"
	FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "report"
	ADD CONSTRAINT "report_unit_id_unit_id_fkey"
	FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "report"
	ADD CONSTRAINT "report_realm_unit_fkey"
	FOREIGN KEY ("realm_id", "unit_id")
	REFERENCES "realm_unit" ("realm_id", "unit_id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "report"
	ADD CONSTRAINT "report_revision_unit_fkey"
	FOREIGN KEY ("reported_revision_id", "unit_id")
	REFERENCES "unit_revision" ("id", "unit_id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "report_realm_created_at_idx"
	ON "report" ("realm_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "report_realm_unit_created_at_idx"
	ON "report" ("realm_id", "unit_id", "created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "report_unit_idx" ON "report" ("unit_id");
--> statement-breakpoint
CREATE INDEX "report_case_idx" ON "report" ("case_id");
--> statement-breakpoint
CREATE INDEX "report_reporter_created_at_idx"
	ON "report" ("reporter_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
