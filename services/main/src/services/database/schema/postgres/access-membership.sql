-- A pair-local fence covers both present and absent enrollment rows.
CREATE OR REPLACE FUNCTION public.lock_access_membership_key(p_scope uuid,p_subject uuid,p_exclusive boolean)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE lock_key bigint;
BEGIN
 IF p_scope IS NULL OR p_subject IS NULL OR p_exclusive IS NULL THEN RAISE EXCEPTION 'Membership fence requires exact scope, subject and mode' USING ERRCODE='22023'; END IF;
 lock_key:=hashtextextended('access-membership:'||p_scope::text||':'||p_subject::text,0);
 IF p_exclusive THEN PERFORM pg_advisory_xact_lock(lock_key);
 ELSE PERFORM pg_advisory_xact_lock_shared(lock_key); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.lock_access_membership_keys(p_scopes uuid[],p_subject uuid,p_exclusive boolean)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE scope_id uuid;
BEGIN
 IF p_scopes IS NULL OR cardinality(p_scopes)>64 OR coalesce(array_ndims(p_scopes),1)<>1 OR array_position(p_scopes,NULL) IS NOT NULL OR p_subject IS NULL OR p_exclusive IS NULL THEN RAISE EXCEPTION 'Membership fence selection exceeds its bounded scope keys' USING ERRCODE='22023'; END IF;
 FOR scope_id IN SELECT DISTINCT selected FROM unnest(p_scopes) selected ORDER BY selected LOOP
  PERFORM public.lock_access_membership_key(scope_id,p_subject,p_exclusive);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_membership_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE receipt public.access_membership_event%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Membership identity and generations are retained' USING ERRCODE='55000'; END IF;
 PERFORM public.lock_access_membership_key(NEW.scope_id,NEW.subject_id,true);
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.last_generation<>0 OR NEW.active_generation IS NOT NULL THEN RAISE EXCEPTION 'Membership identity starts without admission' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.scope_id,NEW.subject_id) IS DISTINCT FROM ROW(OLD.id,OLD.scope_id,OLD.subject_id) THEN RAISE EXCEPTION 'Membership identity is immutable' USING ERRCODE='55000'; END IF;
 IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Membership version must advance by one' USING ERRCODE='23514'; END IF;
 SELECT * INTO receipt FROM public.access_membership_event WHERE membership_id=NEW.id AND version=NEW.version;
 IF NOT FOUND OR ROW(receipt.last_generation,receipt.active_generation) IS DISTINCT FROM ROW(NEW.last_generation,NEW.active_generation) THEN RAISE EXCEPTION 'Membership transition requires its exact receipt' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_membership_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.access_membership%ROWTYPE; declared_actor uuid;
BEGIN
 SELECT * INTO head FROM public.access_membership WHERE id=NEW.membership_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Membership identity is missing' USING ERRCODE='23503'; END IF;
 PERFORM public.lock_access_membership_key(head.scope_id,head.subject_id,true);
 SELECT * INTO head FROM public.access_membership WHERE id=NEW.membership_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Membership identity is missing' USING ERRCODE='23503'; END IF;
 SELECT auth_user_id INTO declared_actor FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Authority subject is missing' USING ERRCODE='23503'; END IF;
 IF declared_actor IS NOT NULL AND declared_actor<>NEW.operator_auth_user_id THEN RAISE EXCEPTION 'Direct authority cannot name another private actor' USING ERRCODE='23514'; END IF;
 IF NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Membership receipt is stale' USING ERRCODE='23514'; END IF;
 IF NEW.operation='admit' THEN
  IF head.active_generation IS NOT NULL OR NEW.last_generation<>head.last_generation+1 OR NEW.active_generation IS DISTINCT FROM NEW.last_generation THEN RAISE EXCEPTION 'Admission requires a new generation after inactivity' USING ERRCODE='23514'; END IF;
 ELSE
  IF head.active_generation IS NULL OR NEW.last_generation<>head.last_generation OR NEW.active_generation IS NOT NULL THEN RAISE EXCEPTION 'Ending membership preserves its last generation' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.operation='leave' AND NEW.authority_subject_id<>head.subject_id THEN RAISE EXCEPTION 'Leave is the selected member subject action' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_membership_admission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE receipt public.access_membership_event%ROWTYPE;
BEGIN
 SELECT * INTO receipt FROM public.access_membership_event WHERE membership_id=NEW.membership_id AND version=NEW.event_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Admission receipt is missing' USING ERRCODE='23503'; END IF;
 IF receipt.operation<>'admit' OR NEW.generation IS DISTINCT FROM receipt.active_generation THEN RAISE EXCEPTION 'Admission must match its exact transition' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_access_membership_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE final_version bigint; receipt public.access_membership_event%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='access_membership' THEN
  SELECT version INTO final_version FROM public.access_membership WHERE id=NEW.id;
  IF final_version=0 THEN RAISE EXCEPTION 'An initial membership identity must complete its admission' USING ERRCODE='23514'; END IF;
  IF NEW.version>0 THEN
   SELECT * INTO receipt FROM public.access_membership_event WHERE membership_id=NEW.id AND version=NEW.version;
   IF NOT FOUND OR ROW(receipt.last_generation,receipt.active_generation) IS DISTINCT FROM ROW(NEW.last_generation,NEW.active_generation) THEN RAISE EXCEPTION 'Every membership head transition requires its snapshot' USING ERRCODE='23514'; END IF;
  END IF;
 ELSE
  SELECT version INTO final_version FROM public.access_membership WHERE id=NEW.membership_id;
  IF final_version<NEW.version THEN RAISE EXCEPTION 'Membership receipt must advance its head' USING ERRCODE='23514'; END IF;
  IF NEW.operation='admit' AND NOT EXISTS(SELECT 1 FROM public.access_membership_admission WHERE membership_id=NEW.membership_id AND generation=NEW.active_generation AND event_version=NEW.version) THEN RAISE EXCEPTION 'Admission receipt requires its retained generation' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS access_membership_head_guard ON public.access_membership;
CREATE TRIGGER access_membership_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_membership FOR EACH ROW EXECUTE FUNCTION public.guard_access_membership_head();
DROP TRIGGER IF EXISTS access_membership_event_guard ON public.access_membership_event;
CREATE TRIGGER access_membership_event_guard BEFORE INSERT ON public.access_membership_event FOR EACH ROW EXECUTE FUNCTION public.guard_access_membership_event();
DROP TRIGGER IF EXISTS access_membership_event_immutable ON public.access_membership_event;
CREATE TRIGGER access_membership_event_immutable BEFORE UPDATE OR DELETE ON public.access_membership_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_membership_admission_guard ON public.access_membership_admission;
CREATE TRIGGER access_membership_admission_guard BEFORE INSERT ON public.access_membership_admission FOR EACH ROW EXECUTE FUNCTION public.guard_access_membership_admission();
DROP TRIGGER IF EXISTS access_membership_admission_immutable ON public.access_membership_admission;
CREATE TRIGGER access_membership_admission_immutable BEFORE UPDATE OR DELETE ON public.access_membership_admission FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_membership_head_complete ON public.access_membership;
CREATE CONSTRAINT TRIGGER access_membership_head_complete AFTER INSERT OR UPDATE ON public.access_membership DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_membership_history();
DROP TRIGGER IF EXISTS access_membership_event_complete ON public.access_membership_event;
CREATE CONSTRAINT TRIGGER access_membership_event_complete AFTER INSERT ON public.access_membership_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_membership_history();
