SET search_path TO public;

-- Create "access_group_membership_set" table
CREATE TABLE "access_group_membership_set" (
  "membership_id" uuid NOT NULL,
  "generation" bigint NOT NULL,
  "scope_id" uuid NOT NULL,
  "version" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("membership_id", "generation"),
  CONSTRAINT "access_group_membership_set_admission_fk" FOREIGN KEY ("membership_id", "generation") REFERENCES "access_membership_admission" ("membership_id", "generation") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "access_group_membership_set_scope_fk" FOREIGN KEY ("membership_id", "scope_id") REFERENCES "access_membership" ("id", "scope_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "access_group_membership_set_snwW13turIZS_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_group_tree" ("scope_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "access_group_membership_set_version_check" CHECK ((version >= 0) AND (version <= '9007199254740991'::bigint))
);
-- Create index "access_group_membership_set_scope_key" to table: "access_group_membership_set"
CREATE UNIQUE INDEX "access_group_membership_set_scope_key" ON "access_group_membership_set" ("membership_id", "generation", "scope_id");
-- Create "access_group_membership" table
CREATE TABLE "access_group_membership" (
  "membership_id" uuid NOT NULL,
  "generation" bigint NOT NULL,
  "group_id" uuid NOT NULL,
  "scope_id" uuid NOT NULL,
  "version" bigint NOT NULL DEFAULT 0,
  "selected" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("membership_id", "generation", "group_id"),
  CONSTRAINT "access_group_membership_group_scope_fk" FOREIGN KEY ("group_id", "scope_id") REFERENCES "access_group" ("id", "scope_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "access_group_membership_set_fk" FOREIGN KEY ("membership_id", "generation", "scope_id") REFERENCES "access_group_membership_set" ("membership_id", "generation", "scope_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "access_group_membership_version_check" CHECK ((version >= 0) AND (version <= '9007199254740991'::bigint))
);
-- Create index "access_group_membership_roster_idx" to table: "access_group_membership"
CREATE INDEX "access_group_membership_roster_idx" ON "access_group_membership" ("group_id", "membership_id", "generation") WHERE selected;
-- Create index "access_group_membership_selected_idx" to table: "access_group_membership"
CREATE INDEX "access_group_membership_selected_idx" ON "access_group_membership" ("membership_id", "generation", "group_id") WHERE selected;
-- Create "access_group_membership_event" table
CREATE TABLE "access_group_membership_event" (
  "membership_id" uuid NOT NULL,
  "generation" bigint NOT NULL,
  "group_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "operation_id" uuid NOT NULL,
  "request_digest" text NOT NULL,
  "operation" text NOT NULL,
  "selected_after" boolean NOT NULL,
  "operator_auth_user_id" uuid NOT NULL,
  "authority_subject_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("membership_id", "generation", "group_id", "version"),
  CONSTRAINT "access_group_membership_event_VQaDB6GISvcn_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "access_group_membership_event_gfcRSbghPITx_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "access_group_membership_event_selection_fk" FOREIGN KEY ("membership_id", "generation", "group_id") REFERENCES "access_group_membership" ("membership_id", "generation", "group_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "access_group_membership_event_digest_check" CHECK (request_digest ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "access_group_membership_event_operation_check" CHECK (operation = ANY (ARRAY['assign'::text, 'remove'::text, 'prune'::text])),
  CONSTRAINT "access_group_membership_event_selection_check" CHECK (selected_after = (operation = 'assign'::text)),
  CONSTRAINT "access_group_membership_event_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "access_group_membership_event_operation_key" to table: "access_group_membership_event"
CREATE UNIQUE INDEX "access_group_membership_event_operation_key" ON "access_group_membership_event" ("membership_id", "generation", "group_id", "operation_id");

CREATE OR REPLACE FUNCTION public.initialize_access_group_membership_set()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE owner_scope uuid;
BEGIN
 SELECT scope_id INTO owner_scope FROM public.access_membership WHERE id=NEW.membership_id;
 INSERT INTO public.access_group_tree(scope_id) VALUES(owner_scope) ON CONFLICT DO NOTHING;
 INSERT INTO public.access_group_membership_set(membership_id,generation,scope_id) VALUES(NEW.membership_id,NEW.generation,owner_scope);
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_group_membership_set()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Admission selection fence is retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 THEN RAISE EXCEPTION 'Selection fence starts at version zero' USING ERRCODE='23514'; END IF;
 ELSIF ROW(NEW.membership_id,NEW.generation,NEW.scope_id) IS DISTINCT FROM ROW(OLD.membership_id,OLD.generation,OLD.scope_id) OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Selection fence identity is fixed and version advances by one' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_group_membership_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.access_group_membership%ROWTYPE; member public.access_membership%ROWTYPE; group_state text; declared_actor uuid;
BEGIN
 SELECT * INTO head FROM public.access_group_membership WHERE membership_id=NEW.membership_id AND generation=NEW.generation AND group_id=NEW.group_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Direct selection identity is missing' USING ERRCODE='23503'; END IF;
 PERFORM scope_id FROM public.access_group_tree WHERE scope_id=head.scope_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Group tree fence is missing' USING ERRCODE='23503'; END IF;
 SELECT * INTO member FROM public.access_membership WHERE id=head.membership_id FOR SHARE;
 PERFORM membership_id FROM public.access_group_membership_set WHERE membership_id=head.membership_id AND generation=head.generation FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Selection set fence is missing' USING ERRCODE='23503'; END IF;
 SELECT * INTO head FROM public.access_group_membership WHERE membership_id=NEW.membership_id AND generation=NEW.generation AND group_id=NEW.group_id FOR UPDATE;
 SELECT state INTO group_state FROM public.access_group WHERE id=head.group_id AND scope_id=head.scope_id;
 IF member.id IS NULL OR group_state IS NULL THEN RAISE EXCEPTION 'Selection eligibility source is missing' USING ERRCODE='23503'; END IF;
 SELECT auth_user_id INTO declared_actor FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Authority subject is missing' USING ERRCODE='23503'; END IF;
 IF declared_actor IS NOT NULL AND declared_actor<>NEW.operator_auth_user_id THEN RAISE EXCEPTION 'Direct authority cannot name another private actor' USING ERRCODE='23514'; END IF;
 IF NEW.version<>head.version+1 OR NEW.selected_after=head.selected THEN RAISE EXCEPTION 'Selection command is stale or does not change selection' USING ERRCODE='23514'; END IF;
 IF NEW.operation='assign' AND (member.active_generation IS DISTINCT FROM head.generation OR group_state IS DISTINCT FROM 'active') THEN RAISE EXCEPTION 'Assignment requires a current admission and active Group' USING ERRCODE='23514'; END IF;
 IF NEW.operation='prune' AND member.active_generation IS NOT DISTINCT FROM head.generation AND group_state IS DISTINCT FROM 'retired' THEN RAISE EXCEPTION 'Pruning requires a permanently ineffective selection' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_group_membership_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE receipt public.access_group_membership_event%ROWTYPE; selected_count integer; member public.access_membership%ROWTYPE; group_state text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Direct selection identity and history are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.selected THEN RAISE EXCEPTION 'Selection identity starts unselected' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.membership_id,NEW.generation,NEW.group_id,NEW.scope_id) IS DISTINCT FROM ROW(OLD.membership_id,OLD.generation,OLD.group_id,OLD.scope_id) THEN RAISE EXCEPTION 'Direct selection identity is immutable' USING ERRCODE='55000'; END IF;
 IF NEW.version<>OLD.version+1 OR NEW.selected=OLD.selected THEN RAISE EXCEPTION 'Selection transition must advance and change selection' USING ERRCODE='23514'; END IF;
 SELECT * INTO receipt FROM public.access_group_membership_event WHERE membership_id=NEW.membership_id AND generation=NEW.generation AND group_id=NEW.group_id AND version=NEW.version;
 IF NOT FOUND OR receipt.selected_after IS DISTINCT FROM NEW.selected THEN RAISE EXCEPTION 'Selection transition requires its exact receipt' USING ERRCODE='23514'; END IF;
 PERFORM scope_id FROM public.access_group_tree WHERE scope_id=NEW.scope_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Group tree fence is missing' USING ERRCODE='23503'; END IF;
 SELECT * INTO member FROM public.access_membership WHERE id=NEW.membership_id FOR SHARE;
 PERFORM membership_id FROM public.access_group_membership_set WHERE membership_id=NEW.membership_id AND generation=NEW.generation FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Selection set fence is missing' USING ERRCODE='23503'; END IF;
 SELECT state INTO group_state FROM public.access_group WHERE id=NEW.group_id AND scope_id=NEW.scope_id;
 IF member.id IS NULL OR group_state IS NULL THEN RAISE EXCEPTION 'Selection eligibility source is missing' USING ERRCODE='23503'; END IF;
 IF NEW.selected AND (member.active_generation IS DISTINCT FROM NEW.generation OR group_state IS DISTINCT FROM 'active') THEN RAISE EXCEPTION 'Assignment requires current admission and Group eligibility at the effect' USING ERRCODE='23514'; END IF;
 IF receipt.operation='prune' AND member.active_generation IS NOT DISTINCT FROM NEW.generation AND group_state IS DISTINCT FROM 'retired' THEN RAISE EXCEPTION 'Pruning requires permanent ineffectiveness at the effect' USING ERRCODE='23514'; END IF;
 IF NEW.selected THEN
  SELECT count(*) INTO selected_count FROM (SELECT 1 FROM public.access_group_membership WHERE membership_id=NEW.membership_id AND generation=NEW.generation AND selected LIMIT 65) candidates;
  IF selected_count>=64 THEN RAISE EXCEPTION 'Direct Group selection budget is exhausted' USING ERRCODE='54000'; END IF;
 END IF;
 -- The receipt guard holds the concrete tree, enrollment and set fences until commit.
 -- Advance this row only with the effect, after the caller's final pre-change admission.
 UPDATE public.access_group_membership_set SET version=version+1 WHERE membership_id=NEW.membership_id AND generation=NEW.generation;
 IF NOT FOUND THEN RAISE EXCEPTION 'Selection set effect is missing' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_access_group_membership_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE final_version bigint; receipt public.access_group_membership_event%ROWTYPE;
BEGIN
 SELECT version INTO final_version FROM public.access_group_membership WHERE membership_id=NEW.membership_id AND generation=NEW.generation AND group_id=NEW.group_id;
 IF TG_TABLE_NAME='access_group_membership' THEN
  IF final_version=0 THEN RAISE EXCEPTION 'A direct selection identity must complete assignment' USING ERRCODE='23514'; END IF;
  IF NEW.version>0 THEN
   SELECT * INTO receipt FROM public.access_group_membership_event WHERE membership_id=NEW.membership_id AND generation=NEW.generation AND group_id=NEW.group_id AND version=NEW.version;
   IF NOT FOUND OR receipt.selected_after IS DISTINCT FROM NEW.selected THEN RAISE EXCEPTION 'Selection head requires its exact receipt' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF final_version<NEW.version THEN RAISE EXCEPTION 'Selection receipt must advance its head' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS access_group_membership_set_initialize ON public.access_membership_admission;
CREATE TRIGGER access_group_membership_set_initialize AFTER INSERT ON public.access_membership_admission FOR EACH ROW EXECUTE FUNCTION public.initialize_access_group_membership_set();
DROP TRIGGER IF EXISTS access_group_membership_set_guard ON public.access_group_membership_set;
CREATE TRIGGER access_group_membership_set_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_group_membership_set FOR EACH ROW EXECUTE FUNCTION public.guard_access_group_membership_set();
DROP TRIGGER IF EXISTS access_group_membership_head_guard ON public.access_group_membership;
CREATE TRIGGER access_group_membership_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_group_membership FOR EACH ROW EXECUTE FUNCTION public.guard_access_group_membership_head();
DROP TRIGGER IF EXISTS access_group_membership_event_guard ON public.access_group_membership_event;
CREATE TRIGGER access_group_membership_event_guard BEFORE INSERT ON public.access_group_membership_event FOR EACH ROW EXECUTE FUNCTION public.guard_access_group_membership_event();
DROP TRIGGER IF EXISTS access_group_membership_event_immutable ON public.access_group_membership_event;
CREATE TRIGGER access_group_membership_event_immutable BEFORE UPDATE OR DELETE ON public.access_group_membership_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_group_membership_head_complete ON public.access_group_membership;
CREATE CONSTRAINT TRIGGER access_group_membership_head_complete AFTER INSERT OR UPDATE ON public.access_group_membership DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_group_membership_history();
DROP TRIGGER IF EXISTS access_group_membership_event_complete ON public.access_group_membership_event;
CREATE CONSTRAINT TRIGGER access_group_membership_event_complete AFTER INSERT ON public.access_group_membership_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_group_membership_history();
