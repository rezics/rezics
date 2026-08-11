-- v1.7 intentionally has no enum-to-Rule compatibility mapping. An installed
-- database must use the documented reset-and-restore cutover so operators can
-- re-attest every active policy decision against an immutable Rule revision.
SET LOCAL search_path = public;

DO $governance_rule_cutover$
BEGIN
  IF EXISTS (SELECT 1 FROM "unit")
    OR EXISTS (SELECT 1 FROM "users")
    OR EXISTS (SELECT 1 FROM "content_governance_action")
    OR EXISTS (SELECT 1 FROM "account_enforcement_action")
    OR EXISTS (SELECT 1 FROM "unit_access_restriction")
    OR EXISTS (SELECT 1 FROM "unit_merge_request")
    OR EXISTS (SELECT 1 FROM "user_account_state")
    OR EXISTS (SELECT 1 FROM "audit_event")
  THEN
    RAISE EXCEPTION 'v1.7 governance Rule cutover requires an empty replacement database'
      USING ERRCODE = '23514',
        HINT = 'Follow docs/releases/1.7.0-governance-rule-cutover.md; legacy reason codes are deliberately not mapped.';
  END IF;
END
$governance_rule_cutover$;

-- Create enum type "governance_authority_kind"
CREATE TYPE "governance_authority_kind" AS ENUM ('platform', 'realm', 'zone', 'unit');
-- Create enum type "governance_decision_basis_kind"
CREATE TYPE "governance_decision_basis_kind" AS ENUM ('rules', 'reversal');
-- Zone is now a first-class governance and audit authority.
ALTER TYPE "audit_authority_kind" ADD VALUE 'zone' BEFORE 'unit';
-- Modify "zone" table
ALTER TABLE "zone" ADD COLUMN "local_rule_realm_id" uuid NULL, ADD CONSTRAINT "zone_local_rule_realm_id_realm_id_fkey" FOREIGN KEY ("local_rule_realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "zone_local_rule_realm_idx" to table: "zone"
CREATE INDEX "zone_local_rule_realm_idx" ON "zone" ("local_rule_realm_id", "id");
-- Create "governance_decision" table
CREATE TABLE "governance_decision" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "action" text NOT NULL,
  "basis_kind" "governance_decision_basis_kind" NOT NULL,
  "actor_profile_id" uuid NOT NULL,
  "authority_kind" "governance_authority_kind" NOT NULL,
  "authority_realm_id" uuid NULL,
  "authority_zone_id" uuid NULL,
  "authority_unit_id" uuid NULL,
  "target_unit_id" uuid NULL,
  "target_user_id" uuid NULL,
  "subject_kind" text NOT NULL,
  "subject_id" uuid NOT NULL,
  "reverses_decision_id" uuid NULL,
  "request_id" text NULL,
  "finalized" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "governance_decision_actor_profile_id_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "governance_decision_authority_realm_id_realm_id_fkey" FOREIGN KEY ("authority_realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "governance_decision_authority_unit_id_unit_id_fkey" FOREIGN KEY ("authority_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "governance_decision_authority_zone_id_zone_id_fkey" FOREIGN KEY ("authority_zone_id") REFERENCES "zone" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "governance_decision_reverses_fkey" FOREIGN KEY ("reverses_decision_id") REFERENCES "governance_decision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "governance_decision_target_unit_id_unit_id_fkey" FOREIGN KEY ("target_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "governance_decision_target_user_id_users_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "governance_decision_action_check" CHECK ((btrim(action) <> ''::text) AND (octet_length(action) <= 128)),
  CONSTRAINT "governance_decision_authority_check" CHECK (((authority_kind = 'platform'::governance_authority_kind) AND (num_nonnulls(authority_realm_id, authority_zone_id, authority_unit_id) = 0)) OR ((authority_kind = 'realm'::governance_authority_kind) AND (authority_realm_id IS NOT NULL) AND (num_nonnulls(authority_zone_id, authority_unit_id) = 0)) OR ((authority_kind = 'zone'::governance_authority_kind) AND (authority_zone_id IS NOT NULL) AND (num_nonnulls(authority_realm_id, authority_unit_id) = 0)) OR ((authority_kind = 'unit'::governance_authority_kind) AND (authority_unit_id IS NOT NULL) AND (num_nonnulls(authority_realm_id, authority_zone_id) = 0))),
  CONSTRAINT "governance_decision_basis_check" CHECK ((basis_kind = 'reversal'::governance_decision_basis_kind) = (reverses_decision_id IS NOT NULL)),
  CONSTRAINT "governance_decision_not_self_reverse" CHECK ((reverses_decision_id IS NULL) OR (reverses_decision_id <> id)),
  CONSTRAINT "governance_decision_request_id_check" CHECK ((request_id IS NULL) OR ((btrim(request_id) <> ''::text) AND (octet_length(request_id) <= 200))),
  CONSTRAINT "governance_decision_subject_kind_check" CHECK ((btrim(subject_kind) <> ''::text) AND (octet_length(subject_kind) <= 64)),
  CONSTRAINT "governance_decision_target_check" CHECK (num_nonnulls(target_unit_id, target_user_id) = 1)
);
-- Create index "governance_decision_actor_created_idx" to table: "governance_decision"
CREATE INDEX "governance_decision_actor_created_idx" ON "governance_decision" ("actor_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "governance_decision_realm_created_idx" to table: "governance_decision"
CREATE INDEX "governance_decision_realm_created_idx" ON "governance_decision" ("authority_realm_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (authority_realm_id IS NOT NULL);
-- Create index "governance_decision_reverses_key" to table: "governance_decision"
CREATE UNIQUE INDEX "governance_decision_reverses_key" ON "governance_decision" ("reverses_decision_id") WHERE (reverses_decision_id IS NOT NULL);
-- Create index "governance_decision_subject_created_idx" to table: "governance_decision"
CREATE INDEX "governance_decision_subject_created_idx" ON "governance_decision" ("subject_kind", "subject_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "governance_decision_target_created_idx" to table: "governance_decision"
CREATE INDEX "governance_decision_target_created_idx" ON "governance_decision" ("target_unit_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (target_unit_id IS NOT NULL);
-- Create index "governance_decision_target_user_created_idx" to table: "governance_decision"
CREATE INDEX "governance_decision_target_user_created_idx" ON "governance_decision" ("target_user_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (target_user_id IS NOT NULL);
-- Create index "governance_decision_zone_created_idx" to table: "governance_decision"
CREATE INDEX "governance_decision_zone_created_idx" ON "governance_decision" ("authority_zone_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (authority_zone_id IS NOT NULL);
-- Modify "user_account_state" table
ALTER TABLE "user_account_state"
  DROP CONSTRAINT "user_account_state_shape_check",
  DROP COLUMN "reason",
  ADD COLUMN "decision_id" uuid NOT NULL,
  ADD CONSTRAINT "user_account_state_decision_id_governance_decision_id_fkey"
    FOREIGN KEY ("decision_id") REFERENCES "governance_decision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  ADD CONSTRAINT "user_account_state_shape_check" CHECK (
    ((state = 'active'::user_account_state_value) AND (note IS NULL) AND (expires_at IS NULL))
    OR (state = 'suspended'::user_account_state_value)
    OR ((state = 'closed'::user_account_state_value) AND (expires_at IS NULL))
  );
CREATE INDEX "user_account_state_decision_idx" ON "user_account_state" ("decision_id");
-- Modify "account_enforcement_action" table
ALTER TABLE "account_enforcement_action" ADD COLUMN "decision_id" uuid NOT NULL, ADD CONSTRAINT "account_enforcement_action_decision_key" UNIQUE ("decision_id"), ADD CONSTRAINT "account_enforcement_action_0PMYZ0KnJ9vg_fkey" FOREIGN KEY ("decision_id") REFERENCES "governance_decision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "audit_event" table
ALTER TABLE "audit_event" DROP CONSTRAINT "audit_event_schema_version_check", ADD CONSTRAINT "audit_event_schema_version_check" CHECK (schema_version = 2), DROP COLUMN "reason_code", ALTER COLUMN "schema_version" SET DEFAULT 2, ADD COLUMN "outcome_code" text NULL, ADD COLUMN "governance_decision_id" uuid NULL, ADD CONSTRAINT "audit_event_outcome_code_check" CHECK ((outcome_code IS NULL) OR ((btrim(outcome_code) <> ''::text) AND (octet_length(outcome_code) <= 128))), ADD CONSTRAINT "audit_event_governance_decision_id_governance_decision_id_fkey" FOREIGN KEY ("governance_decision_id") REFERENCES "governance_decision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "audit_event_governance_decision_idx" to table: "audit_event"
CREATE INDEX "audit_event_governance_decision_idx" ON "audit_event" ("governance_decision_id");
-- Modify "content_governance_action" table
ALTER TABLE "content_governance_action" ADD COLUMN "decision_id" uuid NOT NULL, ADD CONSTRAINT "content_governance_action_decision_key" UNIQUE ("decision_id"), ADD CONSTRAINT "content_governance_action_I2nC8QuZSwcG_fkey" FOREIGN KEY ("decision_id") REFERENCES "governance_decision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create "governance_decision_rule" table
CREATE TABLE "governance_decision_rule" (
  "decision_id" uuid NOT NULL,
  "rule_source_realm_id" uuid NOT NULL,
  "rule_revision_id" uuid NOT NULL,
  "rule_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("decision_id", "rule_id"),
  CONSTRAINT "governance_decision_rule_revision_fkey" FOREIGN KEY ("rule_id", "rule_revision_id") REFERENCES "realm_rule" ("id", "revision_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "governance_decision_rule_revision_realm_fkey" FOREIGN KEY ("rule_source_realm_id", "rule_revision_id") REFERENCES "realm_rule_revision" ("realm_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "governance_decision_rule_rule_id_realm_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "realm_rule" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "governance_decision_rule_rule_source_realm_id_realm_id_fkey" FOREIGN KEY ("rule_source_realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "governance_decision_rule_xie5CeAMqmoP_fkey" FOREIGN KEY ("decision_id") REFERENCES "governance_decision" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "governance_decision_rule_rule_decision_idx" to table: "governance_decision_rule"
CREATE INDEX "governance_decision_rule_rule_decision_idx" ON "governance_decision_rule" ("rule_id", "decision_id");
-- Create index "governance_decision_rule_source_decision_idx" to table: "governance_decision_rule"
CREATE INDEX "governance_decision_rule_source_decision_idx" ON "governance_decision_rule" ("rule_source_realm_id", "decision_id");

-- Rule-backed decisions must have one bounded immutable basis at commit time;
-- reversal decisions must never copy their predecessor's basis.
CREATE FUNCTION "enforce_governance_decision_rule_basis"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  checked_decision_id uuid;
  checked_basis governance_decision_basis_kind;
  checked_finalized boolean;
  rule_count integer;
  source_count integer;
BEGIN
  checked_decision_id := NEW.id;

  SELECT basis_kind, finalized
  INTO checked_basis, checked_finalized
  FROM governance_decision
  WHERE id = checked_decision_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT checked_finalized THEN
    RAISE EXCEPTION 'Governance decision % must be finalized before commit', checked_decision_id
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)
  INTO rule_count
  FROM governance_decision_rule
  WHERE decision_id = checked_decision_id;

  SELECT count(DISTINCT rule_source_realm_id)
  INTO source_count
  FROM governance_decision_rule
  WHERE decision_id = checked_decision_id;

  IF checked_basis = 'rules' AND rule_count NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'Rule-backed governance decision % must reference 1 to 32 Rules', checked_decision_id
      USING ERRCODE = '23514';
  END IF;
  IF checked_basis <> 'rules' AND rule_count <> 0 THEN
    RAISE EXCEPTION 'Non-Rule governance decision % cannot reference Rules', checked_decision_id
      USING ERRCODE = '23514';
  END IF;
  IF source_count > 2 THEN
    RAISE EXCEPTION 'Governance decision % cannot reference more than 2 Rule Realms', checked_decision_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "governance_decision_rule_basis_from_decision"
AFTER INSERT ON "governance_decision"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_governance_decision_rule_basis"();

CREATE FUNCTION "protect_governance_decision_mutation"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.finalized = false
    AND NEW.finalized = true
    AND (to_jsonb(NEW) - 'finalized') = (to_jsonb(OLD) - 'finalized')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'governance decisions are immutable after finalization'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER "governance_decision_immutable"
BEFORE UPDATE OR DELETE ON "governance_decision"
FOR EACH ROW EXECUTE FUNCTION "protect_governance_decision_mutation"();

CREATE FUNCTION "protect_governance_decision_rule_mutation"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1
    FROM governance_decision
    WHERE id = NEW.decision_id AND finalized = false
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'governance Rule bases are immutable after finalization'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER "governance_decision_rule_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "governance_decision_rule"
FOR EACH ROW EXECUTE FUNCTION "protect_governance_decision_rule_mutation"();
-- Modify "unit_access_restriction" table
ALTER TABLE "unit_access_restriction" DROP COLUMN "reason_code", ADD COLUMN "decision_id" uuid NOT NULL, ADD CONSTRAINT "unit_access_restriction_decision_id_governance_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "governance_decision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "unit_access_restriction_decision_idx" to table: "unit_access_restriction"
CREATE INDEX "unit_access_restriction_decision_idx" ON "unit_access_restriction" ("decision_id");
-- Modify "unit_merge_request" table
ALTER TABLE "unit_merge_request" DROP COLUMN "reason_code", ADD COLUMN "decision_id" uuid NOT NULL, ADD CONSTRAINT "unit_merge_request_decision_key" UNIQUE ("decision_id"), ADD CONSTRAINT "unit_merge_request_decision_id_governance_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "governance_decision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop enum type "governance_reason_code"
DROP TYPE "governance_reason_code";
-- Drop the second legacy human-reason enum; all adverse account state changes now cite Rules.
DROP TYPE "user_account_state_reason";
-- Drop "content_governance_action_rule" table
DROP TABLE "content_governance_action_rule";
