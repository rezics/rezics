SET search_path TO public;

CREATE TABLE "identity_preference_representation" (
	"preference_id" uuid,
	"version" bigint,
	"grant_id" uuid,
	"terms_revision" bigint NOT NULL,
	CONSTRAINT "identity_preference_representation_pkey" PRIMARY KEY("preference_id","version","grant_id")
);

ALTER TABLE "identity_preference_event" ADD COLUMN "representation_count" integer NOT NULL;
ALTER TABLE "identity_preference_event" ADD COLUMN "representation_digest" text NOT NULL;
CREATE INDEX "identity_preference_representation_grant_idx" ON "identity_preference_representation" ("grant_id","terms_revision","preference_id","version");
ALTER TABLE "identity_preference_representation" ADD CONSTRAINT "identity_preference_representation_event_fk" FOREIGN KEY ("preference_id","version") REFERENCES "identity_preference_event"("preference_id","version") ON DELETE RESTRICT;
ALTER TABLE "identity_preference_representation" ADD CONSTRAINT "identity_preference_representation_terms_fk" FOREIGN KEY ("grant_id","terms_revision") REFERENCES "access_representation_revision"("grant_id","revision") ON DELETE RESTRICT;
ALTER TABLE "identity_preference_event" ADD CONSTRAINT "identity_preference_event_representation_check" CHECK ("representation_digest" ~ '^[0-9a-f]{64}$' and (("selection_kind"='entity' and "representation_count" between 1 and 8) or ("selection_kind"<>'entity' and "representation_count"=0)));

CREATE OR REPLACE FUNCTION public.identity_preference_representations_match(preference uuid, selected_version bigint)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT e.representation_count=h.amount AND e.representation_digest=h.digest
 FROM public.identity_preference_event e CROSS JOIN LATERAL(
  SELECT count(*)::integer AS amount,encode(sha256(convert_to(coalesce(string_agg(v.grant_id::text||':'||v.terms_revision::text,E'\n' ORDER BY v.grant_id),''),'UTF8')),'hex') AS digest
  FROM (SELECT grant_id,terms_revision FROM public.identity_preference_representation
   WHERE preference_id=preference AND version=selected_version ORDER BY grant_id LIMIT 9) v
 ) h WHERE e.preference_id=preference AND e.version=selected_version
$$;

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
 IF public.identity_preference_representations_match(NEW.id,NEW.version) IS NOT TRUE THEN RAISE EXCEPTION 'Preference context hints do not match their receipt' USING ERRCODE='23514'; END IF;
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

CREATE OR REPLACE FUNCTION public.guard_identity_preference_representation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.identity_preference%ROWTYPE; erased timestamptz; selected_preference uuid; selected_version bigint;
BEGIN
 selected_preference:=CASE WHEN TG_OP='DELETE' THEN OLD.preference_id ELSE NEW.preference_id END;
 selected_version:=CASE WHEN TG_OP='DELETE' THEN OLD.version ELSE NEW.version END;
 SELECT * INTO head FROM public.identity_preference WHERE id=selected_preference;
 IF NOT FOUND THEN RAISE EXCEPTION 'Preference owner is missing' USING ERRCODE='23503'; END IF;
 SELECT erased_at INTO erased FROM public.users WHERE id=head.auth_user_id FOR NO KEY UPDATE;
 IF TG_OP='DELETE' THEN
  IF erased IS NULL THEN RAISE EXCEPTION 'Preference context hints are retained until account erasure' USING ERRCODE='55000'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Preference context hints are immutable' USING ERRCODE='55000'; END IF;
 IF erased IS NOT NULL THEN RAISE EXCEPTION 'Erased accounts cannot select identities' USING ERRCODE='23514'; END IF;
 SELECT * INTO head FROM public.identity_preference WHERE id=selected_preference FOR UPDATE;
 IF selected_version<>head.version+1 OR NOT EXISTS(SELECT 1 FROM public.identity_preference_event
  WHERE preference_id=selected_preference AND version=selected_version AND selection_kind='entity')
 THEN RAISE EXCEPTION 'Context hints must belong to an open Entity selection' USING ERRCODE='23514'; END IF;
 IF (SELECT count(*) FROM (SELECT 1 FROM public.identity_preference_representation
  WHERE preference_id=selected_preference AND version=selected_version LIMIT 8) h)>=8
 THEN RAISE EXCEPTION 'Preference context hint budget exceeded' USING ERRCODE='54000'; END IF;
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
  IF public.identity_preference_representations_match(NEW.preference_id,NEW.version) IS NOT TRUE THEN RAISE EXCEPTION 'Preference context hint snapshot is incomplete' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS identity_preference_representation_guard ON public.identity_preference_representation;
CREATE TRIGGER identity_preference_representation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.identity_preference_representation FOR EACH ROW EXECUTE FUNCTION public.guard_identity_preference_representation();
DROP TRIGGER IF EXISTS identity_preference_guard ON public.identity_preference;
CREATE TRIGGER identity_preference_guard BEFORE INSERT OR UPDATE OR DELETE ON public.identity_preference FOR EACH ROW EXECUTE FUNCTION public.guard_identity_preference();
DROP TRIGGER IF EXISTS identity_preference_event_guard ON public.identity_preference_event;
CREATE TRIGGER identity_preference_event_guard BEFORE INSERT OR UPDATE OR DELETE ON public.identity_preference_event FOR EACH ROW EXECUTE FUNCTION public.guard_identity_preference_event();
DROP TRIGGER IF EXISTS identity_preference_complete ON public.identity_preference;
CREATE CONSTRAINT TRIGGER identity_preference_complete AFTER INSERT OR UPDATE ON public.identity_preference DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_identity_preference();
DROP TRIGGER IF EXISTS identity_preference_event_complete ON public.identity_preference_event;
CREATE CONSTRAINT TRIGGER identity_preference_event_complete AFTER INSERT ON public.identity_preference_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.complete_identity_preference();
