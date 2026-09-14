SET search_path TO public;

CREATE TABLE "oauth_access_token" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"token" text NOT NULL,
	"client_id" text NOT NULL,
	"session_id" uuid,
	"user_id" uuid,
	"reference_id" text,
	"authorization_code_id" text,
	"resources" text[],
	"requested_user_info_claims" text[],
	"refresh_id" uuid,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"revoked" timestamp(3) with time zone,
	"confirmation" jsonb,
	"scopes" text[] NOT NULL
);

CREATE TABLE "oauth_client_assertion" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp(3) with time zone NOT NULL
);

CREATE TABLE "oauth_client_resource" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"client_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp(3) with time zone
);

CREATE TABLE "oauth_client" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"client_id" text NOT NULL,
	"client_secret" text,
	"client_discovery_id" text,
	"disabled" boolean,
	"skip_consent" boolean,
	"enable_end_session" boolean,
	"subject_type" text,
	"scopes" text[],
	"client_credentials_scopes" text[],
	"user_id" uuid,
	"created_at" timestamp(3) with time zone,
	"updated_at" timestamp(3) with time zone,
	"name" text,
	"uri" text,
	"icon" text,
	"contacts" text[],
	"tos" text,
	"policy" text,
	"software_id" text,
	"software_version" text,
	"software_statement" text,
	"redirect_uris" text[] NOT NULL,
	"post_logout_redirect_uris" text[],
	"backchannel_logout_uri" text,
	"backchannel_logout_session_required" boolean,
	"token_endpoint_auth_method" text,
	"application_type" text,
	"jwks" text,
	"jwks_uri" text,
	"grant_types" text[],
	"response_types" text[],
	"require_pkce" boolean,
	"dpop_bound_access_tokens" boolean,
	"reference_id" text,
	"metadata" jsonb
);

CREATE TABLE "oauth_consent" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"client_id" text NOT NULL,
	"user_id" uuid,
	"reference_id" text,
	"resources" text[],
	"requested_user_info_claims" text[],
	"scopes" text[] NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL
);

CREATE TABLE "oauth_jwks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"expires_at" timestamp(3) with time zone,
	"alg" text,
	"crv" text
);

CREATE TABLE "oauth_refresh_token" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"token" text NOT NULL,
	"client_id" text NOT NULL,
	"session_id" uuid,
	"user_id" uuid NOT NULL,
	"reference_id" text,
	"authorization_code_id" text,
	"resources" text[],
	"requested_user_info_claims" text[],
	"expires_at" timestamp(3) with time zone NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"revoked" timestamp(3) with time zone,
	"rotated_at" timestamp(3) with time zone,
	"rotation_replay_response" text,
	"rotation_replay_expires_at" timestamp(3) with time zone,
	"auth_time" timestamp(3) with time zone,
	"confirmation" jsonb,
	"scopes" text[] NOT NULL
);

CREATE TABLE "oauth_resource" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"identifier" text NOT NULL,
	"name" text NOT NULL,
	"access_token_ttl" integer,
	"refresh_token_ttl" integer,
	"signing_algorithm" text,
	"signing_key_id" text,
	"allowed_scopes" text[],
	"custom_claims" jsonb,
	"dpop_bound_access_tokens_required" boolean,
	"disabled" boolean,
	"created_at" timestamp(3) with time zone,
	"updated_at" timestamp(3) with time zone,
	"policy_version" integer,
	"metadata" jsonb
);

CREATE UNIQUE INDEX "oauth_access_token_token_key" ON "oauth_access_token" ("token");
CREATE INDEX "oauth_access_token_client_id_idx" ON "oauth_access_token" ("client_id");
CREATE INDEX "oauth_access_token_session_id_idx" ON "oauth_access_token" ("session_id");
CREATE INDEX "oauth_access_token_user_id_idx" ON "oauth_access_token" ("user_id");
CREATE INDEX "oauth_access_token_authorization_code_id_idx" ON "oauth_access_token" ("authorization_code_id");
CREATE INDEX "oauth_access_token_refresh_id_idx" ON "oauth_access_token" ("refresh_id");
CREATE INDEX "oauth_access_token_expiry_idx" ON "oauth_access_token" ("expires_at","id");
CREATE INDEX "oauth_client_assertion_expiry_idx" ON "oauth_client_assertion" ("expires_at","id");
CREATE INDEX "oauth_client_resource_client_id_idx" ON "oauth_client_resource" ("client_id");
CREATE INDEX "oauth_client_resource_resource_id_idx" ON "oauth_client_resource" ("resource_id");
CREATE UNIQUE INDEX "oauth_client_resource_compound_0_key" ON "oauth_client_resource" ("client_id","resource_id");
CREATE UNIQUE INDEX "oauth_client_client_id_key" ON "oauth_client" ("client_id");
CREATE INDEX "oauth_client_user_id_idx" ON "oauth_client" ("user_id");
CREATE INDEX "oauth_consent_client_id_idx" ON "oauth_consent" ("client_id");
CREATE INDEX "oauth_consent_user_id_idx" ON "oauth_consent" ("user_id");
CREATE INDEX "jwks_expiry_idx" ON "oauth_jwks" ("expires_at","id");
CREATE UNIQUE INDEX "oauth_refresh_token_token_key" ON "oauth_refresh_token" ("token");
CREATE INDEX "oauth_refresh_token_client_id_idx" ON "oauth_refresh_token" ("client_id");
CREATE INDEX "oauth_refresh_token_session_id_idx" ON "oauth_refresh_token" ("session_id");
CREATE INDEX "oauth_refresh_token_user_id_idx" ON "oauth_refresh_token" ("user_id");
CREATE INDEX "oauth_refresh_token_authorization_code_id_idx" ON "oauth_refresh_token" ("authorization_code_id");
CREATE INDEX "oauth_refresh_token_expiry_idx" ON "oauth_refresh_token" ("expires_at","id");
CREATE UNIQUE INDEX "oauth_resource_identifier_key" ON "oauth_resource" ("identifier");
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("client_id");
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL;
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_refresh_id_oauth_refresh_token_id_fk" FOREIGN KEY ("refresh_id") REFERENCES "oauth_refresh_token"("id");
ALTER TABLE "oauth_client_resource" ADD CONSTRAINT "oauth_client_resource_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("client_id") ON DELETE CASCADE;
ALTER TABLE "oauth_client_resource" ADD CONSTRAINT "oauth_client_resource_resource_id_oauth_resource_identifier_fk" FOREIGN KEY ("resource_id") REFERENCES "oauth_resource"("identifier") ON DELETE CASCADE;
ALTER TABLE "oauth_client" ADD CONSTRAINT "oauth_client_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("client_id");
ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("client_id");
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL;
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
