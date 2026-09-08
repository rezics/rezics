-- Native owner integrity and derived state. This file is the canonical forward-maintained source.
CREATE OR REPLACE FUNCTION public.enforce_governance_decision_rule_basis()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.protect_governance_decision_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.protect_governance_decision_rule_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.require_governance_decision_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.decision_id IS NULL THEN
    RAISE EXCEPTION '% inserts require a governance decision', TG_TABLE_NAME
      USING ERRCODE = '23514',
        CONSTRAINT = TG_TABLE_NAME || '_decision_required';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS account_enforcement_action_decision_required ON public.account_enforcement_action;
CREATE TRIGGER account_enforcement_action_decision_required BEFORE INSERT ON public.account_enforcement_action FOR EACH ROW EXECUTE FUNCTION public.require_governance_decision_on_insert();

DROP TRIGGER IF EXISTS content_governance_action_decision_required ON public.content_governance_action;
CREATE TRIGGER content_governance_action_decision_required BEFORE INSERT ON public.content_governance_action FOR EACH ROW EXECUTE FUNCTION public.require_governance_decision_on_insert();

DROP TRIGGER IF EXISTS governance_decision_immutable ON public.governance_decision;
CREATE TRIGGER governance_decision_immutable BEFORE DELETE OR UPDATE ON public.governance_decision FOR EACH ROW EXECUTE FUNCTION public.protect_governance_decision_mutation();

DROP TRIGGER IF EXISTS governance_decision_rule_basis_from_decision ON public.governance_decision;
CREATE CONSTRAINT TRIGGER governance_decision_rule_basis_from_decision AFTER INSERT ON public.governance_decision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.enforce_governance_decision_rule_basis();

DROP TRIGGER IF EXISTS governance_decision_rule_immutable ON public.governance_decision_rule;
CREATE TRIGGER governance_decision_rule_immutable BEFORE INSERT OR DELETE OR UPDATE ON public.governance_decision_rule FOR EACH ROW EXECUTE FUNCTION public.protect_governance_decision_rule_mutation();

DROP TRIGGER IF EXISTS unit_access_restriction_decision_required ON public.unit_access_restriction;
CREATE TRIGGER unit_access_restriction_decision_required BEFORE INSERT ON public.unit_access_restriction FOR EACH ROW EXECUTE FUNCTION public.require_governance_decision_on_insert();

DROP TRIGGER IF EXISTS unit_merge_request_decision_required ON public.unit_merge_request;
CREATE TRIGGER unit_merge_request_decision_required BEFORE INSERT ON public.unit_merge_request FOR EACH ROW EXECUTE FUNCTION public.require_governance_decision_on_insert();

DROP TRIGGER IF EXISTS user_account_state_decision_required ON public.user_account_state;
CREATE TRIGGER user_account_state_decision_required BEFORE INSERT ON public.user_account_state FOR EACH ROW EXECUTE FUNCTION public.require_governance_decision_on_insert();
