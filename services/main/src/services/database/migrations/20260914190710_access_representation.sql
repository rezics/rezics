SET search_path TO public;

ALTER TABLE "access_representation" ADD COLUMN "target_kind" text DEFAULT 'scope' NOT NULL;
ALTER TABLE "access_representation_revision" ADD COLUMN "target_kind" text DEFAULT 'scope' NOT NULL;
ALTER TABLE "access_representation_revision" ADD COLUMN "target_scope_id" uuid;
ALTER TABLE "access_representation" ALTER COLUMN "target_scope_id" DROP NOT NULL;
ALTER TABLE "access_representation_revision" ADD CONSTRAINT "access_representation_revision_LBFXzLcaANOl_fkey" FOREIGN KEY ("target_scope_id") REFERENCES "access_scope"("id") ON DELETE RESTRICT;
ALTER TABLE "access_representation" ADD CONSTRAINT "access_representation_target_check" CHECK (("target_kind"='all-scopes' and "target_scope_id" is null) or ("target_kind"='scope' and "target_scope_id" is not null));
ALTER TABLE "access_representation_revision" ADD CONSTRAINT "access_representation_revision_target_check" CHECK (("target_kind"='all-scopes' and "target_scope_id" is null and cardinality("target_path")=0) or ("target_kind"='scope' and "target_scope_id" is not null));

-- Exact admission/selection dependencies never follow a later rejoin or reassignment.
CREATE OR REPLACE FUNCTION public.access_representation_recipient_is_current(p_grant uuid,p_revision bigint)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE
  WHEN terms.membership_id IS NULL THEN true
  ELSE head.recipient_kind='subject' AND EXISTS(
   SELECT 1 FROM public.access_membership m
   WHERE m.id=terms.membership_id AND m.subject_id=head.recipient_subject_id
    AND m.active_generation=terms.membership_generation
    AND (terms.selection_group_id IS NULL OR EXISTS(
     SELECT 1 FROM public.access_group_membership selected
     JOIN public.access_group g ON g.id=selected.group_id AND g.scope_id=selected.scope_id
     WHERE selected.membership_id=m.id AND selected.generation=terms.membership_generation
      AND selected.group_id=terms.selection_group_id AND selected.version=terms.selection_version
      AND selected.selected AND g.state='active')))
 END
 FROM public.access_representation head
 JOIN public.access_representation_revision terms ON terms.grant_id=head.id
 WHERE head.id=p_grant AND terms.revision=p_revision AND terms.sealed
$$;

CREATE OR REPLACE FUNCTION public.access_representation_parent_basis_is_current(p_grant uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE child public.access_representation%ROWTYPE; parent public.access_representation%ROWTYPE; member public.access_membership%ROWTYPE;
BEGIN
 SELECT * INTO child FROM public.access_representation WHERE id=p_grant;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF child.parent_grant_id IS NULL THEN RETURN true; END IF;
 SELECT * INTO parent FROM public.access_representation WHERE id=child.parent_grant_id;
 IF NOT FOUND OR child.parent_subject_id IS NULL THEN RETURN false; END IF;
 IF parent.recipient_kind='subject' THEN
  IF parent.recipient_subject_id<>child.parent_subject_id THEN RETURN false; END IF;
 ELSIF child.parent_membership_id IS NULL THEN RETURN false;
 END IF;
 IF child.parent_membership_id IS NOT NULL THEN
  SELECT * INTO member FROM public.access_membership WHERE id=child.parent_membership_id;
  IF NOT FOUND OR member.subject_id<>child.parent_subject_id OR member.active_generation IS DISTINCT FROM child.parent_membership_generation OR (parent.recipient_kind<>'subject' AND member.scope_id<>parent.recipient_scope_id) THEN RETURN false; END IF;
 END IF;
 IF child.parent_selection_group_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.access_group_membership selected JOIN public.access_group g ON g.id=selected.group_id AND g.scope_id=selected.scope_id
   WHERE selected.membership_id=child.parent_membership_id AND selected.generation=child.parent_membership_generation
    AND selected.group_id=child.parent_selection_group_id AND selected.version=child.parent_selection_version AND selected.selected AND g.state='active') THEN RETURN false; END IF;
 END IF;
 IF parent.recipient_kind='group' THEN
  IF child.parent_selection_group_id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS(WITH RECURSIVE path(id,parent_id,state,depth) AS (
   SELECT g.id,g.parent_id,g.state,1 FROM public.access_group g WHERE g.id=child.parent_selection_group_id AND g.scope_id=parent.recipient_scope_id
   UNION ALL SELECT g.id,g.parent_id,g.state,p.depth+1 FROM path p JOIN public.access_group g ON g.id=p.parent_id AND g.scope_id=parent.recipient_scope_id WHERE p.state='active' AND p.depth<8
  ) SELECT 1 FROM path WHERE id=parent.recipient_group_id AND state='active');
 END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.access_representation_terms_narrower(p_child uuid,p_child_revision bigint,p_parent uuid,p_parent_revision bigint,p_keep_eligibility boolean)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT child.sealed AND parent.sealed
  AND (parent.target_kind='all-scopes' OR (child.target_kind='scope' AND child.target_scope_id=parent.target_scope_id
   AND cardinality(child.target_path)>=cardinality(parent.target_path)
   AND (cardinality(parent.target_path)=0 OR child.target_path[1:cardinality(parent.target_path)]=parent.target_path)))
  AND child.valid_from>=parent.valid_from
  AND (parent.valid_until IS NULL OR (child.valid_until IS NOT NULL AND child.valid_until<=parent.valid_until))
  AND (NOT child.can_redelegate OR parent.can_redelegate)
  AND (NOT parent.require_fresh_session OR child.require_fresh_session)
  AND (NOT p_keep_eligibility OR parent.membership_id IS NULL OR
   (child.membership_id IS NOT DISTINCT FROM parent.membership_id AND child.membership_generation IS NOT DISTINCT FROM parent.membership_generation
    AND (parent.selection_group_id IS NULL OR (child.selection_group_id IS NOT DISTINCT FROM parent.selection_group_id AND child.selection_version IS NOT DISTINCT FROM parent.selection_version))))
  AND NOT EXISTS(SELECT 1 FROM public.access_representation_permission requested
   WHERE requested.grant_id=p_child AND requested.revision=p_child_revision
    AND NOT EXISTS(SELECT 1 FROM public.access_representation_permission approved WHERE approved.grant_id=p_parent AND approved.revision=p_parent_revision AND approved.family=requested.family AND approved.permission=requested.permission))
 FROM public.access_representation_revision child,public.access_representation_revision parent
 WHERE child.grant_id=p_child AND child.revision=p_child_revision AND parent.grant_id=p_parent AND parent.revision=p_parent_revision
$$;

CREATE OR REPLACE FUNCTION public.access_representation_lineage(p_grant uuid,p_revision bigint)
RETURNS TABLE(grant_id uuid,revision bigint,depth integer) LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH RECURSIVE lineage(id,terms_revision,parent_id,parent_revision,depth) AS (
  SELECT g.id,p_revision,g.parent_grant_id,g.parent_revision,1 FROM public.access_representation g WHERE g.id=p_grant
  UNION ALL
  SELECT g.id,l.parent_revision,g.parent_grant_id,g.parent_revision,l.depth+1
  FROM lineage l JOIN public.access_representation g ON g.id=l.parent_id WHERE l.depth<9
 ) SELECT id,terms_revision,depth FROM lineage
$$;

CREATE OR REPLACE FUNCTION public.lock_access_representation_lineage(p_grant uuid,p_revision bigint)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE represented uuid;
BEGIN
 SELECT entity_id INTO represented FROM public.access_representation WHERE id=p_grant;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation parent is missing' USING ERRCODE='23503'; END IF;
 PERFORM entity_id FROM public.access_representation_entity WHERE entity_id=represented FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation Entity fence is missing' USING ERRCODE='23503'; END IF;
 IF (SELECT count(*) FROM public.access_representation_lineage(p_grant,p_revision))>8 THEN RAISE EXCEPTION 'Representation lineage exceeds depth budget' USING ERRCODE='54000'; END IF;
 PERFORM tree.scope_id FROM public.access_group_tree tree WHERE tree.scope_id IN (
  SELECT m.scope_id FROM public.access_representation_lineage(p_grant,p_revision) l
   JOIN public.access_representation_revision r ON r.grant_id=l.grant_id AND r.revision=l.revision
   JOIN public.access_membership m ON m.id=r.membership_id
  UNION SELECT g.recipient_scope_id FROM public.access_representation_lineage(p_grant,p_revision) l
   JOIN public.access_representation g ON g.id=l.grant_id WHERE g.recipient_kind='group'
  UNION SELECT m.scope_id FROM public.access_representation_lineage(p_grant,p_revision) l JOIN public.access_representation g ON g.id=l.grant_id JOIN public.access_membership m ON m.id=g.parent_membership_id
 ) ORDER BY tree.scope_id FOR SHARE;
 PERFORM m.id FROM public.access_membership m WHERE m.id IN (
  SELECT r.membership_id FROM public.access_representation_lineage(p_grant,p_revision) l
   JOIN public.access_representation_revision r ON r.grant_id=l.grant_id AND r.revision=l.revision
  UNION SELECT g.parent_membership_id FROM public.access_representation_lineage(p_grant,p_revision) l JOIN public.access_representation g ON g.id=l.grant_id
 ) ORDER BY m.id FOR SHARE;
 PERFORM selection.membership_id FROM public.access_group_membership_set selection WHERE (selection.membership_id,selection.generation) IN (
  SELECT r.membership_id,r.membership_generation FROM public.access_representation_lineage(p_grant,p_revision) l
   JOIN public.access_representation_revision r ON r.grant_id=l.grant_id AND r.revision=l.revision WHERE r.selection_group_id IS NOT NULL
  UNION SELECT g.parent_membership_id,g.parent_membership_generation FROM public.access_representation_lineage(p_grant,p_revision) l JOIN public.access_representation g ON g.id=l.grant_id WHERE g.parent_selection_group_id IS NOT NULL
 ) ORDER BY selection.membership_id,selection.generation FOR SHARE;
END $$;

CREATE OR REPLACE FUNCTION public.access_representation_is_current(p_grant uuid,p_revision bigint)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH evaluated AS MATERIALIZED(SELECT clock_timestamp() AS now), lineage AS MATERIALIZED(SELECT * FROM public.access_representation_lineage(p_grant,p_revision))
 SELECT count(*) BETWEEN 1 AND 8 AND count(*)=count(DISTINCT l.grant_id)
  AND bool_or(g.parent_grant_id IS NULL)
  AND bool_and(g.state='active' AND g.terms_revision=l.revision AND r.sealed
   AND r.valid_from<=evaluated.now AND (r.valid_until IS NULL OR r.valid_until>evaluated.now)
   AND public.access_representation_recipient_is_current(g.id,l.revision) IS TRUE
   AND public.access_representation_parent_basis_is_current(g.id) IS TRUE
   AND (g.recipient_kind<>'group' OR EXISTS(SELECT 1 FROM public.access_group recipient WHERE recipient.id=g.recipient_group_id AND recipient.scope_id=g.recipient_scope_id AND recipient.state='active')))
 FROM lineage l JOIN public.access_representation g ON g.id=l.grant_id
 JOIN public.access_representation_revision r ON r.grant_id=g.id AND r.revision=l.revision CROSS JOIN evaluated
 HAVING count(*)=(SELECT count(*) FROM lineage)
$$;

CREATE OR REPLACE FUNCTION public.initialize_access_representation_entity()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.entity_id IS NOT NULL THEN
  INSERT INTO public.access_representation_entity(entity_id) VALUES(NEW.entity_id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_representation_entity()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Representation scope fence is retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 THEN RAISE EXCEPTION 'Representation scope starts at version zero' USING ERRCODE='23514'; END IF;
 ELSIF NEW.entity_id<>OLD.entity_id OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Representation scope identity is fixed and version advances by one' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_representation_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE receipt public.access_representation_event%ROWTYPE; terms public.access_representation_revision%ROWTYPE; expected_terms bigint; parent public.access_representation%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Representation identity and history are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.state<>'draft' OR NEW.terms_revision IS NOT NULL THEN RAISE EXCEPTION 'Representation starts without effective terms' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.entity_id,NEW.parent_grant_id,NEW.parent_revision,NEW.parent_subject_id,NEW.parent_membership_id,NEW.parent_membership_generation,NEW.parent_selection_group_id,NEW.parent_selection_version,NEW.recipient_kind,NEW.recipient_subject_id,NEW.recipient_group_id,NEW.recipient_scope_id) IS DISTINCT FROM ROW(OLD.id,OLD.entity_id,OLD.parent_grant_id,OLD.parent_revision,OLD.parent_subject_id,OLD.parent_membership_id,OLD.parent_membership_generation,OLD.parent_selection_group_id,OLD.parent_selection_version,OLD.recipient_kind,OLD.recipient_subject_id,OLD.recipient_group_id,OLD.recipient_scope_id) THEN RAISE EXCEPTION 'Representation identity cannot be retargeted' USING ERRCODE='55000'; END IF;
 IF OLD.state='revoked' OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Representation transition is stale or revoked' USING ERRCODE='23514'; END IF;
 SELECT * INTO receipt FROM public.access_representation_event WHERE grant_id=NEW.id AND version=NEW.version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation transition requires an exact receipt' USING ERRCODE='23514'; END IF;
 expected_terms:=CASE WHEN receipt.operation='revoke' THEN receipt.retained_terms_revision ELSE receipt.version END;
 IF NEW.terms_revision IS DISTINCT FROM expected_terms OR NEW.state IS DISTINCT FROM (CASE WHEN receipt.operation='revoke' THEN 'revoked' ELSE 'active' END) THEN RAISE EXCEPTION 'Representation head does not match its receipt' USING ERRCODE='23514'; END IF;
 SELECT * INTO terms FROM public.access_representation_revision WHERE grant_id=NEW.id AND revision=NEW.terms_revision AND sealed;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation requires its exact sealed terms' USING ERRCODE='23514'; END IF;
 IF ROW(NEW.target_kind,NEW.target_scope_id) IS DISTINCT FROM ROW(terms.target_kind,terms.target_scope_id) THEN RAISE EXCEPTION 'Representation target must mirror its selected sealed terms' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' THEN
  PERFORM public.lock_access_role_binding_eligibility(terms.membership_id,terms.membership_generation,terms.selection_group_id);
  IF public.access_representation_recipient_is_current(NEW.id,NEW.terms_revision) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Recipient admission or exact Group selection is no longer current' USING ERRCODE='23514'; END IF;
  IF receipt.operation='narrow' AND public.access_representation_terms_narrower(NEW.id,NEW.terms_revision,OLD.id,OLD.terms_revision,true) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Representation amendment may only narrow its exact previous terms' USING ERRCODE='23514'; END IF;
  IF NEW.parent_grant_id IS NOT NULL THEN
   PERFORM public.lock_access_role_binding_eligibility(NEW.parent_membership_id,NEW.parent_membership_generation,NEW.parent_selection_group_id);
   IF public.access_representation_parent_basis_is_current(NEW.id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Dependent issuer admission or Group assignment is no longer current' USING ERRCODE='23514'; END IF;
   SELECT * INTO parent FROM public.access_representation WHERE id=NEW.parent_grant_id;
   IF parent.entity_id IS DISTINCT FROM NEW.entity_id THEN RAISE EXCEPTION 'Dependent representation preserves its Entity authority' USING ERRCODE='23514'; END IF;
   PERFORM public.lock_access_representation_lineage(NEW.parent_grant_id,NEW.parent_revision);
   IF public.access_representation_is_current(NEW.parent_grant_id,NEW.parent_revision) IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM public.access_representation_revision WHERE grant_id=NEW.parent_grant_id AND revision=NEW.parent_revision AND can_redelegate) OR public.access_representation_terms_narrower(NEW.id,NEW.terms_revision,NEW.parent_grant_id,NEW.parent_revision,false) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Dependent representation exceeds or outlives current redelegation authority' USING ERRCODE='23514'; END IF;
   IF (SELECT count(*) FROM public.access_representation_lineage(NEW.parent_grant_id,NEW.parent_revision))>=8 THEN RAISE EXCEPTION 'Representation lineage depth exhausted' USING ERRCODE='54000'; END IF;
  END IF;
  IF NEW.recipient_kind='group' AND NOT EXISTS(SELECT 1 FROM public.access_group WHERE id=NEW.recipient_group_id AND scope_id=NEW.recipient_scope_id AND state='active') THEN RAISE EXCEPTION 'Representation Group must be active at its effect' USING ERRCODE='23514'; END IF;
 END IF;
 UPDATE public.access_representation_entity SET version=version+1 WHERE entity_id=NEW.entity_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation scope fence is missing' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_representation_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.access_representation%ROWTYPE; declared_actor uuid;
BEGIN
 SELECT * INTO head FROM public.access_representation WHERE id=NEW.grant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation identity is missing' USING ERRCODE='23503'; END IF;
 PERFORM entity_id FROM public.access_representation_entity WHERE entity_id=head.entity_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation scope fence is missing' USING ERRCODE='23503'; END IF;
 IF head.recipient_kind='group' THEN
  PERFORM scope_id FROM public.access_group_tree WHERE scope_id=head.recipient_scope_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient Group tree fence is missing' USING ERRCODE='23503'; END IF;
 END IF;
 SELECT * INTO head FROM public.access_representation WHERE id=NEW.grant_id FOR UPDATE;
 SELECT auth_user_id INTO declared_actor FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Authority subject is missing' USING ERRCODE='23503'; END IF;
 IF declared_actor IS NOT NULL AND declared_actor<>NEW.operator_auth_user_id THEN RAISE EXCEPTION 'Direct authority cannot name another operator' USING ERRCODE='23514'; END IF;
 IF head.state='revoked' OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Representation receipt is stale or revoked' USING ERRCODE='23514'; END IF;
 IF NEW.operation='create' THEN
  IF head.parent_grant_id IS NOT NULL AND NEW.authority_subject_id IS DISTINCT FROM head.parent_subject_id THEN RAISE EXCEPTION 'Dependent creation must exercise its exact parent authority subject' USING ERRCODE='23514'; END IF;
  IF head.version<>0 THEN RAISE EXCEPTION 'Representation already exists' USING ERRCODE='23514'; END IF;
 ELSIF head.version=0 THEN RAISE EXCEPTION 'Representation must be created first' USING ERRCODE='23514';
 END IF;
 IF NEW.operation='revoke' AND NEW.retained_terms_revision IS DISTINCT FROM head.terms_revision THEN RAISE EXCEPTION 'Revocation retains the current terms' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_representation_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event_kind text; actual_count integer; actual_digest text; recipient public.access_representation%ROWTYPE; member public.access_membership%ROWTYPE; selection_operation text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Representation terms are immutable' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT operation INTO event_kind FROM public.access_representation_event WHERE grant_id=NEW.grant_id AND version=NEW.revision;
  IF event_kind IS NULL THEN RAISE EXCEPTION 'Terms receipt is missing' USING ERRCODE='23503'; END IF;
  IF event_kind NOT IN('create','narrow') OR NEW.sealed THEN RAISE EXCEPTION 'Terms require their creating receipt before sealing' USING ERRCODE='23514'; END IF;
  IF cardinality(NEW.target_path)>0 AND array_lower(NEW.target_path,1)<>1 THEN RAISE EXCEPTION 'Representation target paths use canonical array bounds' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(NEW.target_path) segment WHERE segment !~ '^[a-z0-9][a-z0-9-]{0,255}$') THEN RAISE EXCEPTION 'Invalid representation target path' USING ERRCODE='23514'; END IF;
  IF NEW.membership_id IS NOT NULL THEN
   SELECT * INTO recipient FROM public.access_representation WHERE id=NEW.grant_id;
   SELECT * INTO member FROM public.access_membership WHERE id=NEW.membership_id;
   IF recipient.recipient_kind IS DISTINCT FROM 'subject' OR member.subject_id IS DISTINCT FROM recipient.recipient_subject_id THEN RAISE EXCEPTION 'Admission dependency must belong to the exact subject recipient' USING ERRCODE='23514'; END IF;
   IF NEW.selection_group_id IS NOT NULL THEN
    SELECT operation INTO selection_operation FROM public.access_group_membership_event WHERE membership_id=NEW.membership_id AND generation=NEW.membership_generation AND group_id=NEW.selection_group_id AND version=NEW.selection_version;
    IF selection_operation IS DISTINCT FROM 'assign' THEN RAISE EXCEPTION 'Group dependency requires its exact assignment receipt' USING ERRCODE='23514'; END IF;
   END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.sealed OR NOT NEW.sealed OR (to_jsonb(NEW)-'sealed') IS DISTINCT FROM (to_jsonb(OLD)-'sealed') THEN RAISE EXCEPTION 'Only sealing can change representation terms' USING ERRCODE='55000'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(family||':'||permission,E'\n' ORDER BY family COLLATE "C",permission COLLATE "C"),''),'UTF8')),'hex') INTO actual_count,actual_digest FROM public.access_representation_permission WHERE grant_id=NEW.grant_id AND revision=NEW.revision;
 IF actual_count<>NEW.permission_count OR actual_digest<>NEW.permission_digest THEN RAISE EXCEPTION 'Representation approval snapshot is incomplete or inconsistent' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_representation_permission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE terms public.access_representation_revision%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Representation approval history is immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO terms FROM public.access_representation_revision WHERE grant_id=NEW.grant_id AND revision=NEW.revision FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation terms are missing' USING ERRCODE='23503'; END IF;
 IF terms.sealed THEN RAISE EXCEPTION 'Sealed terms cannot gain approved permissions' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_access_representation_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE final_version bigint; receipt public.access_representation_event%ROWTYPE; expected_terms bigint;
BEGIN
 IF TG_TABLE_NAME='access_representation' THEN
  SELECT version INTO final_version FROM public.access_representation WHERE id=NEW.id;
  IF final_version=0 THEN RAISE EXCEPTION 'Representation creation must complete sealed terms' USING ERRCODE='23514'; END IF;
  IF NEW.version>0 THEN
   SELECT * INTO receipt FROM public.access_representation_event WHERE grant_id=NEW.id AND version=NEW.version;
   IF NOT FOUND THEN RAISE EXCEPTION 'Representation head requires its exact receipt' USING ERRCODE='23514'; END IF;
   expected_terms:=CASE WHEN receipt.operation='revoke' THEN receipt.retained_terms_revision ELSE receipt.version END;
   IF NEW.terms_revision IS DISTINCT FROM expected_terms OR NEW.state IS DISTINCT FROM (CASE WHEN receipt.operation='revoke' THEN 'revoked' ELSE 'active' END) THEN RAISE EXCEPTION 'Representation transition snapshot is inconsistent' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='access_representation_event' THEN
  SELECT version INTO final_version FROM public.access_representation WHERE id=NEW.grant_id;
  IF final_version<NEW.version THEN RAISE EXCEPTION 'Representation receipt must advance the head' USING ERRCODE='23514'; END IF;
  IF NEW.operation<>'revoke' AND NOT EXISTS(SELECT 1 FROM public.access_representation_revision WHERE grant_id=NEW.grant_id AND revision=NEW.version AND sealed) THEN RAISE EXCEPTION 'Representation receipt must complete its terms' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.access_representation_revision WHERE grant_id=NEW.grant_id AND revision=NEW.revision AND sealed) THEN RAISE EXCEPTION 'Representation terms must be sealed before commit' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS access_representation_entity_initialize ON public.access_subject;
CREATE TRIGGER access_representation_entity_initialize AFTER INSERT ON public.access_subject FOR EACH ROW EXECUTE FUNCTION public.initialize_access_representation_entity();
DROP TRIGGER IF EXISTS access_representation_entity_guard ON public.access_representation_entity;
CREATE TRIGGER access_representation_entity_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_representation_entity FOR EACH ROW EXECUTE FUNCTION public.guard_access_representation_entity();
DROP TRIGGER IF EXISTS access_representation_head_guard ON public.access_representation;
CREATE TRIGGER access_representation_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_representation FOR EACH ROW EXECUTE FUNCTION public.guard_access_representation_head();
DROP TRIGGER IF EXISTS access_representation_event_guard ON public.access_representation_event;
CREATE TRIGGER access_representation_event_guard BEFORE INSERT ON public.access_representation_event FOR EACH ROW EXECUTE FUNCTION public.guard_access_representation_event();
DROP TRIGGER IF EXISTS access_representation_event_immutable ON public.access_representation_event;
CREATE TRIGGER access_representation_event_immutable BEFORE UPDATE OR DELETE ON public.access_representation_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_representation_revision_guard ON public.access_representation_revision;
CREATE TRIGGER access_representation_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_representation_revision FOR EACH ROW EXECUTE FUNCTION public.guard_access_representation_revision();
DROP TRIGGER IF EXISTS access_representation_permission_guard ON public.access_representation_permission;
CREATE TRIGGER access_representation_permission_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_representation_permission FOR EACH ROW EXECUTE FUNCTION public.guard_access_representation_permission();
DROP TRIGGER IF EXISTS access_representation_head_complete ON public.access_representation;
CREATE CONSTRAINT TRIGGER access_representation_head_complete AFTER INSERT OR UPDATE ON public.access_representation DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_representation_history();
DROP TRIGGER IF EXISTS access_representation_event_complete ON public.access_representation_event;
CREATE CONSTRAINT TRIGGER access_representation_event_complete AFTER INSERT ON public.access_representation_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_representation_history();
DROP TRIGGER IF EXISTS access_representation_revision_complete ON public.access_representation_revision;
CREATE CONSTRAINT TRIGGER access_representation_revision_complete AFTER INSERT OR UPDATE ON public.access_representation_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_representation_history();
