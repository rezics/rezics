SET LOCAL search_path = public;

-- Create enum type "unit_revision_attribution_assurance"
CREATE TYPE "unit_revision_attribution_assurance" AS ENUM ('self_declared', 'credential_bound', 'server_observed');
-- Create enum type "unit_revision_contribution_role"
CREATE TYPE "unit_revision_contribution_role" AS ENUM ('creator', 'editor', 'translator', 'researcher');
-- Create enum type "unit_revision_primary_contribution_kind"
CREATE TYPE "unit_revision_primary_contribution_kind" AS ENUM ('unattributed', 'human', 'ai');
-- Modify "unit_revision" table
ALTER TABLE "unit_revision" ADD COLUMN "primary_contribution_kind" "unit_revision_primary_contribution_kind" NOT NULL DEFAULT 'unattributed';
ALTER TABLE "unit_revision" ADD CONSTRAINT "unit_revision_primary_contribution_actor_check" CHECK ((primary_contribution_kind = 'unattributed'::unit_revision_primary_contribution_kind) OR (actor_profile_id IS NOT NULL));
-- Create "unit_revision_credit_attribution" table
CREATE TABLE "unit_revision_credit_attribution" (
  "revision_id" uuid NOT NULL,
  "credited_entity_id" uuid NOT NULL,
  "role" "unit_revision_contribution_role" NOT NULL,
  "assurance" "unit_revision_attribution_assurance" NOT NULL,
  PRIMARY KEY ("revision_id"),
  CONSTRAINT "unit_revision_credit_entity_fkey" FOREIGN KEY ("credited_entity_id") REFERENCES "entity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_revision_credit_revision_fkey" FOREIGN KEY ("revision_id") REFERENCES "unit_revision" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "unit_revision_credit_attribution_entity_revision_idx" to table: "unit_revision_credit_attribution"
CREATE INDEX "unit_revision_credit_attribution_entity_revision_idx" ON "unit_revision_credit_attribution" ("credited_entity_id", "revision_id" DESC NULLS LAST);

-- Contribution kind is part of the immutable historical identity of a revision.
CREATE OR REPLACE FUNCTION public.protect_unit_revision_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF ROW(
		OLD."id",
		OLD."unit_id",
		OLD."parent_revision_id",
		OLD."actor_profile_id",
		OLD."edit_summary",
		OLD."minor",
		OLD."byte_size",
		OLD."created_at",
		OLD."primary_contribution_kind"
	) IS DISTINCT FROM ROW(
		NEW."id",
		NEW."unit_id",
		NEW."parent_revision_id",
		NEW."actor_profile_id",
		NEW."edit_summary",
		NEW."minor",
		NEW."byte_size",
		NEW."created_at",
		NEW."primary_contribution_kind"
	) THEN
		RAISE EXCEPTION 'unit_revision identity is immutable' USING ERRCODE = '55000';
	END IF;
	RETURN NEW;
END;
$$;

-- PostgreSQL CHECK constraints cannot safely express a cross-table invariant.
-- Deferred constraint triggers allow the parent and optional child to be
-- inserted in either order while requiring the final transaction state to be:
-- AI => exactly one credit row; human/unattributed => no credit row.
CREATE FUNCTION public.enforce_unit_revision_primary_contribution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	checked_revision_id uuid;
	checked_kind public.unit_revision_primary_contribution_kind;
	has_credit_attribution boolean;
BEGIN
	checked_revision_id := CASE
		WHEN TG_TABLE_NAME = 'unit_revision'
			THEN NULLIF(to_jsonb(NEW) ->> 'id', '')::uuid
		ELSE NULLIF(to_jsonb(NEW) ->> 'revision_id', '')::uuid
	END;

	SELECT revision.primary_contribution_kind
	INTO checked_kind
	FROM public.unit_revision AS revision
	WHERE revision.id = checked_revision_id;

	SELECT EXISTS (
		SELECT 1
		FROM public.unit_revision_credit_attribution AS attribution
		WHERE attribution.revision_id = checked_revision_id
	)
	INTO has_credit_attribution;

	IF (checked_kind = 'ai'::public.unit_revision_primary_contribution_kind)
		IS DISTINCT FROM has_credit_attribution THEN
		RAISE EXCEPTION 'Revision contribution kind and credit attribution do not agree'
			USING ERRCODE = '23514',
				  CONSTRAINT = 'unit_revision_primary_contribution_integrity',
				  DETAIL = json_build_object(
					  'revisionId', checked_revision_id,
					  'kind', checked_kind,
					  'hasCreditAttribution', has_credit_attribution
				  )::text;
	END IF;
	RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "unit_revision_primary_contribution_from_revision"
AFTER INSERT ON "unit_revision"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_revision_primary_contribution();

CREATE CONSTRAINT TRIGGER "unit_revision_primary_contribution_from_credit"
AFTER INSERT ON "unit_revision_credit_attribution"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_revision_primary_contribution();

CREATE TRIGGER "unit_revision_credit_attribution_immutable"
BEFORE DELETE OR UPDATE ON "unit_revision_credit_attribution"
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();

-- Credit attribution is historical evidence, so an existing row keeps the
-- original Entity ID when that Unit is merged. New history must use the
-- canonical Entity and cannot target an already-merged source identity.
CREATE TRIGGER "unit_revision_credit_reject_merged_entity"
BEFORE INSERT ON "unit_revision_credit_attribution"
FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('credited_entity_id');
