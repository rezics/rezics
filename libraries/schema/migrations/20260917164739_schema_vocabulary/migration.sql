CREATE TABLE "schema_change" (
	"id" uuid PRIMARY KEY,
	"actor" jsonb,
	"message" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_change_message_bound" CHECK (octet_length("message") between 1 and 16384),
	CONSTRAINT "schema_change_actor" CHECK ("actor" is null or coalesce(jsonb_typeof("actor") = 'object' and "actor"->>'owner' ~ '^[a-z][a-z0-9_.-]{0,95}$' and "actor"->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false))
);
--> statement-breakpoint
CREATE TABLE "schema_definition" (
	"id" uuid PRIMARY KEY,
	"term_id" uuid NOT NULL,
	"vocabulary_id" uuid NOT NULL,
	"digest" text NOT NULL,
	"canonical" text NOT NULL,
	"types" jsonb NOT NULL,
	"status" text NOT NULL,
	"replacements" jsonb NOT NULL,
	CONSTRAINT "schema_definition_term_id" UNIQUE("id","term_id"),
	CONSTRAINT "schema_definition_origin" UNIQUE("id","term_id","vocabulary_id"),
	CONSTRAINT "schema_definition_content" UNIQUE("term_id","vocabulary_id","digest"),
	CONSTRAINT "schema_definition_shape" CHECK ("digest" ~ '^[0-9a-f]{64}$' and "status" in ('active','pending','retired') and jsonb_typeof("types") = 'array' and jsonb_typeof("replacements") = 'array')
);
--> statement-breakpoint
CREATE TABLE "schema_label" (
	"id" uuid PRIMARY KEY,
	"term_id" uuid NOT NULL,
	"predicate" text NOT NULL,
	"value" text NOT NULL,
	"language" text NOT NULL,
	"datatype" text NOT NULL,
	CONSTRAINT "schema_label_term_language" UNIQUE("id","term_id","language"),
	CONSTRAINT "schema_label_term" UNIQUE("id","term_id")
);
--> statement-breakpoint
CREATE TABLE "schema_label_selection" (
	"id" uuid PRIMARY KEY,
	"term_id" uuid NOT NULL,
	"language" text NOT NULL,
	"label_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	"change_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_label_selection_version" UNIQUE("term_id","language","version"),
	CONSTRAINT "schema_label_selection_version_positive" CHECK ("version" between 1 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "schema_profile" (
	"id" uuid PRIMARY KEY,
	"key" text NOT NULL CONSTRAINT "schema_profile_key" UNIQUE
);
--> statement-breakpoint
CREATE TABLE "schema_profile_revision" (
	"id" uuid PRIMARY KEY,
	"profile_id" uuid NOT NULL,
	"digest" text NOT NULL,
	"body" jsonb NOT NULL,
	CONSTRAINT "schema_profile_revision_digest" UNIQUE("profile_id","digest"),
	CONSTRAINT "schema_profile_revision_body" CHECK (jsonb_typeof("body") = 'object')
);
--> statement-breakpoint
CREATE TABLE "schema_profile_rule" (
	"profile_revision_id" uuid,
	"predicate_id" uuid,
	"definition_id" uuid NOT NULL,
	CONSTRAINT "schema_profile_rule_pkey" PRIMARY KEY("profile_revision_id","predicate_id")
);
--> statement-breakpoint
CREATE TABLE "schema_relation" (
	"id" uuid PRIMARY KEY,
	"subject_owner" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_relation_owner" CHECK ("subject_owner" ~ '^[a-z][a-z0-9_.-]{0,95}$')
);
--> statement-breakpoint
CREATE TABLE "schema_relation_revision" (
	"id" uuid PRIMARY KEY,
	"relation_id" uuid NOT NULL,
	"predicate_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"subject_revision_id" uuid,
	"parent_revision_id" uuid,
	"change_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"position" numeric,
	"digest" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_revision_relation" UNIQUE("id","relation_id"),
	CONSTRAINT "schema_revision_shape" CHECK ("digest" ~ '^[0-9a-f]{64}$' and ("position" is null or ("position" >= 0 and "position" < 1e40 and scale("position") = 0)) and jsonb_typeof("value") = 'object' and "value"->>'kind' in ('reference','iri','literal','unknown','no-value')),
	CONSTRAINT "schema_revision_not_self_parent" CHECK ("parent_revision_id" is null or "parent_revision_id" <> "id"),
	CONSTRAINT "schema_revision_value" CHECK (coalesce(octet_length("value"::text) <= 524288 and case "value"->>'kind'
			when 'reference' then jsonb_typeof("value"->'reference') = 'object'
				and "value"->'reference'->>'owner' ~ '^[a-z][a-z0-9_.-]{0,95}$'
				and "value"->'reference'->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
				and (not ("value"->'reference' ? 'revisionId') or "value"->'reference'->>'revisionId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
			when 'iri' then jsonb_typeof("value"->'iri') = 'string' and "value"->>'iri' ~ '^[A-Za-z][A-Za-z0-9+.-]*:'
			when 'literal' then jsonb_typeof("value"->'value') = 'string' and jsonb_typeof("value"->'datatype') = 'string'
				and "value"->>'datatype' ~ '^[A-Za-z][A-Za-z0-9+.-]*:'
				and ("value"->>'datatype' = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString') = ("value" ? 'language')
				and (not ("value" ? 'language') or "value"->>'language' ~* '^[a-z]+(-[a-z0-9]+)*$')
			when 'unknown' then true when 'no-value' then true else false end, false))
);
--> statement-breakpoint
CREATE TABLE "schema_relation_selection" (
	"id" uuid PRIMARY KEY,
	"relation_id" uuid NOT NULL,
	"revision_id" uuid,
	"version" bigint NOT NULL,
	"change_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_selection_version" UNIQUE("relation_id","version"),
	CONSTRAINT "schema_selection_version_positive" CHECK ("version" between 1 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "schema_release" (
	"id" uuid PRIMARY KEY,
	"vocabulary_id" uuid NOT NULL,
	"version" text NOT NULL,
	"digest" text NOT NULL,
	"source" jsonb NOT NULL,
	"source_bytes" bytea NOT NULL,
	"canonical" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schema_release_vocabulary_id" UNIQUE("id","vocabulary_id"),
	CONSTRAINT "schema_release_content" UNIQUE("vocabulary_id","digest"),
	CONSTRAINT "schema_release_digest_shape" CHECK ("digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "schema_release_source_bound" CHECK (octet_length("source_bytes") <= 16777216 and jsonb_typeof("source") = 'object'),
	CONSTRAINT "schema_release_source_digest" CHECK (coalesce(encode(sha256("source_bytes"), 'hex') = "source"->>'sha256', false))
);
--> statement-breakpoint
CREATE TABLE "schema_release_context" (
	"release_id" uuid,
	"sha256" text,
	"bytes" bytea NOT NULL,
	CONSTRAINT "schema_release_context_pkey" PRIMARY KEY("release_id","sha256"),
	CONSTRAINT "schema_release_context_bound" CHECK (octet_length("bytes") <= 1048576 and encode(sha256("bytes"), 'hex') = "sha256")
);
--> statement-breakpoint
CREATE TABLE "schema_release_label" (
	"release_id" uuid,
	"term_id" uuid,
	"label_id" uuid,
	CONSTRAINT "schema_release_label_pkey" PRIMARY KEY("release_id","term_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "schema_release_term" (
	"release_id" uuid,
	"vocabulary_id" uuid NOT NULL,
	"term_id" uuid,
	"definition_id" uuid NOT NULL,
	CONSTRAINT "schema_release_term_pkey" PRIMARY KEY("release_id","term_id")
);
--> statement-breakpoint
CREATE TABLE "schema_term" (
	"id" uuid PRIMARY KEY,
	"iri" text NOT NULL,
	"iri_hash" text NOT NULL CONSTRAINT "schema_term_iri_hash" UNIQUE,
	CONSTRAINT "schema_term_iri_bounds" CHECK (octet_length("iri") between 1 and 262144 and encode(sha256(convert_to("iri", 'UTF8')), 'hex') = "iri_hash")
);
--> statement-breakpoint
CREATE TABLE "schema_term_alias" (
	"iri_hash" text PRIMARY KEY,
	"iri" text NOT NULL,
	"term_id" uuid NOT NULL,
	CONSTRAINT "schema_term_alias_hash" CHECK (encode(sha256(convert_to("iri", 'UTF8')), 'hex') = "iri_hash")
);
--> statement-breakpoint
CREATE TABLE "schema_vocabulary" (
	"id" uuid PRIMARY KEY,
	"key" text NOT NULL CONSTRAINT "schema_vocabulary_key" UNIQUE,
	CONSTRAINT "schema_vocabulary_key_shape" CHECK ("key" ~ '^[a-z][a-z0-9-]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE "schema_vocabulary_head" (
	"vocabulary_id" uuid PRIMARY KEY,
	"release_id" uuid NOT NULL,
	"version" bigint NOT NULL,
	CONSTRAINT "schema_vocabulary_head_version" CHECK ("version" between 1 and 9007199254740991)
);
--> statement-breakpoint
CREATE INDEX "schema_label_locale" ON "schema_label" ("term_id","language","id");--> statement-breakpoint
CREATE INDEX "schema_label_selection_latest" ON "schema_label_selection" ("term_id","language","version" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "schema_relation_subject" ON "schema_relation" ("subject_owner","subject_id","id");--> statement-breakpoint
CREATE INDEX "schema_revision_history" ON "schema_relation_revision" ("relation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "schema_revision_predicate" ON "schema_relation_revision" ("predicate_id","relation_id","id");--> statement-breakpoint
CREATE INDEX "schema_revision_target" ON "schema_relation_revision" (("value"->'reference'->>'owner'),("value"->'reference'->>'id'),"predicate_id","id") WHERE "value"->>'kind' = 'reference';--> statement-breakpoint
CREATE INDEX "schema_selection_latest" ON "schema_relation_selection" ("relation_id","version" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "schema_release_term_reverse" ON "schema_release_term" ("term_id","release_id");--> statement-breakpoint
CREATE INDEX "schema_term_alias_term" ON "schema_term_alias" ("term_id");--> statement-breakpoint
ALTER TABLE "schema_definition" ADD CONSTRAINT "schema_definition_term_id_schema_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "schema_term"("id");--> statement-breakpoint
ALTER TABLE "schema_definition" ADD CONSTRAINT "schema_definition_vocabulary_id_schema_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "schema_vocabulary"("id");--> statement-breakpoint
ALTER TABLE "schema_label" ADD CONSTRAINT "schema_label_term_id_schema_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "schema_term"("id");--> statement-breakpoint
ALTER TABLE "schema_label_selection" ADD CONSTRAINT "schema_label_selection_term_id_schema_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "schema_term"("id");--> statement-breakpoint
ALTER TABLE "schema_label_selection" ADD CONSTRAINT "schema_label_selection_change_id_schema_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "schema_change"("id");--> statement-breakpoint
ALTER TABLE "schema_label_selection" ADD CONSTRAINT "schema_label_selection_cdZCXw5WutiB_fkey" FOREIGN KEY ("label_id","term_id","language") REFERENCES "schema_label"("id","term_id","language");--> statement-breakpoint
ALTER TABLE "schema_profile_revision" ADD CONSTRAINT "schema_profile_revision_profile_id_schema_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "schema_profile"("id");--> statement-breakpoint
ALTER TABLE "schema_profile_rule" ADD CONSTRAINT "schema_profile_rule_52qBaeIzxlEq_fkey" FOREIGN KEY ("profile_revision_id") REFERENCES "schema_profile_revision"("id");--> statement-breakpoint
ALTER TABLE "schema_profile_rule" ADD CONSTRAINT "schema_profile_rule_XkHGIddklppP_fkey" FOREIGN KEY ("definition_id","predicate_id") REFERENCES "schema_definition"("id","term_id");--> statement-breakpoint
ALTER TABLE "schema_relation_revision" ADD CONSTRAINT "schema_relation_revision_relation_id_schema_relation_id_fkey" FOREIGN KEY ("relation_id") REFERENCES "schema_relation"("id");--> statement-breakpoint
ALTER TABLE "schema_relation_revision" ADD CONSTRAINT "schema_relation_revision_change_id_schema_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "schema_change"("id");--> statement-breakpoint
ALTER TABLE "schema_relation_revision" ADD CONSTRAINT "schema_relation_revision_droROk66Bxqt_fkey" FOREIGN KEY ("definition_id","predicate_id") REFERENCES "schema_definition"("id","term_id");--> statement-breakpoint
ALTER TABLE "schema_relation_revision" ADD CONSTRAINT "schema_relation_revision_WmNc1McuNqs6_fkey" FOREIGN KEY ("parent_revision_id","relation_id") REFERENCES "schema_relation_revision"("id","relation_id");--> statement-breakpoint
ALTER TABLE "schema_relation_selection" ADD CONSTRAINT "schema_relation_selection_relation_id_schema_relation_id_fkey" FOREIGN KEY ("relation_id") REFERENCES "schema_relation"("id");--> statement-breakpoint
ALTER TABLE "schema_relation_selection" ADD CONSTRAINT "schema_relation_selection_change_id_schema_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "schema_change"("id");--> statement-breakpoint
ALTER TABLE "schema_relation_selection" ADD CONSTRAINT "schema_relation_selection_ojlKseIgk0io_fkey" FOREIGN KEY ("revision_id","relation_id") REFERENCES "schema_relation_revision"("id","relation_id");--> statement-breakpoint
ALTER TABLE "schema_release" ADD CONSTRAINT "schema_release_vocabulary_id_schema_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "schema_vocabulary"("id");--> statement-breakpoint
ALTER TABLE "schema_release_context" ADD CONSTRAINT "schema_release_context_release_id_schema_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "schema_release"("id");--> statement-breakpoint
ALTER TABLE "schema_release_label" ADD CONSTRAINT "schema_release_label_bFdXyLkau8cL_fkey" FOREIGN KEY ("release_id","term_id") REFERENCES "schema_release_term"("release_id","term_id");--> statement-breakpoint
ALTER TABLE "schema_release_label" ADD CONSTRAINT "schema_release_label_glKPZbDWupkm_fkey" FOREIGN KEY ("label_id","term_id") REFERENCES "schema_label"("id","term_id");--> statement-breakpoint
ALTER TABLE "schema_release_term" ADD CONSTRAINT "schema_release_term_RHVTUZjJsQ4Y_fkey" FOREIGN KEY ("release_id","vocabulary_id") REFERENCES "schema_release"("id","vocabulary_id");--> statement-breakpoint
ALTER TABLE "schema_release_term" ADD CONSTRAINT "schema_release_term_MXWjw5DuAa8W_fkey" FOREIGN KEY ("definition_id","term_id","vocabulary_id") REFERENCES "schema_definition"("id","term_id","vocabulary_id");--> statement-breakpoint
ALTER TABLE "schema_term_alias" ADD CONSTRAINT "schema_term_alias_term_id_schema_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "schema_term"("id");--> statement-breakpoint
ALTER TABLE "schema_vocabulary_head" ADD CONSTRAINT "schema_vocabulary_head_vocabulary_id_schema_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "schema_vocabulary"("id");--> statement-breakpoint
ALTER TABLE "schema_vocabulary_head" ADD CONSTRAINT "schema_vocabulary_head_cSN2wTj3S6pz_fkey" FOREIGN KEY ("release_id","vocabulary_id") REFERENCES "schema_release"("id","vocabulary_id");