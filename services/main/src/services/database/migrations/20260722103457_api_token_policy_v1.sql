-- Create "api_access_policy" table
CREATE TABLE "api_access_policy" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "key" text NOT NULL,
  "kind" text NOT NULL,
  "schema_version" integer NOT NULL,
  "configuration" jsonb NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "enabled" boolean NOT NULL DEFAULT true,
  "updated_by_profile_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "api_access_policy_key_key" UNIQUE ("key"),
  CONSTRAINT "api_access_policy_updated_by_profile_id_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "api_access_policy_configuration_json_object_check" CHECK (jsonb_typeof(configuration) = 'object'::text),
  CONSTRAINT "api_access_policy_key_check" CHECK (key ~ '^[a-z][a-z0-9_-]{0,63}$'::text),
  CONSTRAINT "api_access_policy_kind_check" CHECK (kind = ANY (ARRAY['standard'::text, 'staff_trusted'::text])),
  CONSTRAINT "api_access_policy_revision_check" CHECK (revision > 0),
  CONSTRAINT "api_access_policy_schema_version_check" CHECK (schema_version > 0)
);
-- Create index "api_access_policy_updated_by_idx" to table: "api_access_policy"
CREATE INDEX "api_access_policy_updated_by_idx" ON "api_access_policy" ("updated_by_profile_id");
-- Create "api_token_policy_binding" table
CREATE TABLE "api_token_policy_binding" (
  "token_id" uuid NOT NULL,
  "policy_id" uuid NOT NULL,
  "configuration_override" jsonb NOT NULL DEFAULT '{}',
  "valid_until" timestamptz(3) NULL,
  "assigned_by_profile_id" uuid NOT NULL,
  "assignment_reason" text NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("token_id"),
  CONSTRAINT "api_token_policy_binding_assigned_by_profile_id_profile_id_fkey" FOREIGN KEY ("assigned_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "api_token_policy_binding_policy_id_api_access_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "api_access_policy" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "api_token_policy_binding_token_id_apikeys_id_fkey" FOREIGN KEY ("token_id") REFERENCES "apikeys" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_token_policy_binding_configuration_json_object_check" CHECK (jsonb_typeof(configuration_override) = 'object'::text),
  CONSTRAINT "api_token_policy_binding_reason_check" CHECK ((assignment_reason IS NULL) OR (btrim(assignment_reason) <> ''::text)),
  CONSTRAINT "api_token_policy_binding_revision_check" CHECK (revision > 0),
  CONSTRAINT "api_token_policy_binding_validity_check" CHECK ((valid_until IS NULL) OR (valid_until > created_at))
);
-- Create index "api_token_policy_binding_assigned_by_idx" to table: "api_token_policy_binding"
CREATE INDEX "api_token_policy_binding_assigned_by_idx" ON "api_token_policy_binding" ("assigned_by_profile_id");
-- Create index "api_token_policy_binding_policy_idx" to table: "api_token_policy_binding"
CREATE INDEX "api_token_policy_binding_policy_idx" ON "api_token_policy_binding" ("policy_id");
-- Create "api_token_request_lease" table
CREATE TABLE "api_token_request_lease" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "token_id" uuid NOT NULL,
  "scope" text NOT NULL,
  "expires_at" timestamptz(3) NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "api_token_request_lease_token_id_apikeys_id_fkey" FOREIGN KEY ("token_id") REFERENCES "apikeys" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_token_request_lease_expiry_check" CHECK (expires_at > created_at),
  CONSTRAINT "api_token_request_lease_scope_check" CHECK ((btrim(scope) <> ''::text) AND (length(scope) <= 256))
);
-- Create index "api_token_request_lease_expiry_idx" to table: "api_token_request_lease"
CREATE INDEX "api_token_request_lease_expiry_idx" ON "api_token_request_lease" ("expires_at");
-- Create index "api_token_request_lease_token_scope_expiry_idx" to table: "api_token_request_lease"
CREATE INDEX "api_token_request_lease_token_scope_expiry_idx" ON "api_token_request_lease" ("token_id", "scope", "expires_at");
-- Create "api_token_usage_bucket" table
CREATE TABLE "api_token_usage_bucket" (
  "token_id" uuid NOT NULL,
  "scope" text NOT NULL,
  "kind" text NOT NULL,
  "window_started_at" timestamptz(3) NOT NULL,
  "used" bigint NOT NULL,
  "expires_at" timestamptz(3) NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("token_id", "scope", "kind", "window_started_at"),
  CONSTRAINT "api_token_usage_bucket_token_id_apikeys_id_fkey" FOREIGN KEY ("token_id") REFERENCES "apikeys" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "api_token_usage_bucket_expiry_check" CHECK (expires_at > window_started_at),
  CONSTRAINT "api_token_usage_bucket_kind_check" CHECK (kind = ANY (ARRAY['minute_requests'::text, 'daily_cost'::text])),
  CONSTRAINT "api_token_usage_bucket_scope_check" CHECK ((btrim(scope) <> ''::text) AND (length(scope) <= 256)),
  CONSTRAINT "api_token_usage_bucket_used_check" CHECK (used >= 0)
);
-- Create index "api_token_usage_bucket_expiry_idx" to table: "api_token_usage_bucket"
CREATE INDEX "api_token_usage_bucket_expiry_idx" ON "api_token_usage_bucket" ("expires_at");
-- Create index "api_token_usage_bucket_token_expiry_idx" to table: "api_token_usage_bucket"
CREATE INDEX "api_token_usage_bucket_token_expiry_idx" ON "api_token_usage_bucket" ("token_id", "expires_at");
-- Seed the versioned, database-configurable policy documents required by the resolver.
INSERT INTO "api_access_policy" ("key", "kind", "schema_version", "configuration") VALUES
  (
    'standard-default',
    'standard',
    1,
    '{"limits":{"requestsPerMinute":60,"maxConcurrentRequests":2,"dailyCostUnits":2000},"operations":{}}'::jsonb
  ),
  (
    'staff-trusted-default',
    'staff_trusted',
    1,
    '{"limits":{"requestsPerMinute":600,"maxConcurrentRequests":16,"dailyCostUnits":100000},"operations":{}}'::jsonb
  );
