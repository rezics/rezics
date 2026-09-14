SET search_path TO public;

-- Create "access_membership" table
CREATE TABLE "access_membership" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "scope_id" uuid NOT NULL,
  "subject_id" uuid NOT NULL,
  "version" bigint NOT NULL DEFAULT 0,
  "last_generation" bigint NOT NULL DEFAULT 0,
  "active_generation" bigint NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "access_membership_active_check" CHECK ((active_generation IS NULL) OR ((active_generation = last_generation) AND (active_generation > 0))),
  CONSTRAINT "access_membership_version_check" CHECK (((version >= 0) AND (version <= '9007199254740991'::bigint)) AND ((last_generation >= 0) AND (last_generation <= version)))
);
-- Create index "access_membership_id_scope_key" to table: "access_membership"
CREATE UNIQUE INDEX "access_membership_id_scope_key" ON "access_membership" ("id", "scope_id");
-- Create index "access_membership_scope_subject_key" to table: "access_membership"
CREATE UNIQUE INDEX "access_membership_scope_subject_key" ON "access_membership" ("scope_id", "subject_id");
-- Create index "access_membership_subject_scope_idx" to table: "access_membership"
CREATE INDEX "access_membership_subject_scope_idx" ON "access_membership" ("subject_id", "scope_id");
-- Create "access_membership_admission" table
CREATE TABLE "access_membership_admission" (
  "membership_id" uuid NOT NULL,
  "generation" bigint NOT NULL,
  "event_version" bigint NOT NULL,
  PRIMARY KEY ("membership_id", "generation"),
  CONSTRAINT "access_membership_admission_generation_check" CHECK ((generation >= 1) AND (generation <= event_version))
);
-- Create "access_membership_event" table
CREATE TABLE "access_membership_event" (
  "membership_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "operation_id" uuid NOT NULL,
  "request_digest" text NOT NULL,
  "operation" text NOT NULL,
  "last_generation" bigint NOT NULL,
  "active_generation" bigint NULL,
  "operator_auth_user_id" uuid NOT NULL,
  "authority_subject_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("membership_id", "version"),
  CONSTRAINT "access_membership_event_active_check" CHECK (((operation = 'admit'::text) AND (active_generation IS NOT NULL) AND (active_generation = last_generation)) OR ((operation <> 'admit'::text) AND (active_generation IS NULL))),
  CONSTRAINT "access_membership_event_digest_check" CHECK (request_digest ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "access_membership_event_operation_check" CHECK (operation = ANY (ARRAY['admit'::text, 'leave'::text, 'remove'::text])),
  CONSTRAINT "access_membership_event_version_check" CHECK (((version >= 1) AND (version <= '9007199254740991'::bigint)) AND ((last_generation >= 1) AND (last_generation <= version)))
);
-- Create index "access_membership_event_operation_key" to table: "access_membership_event"
CREATE UNIQUE INDEX "access_membership_event_operation_key" ON "access_membership_event" ("membership_id", "operation_id");
-- Modify "access_membership" table
ALTER TABLE "access_membership" ADD CONSTRAINT "access_membership_active_admission_fk" FOREIGN KEY ("id", "active_generation") REFERENCES "access_membership_admission" ("membership_id", "generation") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_membership_scope_id_access_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_scope" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_membership_subject_id_access_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "access_subject" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "access_membership_admission" table
ALTER TABLE "access_membership_admission" ADD CONSTRAINT "access_membership_admission_event_fk" FOREIGN KEY ("membership_id", "event_version") REFERENCES "access_membership_event" ("membership_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "access_membership_event" table
ALTER TABLE "access_membership_event" ADD CONSTRAINT "access_membership_event_4VSfBXLnbHkX_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_membership_event_membership_id_access_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "access_membership" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "access_membership_event_operator_auth_user_id_users_id_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.guard_access_membership_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE receipt public.access_membership_event%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Membership identity and generations are retained' USING ERRCODE='55000'; END IF;
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
