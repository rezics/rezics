ALTER TYPE "platform_capability"
	ADD VALUE 'platform.user.api_token.api_quota.read' BEFORE 'platform.moderate';
ALTER TYPE "platform_capability"
	ADD VALUE 'platform.user.api_token.api_quota.update' BEFORE 'platform.moderate';

ALTER TABLE "api_quota_policy"
	ADD COLUMN "subject_kind" text NOT NULL DEFAULT 'account';
ALTER TABLE "api_quota_policy"
	ALTER COLUMN "subject_kind" DROP DEFAULT;
ALTER TABLE "api_quota_policy"
	ADD CONSTRAINT "api_quota_policy_subject_kind_check"
	CHECK ("subject_kind" IN ('account', 'token'));
CREATE UNIQUE INDEX "api_quota_policy_id_subject_kind_key"
	ON "api_quota_policy" ("id", "subject_kind");

ALTER TABLE "api_account_quota_binding"
	DROP CONSTRAINT "api_account_quota_binding_policy_id_api_quota_policy_id_fkey";
ALTER TABLE "api_account_quota_binding"
	ADD COLUMN "policy_subject_kind" text NOT NULL DEFAULT 'account';
ALTER TABLE "api_account_quota_binding"
	ADD CONSTRAINT "api_account_quota_binding_policy_kind_check"
	CHECK ("policy_subject_kind" = 'account');
ALTER TABLE "api_account_quota_binding"
	ADD CONSTRAINT "api_account_quota_binding_policy_kind_fkey"
	FOREIGN KEY ("policy_id", "policy_subject_kind")
	REFERENCES "api_quota_policy" ("id", "subject_kind")
	ON DELETE RESTRICT;

CREATE TABLE "api_token_quota_binding" (
	"token_id" uuid PRIMARY KEY,
	"policy_id" uuid NOT NULL,
	"policy_subject_kind" text NOT NULL DEFAULT 'token',
	"configuration_override" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"valid_until" timestamptz(3),
	"assignment_reason" text NOT NULL,
	"assigned_by_profile_id" uuid NOT NULL,
	"revision" integer NOT NULL DEFAULT 1,
	"created_at" timestamptz(3) NOT NULL DEFAULT now(),
	"updated_at" timestamptz(3) NOT NULL DEFAULT now(),
	CONSTRAINT "api_token_quota_binding_token_id_apikeys_id_fkey"
		FOREIGN KEY ("token_id") REFERENCES "apikeys" ("id") ON DELETE CASCADE,
	CONSTRAINT "api_token_quota_binding_policy_kind_fkey"
		FOREIGN KEY ("policy_id", "policy_subject_kind")
		REFERENCES "api_quota_policy" ("id", "subject_kind") ON DELETE RESTRICT,
	CONSTRAINT "api_token_quota_binding_assigned_by_profile_id_profile_id_fkey"
		FOREIGN KEY ("assigned_by_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT,
	CONSTRAINT "api_token_quota_binding_policy_kind_check"
		CHECK ("policy_subject_kind" = 'token'),
	CONSTRAINT "api_token_quota_binding_revision_check"
		CHECK ("revision" > 0),
	CONSTRAINT "api_token_quota_binding_configuration_json_object_check"
		CHECK (jsonb_typeof("configuration_override") = 'object'),
	CONSTRAINT "api_token_quota_binding_validity_check"
		CHECK ("valid_until" IS NULL OR "valid_until" > "created_at"),
	CONSTRAINT "api_token_quota_binding_reason_check"
		CHECK (btrim("assignment_reason") <> '')
);
CREATE INDEX "api_token_quota_binding_policy_idx"
	ON "api_token_quota_binding" ("policy_id");
CREATE INDEX "api_token_quota_binding_assigned_by_idx"
	ON "api_token_quota_binding" ("assigned_by_profile_id");
