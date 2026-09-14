CREATE OR REPLACE FUNCTION public.guard_access_assignment_ceiling()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event_kind text; actual_count integer; actual_digest text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Assignment approvals and revocation history are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.state<>'draft' OR NEW.sealed THEN RAISE EXCEPTION 'Assignment approval starts unsealed' USING ERRCODE='23514'; END IF;
  IF cardinality(NEW.target_path)>0 AND array_lower(NEW.target_path,1)<>1 THEN RAISE EXCEPTION 'Assignment paths use canonical array bounds' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(NEW.target_path) segment WHERE segment !~ '^[a-z0-9][a-z0-9-]{0,255}$') THEN RAISE EXCEPTION 'Invalid assignment target path' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.access_role_binding WHERE id=NEW.manager_binding_id AND target_scope_id=NEW.scope_id) THEN RAISE EXCEPTION 'Manager binding must belong to the approving authority scope' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF (to_jsonb(NEW)-'version'-'state'-'sealed') IS DISTINCT FROM (to_jsonb(OLD)-'version'-'state'-'sealed') OR NEW.version<>OLD.version+1 OR OLD.state='revoked' THEN RAISE EXCEPTION 'Assignment approval terms are immutable and revocation is terminal' USING ERRCODE='55000'; END IF;
 SELECT operation INTO event_kind FROM public.access_assignment_ceiling_event WHERE ceiling_id=NEW.id AND version=NEW.version;
 IF event_kind IS NULL OR (event_kind='create')<>(NEW.state='active') OR NOT NEW.sealed THEN RAISE EXCEPTION 'Assignment approval transition requires its exact receipt' USING ERRCODE='23514'; END IF;
 IF event_kind='create' THEN
  SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(family||':'||permission,E'\n' ORDER BY family COLLATE "C",permission COLLATE "C"),''),'UTF8')),'hex') INTO actual_count,actual_digest FROM public.access_assignment_ceiling_permission WHERE ceiling_id=NEW.id;
  IF actual_count<>NEW.permission_count OR actual_digest<>NEW.permission_digest THEN RAISE EXCEPTION 'Assignment permission approval is incomplete' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.access_role_binding WHERE id=NEW.manager_binding_id AND target_scope_id=NEW.scope_id AND state='active' AND terms_revision=NEW.manager_terms_revision) THEN RAISE EXCEPTION 'Assignment approval requires its current manager binding terms' USING ERRCODE='23514'; END IF;
 END IF;
 UPDATE public.access_role_binding_scope SET version=version+1 WHERE scope_id=NEW.scope_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment scope fence is missing' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_assignment_ceiling_permission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE sealed boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Assignment permission approvals are immutable' USING ERRCODE='55000'; END IF;
 SELECT c.sealed INTO sealed FROM public.access_assignment_ceiling c WHERE id=NEW.ceiling_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment approval is missing' USING ERRCODE='23503'; END IF;
 IF sealed THEN RAISE EXCEPTION 'Sealed assignment approvals cannot gain permissions' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_assignment_ceiling_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.access_assignment_ceiling%ROWTYPE; actor_id uuid;
BEGIN
 SELECT * INTO head FROM public.access_assignment_ceiling WHERE id=NEW.ceiling_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment approval is missing' USING ERRCODE='23503'; END IF;
 PERFORM scope_id FROM public.access_role_binding_scope WHERE scope_id=head.scope_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment scope fence is missing' USING ERRCODE='23503'; END IF;
 SELECT * INTO head FROM public.access_assignment_ceiling WHERE id=NEW.ceiling_id FOR UPDATE;
 SELECT auth_user_id INTO actor_id FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND OR (actor_id IS NOT NULL AND actor_id<>NEW.operator_auth_user_id) THEN RAISE EXCEPTION 'Assignment approval actor does not match its selected subject' USING ERRCODE='23514'; END IF;
 IF NEW.version<>head.version+1 OR (NEW.operation='create')<>(head.state='draft') OR head.state='revoked' THEN RAISE EXCEPTION 'Assignment approval receipt is stale' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.complete_access_assignment_ceiling()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE version bigint;
BEGIN
 IF TG_TABLE_NAME='access_assignment_ceiling' THEN
  SELECT c.version INTO version FROM public.access_assignment_ceiling c WHERE id=NEW.id;
 ELSE
  SELECT c.version INTO version FROM public.access_assignment_ceiling c WHERE id=NEW.ceiling_id;
 END IF;
 IF version IS NULL OR version=0 OR version<NEW.version THEN RAISE EXCEPTION 'Assignment approval must complete its sealed transition' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS access_assignment_ceiling_guard ON public.access_assignment_ceiling;
CREATE TRIGGER access_assignment_ceiling_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_assignment_ceiling FOR EACH ROW EXECUTE FUNCTION public.guard_access_assignment_ceiling();
DROP TRIGGER IF EXISTS access_assignment_ceiling_permission_guard ON public.access_assignment_ceiling_permission;
CREATE TRIGGER access_assignment_ceiling_permission_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_assignment_ceiling_permission FOR EACH ROW EXECUTE FUNCTION public.guard_access_assignment_ceiling_permission();
DROP TRIGGER IF EXISTS access_assignment_ceiling_event_guard ON public.access_assignment_ceiling_event;
CREATE TRIGGER access_assignment_ceiling_event_guard BEFORE INSERT ON public.access_assignment_ceiling_event FOR EACH ROW EXECUTE FUNCTION public.guard_access_assignment_ceiling_event();
DROP TRIGGER IF EXISTS access_assignment_ceiling_event_immutable ON public.access_assignment_ceiling_event;
CREATE TRIGGER access_assignment_ceiling_event_immutable BEFORE UPDATE OR DELETE ON public.access_assignment_ceiling_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_assignment_ceiling_complete ON public.access_assignment_ceiling;
CREATE CONSTRAINT TRIGGER access_assignment_ceiling_complete AFTER INSERT OR UPDATE ON public.access_assignment_ceiling DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_access_assignment_ceiling();
DROP TRIGGER IF EXISTS access_assignment_ceiling_event_complete ON public.access_assignment_ceiling_event;
CREATE CONSTRAINT TRIGGER access_assignment_ceiling_event_complete AFTER INSERT ON public.access_assignment_ceiling_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_access_assignment_ceiling();
