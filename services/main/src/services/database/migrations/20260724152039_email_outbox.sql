-- Create enum type "email_outbox_kind"
CREATE TYPE "email_outbox_kind" AS ENUM ('verify_email', 'reset_password', 'notification');
-- Create enum type "email_outbox_status"
CREATE TYPE "email_outbox_status" AS ENUM ('pending', 'processing', 'accepted', 'failed');
-- Create enum type "email_provider_status"
CREATE TYPE "email_provider_status" AS ENUM ('logged', 'queued', 'delivered');
-- Create "email_outbox" table
CREATE TABLE "email_outbox" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "kind" "email_outbox_kind" NOT NULL,
  "notification_id" uuid NULL,
  "recipient_email" text NULL,
  "locale" text NULL,
  "action_url" text NULL,
  "status" "email_outbox_status" NOT NULL DEFAULT 'pending',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "available_at" timestamptz(3) NOT NULL DEFAULT now(),
  "lease_expires_at" timestamptz(3) NULL,
  "accepted_at" timestamptz(3) NULL,
  "failed_at" timestamptz(3) NULL,
  "provider_message_id" text NULL,
  "provider_status" "email_provider_status" NULL,
  "last_error" text NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "email_outbox_notification_id_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notification" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "email_outbox_attempt_count_check" CHECK (attempt_count >= 0),
  CONSTRAINT "email_outbox_intent_check" CHECK (((kind = 'notification'::email_outbox_kind) AND (notification_id IS NOT NULL) AND (recipient_email IS NULL) AND (locale IS NULL) AND (action_url IS NULL)) OR ((kind = ANY (ARRAY['verify_email'::email_outbox_kind, 'reset_password'::email_outbox_kind])) AND (notification_id IS NULL) AND (((status = ANY (ARRAY['pending'::email_outbox_status, 'processing'::email_outbox_status])) AND (NULLIF(btrim(recipient_email), ''::text) IS NOT NULL) AND (NULLIF(btrim(action_url), ''::text) IS NOT NULL) AND (locale = ANY (ARRAY['en'::text, 'zh-hant'::text]))) OR ((status = ANY (ARRAY['accepted'::email_outbox_status, 'failed'::email_outbox_status])) AND (recipient_email IS NULL) AND (locale IS NULL) AND (action_url IS NULL))))),
  CONSTRAINT "email_outbox_state_check" CHECK (((status = 'pending'::email_outbox_status) AND (lease_expires_at IS NULL) AND (accepted_at IS NULL) AND (failed_at IS NULL) AND (provider_message_id IS NULL) AND (provider_status IS NULL)) OR ((status = 'processing'::email_outbox_status) AND (lease_expires_at IS NOT NULL) AND (accepted_at IS NULL) AND (failed_at IS NULL) AND (provider_message_id IS NULL) AND (provider_status IS NULL) AND (last_error IS NULL)) OR ((status = 'accepted'::email_outbox_status) AND (lease_expires_at IS NULL) AND (accepted_at IS NOT NULL) AND (failed_at IS NULL) AND (provider_status IS NOT NULL) AND ((provider_status = 'logged'::email_provider_status) OR (NULLIF(btrim(provider_message_id), ''::text) IS NOT NULL)) AND (last_error IS NULL)) OR ((status = 'failed'::email_outbox_status) AND (lease_expires_at IS NULL) AND (accepted_at IS NULL) AND (failed_at IS NOT NULL) AND (provider_message_id IS NULL) AND (provider_status IS NULL) AND (NULLIF(btrim(last_error), ''::text) IS NOT NULL)))
);
-- Create index "email_outbox_notification_idx" to table: "email_outbox"
CREATE UNIQUE INDEX "email_outbox_notification_idx" ON "email_outbox" ("notification_id") WHERE (notification_id IS NOT NULL);
-- Create index "email_outbox_pending_idx" to table: "email_outbox"
CREATE INDEX "email_outbox_pending_idx" ON "email_outbox" ("available_at", "created_at") WHERE (status = 'pending'::email_outbox_status);
-- Create index "email_outbox_processing_lease_idx" to table: "email_outbox"
CREATE INDEX "email_outbox_processing_lease_idx" ON "email_outbox" ("lease_expires_at") WHERE (status = 'processing'::email_outbox_status);
-- Create index "email_outbox_provider_message_idx" to table: "email_outbox"
CREATE UNIQUE INDEX "email_outbox_provider_message_idx" ON "email_outbox" ("provider_message_id") WHERE (provider_message_id IS NOT NULL);
