-- Create "api_quota_policy" table
CREATE TABLE "api_quota_policy" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "key" text NOT NULL,
  "class" text NOT NULL,
  "current_revision" integer NOT NULL DEFAULT 1,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "api_quota_policy_key_key" UNIQUE ("key"),
  CONSTRAINT "api_quota_policy_class_check" CHECK (class = ANY (ARRAY['standard'::text, 'privileged'::text])),
  CONSTRAINT "api_quota_policy_current_revision_check" CHECK (current_revision > 0),
  CONSTRAINT "api_quota_policy_key_check" CHECK (key ~ '^[a-z][a-z0-9_-]{0,63}$'::text)
);
-- Create "api_account_quota_binding" table
CREATE TABLE "api_account_quota_binding" (
  "user_id" uuid NOT NULL,
  "policy_id" uuid NOT NULL,
  "configuration_override" jsonb NOT NULL DEFAULT '{}',
  "valid_until" timestamptz(3) NULL,
  "assignment_reason" text NOT NULL,
  "assigned_by_profile_id" uuid NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id"),
  CONSTRAINT "api_account_quota_binding_4WtImkXpd3J0_fkey" FOREIGN KEY ("assigned_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "api_account_quota_binding_policy_id_api_quota_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "api_quota_policy" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "api_account_quota_binding_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_account_quota_binding_configuration_json_object_check" CHECK (jsonb_typeof(configuration_override) = 'object'::text),
  CONSTRAINT "api_account_quota_binding_reason_check" CHECK (btrim(assignment_reason) <> ''::text),
  CONSTRAINT "api_account_quota_binding_revision_check" CHECK (revision > 0),
  CONSTRAINT "api_account_quota_binding_validity_check" CHECK ((valid_until IS NULL) OR (valid_until > created_at))
);
-- Create index "api_account_quota_binding_assigned_by_idx" to table: "api_account_quota_binding"
CREATE INDEX "api_account_quota_binding_assigned_by_idx" ON "api_account_quota_binding" ("assigned_by_profile_id");
-- Create index "api_account_quota_binding_policy_idx" to table: "api_account_quota_binding"
CREATE INDEX "api_account_quota_binding_policy_idx" ON "api_account_quota_binding" ("policy_id");
-- Create "api_quota_daily_usage" table
CREATE TABLE "api_quota_daily_usage" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "account_user_id" uuid NULL,
  "token_id" uuid NULL,
  "scope" text NOT NULL,
  "usage_date" date NOT NULL,
  "used_cost_units" bigint NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "api_quota_daily_usage_account_user_id_users_id_fkey" FOREIGN KEY ("account_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_quota_daily_usage_token_id_apikeys_id_fkey" FOREIGN KEY ("token_id") REFERENCES "apikeys" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_quota_daily_usage_scope_check" CHECK ((btrim(scope) <> ''::text) AND (length(scope) <= 256)),
  CONSTRAINT "api_quota_daily_usage_subject_check" CHECK (num_nonnulls(account_user_id, token_id) = 1),
  CONSTRAINT "api_quota_daily_usage_used_cost_check" CHECK (used_cost_units >= 0)
);
-- Create index "api_quota_daily_usage_account_scope_date_key" to table: "api_quota_daily_usage"
CREATE UNIQUE INDEX "api_quota_daily_usage_account_scope_date_key" ON "api_quota_daily_usage" ("account_user_id", "scope", "usage_date") WHERE (account_user_id IS NOT NULL);
-- Create index "api_quota_daily_usage_date_idx" to table: "api_quota_daily_usage"
CREATE INDEX "api_quota_daily_usage_date_idx" ON "api_quota_daily_usage" ("usage_date");
-- Create index "api_quota_daily_usage_token_scope_date_key" to table: "api_quota_daily_usage"
CREATE UNIQUE INDEX "api_quota_daily_usage_token_scope_date_key" ON "api_quota_daily_usage" ("token_id", "scope", "usage_date") WHERE (token_id IS NOT NULL);
-- Create "api_quota_policy_revision" table
CREATE TABLE "api_quota_policy_revision" (
  "policy_id" uuid NOT NULL,
  "revision" integer NOT NULL,
  "schema_version" integer NOT NULL,
  "configuration" jsonb NOT NULL,
  "change_reason" text NOT NULL,
  "created_by_profile_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("policy_id", "revision"),
  CONSTRAINT "api_quota_policy_revision_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "api_quota_policy_revision_policy_id_api_quota_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "api_quota_policy" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_quota_policy_revision_change_reason_check" CHECK (btrim(change_reason) <> ''::text),
  CONSTRAINT "api_quota_policy_revision_configuration_json_object_check" CHECK (jsonb_typeof(configuration) = 'object'::text),
  CONSTRAINT "api_quota_policy_revision_revision_check" CHECK (revision > 0),
  CONSTRAINT "api_quota_policy_revision_schema_version_check" CHECK (schema_version > 0)
);
-- Create index "api_quota_policy_revision_created_by_idx" to table: "api_quota_policy_revision"
CREATE INDEX "api_quota_policy_revision_created_by_idx" ON "api_quota_policy_revision" ("created_by_profile_id");
-- Create "api_quota_rate_state" table
CREATE TABLE "api_quota_rate_state" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "account_user_id" uuid NULL,
  "token_id" uuid NULL,
  "scope" text NOT NULL,
  "available_rate_units" bigint NOT NULL,
  "refilled_at" timestamptz(3) NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "api_quota_rate_state_account_user_id_users_id_fkey" FOREIGN KEY ("account_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_quota_rate_state_token_id_apikeys_id_fkey" FOREIGN KEY ("token_id") REFERENCES "apikeys" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_quota_rate_state_available_units_check" CHECK (available_rate_units >= 0),
  CONSTRAINT "api_quota_rate_state_scope_check" CHECK ((btrim(scope) <> ''::text) AND (length(scope) <= 256)),
  CONSTRAINT "api_quota_rate_state_subject_check" CHECK (num_nonnulls(account_user_id, token_id) = 1)
);
-- Create index "api_quota_rate_state_account_scope_key" to table: "api_quota_rate_state"
CREATE UNIQUE INDEX "api_quota_rate_state_account_scope_key" ON "api_quota_rate_state" ("account_user_id", "scope") WHERE (account_user_id IS NOT NULL);
-- Create index "api_quota_rate_state_token_scope_key" to table: "api_quota_rate_state"
CREATE UNIQUE INDEX "api_quota_rate_state_token_scope_key" ON "api_quota_rate_state" ("token_id", "scope") WHERE (token_id IS NOT NULL);
-- Create index "api_quota_rate_state_updated_at_idx" to table: "api_quota_rate_state"
CREATE INDEX "api_quota_rate_state_updated_at_idx" ON "api_quota_rate_state" ("updated_at");
-- Create "api_quota_request_lease" table
CREATE TABLE "api_quota_request_lease" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "request_id" uuid NOT NULL,
  "account_user_id" uuid NULL,
  "token_id" uuid NULL,
  "scope" text NOT NULL,
  "expires_at" timestamptz(3) NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "api_quota_request_lease_account_user_id_users_id_fkey" FOREIGN KEY ("account_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_quota_request_lease_token_id_apikeys_id_fkey" FOREIGN KEY ("token_id") REFERENCES "apikeys" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_quota_request_lease_expiry_check" CHECK (expires_at > created_at),
  CONSTRAINT "api_quota_request_lease_scope_check" CHECK ((btrim(scope) <> ''::text) AND (length(scope) <= 256)),
  CONSTRAINT "api_quota_request_lease_subject_check" CHECK (num_nonnulls(account_user_id, token_id) = 1)
);
-- Create index "api_quota_request_lease_account_request_scope_key" to table: "api_quota_request_lease"
CREATE UNIQUE INDEX "api_quota_request_lease_account_request_scope_key" ON "api_quota_request_lease" ("account_user_id", "request_id", "scope") WHERE (account_user_id IS NOT NULL);
-- Create index "api_quota_request_lease_account_scope_expiry_idx" to table: "api_quota_request_lease"
CREATE INDEX "api_quota_request_lease_account_scope_expiry_idx" ON "api_quota_request_lease" ("account_user_id", "scope", "expires_at") WHERE (account_user_id IS NOT NULL);
-- Create index "api_quota_request_lease_expiry_idx" to table: "api_quota_request_lease"
CREATE INDEX "api_quota_request_lease_expiry_idx" ON "api_quota_request_lease" ("expires_at");
-- Create index "api_quota_request_lease_token_request_scope_key" to table: "api_quota_request_lease"
CREATE UNIQUE INDEX "api_quota_request_lease_token_request_scope_key" ON "api_quota_request_lease" ("token_id", "request_id", "scope") WHERE (token_id IS NOT NULL);
-- Create index "api_quota_request_lease_token_scope_expiry_idx" to table: "api_quota_request_lease"
CREATE INDEX "api_quota_request_lease_token_scope_expiry_idx" ON "api_quota_request_lease" ("token_id", "scope", "expires_at") WHERE (token_id IS NOT NULL);
-- Create "api_token_creation_reservation" table
CREATE TABLE "api_token_creation_reservation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "account_user_id" uuid NOT NULL,
  "expires_at" timestamptz(3) NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "api_token_creation_reservation_account_user_id_users_id_fkey" FOREIGN KEY ("account_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_token_creation_reservation_expiry_check" CHECK (expires_at > created_at)
);
-- Create index "api_token_creation_reservation_account_expiry_idx" to table: "api_token_creation_reservation"
CREATE INDEX "api_token_creation_reservation_account_expiry_idx" ON "api_token_creation_reservation" ("account_user_id", "expires_at");
-- Create index "api_token_creation_reservation_expiry_idx" to table: "api_token_creation_reservation"
CREATE INDEX "api_token_creation_reservation_expiry_idx" ON "api_token_creation_reservation" ("expires_at");
-- Create "api_token_quota_override" table
CREATE TABLE "api_token_quota_override" (
  "token_id" uuid NOT NULL,
  "configuration_override" jsonb NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "updated_by_profile_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("token_id"),
  CONSTRAINT "api_token_quota_override_token_id_apikeys_id_fkey" FOREIGN KEY ("token_id") REFERENCES "apikeys" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_token_quota_override_updated_by_profile_id_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "api_token_quota_override_configuration_json_object_check" CHECK (jsonb_typeof(configuration_override) = 'object'::text),
  CONSTRAINT "api_token_quota_override_revision_check" CHECK (revision > 0)
);
-- Create index "api_token_quota_override_updated_by_idx" to table: "api_token_quota_override"
CREATE INDEX "api_token_quota_override_updated_by_idx" ON "api_token_quota_override" ("updated_by_profile_id");
