-- Extend enum type "platform_capability"
ALTER TYPE "platform_capability" ADD VALUE 'platform.user.read' BEFORE 'entity.associations.override';
ALTER TYPE "platform_capability" ADD VALUE 'platform.user.status.update' AFTER 'platform.user.read';
ALTER TYPE "platform_capability" ADD VALUE 'platform.session.read' AFTER 'platform.user.status.update';
ALTER TYPE "platform_capability" ADD VALUE 'platform.session.revoke' AFTER 'platform.session.read';
-- Create enum type "user_account_state_value"
CREATE TYPE "user_account_state_value" AS ENUM ('active', 'suspended', 'closed');
-- Create enum type "user_account_state_reason"
CREATE TYPE "user_account_state_reason" AS ENUM ('security', 'policy_violation', 'compromised', 'user_request', 'legal', 'other');
-- Create "user_account_state" table
CREATE TABLE "user_account_state" (
  "user_id" uuid NOT NULL,
  "state" "user_account_state_value" NOT NULL DEFAULT 'active',
  "reason" "user_account_state_reason" NULL,
  "note" text NULL,
  "expires_at" timestamptz(3) NULL,
  "updated_by_profile_id" uuid NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "user_account_state_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "user_account_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "user_account_state_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "user_account_state_revision_check" CHECK (revision > 0),
  CONSTRAINT "user_account_state_shape_check" CHECK (
    (
      state = 'active'::user_account_state_value
      AND reason IS NULL
      AND note IS NULL
      AND expires_at IS NULL
    ) OR (
      state = 'suspended'::user_account_state_value
      AND reason IS NOT NULL
    ) OR (
      state = 'closed'::user_account_state_value
      AND reason IS NOT NULL
      AND expires_at IS NULL
    )
  )
);
-- Create index "user_account_state_state_expiry_idx"
CREATE INDEX "user_account_state_state_expiry_idx" ON "user_account_state" ("state", "expires_at");
-- Create index "user_account_state_updated_by_idx"
CREATE INDEX "user_account_state_updated_by_idx" ON "user_account_state" ("updated_by_profile_id");
