-- One exact latest state-changing governance action per Realm publication.
CREATE OR REPLACE FUNCTION public.realm_publication_guard_governance_pointer()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE chosen public.content_governance_action%ROWTYPE; prior public.content_governance_action%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.realm_id,NEW.unit_id) IS DISTINCT FROM (OLD.realm_id,OLD.unit_id) THEN
  RAISE EXCEPTION 'Realm publication identity is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND NEW.latest_governance_action_id IS NOT DISTINCT FROM OLD.latest_governance_action_id THEN RETURN NEW; END IF;
 IF NEW.latest_governance_action_id IS NULL THEN
  IF TG_OP='UPDATE' AND OLD.latest_governance_action_id IS NOT NULL THEN RAISE EXCEPTION 'Latest Realm governance cannot be cleared' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 SELECT a.* INTO chosen FROM public.content_governance_action a JOIN public.content_review_case c ON c.id=a.case_id
 WHERE a.id=NEW.latest_governance_action_id AND c.authority='realm' AND c.realm_id=NEW.realm_id AND c.target_unit_id=NEW.unit_id AND a.resulting_state IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Latest governance action must address the exact Realm publication state' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND OLD.latest_governance_action_id IS NOT NULL THEN
  SELECT * INTO STRICT prior FROM public.content_governance_action WHERE id=OLD.latest_governance_action_id;
  IF (chosen.created_at,chosen.id)<=(prior.created_at,prior.id) THEN RAISE EXCEPTION 'Latest governance pointer cannot move backward' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.realm_publication_project_governance_action()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE context public.content_review_case%ROWTYPE;
BEGIN
 IF NEW.resulting_state IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO STRICT context FROM public.content_review_case WHERE id=NEW.case_id;
 IF context.authority<>'realm' THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.realm_unit WHERE realm_id=context.realm_id AND unit_id=context.target_unit_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Realm state action requires its publication' USING ERRCODE='23514'; END IF;
 -- The UPDATE locks the one publication row; PostgreSQL rechecks this predicate after concurrent writers.
 UPDATE public.realm_unit r SET latest_governance_action_id=NEW.id
 WHERE r.realm_id=context.realm_id AND r.unit_id=context.target_unit_id
 AND (r.latest_governance_action_id IS NULL OR
  (SELECT (a.created_at,a.id)<(NEW.created_at,NEW.id) FROM public.content_governance_action a WHERE a.id=r.latest_governance_action_id));
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.realm_publication_guard_governance_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_TABLE_NAME='content_governance_action' THEN
  IF TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Governance action evidence is immutable' USING ERRCODE='23514'; END IF;
 ELSE
  IF (NEW.authority,NEW.realm_id,NEW.target_unit_id) IS DISTINCT FROM (OLD.authority,OLD.realm_id,OLD.target_unit_id) THEN
   RAISE EXCEPTION 'Governance case authority and target are immutable' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS realm_publication_governance_pointer_guard ON public.realm_unit;
CREATE TRIGGER realm_publication_governance_pointer_guard BEFORE INSERT OR UPDATE ON public.realm_unit FOR EACH ROW EXECUTE FUNCTION public.realm_publication_guard_governance_pointer();
DROP TRIGGER IF EXISTS realm_publication_governance_project ON public.content_governance_action;
CREATE TRIGGER realm_publication_governance_project AFTER INSERT ON public.content_governance_action FOR EACH ROW EXECUTE FUNCTION public.realm_publication_project_governance_action();
DROP TRIGGER IF EXISTS realm_publication_governance_evidence_guard ON public.content_governance_action;
CREATE TRIGGER realm_publication_governance_evidence_guard BEFORE UPDATE OR DELETE ON public.content_governance_action FOR EACH ROW EXECUTE FUNCTION public.realm_publication_guard_governance_evidence();
DROP TRIGGER IF EXISTS realm_publication_governance_scope_guard ON public.content_review_case;
CREATE TRIGGER realm_publication_governance_scope_guard BEFORE UPDATE ON public.content_review_case FOR EACH ROW EXECUTE FUNCTION public.realm_publication_guard_governance_evidence();
