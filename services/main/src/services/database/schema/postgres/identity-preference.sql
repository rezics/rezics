CREATE OR REPLACE FUNCTION public.guard_identity_preference()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE owner_id uuid; erased timestamptz; event public.identity_preference_event%ROWTYPE;
BEGIN
 owner_id:=CASE WHEN TG_OP='DELETE' THEN OLD.auth_user_id ELSE NEW.auth_user_id END;
 SELECT erased_at INTO erased FROM public.users WHERE id=owner_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Preference account is unavailable' USING ERRCODE='23503'; END IF;
 IF TG_OP='DELETE' THEN
  IF erased IS NULL THEN RAISE EXCEPTION 'Clear the preference with a revision; deletion is reserved for account erasure' USING ERRCODE='55000'; END IF;
  RETURN OLD;
 END IF;
 IF erased IS NOT NULL THEN RAISE EXCEPTION 'Erased accounts cannot change identity preferences' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.selection_kind<>'none' OR NEW.entity_id IS NOT NULL THEN RAISE EXCEPTION 'Preference starts without a selected identity' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.auth_user_id,NEW.client_id) IS DISTINCT FROM ROW(OLD.id,OLD.auth_user_id,OLD.client_id) OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Preference identity is fixed and control advances by one' USING ERRCODE='23514'; END IF;
 SELECT * INTO event FROM public.identity_preference_event WHERE preference_id=NEW.id AND version=NEW.version;
 IF NOT FOUND OR ROW(event.selection_kind,event.entity_id) IS DISTINCT FROM ROW(NEW.selection_kind,NEW.entity_id) THEN RAISE EXCEPTION 'Preference selection requires its exact receipt' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_identity_preference_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.identity_preference%ROWTYPE; erased timestamptz; actor_id uuid;
BEGIN
 SELECT * INTO head FROM public.identity_preference WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.preference_id ELSE NEW.preference_id END;
 IF NOT FOUND THEN RAISE EXCEPTION 'Preference owner is missing' USING ERRCODE='23503'; END IF;
 SELECT erased_at INTO erased FROM public.users WHERE id=head.auth_user_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Preference account is missing' USING ERRCODE='23503'; END IF;
 IF TG_OP='DELETE' THEN
  IF erased IS NULL THEN RAISE EXCEPTION 'Preference receipts may be deleted only during account erasure' USING ERRCODE='55000'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Preference receipts are immutable before erasure' USING ERRCODE='55000'; END IF;
 IF erased IS NOT NULL THEN RAISE EXCEPTION 'Erased accounts cannot select identities' USING ERRCODE='23514'; END IF;
 SELECT * INTO head FROM public.identity_preference WHERE id=NEW.preference_id FOR UPDATE;
 IF NEW.version<>head.version+1 OR (NEW.selection_kind='inherit-main' AND head.client_id IS NULL) THEN RAISE EXCEPTION 'Preference receipt is stale or has an invalid main selection' USING ERRCODE='23514'; END IF;
 SELECT auth_user_id INTO actor_id FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND OR (actor_id IS NOT NULL AND actor_id<>NEW.operator_auth_user_id) THEN RAISE EXCEPTION 'Preference authority subject does not match its operator' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.complete_identity_preference()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE final_version bigint;
BEGIN
 IF TG_TABLE_NAME='identity_preference' THEN
  SELECT version INTO final_version FROM public.identity_preference WHERE id=NEW.id;
  IF final_version=0 THEN RAISE EXCEPTION 'Preference admission must complete its first receipt' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT version INTO final_version FROM public.identity_preference WHERE id=NEW.preference_id;
  IF final_version<NEW.version THEN RAISE EXCEPTION 'Preference receipt must advance its head' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS identity_preference_guard ON public.identity_preference;
CREATE TRIGGER identity_preference_guard BEFORE INSERT OR UPDATE OR DELETE ON public.identity_preference FOR EACH ROW EXECUTE FUNCTION public.guard_identity_preference();
DROP TRIGGER IF EXISTS identity_preference_event_guard ON public.identity_preference_event;
CREATE TRIGGER identity_preference_event_guard BEFORE INSERT OR UPDATE OR DELETE ON public.identity_preference_event FOR EACH ROW EXECUTE FUNCTION public.guard_identity_preference_event();
DROP TRIGGER IF EXISTS identity_preference_complete ON public.identity_preference;
CREATE CONSTRAINT TRIGGER identity_preference_complete AFTER INSERT OR UPDATE ON public.identity_preference DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_identity_preference();
DROP TRIGGER IF EXISTS identity_preference_event_complete ON public.identity_preference_event;
CREATE CONSTRAINT TRIGGER identity_preference_event_complete AFTER INSERT ON public.identity_preference_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_identity_preference();
