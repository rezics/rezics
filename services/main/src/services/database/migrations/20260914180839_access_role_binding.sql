SET search_path TO public;

ALTER TABLE "access_role_binding_revision" ADD COLUMN "membership_id" uuid;
ALTER TABLE "access_role_binding_revision" ADD COLUMN "membership_generation" bigint;
ALTER TABLE "access_role_binding_revision" ADD COLUMN "selection_group_id" uuid;
ALTER TABLE "access_role_binding_revision" ADD COLUMN "selection_version" bigint;
CREATE INDEX "access_role_binding_revision_admission_idx" ON "access_role_binding_revision" ("membership_id","membership_generation","binding_id","revision") WHERE "membership_id" is not null;
ALTER TABLE "access_role_binding_revision" ADD CONSTRAINT "access_role_binding_revision_admission_fk" FOREIGN KEY ("membership_id","membership_generation") REFERENCES "access_membership_admission"("membership_id","generation") ON DELETE RESTRICT;
ALTER TABLE "access_role_binding_revision" ADD CONSTRAINT "access_role_binding_revision_selection_fk" FOREIGN KEY ("membership_id","membership_generation","selection_group_id","selection_version") REFERENCES "access_group_membership_event"("membership_id","generation","group_id","version") ON DELETE RESTRICT;
ALTER TABLE "access_role_binding_revision" ADD CONSTRAINT "access_role_binding_revision_eligibility_check" CHECK ((("membership_id" is null and "membership_generation" is null and "selection_group_id" is null and "selection_version" is null) or ("membership_id" is not null and "membership_generation" between 1 and 9007199254740991 and (("selection_group_id" is null and "selection_version" is null) or ("selection_group_id" is not null and "selection_version" between 1 and 9007199254740991)))) and ("membership_id" is null)=("membership_generation" is null) and ("selection_group_id" is null)=("selection_version" is null));

-- Exact admission/selection dependencies never follow a later rejoin or reassignment.
CREATE OR REPLACE FUNCTION public.access_role_binding_recipient_is_current(p_binding uuid,p_revision bigint)
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
 FROM public.access_role_binding head
 JOIN public.access_role_binding_revision terms ON terms.binding_id=head.id
 WHERE head.id=p_binding AND terms.revision=p_revision AND terms.sealed
$$;

CREATE OR REPLACE FUNCTION public.lock_access_role_binding_eligibility(p_membership uuid,p_generation bigint,p_group uuid)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE owner_scope uuid;
BEGIN
 IF p_membership IS NULL THEN RETURN; END IF;
 SELECT scope_id INTO owner_scope FROM public.access_membership WHERE id=p_membership;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recipient membership is missing' USING ERRCODE='23503'; END IF;
 PERFORM scope_id FROM public.access_group_tree WHERE scope_id=owner_scope FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recipient membership tree fence is missing' USING ERRCODE='23503'; END IF;
 PERFORM id FROM public.access_membership WHERE id=p_membership FOR SHARE;
 IF p_group IS NOT NULL THEN
  PERFORM membership_id FROM public.access_group_membership_set WHERE membership_id=p_membership AND generation=p_generation FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient selection fence is missing' USING ERRCODE='23503'; END IF;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.initialize_access_role_binding_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 INSERT INTO public.access_role_binding_scope(scope_id) VALUES(NEW.id);
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Binding scope fence is retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 THEN RAISE EXCEPTION 'Binding scope starts at version zero' USING ERRCODE='23514'; END IF;
 ELSIF NEW.scope_id<>OLD.scope_id OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Binding scope identity is fixed and version advances by one' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE receipt public.access_role_binding_event%ROWTYPE; terms public.access_role_binding_revision%ROWTYPE; role_state text; role_scope uuid; expected_terms bigint;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Binding identity and history are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.state<>'draft' OR NEW.terms_revision IS NOT NULL THEN RAISE EXCEPTION 'Binding starts without effective terms' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.target_scope_id,NEW.role_id,NEW.recipient_kind,NEW.recipient_subject_id,NEW.recipient_group_id,NEW.recipient_scope_id) IS DISTINCT FROM ROW(OLD.id,OLD.target_scope_id,OLD.role_id,OLD.recipient_kind,OLD.recipient_subject_id,OLD.recipient_group_id,OLD.recipient_scope_id) THEN RAISE EXCEPTION 'Binding identity cannot be retargeted' USING ERRCODE='55000'; END IF;
 IF OLD.state='revoked' OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Binding transition is stale or revoked' USING ERRCODE='23514'; END IF;
 SELECT * INTO receipt FROM public.access_role_binding_event WHERE binding_id=NEW.id AND version=NEW.version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding transition requires an exact receipt' USING ERRCODE='23514'; END IF;
 expected_terms:=CASE WHEN receipt.operation='revoke' THEN receipt.retained_terms_revision ELSE receipt.version END;
 IF NEW.terms_revision IS DISTINCT FROM expected_terms OR NEW.state IS DISTINCT FROM (CASE WHEN receipt.operation='revoke' THEN 'revoked' ELSE 'active' END) THEN RAISE EXCEPTION 'Binding head does not match its receipt' USING ERRCODE='23514'; END IF;
 SELECT * INTO terms FROM public.access_role_binding_revision WHERE binding_id=NEW.id AND revision=NEW.terms_revision AND sealed;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding requires its exact sealed terms' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' THEN
  PERFORM public.lock_access_role_binding_eligibility(terms.membership_id,terms.membership_generation,terms.selection_group_id);
  IF public.access_role_binding_recipient_is_current(NEW.id,NEW.terms_revision) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Recipient admission or exact Group selection is no longer current' USING ERRCODE='23514'; END IF;
  SELECT state,scope_id INTO role_state,role_scope FROM public.access_role WHERE id=NEW.role_id FOR SHARE;
  IF role_state IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Binding requires an active role at its effect' USING ERRCODE='23514'; END IF;
  IF terms.permission_policy='local-role' AND (role_scope<>NEW.target_scope_id OR (NEW.recipient_scope_id IS NOT NULL AND NEW.recipient_scope_id<>NEW.target_scope_id)) THEN RAISE EXCEPTION 'Cross-authority role use requires explicit approved permissions' USING ERRCODE='23514'; END IF;
  IF NEW.recipient_kind='group' AND NOT EXISTS(SELECT 1 FROM public.access_group WHERE id=NEW.recipient_group_id AND scope_id=NEW.recipient_scope_id AND state='active') THEN RAISE EXCEPTION 'Binding Group must be active at its effect' USING ERRCODE='23514'; END IF;
 END IF;
 UPDATE public.access_role_binding_scope SET version=version+1 WHERE scope_id=NEW.target_scope_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding scope fence is missing' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.access_role_binding%ROWTYPE; declared_actor uuid;
BEGIN
 SELECT * INTO head FROM public.access_role_binding WHERE id=NEW.binding_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding identity is missing' USING ERRCODE='23503'; END IF;
 PERFORM scope_id FROM public.access_role_binding_scope WHERE scope_id=head.target_scope_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding scope fence is missing' USING ERRCODE='23503'; END IF;
 IF head.recipient_kind='group' THEN
  PERFORM scope_id FROM public.access_group_tree WHERE scope_id=head.recipient_scope_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient Group tree fence is missing' USING ERRCODE='23503'; END IF;
 END IF;
 PERFORM id FROM public.access_role WHERE id=head.role_id FOR SHARE;
 SELECT * INTO head FROM public.access_role_binding WHERE id=NEW.binding_id FOR UPDATE;
 SELECT auth_user_id INTO declared_actor FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Authority subject is missing' USING ERRCODE='23503'; END IF;
 IF declared_actor IS NOT NULL AND declared_actor<>NEW.operator_auth_user_id THEN RAISE EXCEPTION 'Direct authority cannot name another operator' USING ERRCODE='23514'; END IF;
 IF head.state='revoked' OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Binding receipt is stale or revoked' USING ERRCODE='23514'; END IF;
 IF NEW.operation='create' THEN
  IF head.version<>0 THEN RAISE EXCEPTION 'Binding already exists' USING ERRCODE='23514'; END IF;
 ELSIF head.version=0 THEN RAISE EXCEPTION 'Binding must be created first' USING ERRCODE='23514';
 END IF;
 IF NEW.operation='revoke' AND NEW.retained_terms_revision IS DISTINCT FROM head.terms_revision THEN RAISE EXCEPTION 'Revocation retains the current terms' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event_kind text; actual_count integer; actual_digest text; recipient public.access_role_binding%ROWTYPE; member public.access_membership%ROWTYPE; selection_operation text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Binding terms are immutable' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT operation INTO event_kind FROM public.access_role_binding_event WHERE binding_id=NEW.binding_id AND version=NEW.revision;
  IF event_kind IS NULL THEN RAISE EXCEPTION 'Terms receipt is missing' USING ERRCODE='23503'; END IF;
  IF event_kind NOT IN('create','amend') OR NEW.sealed THEN RAISE EXCEPTION 'Terms require their creating receipt before sealing' USING ERRCODE='23514'; END IF;
  IF cardinality(NEW.target_path)>0 AND array_lower(NEW.target_path,1)<>1 THEN RAISE EXCEPTION 'Binding target paths use canonical array bounds' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(NEW.target_path) segment WHERE segment !~ '^[a-z0-9][a-z0-9-]{0,255}$') THEN RAISE EXCEPTION 'Invalid binding target path' USING ERRCODE='23514'; END IF;
  IF NEW.membership_id IS NOT NULL THEN
   SELECT * INTO recipient FROM public.access_role_binding WHERE id=NEW.binding_id;
   SELECT * INTO member FROM public.access_membership WHERE id=NEW.membership_id;
   IF recipient.recipient_kind IS DISTINCT FROM 'subject' OR member.subject_id IS DISTINCT FROM recipient.recipient_subject_id THEN RAISE EXCEPTION 'Admission dependency must belong to the exact subject recipient' USING ERRCODE='23514'; END IF;
   IF NEW.selection_group_id IS NOT NULL THEN
    SELECT operation INTO selection_operation FROM public.access_group_membership_event WHERE membership_id=NEW.membership_id AND generation=NEW.membership_generation AND group_id=NEW.selection_group_id AND version=NEW.selection_version;
    IF selection_operation IS DISTINCT FROM 'assign' THEN RAISE EXCEPTION 'Group dependency requires its exact assignment receipt' USING ERRCODE='23514'; END IF;
   END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.sealed OR NOT NEW.sealed OR (to_jsonb(NEW)-'sealed') IS DISTINCT FROM (to_jsonb(OLD)-'sealed') THEN RAISE EXCEPTION 'Only sealing can change binding terms' USING ERRCODE='55000'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(family||':'||permission,E'\n' ORDER BY family COLLATE "C",permission COLLATE "C"),''),'UTF8')),'hex') INTO actual_count,actual_digest FROM public.access_role_binding_permission WHERE binding_id=NEW.binding_id AND revision=NEW.revision;
 IF actual_count<>NEW.permission_count OR actual_digest<>NEW.permission_digest THEN RAISE EXCEPTION 'Binding approval snapshot is incomplete or inconsistent' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_permission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE terms public.access_role_binding_revision%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Binding approval history is immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO terms FROM public.access_role_binding_revision WHERE binding_id=NEW.binding_id AND revision=NEW.revision FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding terms are missing' USING ERRCODE='23503'; END IF;
 IF terms.sealed THEN RAISE EXCEPTION 'Sealed terms cannot gain approved permissions' USING ERRCODE='55000'; END IF;
 IF terms.permission_policy<>'frozen-ceiling' THEN RAISE EXCEPTION 'Local role following has no frozen permission rows' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_access_role_binding_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE final_version bigint; receipt public.access_role_binding_event%ROWTYPE; expected_terms bigint;
BEGIN
 IF TG_TABLE_NAME='access_role_binding' THEN
  SELECT version INTO final_version FROM public.access_role_binding WHERE id=NEW.id;
  IF final_version=0 THEN RAISE EXCEPTION 'Binding creation must complete sealed terms' USING ERRCODE='23514'; END IF;
  IF NEW.version>0 THEN
   SELECT * INTO receipt FROM public.access_role_binding_event WHERE binding_id=NEW.id AND version=NEW.version;
   IF NOT FOUND THEN RAISE EXCEPTION 'Binding head requires its exact receipt' USING ERRCODE='23514'; END IF;
   expected_terms:=CASE WHEN receipt.operation='revoke' THEN receipt.retained_terms_revision ELSE receipt.version END;
   IF NEW.terms_revision IS DISTINCT FROM expected_terms OR NEW.state IS DISTINCT FROM (CASE WHEN receipt.operation='revoke' THEN 'revoked' ELSE 'active' END) THEN RAISE EXCEPTION 'Binding transition snapshot is inconsistent' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='access_role_binding_event' THEN
  SELECT version INTO final_version FROM public.access_role_binding WHERE id=NEW.binding_id;
  IF final_version<NEW.version THEN RAISE EXCEPTION 'Binding receipt must advance the head' USING ERRCODE='23514'; END IF;
  IF NEW.operation<>'revoke' AND NOT EXISTS(SELECT 1 FROM public.access_role_binding_revision WHERE binding_id=NEW.binding_id AND revision=NEW.version AND sealed) THEN RAISE EXCEPTION 'Binding receipt must complete its terms' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.access_role_binding_revision WHERE binding_id=NEW.binding_id AND revision=NEW.revision AND sealed) THEN RAISE EXCEPTION 'Binding terms must be sealed before commit' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS access_role_binding_scope_initialize ON public.access_scope;
CREATE TRIGGER access_role_binding_scope_initialize AFTER INSERT ON public.access_scope FOR EACH ROW EXECUTE FUNCTION public.initialize_access_role_binding_scope();
DROP TRIGGER IF EXISTS access_role_binding_scope_guard ON public.access_role_binding_scope;
CREATE TRIGGER access_role_binding_scope_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_binding_scope FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_scope();
DROP TRIGGER IF EXISTS access_role_binding_head_guard ON public.access_role_binding;
CREATE TRIGGER access_role_binding_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_binding FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_head();
DROP TRIGGER IF EXISTS access_role_binding_event_guard ON public.access_role_binding_event;
CREATE TRIGGER access_role_binding_event_guard BEFORE INSERT ON public.access_role_binding_event FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_event();
DROP TRIGGER IF EXISTS access_role_binding_event_immutable ON public.access_role_binding_event;
CREATE TRIGGER access_role_binding_event_immutable BEFORE UPDATE OR DELETE ON public.access_role_binding_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_role_binding_revision_guard ON public.access_role_binding_revision;
CREATE TRIGGER access_role_binding_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_binding_revision FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_revision();
DROP TRIGGER IF EXISTS access_role_binding_permission_guard ON public.access_role_binding_permission;
CREATE TRIGGER access_role_binding_permission_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_binding_permission FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_permission();
DROP TRIGGER IF EXISTS access_role_binding_head_complete ON public.access_role_binding;
CREATE CONSTRAINT TRIGGER access_role_binding_head_complete AFTER INSERT OR UPDATE ON public.access_role_binding DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_role_binding_history();
DROP TRIGGER IF EXISTS access_role_binding_event_complete ON public.access_role_binding_event;
CREATE CONSTRAINT TRIGGER access_role_binding_event_complete AFTER INSERT ON public.access_role_binding_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_role_binding_history();
DROP TRIGGER IF EXISTS access_role_binding_revision_complete ON public.access_role_binding_revision;
CREATE CONSTRAINT TRIGGER access_role_binding_revision_complete AFTER INSERT OR UPDATE ON public.access_role_binding_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_role_binding_history();
