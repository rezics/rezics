-- atlas:txmode none

SET search_path TO public;

-- Metadata-first judgment cutover. The affected API write paths must be paused before this stage.
-- Replacement indexes are built concurrently; Atlas executes this migration with txmode none.

ALTER TYPE public.unit_merge_operation_phase RENAME VALUE 'realm_tag_votes' TO 'realm_tag_judgments';

DROP TRIGGER IF EXISTS realm_tag_vote_realm_tag_voting_enabled ON public.realm_tag_vote;
DROP TRIGGER IF EXISTS realm_tag_vote_stat_maintain ON public.realm_tag_vote;
DROP TRIGGER IF EXISTS unit_structure_application_vote_stat_maintain ON public.unit_structure_application_vote;
DROP TRIGGER IF EXISTS unit_structure_application_vote_support_maintain ON public.unit_structure_application_vote;
DROP TRIGGER IF EXISTS unit_structure_application_vote_tag_conflict ON public.unit_structure_application_vote;
DROP TRIGGER IF EXISTS unit_tag_vote_effective_maintain ON public.unit_tag_vote;
DROP TRIGGER IF EXISTS unit_tag_vote_structure_conflict ON public.unit_tag_vote;
DROP TRIGGER IF EXISTS unit_tag_vote_stat_maintain ON public.unit_effective_tag_vote;
DROP TRIGGER IF EXISTS unit_structure_definition_validate ON public.unit_structure;
DROP TRIGGER IF EXISTS unit_structure_definition_project ON public.unit_structure;

DROP FUNCTION IF EXISTS public.enforce_realm_tag_voting_enabled();
DROP FUNCTION IF EXISTS public.maintain_realm_tag_vote_stat();
DROP FUNCTION IF EXISTS public.maintain_unit_structure_application_vote_stat();
DROP FUNCTION IF EXISTS public.maintain_unit_tag_vote_stat();
DROP FUNCTION IF EXISTS public.maintain_effective_tag_from_direct_vote();
DROP FUNCTION IF EXISTS public.maintain_structure_application_support();
DROP FUNCTION IF EXISTS public.reject_conflicting_direct_tag_vote();
DROP FUNCTION IF EXISTS public.reject_conflicting_structure_application_vote();
DROP FUNCTION IF EXISTS public.refresh_unit_structure_application_vote_stat(uuid, uuid);
DROP FUNCTION IF EXISTS public.refresh_unit_effective_tag_vote(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.prepare_unit_structure_definition();
DROP FUNCTION IF EXISTS public.project_unit_structure_definition();

ALTER TABLE public.unit_tag_vote RENAME TO unit_tag_judgment;
ALTER TABLE public.unit_tag_judgment RENAME COLUMN value TO fit_vote;
ALTER TABLE public.unit_tag_judgment ALTER COLUMN fit_vote DROP NOT NULL;
ALTER TABLE public.unit_tag_judgment
	ADD COLUMN spoiler_level smallint,
	ADD COLUMN fit_updated_at timestamp(3) with time zone,
	ADD COLUMN spoiler_updated_at timestamp(3) with time zone;
ALTER TABLE public.unit_tag_judgment DROP CONSTRAINT unit_tag_vote_value_check;
ALTER TABLE public.unit_tag_judgment RENAME CONSTRAINT unit_tag_vote_pkey TO unit_tag_judgment_pkey;
ALTER TABLE public.unit_tag_judgment RENAME CONSTRAINT unit_tag_vote_profile_id_profile_id_fkey TO unit_tag_judgment_profile_id_profile_id_fkey;
ALTER TABLE public.unit_tag_judgment RENAME CONSTRAINT unit_tag_vote_tag_id_tag_id_fkey TO unit_tag_judgment_tag_id_tag_id_fkey;
ALTER TABLE public.unit_tag_judgment RENAME CONSTRAINT unit_tag_vote_unit_id_unit_id_fkey TO unit_tag_judgment_unit_id_unit_id_fkey;
ALTER TABLE public.unit_tag_judgment RENAME CONSTRAINT unit_tag_vote_unit_tag_fkey TO unit_tag_judgment_unit_tag_fkey;
ALTER TABLE public.unit_tag_judgment RENAME CONSTRAINT unit_tag_vote_not_self_check TO unit_tag_judgment_not_self_check;
ALTER TABLE public.unit_tag_judgment
	ADD CONSTRAINT unit_tag_judgment_fit_vote_check CHECK (fit_vote IS NULL OR fit_vote IN (-1, 1)) NOT VALID,
	ADD CONSTRAINT unit_tag_judgment_spoiler_level_check CHECK (spoiler_level IS NULL OR spoiler_level BETWEEN 0 AND 2) NOT VALID,
	ADD CONSTRAINT unit_tag_judgment_sparse_check CHECK (fit_vote IS NOT NULL OR spoiler_level IS NOT NULL) NOT VALID,
	ADD CONSTRAINT unit_tag_judgment_fit_timestamp_check CHECK ((fit_vote IS NULL) = (fit_updated_at IS NULL)) NOT VALID,
	ADD CONSTRAINT unit_tag_judgment_spoiler_timestamp_check CHECK ((spoiler_level IS NULL) = (spoiler_updated_at IS NULL)) NOT VALID;
CREATE INDEX CONCURRENTLY unit_tag_judgment_tag_unit_idx ON public.unit_tag_judgment (tag_id, unit_id);
CREATE INDEX CONCURRENTLY unit_tag_judgment_profile_unit_tag_idx ON public.unit_tag_judgment (profile_id, unit_id, tag_id);
DROP INDEX public.unit_tag_vote_tag_idx;
DROP INDEX public.unit_tag_vote_profile_idx;

ALTER TABLE public.unit_tag_vote_stat RENAME TO unit_tag_judgment_stat;
ALTER TABLE public.unit_tag_judgment_stat
	ADD COLUMN spoiler_vote_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_none_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_minor_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_major_count bigint DEFAULT 0 NOT NULL;
ALTER TABLE public.unit_tag_judgment_stat RENAME CONSTRAINT unit_tag_vote_stat_pkey TO unit_tag_judgment_stat_pkey;
ALTER TABLE public.unit_tag_judgment_stat RENAME CONSTRAINT unit_tag_vote_stat_effective_tag_fkey TO unit_tag_judgment_stat_effective_tag_fkey;
ALTER TABLE public.unit_tag_judgment_stat RENAME CONSTRAINT unit_tag_vote_stat_count_check TO unit_tag_judgment_stat_count_check;
ALTER TABLE public.unit_tag_judgment_stat RENAME CONSTRAINT unit_tag_vote_stat_score_check TO unit_tag_judgment_stat_score_check;
ALTER TABLE public.unit_tag_judgment_stat RENAME CONSTRAINT unit_tag_vote_stat_parity_check TO unit_tag_judgment_stat_parity_check;
ALTER TABLE public.unit_tag_judgment_stat
	ADD CONSTRAINT unit_tag_judgment_stat_spoiler_count_check CHECK (
		spoiler_vote_count = spoiler_none_count + spoiler_minor_count + spoiler_major_count
	) NOT VALID;

ALTER TABLE public.unit_structure_application_vote RENAME TO unit_structure_application_judgment;
ALTER TABLE public.unit_structure_application_judgment RENAME COLUMN value TO fit_vote;
ALTER TABLE public.unit_structure_application_judgment ALTER COLUMN fit_vote DROP NOT NULL;
ALTER TABLE public.unit_structure_application_judgment
	ADD COLUMN spoiler_level smallint,
	ADD COLUMN fit_updated_at timestamp(3) with time zone,
	ADD COLUMN spoiler_updated_at timestamp(3) with time zone;
ALTER TABLE public.unit_structure_application_judgment DROP CONSTRAINT unit_structure_application_vote_value_check;
ALTER TABLE public.unit_structure_application_judgment RENAME CONSTRAINT unit_structure_application_vote_pkey TO unit_structure_application_judgment_pkey;
ALTER TABLE public.unit_structure_application_judgment RENAME CONSTRAINT unit_structure_application_vote_application_fkey TO unit_structure_application_judgment_application_fkey;
ALTER TABLE public.unit_structure_application_judgment RENAME CONSTRAINT unit_structure_application_vote_profile_id_profile_id_fkey TO unit_structure_application_judgment_profile_id_profile_id_fkey;
ALTER TABLE public.unit_structure_application_judgment
	ADD CONSTRAINT unit_structure_application_judgment_fit_vote_check CHECK (fit_vote IS NULL OR fit_vote IN (-1, 1)) NOT VALID,
	ADD CONSTRAINT unit_structure_application_judgment_spoiler_level_check CHECK (spoiler_level IS NULL OR spoiler_level BETWEEN 0 AND 2) NOT VALID,
	ADD CONSTRAINT unit_structure_application_judgment_sparse_check CHECK (fit_vote IS NOT NULL OR spoiler_level IS NOT NULL) NOT VALID,
	ADD CONSTRAINT unit_structure_application_judgment_fit_timestamp_check CHECK ((fit_vote IS NULL) = (fit_updated_at IS NULL)) NOT VALID,
	ADD CONSTRAINT unit_structure_application_judgment_spoiler_timestamp_check CHECK ((spoiler_level IS NULL) = (spoiler_updated_at IS NULL)) NOT VALID;
CREATE INDEX CONCURRENTLY unit_structure_application_judgment_profile_idx ON public.unit_structure_application_judgment (profile_id, unit_id, structure_id);
DROP INDEX public.unit_structure_application_vote_profile_idx;
ALTER TRIGGER reject_merged_unit_unit_structure_application_vote_unit_id ON public.unit_structure_application_judgment RENAME TO reject_merged_unit_unit_structure_application_judgment_unit_id;
ALTER TABLE public.unit_tag_structure_support RENAME CONSTRAINT unit_tag_structure_support_application_vote_fkey TO unit_tag_structure_support_application_judgment_fkey;

ALTER TABLE public.unit_structure_application_vote_stat RENAME TO unit_structure_application_judgment_stat;
ALTER TABLE public.unit_structure_application_judgment_stat
	ADD COLUMN spoiler_vote_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_none_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_minor_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_major_count bigint DEFAULT 0 NOT NULL;
ALTER TABLE public.unit_structure_application_judgment_stat RENAME CONSTRAINT unit_structure_application_vote_stat_pkey TO unit_structure_application_judgment_stat_pkey;
ALTER TABLE public.unit_structure_application_judgment_stat RENAME CONSTRAINT unit_structure_application_vote_stat_application_fkey TO unit_structure_application_judgment_stat_application_fkey;
ALTER TABLE public.unit_structure_application_judgment_stat RENAME CONSTRAINT unit_structure_application_vote_stat_count_check TO unit_structure_application_judgment_stat_count_check;
ALTER TABLE public.unit_structure_application_judgment_stat RENAME CONSTRAINT unit_structure_application_vote_stat_score_check TO unit_structure_application_judgment_stat_score_check;
ALTER TABLE public.unit_structure_application_judgment_stat RENAME CONSTRAINT unit_structure_application_vote_stat_parity_check TO unit_structure_application_judgment_stat_parity_check;
ALTER TABLE public.unit_structure_application_judgment_stat
	ADD CONSTRAINT unit_structure_application_judgment_stat_spoiler_count_check CHECK (
		spoiler_vote_count = spoiler_none_count + spoiler_minor_count + spoiler_major_count
	) NOT VALID;

ALTER TABLE public.realm_tag_vote RENAME TO realm_tag_judgment;
ALTER TABLE public.realm_tag_judgment RENAME COLUMN value TO fit_vote;
ALTER TABLE public.realm_tag_judgment ALTER COLUMN fit_vote DROP NOT NULL;
ALTER TABLE public.realm_tag_judgment
	ADD COLUMN spoiler_level smallint,
	ADD COLUMN fit_updated_at timestamp(3) with time zone,
	ADD COLUMN spoiler_updated_at timestamp(3) with time zone;
ALTER TABLE public.realm_tag_judgment DROP CONSTRAINT realm_tag_vote_value_check;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_pkey TO realm_tag_judgment_pkey;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_profile_id_profile_id_fkey TO realm_tag_judgment_profile_id_profile_id_fkey;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_realm_fkey TO realm_tag_judgment_realm_fkey;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_unit_fkey TO realm_tag_judgment_unit_fkey;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_tag_fkey TO realm_tag_judgment_tag_fkey;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_context_fkey TO realm_tag_judgment_context_fkey;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_not_self_check TO realm_tag_judgment_not_self_check;
ALTER TABLE public.realm_tag_judgment
	ADD CONSTRAINT realm_tag_judgment_fit_vote_check CHECK (fit_vote IS NULL OR fit_vote IN (-1, 1)) NOT VALID,
	ADD CONSTRAINT realm_tag_judgment_spoiler_level_check CHECK (spoiler_level IS NULL OR spoiler_level BETWEEN 0 AND 2) NOT VALID,
	ADD CONSTRAINT realm_tag_judgment_sparse_check CHECK (fit_vote IS NOT NULL OR spoiler_level IS NOT NULL) NOT VALID,
	ADD CONSTRAINT realm_tag_judgment_fit_timestamp_check CHECK ((fit_vote IS NULL) = (fit_updated_at IS NULL)) NOT VALID,
	ADD CONSTRAINT realm_tag_judgment_spoiler_timestamp_check CHECK ((spoiler_level IS NULL) = (spoiler_updated_at IS NULL)) NOT VALID;
CREATE INDEX CONCURRENTLY realm_tag_judgment_profile_route_idx ON public.realm_tag_judgment (profile_id, realm_id, unit_id, tag_id);
ALTER INDEX public.realm_tag_vote_realm_tag_unit_idx RENAME TO realm_tag_judgment_realm_tag_unit_idx;
ALTER INDEX public.realm_tag_vote_unit_merge_idx RENAME TO realm_tag_judgment_unit_merge_idx;
DROP INDEX public.realm_tag_vote_profile_idx;
ALTER TRIGGER reject_merged_unit_realm_tag_vote_unit_id ON public.realm_tag_judgment RENAME TO reject_merged_unit_realm_tag_judgment_unit_id;

ALTER TABLE public.realm_tag_vote_stat RENAME TO realm_tag_judgment_stat;
ALTER TABLE public.realm_tag_judgment_stat
	ADD COLUMN spoiler_vote_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_none_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_minor_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_major_count bigint DEFAULT 0 NOT NULL;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_pkey TO realm_tag_judgment_stat_pkey;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_realm_fkey TO realm_tag_judgment_stat_realm_fkey;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_unit_fkey TO realm_tag_judgment_stat_unit_fkey;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_tag_fkey TO realm_tag_judgment_stat_tag_fkey;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_context_fkey TO realm_tag_judgment_stat_context_fkey;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_count_check TO realm_tag_judgment_stat_count_check;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_score_check TO realm_tag_judgment_stat_score_check;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_parity_check TO realm_tag_judgment_stat_parity_check;
ALTER INDEX public.realm_tag_vote_stat_realm_tag_unit_idx RENAME TO realm_tag_judgment_stat_realm_tag_unit_idx;
ALTER TABLE public.realm_tag_judgment_stat
	ADD CONSTRAINT realm_tag_judgment_stat_spoiler_count_check CHECK (
		spoiler_vote_count = spoiler_none_count + spoiler_minor_count + spoiler_major_count
	) NOT VALID;

-- Create "entity_measurement" table
CREATE TABLE "entity_measurement" (
  "entity_id" uuid NOT NULL,
  "context_unit_id" uuid NULL,
  "height_millimetres" integer NULL,
  "weight_grams" integer NULL,
  "bust_millimetres" integer NULL,
  "waist_millimetres" integer NULL,
  "hips_millimetres" integer NULL,
  "source_url" text NOT NULL,
  "source_imported_at" timestamptz(3) NOT NULL,
  "source_provenance" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "entity_measurement_entity_context_key" UNIQUE NULLS NOT DISTINCT ("entity_id", "context_unit_id"),
  CONSTRAINT "entity_measurement_context_unit_id_unit_id_fkey" FOREIGN KEY ("context_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_measurement_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "entity_measurement_context_not_self_check" CHECK ((context_unit_id IS NULL) OR (context_unit_id <> entity_id)),
  CONSTRAINT "entity_measurement_positive_check" CHECK (COALESCE((height_millimetres > 0), true) AND COALESCE((weight_grams > 0), true) AND COALESCE((bust_millimetres > 0), true) AND COALESCE((waist_millimetres > 0), true) AND COALESCE((hips_millimetres > 0), true)),
  CONSTRAINT "entity_measurement_source_provenance_check" CHECK (jsonb_typeof(source_provenance) = 'object'::text),
  CONSTRAINT "entity_measurement_source_url_check" CHECK (btrim(source_url) <> ''::text),
  CONSTRAINT "entity_measurement_value_present_check" CHECK (num_nonnulls(height_millimetres, weight_grams, bust_millimetres, waist_millimetres, hips_millimetres) > 0)
);
-- Create index "entity_measurement_context_idx" to table: "entity_measurement"
CREATE INDEX "entity_measurement_context_idx" ON "entity_measurement" ("context_unit_id", "entity_id") WHERE (context_unit_id IS NOT NULL);
-- Create "subject_association_judgment" table
CREATE TABLE "subject_association_judgment" (
  "association_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "spoiler_level" smallint NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("association_id", "profile_id"),
  CONSTRAINT "subject_association_judgment_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "subject_association_judgment_uo93BqITkQjw_fkey" FOREIGN KEY ("association_id") REFERENCES "subject_association" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "subject_association_judgment_spoiler_level_check" CHECK ((spoiler_level >= 0) AND (spoiler_level <= 2))
);
-- Create index "subject_association_judgment_profile_idx" to table: "subject_association_judgment"
CREATE INDEX "subject_association_judgment_profile_idx" ON "subject_association_judgment" ("profile_id", "association_id");
-- Create "subject_association_judgment_stat" table
CREATE TABLE "subject_association_judgment_stat" (
  "association_id" uuid NOT NULL,
  "spoiler_vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_none_count" bigint NOT NULL DEFAULT 0,
  "spoiler_minor_count" bigint NOT NULL DEFAULT 0,
  "spoiler_major_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("association_id"),
  CONSTRAINT "subject_association_judgment_stat_9yJeuJ2l9fWh_fkey" FOREIGN KEY ("association_id") REFERENCES "subject_association" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "subject_association_judgment_stat_spoiler_count_check" CHECK (spoiler_vote_count = ((spoiler_none_count + spoiler_minor_count) + spoiler_major_count))
);
-- Modify "tag" table
ALTER TABLE "tag" ADD CONSTRAINT "tag_default_spoiler_level_check" CHECK ((default_spoiler_level IS NULL) OR ((default_spoiler_level >= 0) AND (default_spoiler_level <= 2))), ADD COLUMN "directly_applicable" boolean NOT NULL DEFAULT true, ADD COLUMN "default_spoiler_level" smallint NULL;
-- Create "unit_structure_end" table
CREATE TABLE "unit_structure_end" (
  "structure_id" uuid NOT NULL,
  "final_tag_id" uuid NOT NULL,
  PRIMARY KEY ("structure_id"),
  CONSTRAINT "unit_structure_end_structure_tag_key" UNIQUE ("structure_id", "final_tag_id"),
  CONSTRAINT "unit_structure_end_final_tag_id_tag_id_fkey" FOREIGN KEY ("final_tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_structure_end_structure_id_unit_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "unit_structure" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "unit_structure_end_tag_idx" to table: "unit_structure_end"
CREATE INDEX "unit_structure_end_tag_idx" ON "unit_structure_end" ("final_tag_id", "structure_id");
-- Create "tag_primary_display_path" table
CREATE TABLE "tag_primary_display_path" (
  "tag_id" uuid NOT NULL,
  "structure_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("tag_id"),
  CONSTRAINT "tag_primary_display_path_structure_end_fkey" FOREIGN KEY ("structure_id", "tag_id") REFERENCES "unit_structure_end" ("structure_id", "final_tag_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_primary_display_path_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "tag_primary_display_path_structure_idx" to table: "tag_primary_display_path"
CREATE INDEX "tag_primary_display_path_structure_idx" ON "tag_primary_display_path" ("structure_id", "tag_id");

-- Canonical PostgreSQL functions and triggers for the vndb-v11 Phase 0 contract.
-- Tables, columns, constraints, and indexes remain owned by the Drizzle schema.

CREATE OR REPLACE FUNCTION public.enforce_realm_tag_judgment_enabled() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	PERFORM 1
	FROM public.realm
	WHERE id = NEW.realm_id
		AND realm_tag_voting_enabled
	FOR SHARE;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'Realm-scoped Tag judgment is not enabled for Realm %', NEW.realm_id
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'realm_tag_judgment_realm_tag_voting_enabled';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_effective_tag_vote(
	target_unit_id uuid,
	target_tag_id uuid,
	target_profile_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	direct_value integer;
	has_structure_support boolean;
BEGIN
	PERFORM public.lock_unit_effective_tag_vote_key(
		target_unit_id,
		target_tag_id,
		target_profile_id
	);
	SELECT fit_vote
	INTO direct_value
	FROM public.unit_tag_judgment
	WHERE unit_id = target_unit_id
		AND tag_id = target_tag_id
		AND profile_id = target_profile_id;
	SELECT EXISTS (
		SELECT 1
		FROM public.unit_tag_structure_support
		WHERE unit_id = target_unit_id
			AND tag_id = target_tag_id
			AND profile_id = target_profile_id
	)
	INTO has_structure_support;

	IF direct_value IS NOT NULL OR has_structure_support THEN
		INSERT INTO public.unit_effective_tag_vote (
			unit_id,
			tag_id,
			profile_id,
			value
		)
		VALUES (
			target_unit_id,
			target_tag_id,
			target_profile_id,
			coalesce(direct_value, 1)
		)
		ON CONFLICT (unit_id, tag_id, profile_id) DO UPDATE SET
			value = excluded.value,
			updated_at = now();
	ELSE
		DELETE FROM public.unit_effective_tag_vote
		WHERE unit_id = target_unit_id
			AND tag_id = target_tag_id
			AND profile_id = target_profile_id;
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_tag_judgment_stat(
	target_unit_id uuid,
	target_tag_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	fit_score bigint;
	fit_count bigint;
	spoiler_count bigint;
	none_count bigint;
	minor_count bigint;
	major_count bigint;
BEGIN
	PERFORM public.lock_unit_effective_tag_key(target_unit_id, target_tag_id);
	SELECT coalesce(sum(value), 0)::bigint, count(*)::bigint
	INTO fit_score, fit_count
	FROM public.unit_effective_tag_vote
	WHERE unit_id = target_unit_id
		AND tag_id = target_tag_id;
	SELECT
		count(spoiler_level)::bigint,
		count(*) FILTER (WHERE spoiler_level = 0)::bigint,
		count(*) FILTER (WHERE spoiler_level = 1)::bigint,
		count(*) FILTER (WHERE spoiler_level = 2)::bigint
	INTO spoiler_count, none_count, minor_count, major_count
	FROM public.unit_tag_judgment
	WHERE unit_id = target_unit_id
		AND tag_id = target_tag_id;

	IF (fit_count > 0 OR spoiler_count > 0) AND EXISTS (
		SELECT 1
		FROM public.unit_effective_tag
		WHERE unit_id = target_unit_id
			AND tag_id = target_tag_id
	) THEN
		INSERT INTO public.unit_tag_judgment_stat (
			unit_id,
			tag_id,
			score,
			vote_count,
			spoiler_vote_count,
			spoiler_none_count,
			spoiler_minor_count,
			spoiler_major_count
		)
		VALUES (
			target_unit_id,
			target_tag_id,
			fit_score,
			fit_count,
			spoiler_count,
			none_count,
			minor_count,
			major_count
		)
		ON CONFLICT (unit_id, tag_id) DO UPDATE SET
			score = excluded.score,
			vote_count = excluded.vote_count,
			spoiler_vote_count = excluded.spoiler_vote_count,
			spoiler_none_count = excluded.spoiler_none_count,
			spoiler_minor_count = excluded.spoiler_minor_count,
			spoiler_major_count = excluded.spoiler_major_count,
			updated_at = now();
	ELSE
		DELETE FROM public.unit_tag_judgment_stat
		WHERE unit_id = target_unit_id
			AND tag_id = target_tag_id;
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_effective_tag_from_direct_judgment() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP <> 'INSERT' THEN
		PERFORM public.refresh_unit_effective_tag_vote(
			OLD.unit_id,
			OLD.tag_id,
			OLD.profile_id
		);
		PERFORM public.refresh_unit_tag_judgment_stat(OLD.unit_id, OLD.tag_id);
	END IF;
	IF TG_OP <> 'DELETE' THEN
		PERFORM public.refresh_unit_effective_tag_vote(
			NEW.unit_id,
			NEW.tag_id,
			NEW.profile_id
		);
		PERFORM public.refresh_unit_tag_judgment_stat(NEW.unit_id, NEW.tag_id);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_judgment_stat() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP <> 'INSERT' THEN
		PERFORM public.refresh_unit_tag_judgment_stat(OLD.unit_id, OLD.tag_id);
	END IF;
	IF TG_OP <> 'DELETE' AND (
		TG_OP = 'INSERT'
		OR (NEW.unit_id, NEW.tag_id) IS DISTINCT FROM (OLD.unit_id, OLD.tag_id)
	) THEN
		PERFORM public.refresh_unit_tag_judgment_stat(NEW.unit_id, NEW.tag_id);
	END IF;
	RETURN NULL;
END;
$$;

-- End effective judgment functions.

CREATE OR REPLACE FUNCTION public.maintain_structure_application_support() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP <> 'INSERT'
		AND OLD.fit_vote = 1
		AND (
			TG_OP = 'DELETE'
			OR (NEW.unit_id, NEW.structure_id, NEW.profile_id, NEW.fit_vote)
				IS DISTINCT FROM
				(OLD.unit_id, OLD.structure_id, OLD.profile_id, OLD.fit_vote)
		)
	THEN
		DELETE FROM public.unit_tag_structure_support
		WHERE unit_id = OLD.unit_id
			AND structure_id = OLD.structure_id
			AND profile_id = OLD.profile_id;
	END IF;
	IF TG_OP <> 'DELETE'
		AND NEW.fit_vote = 1
		AND (
			TG_OP = 'INSERT'
			OR (NEW.unit_id, NEW.structure_id, NEW.profile_id, NEW.fit_vote)
				IS DISTINCT FROM
				(OLD.unit_id, OLD.structure_id, OLD.profile_id, OLD.fit_vote)
		)
	THEN
		INSERT INTO public.unit_tag_structure_support (
			unit_id,
			tag_id,
			profile_id,
			structure_id
		)
		SELECT
			NEW.unit_id,
			member.member_unit_id,
			NEW.profile_id,
			NEW.structure_id
		FROM public.unit_structure_member AS member
		WHERE member.structure_id = NEW.structure_id
		ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_structure_application_judgment_stat(
	target_unit_id uuid,
	target_structure_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	fit_score bigint;
	fit_count bigint;
	spoiler_count bigint;
	none_count bigint;
	minor_count bigint;
	major_count bigint;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtextextended(
		target_unit_id::text || ':' || target_structure_id::text,
		71004
	));
	IF NOT EXISTS (
		SELECT 1
		FROM public.unit_structure_application
		WHERE unit_id = target_unit_id
			AND structure_id = target_structure_id
	) THEN
		DELETE FROM public.unit_structure_application_judgment_stat
		WHERE unit_id = target_unit_id
			AND structure_id = target_structure_id;
		RETURN;
	END IF;
	SELECT
		coalesce(sum(fit_vote), 0)::bigint,
		count(fit_vote)::bigint,
		count(spoiler_level)::bigint,
		count(*) FILTER (WHERE spoiler_level = 0)::bigint,
		count(*) FILTER (WHERE spoiler_level = 1)::bigint,
		count(*) FILTER (WHERE spoiler_level = 2)::bigint
	INTO
		fit_score,
		fit_count,
		spoiler_count,
		none_count,
		minor_count,
		major_count
	FROM public.unit_structure_application_judgment
	WHERE unit_id = target_unit_id
		AND structure_id = target_structure_id;

	IF fit_count > 0 OR spoiler_count > 0 THEN
		INSERT INTO public.unit_structure_application_judgment_stat (
			unit_id,
			structure_id,
			score,
			vote_count,
			spoiler_vote_count,
			spoiler_none_count,
			spoiler_minor_count,
			spoiler_major_count
		)
		VALUES (
			target_unit_id,
			target_structure_id,
			fit_score,
			fit_count,
			spoiler_count,
			none_count,
			minor_count,
			major_count
		)
		ON CONFLICT (unit_id, structure_id) DO UPDATE SET
			score = excluded.score,
			vote_count = excluded.vote_count,
			spoiler_vote_count = excluded.spoiler_vote_count,
			spoiler_none_count = excluded.spoiler_none_count,
			spoiler_minor_count = excluded.spoiler_minor_count,
			spoiler_major_count = excluded.spoiler_major_count,
			updated_at = now();
	ELSE
		DELETE FROM public.unit_structure_application_judgment_stat
		WHERE unit_id = target_unit_id
			AND structure_id = target_structure_id;
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_structure_application_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP <> 'INSERT' THEN
		PERFORM public.refresh_unit_structure_application_judgment_stat(
			OLD.unit_id,
			OLD.structure_id
		);
	END IF;
	IF TG_OP <> 'DELETE' AND (
		TG_OP = 'INSERT'
		OR (NEW.unit_id, NEW.structure_id)
			IS DISTINCT FROM (OLD.unit_id, OLD.structure_id)
	) THEN
		PERFORM public.refresh_unit_structure_application_judgment_stat(
			NEW.unit_id,
			NEW.structure_id
		);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_tag_judgment_stat() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP <> 'INSERT' THEN
		UPDATE public.realm_tag_judgment_stat
		SET
			score = score - coalesce(OLD.fit_vote, 0),
			vote_count = vote_count - (OLD.fit_vote IS NOT NULL)::integer,
			spoiler_vote_count = spoiler_vote_count - (OLD.spoiler_level IS NOT NULL)::integer,
			spoiler_none_count = spoiler_none_count
				- coalesce((OLD.spoiler_level = 0)::integer, 0),
			spoiler_minor_count = spoiler_minor_count
				- coalesce((OLD.spoiler_level = 1)::integer, 0),
			spoiler_major_count = spoiler_major_count
				- coalesce((OLD.spoiler_level = 2)::integer, 0),
			updated_at = now()
		WHERE realm_id = OLD.realm_id
			AND unit_id = OLD.unit_id
			AND tag_id = OLD.tag_id;
		IF NOT FOUND AND EXISTS (
			SELECT 1
			FROM public.realm_tag_context
			WHERE realm_id = OLD.realm_id
				AND tag_id = OLD.tag_id
		) THEN
			RAISE EXCEPTION 'missing realm_tag_judgment_stat row for decrement: %, %, %',
				OLD.realm_id, OLD.unit_id, OLD.tag_id
				USING ERRCODE = '23514';
		END IF;
		DELETE FROM public.realm_tag_judgment_stat
		WHERE realm_id = OLD.realm_id
			AND unit_id = OLD.unit_id
			AND tag_id = OLD.tag_id
			AND vote_count = 0
			AND spoiler_vote_count = 0;
	END IF;

	IF TG_OP <> 'DELETE' THEN
		INSERT INTO public.realm_tag_judgment_stat (
			realm_id,
			unit_id,
			tag_id,
			score,
			vote_count,
			spoiler_vote_count,
			spoiler_none_count,
			spoiler_minor_count,
			spoiler_major_count
		)
		VALUES (
			NEW.realm_id,
			NEW.unit_id,
			NEW.tag_id,
			coalesce(NEW.fit_vote, 0),
			(NEW.fit_vote IS NOT NULL)::integer,
			(NEW.spoiler_level IS NOT NULL)::integer,
			coalesce((NEW.spoiler_level = 0)::integer, 0),
			coalesce((NEW.spoiler_level = 1)::integer, 0),
			coalesce((NEW.spoiler_level = 2)::integer, 0)
		)
		ON CONFLICT (realm_id, unit_id, tag_id) DO UPDATE SET
			score = public.realm_tag_judgment_stat.score + excluded.score,
			vote_count = public.realm_tag_judgment_stat.vote_count + excluded.vote_count,
			spoiler_vote_count = public.realm_tag_judgment_stat.spoiler_vote_count
				+ excluded.spoiler_vote_count,
			spoiler_none_count = public.realm_tag_judgment_stat.spoiler_none_count
				+ excluded.spoiler_none_count,
			spoiler_minor_count = public.realm_tag_judgment_stat.spoiler_minor_count
				+ excluded.spoiler_minor_count,
			spoiler_major_count = public.realm_tag_judgment_stat.spoiler_major_count
				+ excluded.spoiler_major_count,
			updated_at = now();
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_subject_association_judgment_stat() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP <> 'INSERT' THEN
		UPDATE public.subject_association_judgment_stat
		SET
			spoiler_vote_count = spoiler_vote_count - 1,
			spoiler_none_count = spoiler_none_count - (OLD.spoiler_level = 0)::integer,
			spoiler_minor_count = spoiler_minor_count - (OLD.spoiler_level = 1)::integer,
			spoiler_major_count = spoiler_major_count - (OLD.spoiler_level = 2)::integer,
			updated_at = now()
		WHERE association_id = OLD.association_id;
		IF NOT FOUND AND EXISTS (
			SELECT 1
			FROM public.subject_association
			WHERE id = OLD.association_id
		) THEN
			RAISE EXCEPTION 'missing subject_association_judgment_stat row for decrement: %',
				OLD.association_id
				USING ERRCODE = '23514';
		END IF;
		DELETE FROM public.subject_association_judgment_stat
		WHERE association_id = OLD.association_id
			AND spoiler_vote_count = 0;
	END IF;

	IF TG_OP <> 'DELETE' THEN
		INSERT INTO public.subject_association_judgment_stat (
			association_id,
			spoiler_vote_count,
			spoiler_none_count,
			spoiler_minor_count,
			spoiler_major_count
		)
		VALUES (
			NEW.association_id,
			1,
			(NEW.spoiler_level = 0)::integer,
			(NEW.spoiler_level = 1)::integer,
			(NEW.spoiler_level = 2)::integer
		)
		ON CONFLICT (association_id) DO UPDATE SET
			spoiler_vote_count = public.subject_association_judgment_stat.spoiler_vote_count + 1,
			spoiler_none_count = public.subject_association_judgment_stat.spoiler_none_count
				+ excluded.spoiler_none_count,
			spoiler_minor_count = public.subject_association_judgment_stat.spoiler_minor_count
				+ excluded.spoiler_minor_count,
			spoiler_major_count = public.subject_association_judgment_stat.spoiler_major_count
				+ excluded.spoiler_major_count,
			updated_at = now();
	END IF;
	RETURN NULL;
END;
$$;

-- End judgment aggregate functions.

CREATE OR REPLACE FUNCTION public.reject_conflicting_direct_tag_judgment() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	PERFORM public.lock_unit_effective_tag_vote_key(
		NEW.unit_id,
		NEW.tag_id,
		NEW.profile_id
	);
	IF NEW.fit_vote = -1 AND EXISTS (
		SELECT 1
		FROM public.unit_tag_structure_support
		WHERE unit_id = NEW.unit_id
			AND tag_id = NEW.tag_id
			AND profile_id = NEW.profile_id
	) THEN
		RAISE EXCEPTION 'A negative direct Tag judgment conflicts with positive structure support'
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_conflicting_structure_application_judgment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	PERFORM public.lock_unit_structure_definition_key(NEW.structure_id);
	IF EXISTS (
		SELECT 1
		FROM public.unit_structure_member
		WHERE structure_id = NEW.structure_id
			AND member_unit_id = NEW.unit_id
	) THEN
		RAISE EXCEPTION 'A Tag hierarchy path cannot be applied to one of its members'
			USING ERRCODE = '23514';
	END IF;
	PERFORM public.lock_unit_effective_tag_vote_key(
		NEW.unit_id,
		member.member_unit_id,
		NEW.profile_id
	)
	FROM public.unit_structure_member AS member
	WHERE member.structure_id = NEW.structure_id
	ORDER BY member.member_unit_id;
	IF NEW.fit_vote = 1 AND EXISTS (
		SELECT 1
		FROM public.unit_structure_member AS member
		JOIN public.unit_tag_judgment AS direct_judgment
			ON direct_judgment.unit_id = NEW.unit_id
			AND direct_judgment.tag_id = member.member_unit_id
			AND direct_judgment.profile_id = NEW.profile_id
			AND direct_judgment.fit_vote = -1
		WHERE member.structure_id = NEW.structure_id
	) THEN
		RAISE EXCEPTION 'Positive structure support conflicts with a negative direct Tag judgment'
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_unit_structure_definition() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	invalid_member_count integer;
BEGIN
	IF cardinality(NEW.member_unit_ids) <> (
		SELECT count(DISTINCT member_id)
		FROM unnest(NEW.member_unit_ids) AS member_id
	) THEN
		RAISE EXCEPTION 'Unit structure members must be distinct'
			USING ERRCODE = '23514';
	END IF;
	IF NEW.kind = 'tag.hierarchy_path' THEN
		SELECT count(*)
		INTO invalid_member_count
		FROM unnest(NEW.member_unit_ids) AS member_id
		LEFT JOIN public.tag ON tag.id = member_id
		LEFT JOIN public.unit ON unit.id = member_id
		WHERE tag.id IS NULL
			OR unit.kind <> 'tag'
			OR unit.status <> 'published'
			OR unit.visibility <> 'public'
			OR unit.moderation_status <> 'approved'
			OR unit.deleted_at IS NOT NULL;
		IF invalid_member_count <> 0 THEN
			RAISE EXCEPTION 'Tag hierarchy paths require active public Tag members'
				USING ERRCODE = '23514';
		END IF;
	ELSE
		RAISE EXCEPTION 'Unsupported Unit structure kind: %', NEW.kind
			USING ERRCODE = '23514';
	END IF;
	IF TG_OP = 'UPDATE' THEN
		PERFORM public.lock_unit_structure_definition_key(NEW.id);
		IF EXISTS (
			SELECT 1
			FROM public.unit_structure_application
			WHERE structure_id = NEW.id
				AND unit_id = ANY(NEW.member_unit_ids)
		) THEN
			RAISE EXCEPTION 'A Tag hierarchy path cannot contain an existing application target'
				USING ERRCODE = '23514';
		END IF;
		IF EXISTS (
			SELECT 1
			FROM public.unit_structure_application_judgment AS application_judgment
			CROSS JOIN unnest(NEW.member_unit_ids) AS member_id
			JOIN public.unit_tag_judgment AS direct_judgment
				ON direct_judgment.unit_id = application_judgment.unit_id
				AND direct_judgment.tag_id = member_id
				AND direct_judgment.profile_id = application_judgment.profile_id
				AND direct_judgment.fit_vote = -1
			WHERE application_judgment.structure_id = NEW.id
				AND application_judgment.fit_vote = 1
		) THEN
			RAISE EXCEPTION 'Administrative Structure correction conflicts with a negative direct Tag judgment'
				USING ERRCODE = '23514';
		END IF;
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_unit_structure_definition() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP = 'UPDATE' THEN
		DELETE FROM public.unit_structure_edge
		WHERE structure_id = NEW.id;
		DELETE FROM public.unit_structure_member
		WHERE structure_id = NEW.id;
	END IF;
	INSERT INTO public.unit_structure_member (
		structure_id,
		ordinal,
		member_unit_id
	)
	SELECT NEW.id, member.ordinality - 1, member.id
	FROM unnest(NEW.member_unit_ids) WITH ORDINALITY AS member(id, ordinality);
	INSERT INTO public.unit_structure_edge (
		structure_id,
		ordinal,
		parent_unit_id,
		child_unit_id
	)
	SELECT
		NEW.id,
		member.ordinality - 1,
		member.id,
		NEW.member_unit_ids[member.ordinality + 1]
	FROM unnest(NEW.member_unit_ids) WITH ORDINALITY AS member(id, ordinality)
	WHERE member.ordinality < cardinality(NEW.member_unit_ids);
	INSERT INTO public.unit_structure_end (structure_id, final_tag_id)
	VALUES (
		NEW.id,
		NEW.member_unit_ids[cardinality(NEW.member_unit_ids)]
	)
	ON CONFLICT (structure_id) DO UPDATE SET
		final_tag_id = excluded.final_tag_id;

	IF TG_OP = 'UPDATE' THEN
		INSERT INTO public.unit_tag_structure_support (
			unit_id,
			tag_id,
			profile_id,
			structure_id
		)
		SELECT
			application_judgment.unit_id,
			member.member_unit_id,
			application_judgment.profile_id,
			application_judgment.structure_id
		FROM public.unit_structure_application_judgment AS application_judgment
		JOIN public.unit_structure_member AS member
			ON member.structure_id = application_judgment.structure_id
		WHERE application_judgment.structure_id = NEW.id
			AND application_judgment.fit_vote = 1
		ORDER BY
			application_judgment.unit_id,
			member.member_unit_id,
			application_judgment.profile_id
		ON CONFLICT DO NOTHING;
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_tag_primary_display_path(
	target_tag_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	selected_structure_id uuid;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtextextended(target_tag_id::text, 71005));
	SELECT structure_end.structure_id
	INTO selected_structure_id
	FROM public.unit_structure_end AS structure_end
	JOIN public.unit_structure_vote_stat AS vote_stat
		ON vote_stat.structure_id = structure_end.structure_id
	WHERE structure_end.final_tag_id = target_tag_id
		AND vote_stat.score > 0
	ORDER BY
		(
			(
				(
					(vote_stat.vote_count::numeric + vote_stat.score::numeric)
						/ (2 * vote_stat.vote_count::numeric)
				)
				+ (1.96 * 1.96) / (2 * vote_stat.vote_count::numeric)
				- 1.96 * sqrt(
					(
						(
							(
								(vote_stat.vote_count::numeric + vote_stat.score::numeric)
									/ (2 * vote_stat.vote_count::numeric)
							)
							* (
								1 - (
									(vote_stat.vote_count::numeric + vote_stat.score::numeric)
										/ (2 * vote_stat.vote_count::numeric)
								)
							)
							+ (1.96 * 1.96) / (4 * vote_stat.vote_count::numeric)
						)
						/ vote_stat.vote_count::numeric
					)
				)
			)
			/ (1 + (1.96 * 1.96) / vote_stat.vote_count::numeric)
		) DESC,
		vote_stat.score DESC,
		vote_stat.vote_count DESC,
		structure_end.structure_id
	LIMIT 1;
	IF selected_structure_id IS NULL THEN
		DELETE FROM public.tag_primary_display_path
		WHERE tag_id = target_tag_id;
	ELSE
		INSERT INTO public.tag_primary_display_path (tag_id, structure_id)
		VALUES (target_tag_id, selected_structure_id)
		ON CONFLICT (tag_id) DO UPDATE SET
			structure_id = excluded.structure_id,
			updated_at = now();
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_tag_primary_display_path_from_end() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP <> 'INSERT' THEN
		PERFORM public.refresh_tag_primary_display_path(OLD.final_tag_id);
	END IF;
	IF TG_OP <> 'DELETE' AND (
		TG_OP = 'INSERT'
		OR NEW.final_tag_id IS DISTINCT FROM OLD.final_tag_id
	) THEN
		PERFORM public.refresh_tag_primary_display_path(NEW.final_tag_id);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_tag_primary_display_path_from_vote_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	target_tag_id uuid;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		SELECT final_tag_id
		INTO target_tag_id
		FROM public.unit_structure_end
		WHERE structure_id = OLD.structure_id;
		IF target_tag_id IS NOT NULL THEN
			PERFORM public.refresh_tag_primary_display_path(target_tag_id);
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' AND (
		TG_OP = 'INSERT'
		OR NEW.structure_id IS DISTINCT FROM OLD.structure_id
	) THEN
		SELECT final_tag_id
		INTO target_tag_id
		FROM public.unit_structure_end
		WHERE structure_id = NEW.structure_id;
		IF target_tag_id IS NOT NULL THEN
			PERFORM public.refresh_tag_primary_display_path(target_tag_id);
		END IF;
	END IF;
	RETURN NULL;
END;
$$;

-- End path projection functions.

CREATE OR REPLACE FUNCTION public.guard_entity_measurement() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP = 'UPDATE'
		AND (NEW.entity_id, NEW.context_unit_id)
			IS DISTINCT FROM (OLD.entity_id, OLD.context_unit_id)
	THEN
		RAISE EXCEPTION 'Entity measurement identity is immutable'
			USING ERRCODE = '55000';
	END IF;
	IF TG_OP = 'INSERT' AND NEW.context_unit_id IS NOT NULL THEN
		PERFORM pg_advisory_xact_lock(hashtextextended(NEW.entity_id::text, 71006));
		IF (
			SELECT count(*)
			FROM public.entity_measurement
			WHERE entity_id = NEW.entity_id
				AND context_unit_id IS NOT NULL
		) >= 8 THEN
			RAISE EXCEPTION 'An Entity may have at most eight contextual measurement sets'
				USING
					ERRCODE = '23514',
					CONSTRAINT = 'entity_measurement_context_limit';
		END IF;
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_direct_tag_application_policy() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	content_spoiler_ids constant uuid[] := ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid
	];
	nsfw_id constant uuid := '019b76da-a800-7370-8000-000000000004'::uuid;
	registry_ids constant uuid[] := content_spoiler_ids || ARRAY[nsfw_id];
	is_directly_applicable boolean;
BEGIN
	IF NOT NEW.tag_id = ANY(registry_ids) THEN
		SELECT directly_applicable
		INTO is_directly_applicable
		FROM public.tag
		WHERE id = NEW.tag_id;
		IF is_directly_applicable = false THEN
			RAISE EXCEPTION 'Tag % cannot be applied directly', NEW.tag_id
				USING
					ERRCODE = '23514',
					CONSTRAINT = 'tag_directly_applicable';
		END IF;
		RETURN NEW;
	END IF;

	IF TG_TABLE_NAME = 'profile_unit_tag' THEN
		RAISE EXCEPTION 'Content labels cannot be private Profile Tags'
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'content_label_private_rejected';
	END IF;
	IF TG_TABLE_NAME = 'unit_tag' AND NOT NEW.pinned THEN
		RAISE EXCEPTION 'Global content-label rows must be pinned'
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'content_label_pinned';
	END IF;
	IF NEW.tag_id = ANY(content_spoiler_ids) THEN
		IF NOT EXISTS (
			SELECT 1
			FROM public.post
			WHERE id = NEW.unit_id
		) THEN
			RAISE EXCEPTION 'Content-spoiler labels apply only to post-kind Units'
				USING
					ERRCODE = '23514',
					CONSTRAINT = 'content_spoiler_label_post_kind';
		END IF;
	ELSIF NOT EXISTS (
		SELECT 1
		FROM public.unit
		WHERE id = NEW.unit_id
			AND status = 'published'
			AND visibility = 'public'
			AND moderation_status = 'approved'
			AND deleted_at IS NULL
			AND kind NOT IN (
				'slug_namespace',
				'profile',
				'tag',
				'structure',
				'zone',
				'realm',
				'realm_rule'
			)
	) THEN
		RAISE EXCEPTION 'The NSFW display label applies only to active public content Units'
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'nsfw_label_public_content';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_platform_content_label_unit_tag() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	registry_ids constant uuid[] := ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid,
		'019b76da-a800-7370-8000-000000000004'::uuid
	];
	official_profile_ids constant uuid[] := ARRAY[
		'019b76da-a800-7200-8000-000000000001'::uuid,
		'019b76da-a800-7200-8000-000000000002'::uuid,
		'019b76da-a800-7200-8000-000000000003'::uuid
	];
	row_unit_id uuid;
	row_tag_id uuid;
	row_profile_id uuid;
	decision_id uuid;
	required_action text;
BEGIN
	IF TG_OP = 'DELETE' THEN
		row_unit_id := OLD.unit_id;
		row_tag_id := OLD.tag_id;
		row_profile_id := OLD.created_by_profile_id;
		required_action := 'content_label.remove';
	ELSE
		row_unit_id := NEW.unit_id;
		row_tag_id := NEW.tag_id;
		row_profile_id := NEW.created_by_profile_id;
		required_action := CASE
			WHEN TG_OP = 'INSERT' THEN 'content_label.apply'
			ELSE 'content_label.replace'
		END;
	END IF;
	IF NOT row_tag_id = ANY(registry_ids)
		OR row_profile_id IS NULL
		OR NOT row_profile_id = ANY(official_profile_ids)
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;
	IF TG_OP = 'UPDATE'
		AND (NEW.unit_id, NEW.tag_id, NEW.created_by_profile_id)
			IS DISTINCT FROM (OLD.unit_id, OLD.tag_id, OLD.created_by_profile_id)
	THEN
		RAISE EXCEPTION 'Platform content-label row identity is immutable'
			USING ERRCODE = '55000';
	END IF;

	decision_id := nullif(
		current_setting('rezics.content_label_governance_decision_id', true),
		''
	)::uuid;
	IF decision_id IS NULL OR NOT EXISTS (
		SELECT 1
		FROM public.governance_decision
		WHERE id = decision_id
			AND action = required_action
			AND actor_profile_id = row_profile_id
			AND authority_kind = 'platform'
			AND target_unit_id = row_unit_id
			AND subject_kind = 'content_label'
			AND subject_id = row_tag_id
			AND finalized
	) THEN
		RAISE EXCEPTION 'Platform content-label mutation requires a matching finalized governance decision'
			USING
				ERRCODE = '42501',
				CONSTRAINT = 'content_label_platform_governance';
	END IF;
	IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_content_label_judgment() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF NEW.tag_id = ANY(ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid,
		'019b76da-a800-7370-8000-000000000004'::uuid
	]) THEN
		RAISE EXCEPTION 'Content-label applicability and spoiler judgments are not permitted'
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'content_label_judgment_rejected';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_vndb_projection() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF pg_trigger_depth() > 1
		OR current_setting('rezics.vndb_projection_refresh', true) = 'enabled'
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;
	RAISE EXCEPTION '% is a database-maintained projection', TG_TABLE_NAME
		USING ERRCODE = '55000';
END;
$$;

-- End vndb-v11 guard functions.

DROP TRIGGER IF EXISTS realm_tag_judgment_realm_tag_voting_enabled
	ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_realm_tag_voting_enabled
BEFORE INSERT OR UPDATE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.enforce_realm_tag_judgment_enabled();

DROP TRIGGER IF EXISTS realm_tag_judgment_stat_maintain
	ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_stat_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_judgment_stat();

DROP TRIGGER IF EXISTS unit_structure_application_judgment_stat_maintain
	ON public.unit_structure_application_judgment;
CREATE TRIGGER unit_structure_application_judgment_stat_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_structure_application_judgment_stat();

DROP TRIGGER IF EXISTS unit_structure_application_judgment_support_maintain
	ON public.unit_structure_application_judgment;
CREATE TRIGGER unit_structure_application_judgment_support_maintain
AFTER INSERT OR DELETE OR UPDATE
ON public.unit_structure_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_structure_application_support();

DROP TRIGGER IF EXISTS unit_structure_application_judgment_tag_conflict
	ON public.unit_structure_application_judgment;
CREATE TRIGGER unit_structure_application_judgment_tag_conflict
BEFORE INSERT OR UPDATE OF fit_vote
ON public.unit_structure_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_conflicting_structure_application_judgment();

DROP TRIGGER IF EXISTS unit_tag_judgment_effective_maintain
	ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_effective_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_effective_tag_from_direct_judgment();

DROP TRIGGER IF EXISTS unit_tag_judgment_structure_conflict
	ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_structure_conflict
BEFORE INSERT OR UPDATE OF fit_vote ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_conflicting_direct_tag_judgment();

DROP TRIGGER IF EXISTS unit_tag_judgment_stat_maintain
	ON public.unit_effective_tag_vote;
CREATE TRIGGER unit_tag_judgment_stat_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_effective_tag_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_judgment_stat();

DROP TRIGGER IF EXISTS unit_structure_definition_prepare
	ON public.unit_structure;
CREATE TRIGGER unit_structure_definition_prepare
BEFORE INSERT OR UPDATE ON public.unit_structure
FOR EACH ROW EXECUTE FUNCTION public.prepare_unit_structure_definition();

DROP TRIGGER IF EXISTS unit_structure_definition_project
	ON public.unit_structure;
CREATE TRIGGER unit_structure_definition_project
AFTER INSERT OR UPDATE ON public.unit_structure
FOR EACH ROW EXECUTE FUNCTION public.project_unit_structure_definition();

DROP TRIGGER IF EXISTS unit_structure_end_immutable
	ON public.unit_structure_end;
CREATE TRIGGER unit_structure_end_immutable
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_structure_end
FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_projection();

DROP TRIGGER IF EXISTS tag_primary_display_path_immutable
	ON public.tag_primary_display_path;
CREATE TRIGGER tag_primary_display_path_immutable
BEFORE INSERT OR DELETE OR UPDATE ON public.tag_primary_display_path
FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_projection();

DROP TRIGGER IF EXISTS unit_structure_end_primary_display_maintain
	ON public.unit_structure_end;
CREATE TRIGGER unit_structure_end_primary_display_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_end
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_primary_display_path_from_end();

DROP TRIGGER IF EXISTS unit_structure_vote_stat_primary_display_maintain
	ON public.unit_structure_vote_stat;
CREATE TRIGGER unit_structure_vote_stat_primary_display_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_vote_stat
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_primary_display_path_from_vote_stat();

DROP TRIGGER IF EXISTS entity_measurement_guard
	ON public.entity_measurement;
CREATE TRIGGER entity_measurement_guard
BEFORE INSERT OR UPDATE ON public.entity_measurement
FOR EACH ROW EXECUTE FUNCTION public.guard_entity_measurement();

DROP TRIGGER IF EXISTS unit_tag_application_policy_guard
	ON public.unit_tag;
CREATE TRIGGER unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS realm_unit_tag_application_policy_guard
	ON public.realm_unit_tag;
CREATE TRIGGER realm_unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.realm_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS profile_unit_tag_application_policy_guard
	ON public.profile_unit_tag;
CREATE TRIGGER profile_unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.profile_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS unit_tag_platform_content_label_guard
	ON public.unit_tag;
CREATE TRIGGER unit_tag_platform_content_label_guard
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_platform_content_label_unit_tag();

DROP TRIGGER IF EXISTS unit_tag_judgment_content_label_reject
	ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_content_label_reject
BEFORE INSERT OR UPDATE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment();

DROP TRIGGER IF EXISTS realm_tag_judgment_content_label_reject
	ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_content_label_reject
BEFORE INSERT OR UPDATE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment();

DROP TRIGGER IF EXISTS subject_association_judgment_stat_maintain
	ON public.subject_association_judgment;
CREATE TRIGGER subject_association_judgment_stat_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.subject_association_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_subject_association_judgment_stat();

-- Rebuild only the bounded development-preview Path inverse projection.
DO $vndb$
BEGIN
	PERFORM set_config('rezics.vndb_projection_refresh', 'enabled', true);
	INSERT INTO public.unit_structure_end (structure_id, final_tag_id)
	SELECT
		id,
		member_unit_ids[cardinality(member_unit_ids)]
	FROM public.unit_structure
	ON CONFLICT (structure_id) DO UPDATE SET
		final_tag_id = excluded.final_tag_id;
END;
$vndb$;
