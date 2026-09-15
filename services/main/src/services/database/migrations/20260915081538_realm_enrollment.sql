SET search_path TO public;

DROP TRIGGER IF EXISTS realm_member_stat_maintain ON public.realm_member;
DROP FUNCTION IF EXISTS public.maintain_realm_member_stat();
-- The replaced writable roster is discarded; retain other Realm metrics.
UPDATE public.realm_stat SET active_member_count=0 WHERE active_member_count<>0;

DROP TABLE "realm_member";
DROP TABLE "realm_rule_acceptance";
ALTER TYPE "realm_member_state" ADD VALUE 'open';
ALTER TYPE "realm_member_state" ADD VALUE 'invited';
ALTER TYPE "realm_member_state" ADD VALUE 'rejected';
ALTER TYPE "realm_member_state" ADD VALUE 'left';
CREATE TABLE "realm_enforcement" (
	"scope_id" uuid,
	"subject_id" uuid,
	"revision" bigint DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'clear' NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_enforcement_pkey" PRIMARY KEY("scope_id","subject_id"),
	CONSTRAINT "realm_enforcement_state_check" CHECK ("state" in ('clear','muted','banned') and "revision" between 0 and 9007199254740991)
);

CREATE TABLE "realm_enrollment" (
	"scope_id" uuid,
	"subject_id" uuid,
	"realm_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"policy_revision" bigint,
	"revision" bigint DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"consent" jsonb,
	"notification_basis" jsonb,
	"invitation" jsonb,
	"invitation_contact_id" uuid,
	"rule_revision_id" uuid,
	"consent_expires_at" timestamp(3) with time zone,
	"generation" bigint,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_enrollment_pkey" PRIMARY KEY("scope_id","subject_id"),
	CONSTRAINT "realm_enrollment_revision_check" CHECK ("revision" between 0 and 9007199254740991),
	CONSTRAINT "realm_enrollment_state_check" CHECK ("state" in ('open','invited','pending','approved','rejected','left','removed')),
	CONSTRAINT "realm_enrollment_notification_budget" CHECK (octet_length("notification_basis"::text)<=8192),
	CONSTRAINT "realm_enrollment_evidence_budget" CHECK (octet_length("consent"::text)<=32768 and octet_length("invitation"::text)<=32768)
);

CREATE TABLE "realm_enrollment_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"requested_realm_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"secret_digest" text,
	"revision" bigint DEFAULT 1 NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"revoked_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_enrollment_contact_lifecycle_check" CHECK (("revision"=1 and "revoked_at" is null and "secret_digest" is not null and "secret_digest" ~ '^[0-9a-f]{64}$') or ("revision"=2 and "revoked_at" is not null and "secret_digest" is null)),
	CONSTRAINT "realm_enrollment_contact_expiry_check" CHECK ("expires_at">"created_at" and "expires_at"<="created_at"+interval '30 days')
);

CREATE TABLE "realm_enrollment_operation" (
	"scope_id" uuid,
	"operation_id" uuid,
	"subject_id" uuid NOT NULL,
	"operator_auth_user_id" uuid,
	"authority_subject_id" uuid,
	"revision" bigint NOT NULL,
	"request_digest" text NOT NULL,
	"operation" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_enrollment_operation_pkey" PRIMARY KEY("scope_id","operation_id"),
	CONSTRAINT "realm_enrollment_operation_actor_check" CHECK (("operator_auth_user_id" is not null and "authority_subject_id" is not null and "operation" in ('join','leave','acknowledge','invite','approve','reject','remove','mute','ban','clear')) or ("operator_auth_user_id" is null and "authority_subject_id" is null and "operation" in ('expired','erased'))),
	CONSTRAINT "realm_enrollment_operation_revision_check" CHECK ("revision">0 and ("result"->>'revision')::bigint="revision"),
	CONSTRAINT "realm_enrollment_operation_digest_check" CHECK ("request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "realm_enrollment_operation_budget" CHECK (octet_length("result"::text)<=2048)
);

CREATE TABLE "realm_enrollment_rule_acceptance" (
	"membership_id" uuid,
	"generation" bigint,
	"revision_id" uuid,
	"operator_auth_user_id" uuid NOT NULL,
	"authority_subject_id" uuid NOT NULL,
	"language" text,
	"accepted_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "realm_enrollment_rule_acceptance_pkey" PRIMARY KEY("membership_id","generation","revision_id"),
	CONSTRAINT "realm_enrollment_rule_language_check" CHECK ("language" is null or "language" in ('zh', 'en', 'ja', 'ko', 'de', 'fr', 'es'))
);

ALTER TABLE "realm" ADD COLUMN "membership_control_revision" bigint DEFAULT 1 NOT NULL;
CREATE INDEX "realm_enforcement_subject_idx" ON "realm_enforcement" ("subject_id","scope_id");
CREATE INDEX "realm_enrollment_subject_idx" ON "realm_enrollment" ("subject_id","scope_id");
CREATE INDEX "realm_enrollment_realm_page_idx" ON "realm_enrollment" ("realm_id","subject_id");
CREATE INDEX "realm_enrollment_notice_actor_idx" ON "realm_enrollment" (("notification_basis"->>'principalId'),"scope_id","subject_id") WHERE "notification_basis" is not null;
CREATE INDEX "realm_enrollment_consent_actor_idx" ON "realm_enrollment" (("consent"->>'principalId'),"scope_id","subject_id") WHERE "consent" is not null;
CREATE INDEX "realm_enrollment_invitation_actor_idx" ON "realm_enrollment" (("invitation"->>'principalId'),"scope_id","subject_id") WHERE "invitation" is not null;
CREATE INDEX "realm_enrollment_erasable_subject_idx" ON "realm_enrollment" ("subject_id","scope_id") WHERE "state" in ('approved','pending','invited');
CREATE INDEX "realm_enrollment_pending_expiry_idx" ON "realm_enrollment" ("consent_expires_at","scope_id","subject_id") WHERE "consent_expires_at" is not null;
CREATE INDEX "realm_enrollment_contact_subject_idx" ON "realm_enrollment_contact" ("subject_id","id") WHERE "revoked_at" is null;
CREATE INDEX "realm_enrollment_contact_expiry_idx" ON "realm_enrollment_contact" ("expires_at","id") WHERE "revoked_at" is null;
CREATE UNIQUE INDEX "realm_enrollment_contact_secret_key" ON "realm_enrollment_contact" ("secret_digest") WHERE "secret_digest" is not null;
CREATE UNIQUE INDEX "realm_enrollment_operation_history_idx" ON "realm_enrollment_operation" ("scope_id","subject_id","revision");
CREATE INDEX "realm_enrollment_operation_subject_idx" ON "realm_enrollment_operation" ("subject_id","scope_id","operation_id");
CREATE INDEX "realm_enrollment_rule_revision_idx" ON "realm_enrollment_rule_acceptance" ("revision_id","membership_id");
ALTER TABLE "realm_enforcement" ADD CONSTRAINT "realm_enforcement_scope_id_access_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_scope"("id");
ALTER TABLE "realm_enforcement" ADD CONSTRAINT "realm_enforcement_subject_id_access_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "access_subject"("id");
ALTER TABLE "realm_enrollment" ADD CONSTRAINT "realm_enrollment_scope_id_access_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_scope"("id");
ALTER TABLE "realm_enrollment" ADD CONSTRAINT "realm_enrollment_subject_id_access_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "access_subject"("id");
ALTER TABLE "realm_enrollment" ADD CONSTRAINT "realm_enrollment_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id");
ALTER TABLE "realm_enrollment" ADD CONSTRAINT "realm_enrollment_CIaheYxCzTOP_fkey" FOREIGN KEY ("invitation_contact_id") REFERENCES "realm_enrollment_contact"("id");
ALTER TABLE "realm_enrollment" ADD CONSTRAINT "realm_enrollment_LigH8ykqmX3H_fkey" FOREIGN KEY ("membership_id","scope_id","subject_id") REFERENCES "access_membership"("id","scope_id","subject_id");
ALTER TABLE "realm_enrollment" ADD CONSTRAINT "realm_enrollment_Raqwn5PK3OcA_fkey" FOREIGN KEY ("membership_id","generation") REFERENCES "access_membership_admission"("membership_id","generation");
ALTER TABLE "realm_enrollment" ADD CONSTRAINT "realm_enrollment_kRowb4ifWry8_fkey" FOREIGN KEY ("realm_id","rule_revision_id") REFERENCES "realm_rule_revision"("realm_id","id");
ALTER TABLE "realm_enrollment_contact" ADD CONSTRAINT "realm_enrollment_contact_subject_id_access_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "access_subject"("id");
ALTER TABLE "realm_enrollment_operation" ADD CONSTRAINT "realm_enrollment_operation_scope_id_access_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_scope"("id");
ALTER TABLE "realm_enrollment_operation" ADD CONSTRAINT "realm_enrollment_operation_subject_id_access_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "access_subject"("id");
ALTER TABLE "realm_enrollment_operation" ADD CONSTRAINT "realm_enrollment_operation_operator_auth_user_id_users_id_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users"("id");
ALTER TABLE "realm_enrollment_operation" ADD CONSTRAINT "realm_enrollment_operation_9sKlrL8k6aeR_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject"("id");
ALTER TABLE "realm_enrollment_rule_acceptance" ADD CONSTRAINT "realm_enrollment_rule_acceptance_6yAcQVxJclTs_fkey" FOREIGN KEY ("revision_id") REFERENCES "realm_rule_revision"("id");
ALTER TABLE "realm_enrollment_rule_acceptance" ADD CONSTRAINT "realm_enrollment_rule_acceptance_dBM9UpbsY96m_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users"("id");
ALTER TABLE "realm_enrollment_rule_acceptance" ADD CONSTRAINT "realm_enrollment_rule_acceptance_KbpvF3UDfnoW_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject"("id");
ALTER TABLE "realm_enrollment_rule_acceptance" ADD CONSTRAINT "realm_enrollment_rule_acceptance_tugXrK8PIl2N_fkey" FOREIGN KEY ("membership_id","generation") REFERENCES "access_membership_admission"("membership_id","generation");
ALTER TABLE "realm" ADD CONSTRAINT "realm_membership_control_revision_check" CHECK ("membership_control_revision" between 1 and 9007199254740991);

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
  -- Reserved identities carry no authority; applications may precede their first admission.
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
 IF NEW.operation='assign' AND (member.active_generation IS DISTINCT FROM head.generation OR public.access_membership_is_eligible(member.id) IS DISTINCT FROM true OR group_state IS DISTINCT FROM 'active') THEN RAISE EXCEPTION 'Assignment requires a current admission and active Group' USING ERRCODE='23514'; END IF;
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
 IF NEW.selected AND (member.active_generation IS DISTINCT FROM NEW.generation OR public.access_membership_is_eligible(member.id) IS DISTINCT FROM true OR group_state IS DISTINCT FROM 'active') THEN RAISE EXCEPTION 'Assignment requires current admission and Group eligibility at the effect' USING ERRCODE='23514'; END IF;
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


CREATE OR REPLACE FUNCTION public.access_principal_account_is_eligible(p_principal uuid,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH evaluated AS MATERIALIZED(SELECT clock_timestamp() AS now)
 SELECT CASE WHEN p_action IS NULL OR p_action NOT IN ('read','write','contribute') THEN NULL
  ELSE EXISTS(
   SELECT 1 FROM public.users u CROSS JOIN evaluated WHERE u.id=p_principal AND u.erased_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM public.user_account_state a WHERE a.user_id=u.id AND
     (a.state='closed' OR (a.state='suspended' AND (a.expires_at IS NULL OR NOT isfinite(a.expires_at) OR a.expires_at>evaluated.now))))
    AND (p_action='read' OR NOT EXISTS(SELECT 1 FROM public.account_enforcement e WHERE e.auth_user_id=u.id AND e.revocation_action_id IS NULL
     AND (e.kind IN ('ban','suspension') OR (p_action='contribute' AND e.kind='silence'))
     AND (NOT isfinite(e.starts_at) OR (e.expires_at IS NOT NULL AND NOT isfinite(e.expires_at)) OR
      (e.starts_at<=evaluated.now AND (e.expires_at IS NULL OR e.expires_at>evaluated.now)))))
  ) END
$$;

CREATE OR REPLACE FUNCTION public.connected_app_is_eligible(p_app uuid)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.connected_app app JOIN public.access_scope s ON s.id=app.scope_id
  LEFT JOIN public.users a ON a.id=s.auth_user_id LEFT JOIN public.workload_principal w ON w.auth_user_id=a.id
  LEFT JOIN public.access_scope ws ON ws.id=w.owner_scope_id
  LEFT JOIN public.reference_value r ON r.id=s.unit_ref LEFT JOIN public.entity_identity e ON e.id=r.target_entity_id
  LEFT JOIN public.entity_participation ep ON ep.entity_id=e.id
  WHERE app.id=p_app AND app.state='active' AND app.trust<>'blocked' AND (
   (a.principal_kind='human' AND public.access_principal_account_is_eligible(a.id,'read') IS TRUE) OR
   (a.principal_kind='service' AND w.purpose='system' AND w.state='active' AND ws.platform_root='platform'
    AND public.access_principal_account_is_eligible(a.id,'read') IS TRUE) OR
   (e.id IS NOT NULL AND e.deleted_at IS NULL AND ep.state='active')))
$$;

CREATE OR REPLACE FUNCTION public.connected_installation_is_eligible(p_installation uuid)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH evaluated AS MATERIALIZED(SELECT clock_timestamp() AS now)
 SELECT EXISTS(SELECT 1 FROM public.connected_installation i JOIN public.connected_installation_revision r
  ON r.installation_id=i.id AND r.revision=i.approved_revision CROSS JOIN evaluated
  WHERE i.id=p_installation AND i.state='active' AND r.sealed AND r.valid_from<=evaluated.now
   AND (r.valid_until IS NULL OR r.valid_until>evaluated.now) AND public.connected_app_is_eligible(i.app_id) IS TRUE)
$$;

CREATE OR REPLACE FUNCTION public.workload_principal_is_eligible(p_principal uuid,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN p_action IS NULL OR p_action NOT IN ('read','write','contribute') THEN NULL ELSE EXISTS(
  SELECT 1 FROM public.workload_principal w JOIN public.access_scope s ON s.id=w.owner_scope_id
   LEFT JOIN public.reference_value r ON r.id=s.unit_ref LEFT JOIN public.users a ON a.id=s.auth_user_id
   LEFT JOIN public.entity_identity e ON e.id=r.target_entity_id LEFT JOIN public.entity_participation ep ON ep.entity_id=e.id
   LEFT JOIN public.realm realm ON realm.id=r.target_realm_id
  WHERE w.auth_user_id=p_principal AND w.state='active' AND w.version>0 AND (
   (w.purpose='system' AND s.platform_root='platform') OR (w.purpose='installation' AND EXISTS(
    SELECT 1 FROM public.connected_installation i WHERE i.workload_principal_id=w.auth_user_id AND i.owner_scope_id=w.owner_scope_id
     AND public.connected_installation_is_eligible(i.id) IS TRUE) AND (
    (a.principal_kind='human' AND public.access_principal_account_is_eligible(a.id,p_action) IS TRUE) OR
    (e.shape='organization' AND e.deleted_at IS NULL AND ep.state='active') OR
    (realm.id IS NOT NULL AND realm.deleted_at IS NULL)
   )))) END
$$;

CREATE OR REPLACE FUNCTION public.access_subject_is_eligible(p_subject uuid,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN p_action IS NULL OR p_action NOT IN ('read','write','contribute') THEN NULL
  WHEN s.auth_user_id IS NOT NULL THEN EXISTS(SELECT 1 FROM public.users u WHERE u.id=s.auth_user_id
   AND public.access_principal_account_is_eligible(u.id,p_action) IS TRUE
   AND (u.principal_kind='human' OR (u.principal_kind='service' AND public.workload_principal_is_eligible(u.id,p_action) IS TRUE)))
  ELSE EXISTS(SELECT 1 FROM public.entity_identity e JOIN public.entity_participation p ON p.entity_id=e.id
   WHERE e.id=s.entity_id AND e.deleted_at IS NULL AND p.state='active') END
 FROM public.access_subject s WHERE s.id=p_subject
$$;

-- Org admission remains institutional, but a disabled/recovery-required scope supplies no live member-set authority.
CREATE OR REPLACE FUNCTION public.access_membership_scope_is_eligible(p_scope uuid)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN e.shape='organization' THEN e.deleted_at IS NULL AND coalesce(p.state='active',false) WHEN r.target_realm_id IS NOT NULL THEN EXISTS(SELECT 1 FROM public.realm realm WHERE realm.id=r.target_realm_id AND realm.deleted_at IS NULL AND realm.moderation_status='approved' AND realm.status='published') ELSE true END
 FROM public.access_scope s LEFT JOIN public.reference_value r ON r.id=s.unit_ref
 LEFT JOIN public.entity_identity e ON e.id=r.target_entity_id LEFT JOIN public.entity_participation p ON p.entity_id=e.id
 WHERE s.id=p_scope
$$;

-- Realm bans are independent hard restrictions on every shared member-set path.
CREATE OR REPLACE FUNCTION public.access_membership_is_eligible(p_membership uuid)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT public.access_membership_scope_is_eligible(m.scope_id) AND m.active_generation IS NOT NULL
  AND public.access_subject_is_eligible(m.subject_id,'read')
  AND NOT EXISTS(SELECT 1 FROM public.realm_enforcement e WHERE e.scope_id=m.scope_id AND e.subject_id=m.subject_id AND e.state='banned')
 FROM public.access_membership m WHERE m.id=p_membership
$$;

CREATE OR REPLACE FUNCTION public.access_subject_matches_recipient(p_subject uuid,p_kind text,p_recipient uuid,p_scope uuid,p_group uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE member public.access_membership%ROWTYPE; selected_count integer; matched boolean; broken boolean;
BEGIN
 IF p_subject IS NULL OR p_kind IS NULL THEN RETURN NULL; END IF;
 IF p_kind='subject' THEN RETURN p_subject=p_recipient; END IF;
 IF p_kind NOT IN ('group','all-members') OR p_scope IS NULL THEN RETURN NULL; END IF;
 IF public.access_membership_scope_is_eligible(p_scope) IS NULL THEN RETURN NULL; END IF;
 IF NOT public.access_membership_scope_is_eligible(p_scope) THEN RETURN false; END IF;
 SELECT * INTO member FROM public.access_membership WHERE subject_id=p_subject AND scope_id=p_scope;
 IF NOT FOUND OR public.access_membership_is_eligible(member.id) IS DISTINCT FROM true THEN RETURN false; END IF;
 IF p_kind='all-members' THEN RETURN true; END IF;
 IF p_group IS NULL OR NOT EXISTS(SELECT 1 FROM public.access_group_membership_set WHERE membership_id=member.id AND generation=member.active_generation) THEN RETURN NULL; END IF;
 SELECT count(*) INTO selected_count FROM (SELECT 1 FROM public.access_group_membership WHERE membership_id=member.id AND generation=member.active_generation AND selected LIMIT 65) selected;
 IF selected_count>64 THEN RETURN NULL; END IF;
 WITH RECURSIVE path(direct_id,id,parent_id,state,version,depth) AS (
  SELECT g.id,g.id,g.parent_id,g.state,g.version,1 FROM public.access_group_membership selected
   JOIN public.access_group g ON g.id=selected.group_id AND g.scope_id=selected.scope_id
   WHERE selected.membership_id=member.id AND selected.generation=member.active_generation AND selected.selected
  UNION ALL SELECT p.direct_id,g.id,g.parent_id,g.state,g.version,p.depth+1 FROM path p
   JOIN public.access_group g ON g.id=p.parent_id AND g.scope_id=p_scope WHERE p.state='active' AND p.depth<8
 ) SELECT coalesce(bool_or(id=p_group AND state='active' AND version>0),false),
  coalesce(bool_or(version=0 OR (state='active' AND depth=8 AND parent_id IS NOT NULL)),false) INTO matched,broken FROM path;
 IF broken THEN RETURN NULL; END IF;
 RETURN matched;
END $$;

CREATE OR REPLACE FUNCTION public.access_representation_path_is_current(p_grants uuid[],p_revisions bigint[],p_principal uuid,p_entity uuid,p_action text)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE step integer; head public.access_representation%ROWTYPE; terms public.access_representation_revision%ROWTYPE; next_subject uuid; owner_subject uuid; next_entity uuid; visited uuid[]:=array[]::uuid[];
BEGIN
 IF p_grants IS NULL OR p_revisions IS NULL OR cardinality(p_grants) NOT BETWEEN 1 AND 8 OR cardinality(p_grants)<>cardinality(p_revisions)
  OR coalesce(array_ndims(p_grants),1)<>1 OR coalesce(array_ndims(p_revisions),1)<>1 OR array_lower(p_grants,1)<>1 OR array_lower(p_revisions,1)<>1
  OR array_position(p_grants,NULL) IS NOT NULL OR array_position(p_revisions,NULL) IS NOT NULL THEN RETURN NULL; END IF;
 IF cardinality(p_grants)<>(SELECT count(DISTINCT value) FROM unnest(p_grants) value) THEN RETURN false; END IF;
 IF public.access_subject_is_eligible(p_principal,p_action) IS DISTINCT FROM true THEN RETURN false; END IF;
 next_entity:=p_entity;
 FOR step IN 1..cardinality(p_grants) LOOP
  SELECT * INTO head FROM public.access_representation WHERE id=p_grants[step];
  IF NOT FOUND OR head.entity_id IS DISTINCT FROM next_entity OR public.access_representation_is_current(head.id,p_revisions[step]) IS DISTINCT FROM true THEN RETURN false; END IF;
  IF head.entity_id=ANY(visited) THEN RETURN false; END IF;
  visited:=array_append(visited,head.entity_id);
  SELECT * INTO terms FROM public.access_representation_revision WHERE grant_id=head.id AND revision=p_revisions[step] AND sealed;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT id INTO owner_subject FROM public.access_subject WHERE entity_id=head.entity_id;
  IF public.access_subject_is_eligible(owner_subject,p_action) IS DISTINCT FROM true THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.access_representation_lineage(head.id,p_revisions[step]) l
   JOIN public.access_representation g ON g.id=l.grant_id WHERE g.parent_subject_id IS NOT NULL
    AND public.access_subject_is_eligible(g.parent_subject_id,p_action) IS DISTINCT FROM true) THEN RETURN false; END IF;
  IF step=cardinality(p_grants) THEN next_subject:=p_principal;
  ELSE
   IF NOT terms.can_redelegate THEN RETURN false; END IF;
   SELECT entity_id INTO next_entity FROM public.access_representation WHERE id=p_grants[step+1];
   SELECT id INTO next_subject FROM public.access_subject WHERE entity_id=next_entity;
   IF next_subject IS NULL THEN RETURN false; END IF;
  END IF;
  IF public.access_subject_matches_recipient(next_subject,head.recipient_kind,head.recipient_subject_id,head.recipient_scope_id,head.recipient_group_id) IS DISTINCT FROM true THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;


-- Exact admission/selection dependencies never follow a later rejoin or reassignment.
CREATE OR REPLACE FUNCTION public.access_role_binding_recipient_is_current(p_binding uuid,p_revision bigint)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE
  WHEN terms.membership_id IS NULL THEN true
  ELSE head.recipient_kind='subject' AND EXISTS(
   SELECT 1 FROM public.access_membership m
   WHERE m.id=terms.membership_id AND m.subject_id=head.recipient_subject_id
    AND m.active_generation=terms.membership_generation AND public.access_membership_is_eligible(m.id) IS TRUE
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


-- Exact admission/selection dependencies never follow a later rejoin or reassignment.
CREATE OR REPLACE FUNCTION public.access_representation_recipient_is_current(p_grant uuid,p_revision bigint)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE
  WHEN terms.membership_id IS NULL THEN true
  ELSE head.recipient_kind='subject' AND EXISTS(
   SELECT 1 FROM public.access_membership m
   WHERE m.id=terms.membership_id AND m.subject_id=head.recipient_subject_id
    AND m.active_generation=terms.membership_generation AND public.access_membership_is_eligible(m.id) IS TRUE
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
  IF NOT FOUND OR public.access_membership_is_eligible(member.id) IS DISTINCT FROM true OR member.subject_id<>child.parent_subject_id OR member.active_generation IS DISTINCT FROM child.parent_membership_generation OR (parent.recipient_kind<>'subject' AND member.scope_id<>parent.recipient_scope_id) THEN RETURN false; END IF;
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


-- Public presentation is a read-only Entity projection, never a second membership writer.
CREATE OR REPLACE VIEW public.current_realm_entity_membership AS
 SELECT e.realm_id,s.entity_id AS profile_id,
  (CASE WHEN m.active_generation IS NOT NULL THEN CASE WHEN coalesce(f.state,'clear')='clear' THEN 'active' ELSE f.state END ELSE CASE WHEN e.state='approved' THEN 'removed' ELSE e.state END END)::public.realm_member_state AS state,
  e.created_at AS joined_at,e.updated_at
 FROM public.realm_enrollment e JOIN public.access_membership m ON m.id=e.membership_id
 JOIN public.access_subject s ON s.id=e.subject_id AND s.entity_id IS NOT NULL
 LEFT JOIN public.realm_enforcement f ON f.scope_id=e.scope_id AND f.subject_id=e.subject_id;
CREATE OR REPLACE VIEW public.current_realm_entity_rule_acceptance AS
 SELECT a.revision_id,s.entity_id AS profile_id,a.language,a.accepted_at
 FROM public.realm_enrollment_rule_acceptance a JOIN public.access_membership m ON m.id=a.membership_id AND m.active_generation=a.generation
 JOIN public.access_subject s ON s.id=m.subject_id AND s.entity_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_realm_enrollment_control()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF ROW(NEW.status,NEW.visibility,NEW.join_policy,NEW.deleted_at,NEW.moderation_status) IS DISTINCT FROM ROW(OLD.status,OLD.visibility,OLD.join_policy,OLD.deleted_at,OLD.moderation_status) THEN
  NEW.membership_control_revision:=OLD.membership_control_revision+1;
 ELSIF NEW.membership_control_revision<>OLD.membership_control_revision THEN
  RAISE EXCEPTION 'Realm membership policy revision is owner-maintained' USING ERRCODE='23514';
 END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.guard_realm_enrollment_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Realm enrollment and enforcement evidence is retained' USING ERRCODE='55000'; END IF;
 PERFORM public.lock_access_membership_key(NEW.scope_id,NEW.subject_id,true);
 IF NOT EXISTS(SELECT 1 FROM public.access_scope s JOIN public.reference_value r ON r.id=s.unit_ref WHERE s.id=NEW.scope_id AND r.target_realm_id IS NOT NULL) THEN RAISE EXCEPTION 'Realm policy requires a native Realm scope' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (ROW(NEW.scope_id,NEW.subject_id) IS DISTINCT FROM ROW(OLD.scope_id,OLD.subject_id) OR NEW.revision<>OLD.revision+1) THEN RAISE EXCEPTION 'Realm enrollment command must advance exactly one revision' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='realm_enrollment' THEN
  IF NOT EXISTS(SELECT 1 FROM public.access_scope s JOIN public.reference_value r ON r.id=s.unit_ref WHERE s.id=NEW.scope_id AND r.target_realm_id=NEW.realm_id) THEN RAISE EXCEPTION 'Realm enrollment scope mismatch' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND ROW(NEW.realm_id,NEW.membership_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.realm_id,OLD.membership_id,OLD.created_at) THEN RAISE EXCEPTION 'Realm enrollment identity is immutable' USING ERRCODE='55000'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.validate_realm_enrollment_admission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE member public.access_membership%ROWTYPE;
BEGIN
 SELECT * INTO member FROM public.access_membership WHERE id=NEW.membership_id;
 IF NEW.operation='admit' AND EXISTS(SELECT 1 FROM public.access_scope s JOIN public.reference_value r ON r.id=s.unit_ref WHERE s.id=member.scope_id AND r.target_realm_id IS NOT NULL) THEN
  IF NOT EXISTS(SELECT 1 FROM public.realm_enrollment e JOIN public.realm_enrollment_operation o ON o.scope_id=e.scope_id AND o.subject_id=e.subject_id
    WHERE e.membership_id=member.id AND e.generation=NEW.active_generation AND e.state='approved' AND e.consent IS NOT NULL
    AND o.operation_id=NEW.operation_id AND o.operator_auth_user_id=NEW.operator_auth_user_id AND o.authority_subject_id=NEW.authority_subject_id
    AND o.operation IN ('join','approve')) THEN RAISE EXCEPTION 'Realm admission requires exact recipient consent and its native command receipt' USING ERRCODE='23514'; END IF;
 END IF; RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.maintain_realm_membership_count()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE target uuid; delta bigint;
BEGIN
 IF (NEW.active_generation IS NOT NULL)=(OLD.active_generation IS NOT NULL) THEN RETURN NEW; END IF;
 SELECT r.target_realm_id INTO target FROM public.access_scope sc JOIN public.reference_value r ON r.id=sc.unit_ref JOIN public.access_subject s ON s.id=NEW.subject_id WHERE sc.id=NEW.scope_id AND s.entity_id IS NOT NULL;
 IF target IS NULL THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.realm_enforcement e WHERE e.scope_id=NEW.scope_id AND e.subject_id=NEW.subject_id AND e.state<>'clear') THEN RETURN NEW; END IF;
 delta:=CASE WHEN NEW.active_generation IS NULL THEN -1 ELSE 1 END;
 IF delta<0 THEN
  UPDATE public.realm_stat SET active_member_count=active_member_count-1,updated_at=now() WHERE realm_id=target;
  IF NOT FOUND THEN RAISE EXCEPTION 'Realm public enrollment count missing on departure' USING ERRCODE='23514'; END IF;
 ELSE
  INSERT INTO public.realm_stat(realm_id,active_member_count) VALUES(target,1) ON CONFLICT(realm_id) DO UPDATE SET active_member_count=public.realm_stat.active_member_count+1,updated_at=now();
 END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.maintain_realm_enforcement_count()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE target uuid; delta bigint; previous text;
BEGIN
 previous:=CASE WHEN TG_OP='INSERT' THEN 'clear' ELSE OLD.state END;
 delta:=(CASE WHEN NEW.state='clear' THEN 1 ELSE 0 END)-(CASE WHEN previous='clear' THEN 1 ELSE 0 END);
 IF delta=0 THEN RETURN NEW; END IF;
 SELECT r.target_realm_id INTO target FROM public.access_membership m JOIN public.access_scope sc ON sc.id=m.scope_id JOIN public.reference_value r ON r.id=sc.unit_ref JOIN public.access_subject s ON s.id=m.subject_id
 WHERE m.scope_id=NEW.scope_id AND m.subject_id=NEW.subject_id AND m.active_generation IS NOT NULL AND s.entity_id IS NOT NULL;
 IF target IS NULL THEN RETURN NEW; END IF;
 IF delta<0 THEN
  UPDATE public.realm_stat SET active_member_count=active_member_count-1,updated_at=now() WHERE realm_id=target;
  IF NOT FOUND THEN RAISE EXCEPTION 'Realm public active-member count missing on enforcement' USING ERRCODE='23514'; END IF;
 ELSE
  INSERT INTO public.realm_stat(realm_id,active_member_count) VALUES(target,1) ON CONFLICT(realm_id) DO UPDATE SET active_member_count=public.realm_stat.active_member_count+1,updated_at=now();
 END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS realm_enforcement_count ON public.realm_enforcement;
CREATE TRIGGER realm_enforcement_count AFTER INSERT OR UPDATE OF state ON public.realm_enforcement FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_enforcement_count();
DROP TRIGGER IF EXISTS realm_enrollment_control ON public.realm;
CREATE TRIGGER realm_enrollment_control BEFORE UPDATE ON public.realm FOR EACH ROW EXECUTE FUNCTION public.guard_realm_enrollment_control();
DROP TRIGGER IF EXISTS realm_enrollment_guard ON public.realm_enrollment;
CREATE TRIGGER realm_enrollment_guard BEFORE INSERT OR UPDATE OR DELETE ON public.realm_enrollment FOR EACH ROW EXECUTE FUNCTION public.guard_realm_enrollment_head();
DROP TRIGGER IF EXISTS realm_enforcement_guard ON public.realm_enforcement;
CREATE TRIGGER realm_enforcement_guard BEFORE INSERT OR UPDATE OR DELETE ON public.realm_enforcement FOR EACH ROW EXECUTE FUNCTION public.guard_realm_enrollment_head();
DROP TRIGGER IF EXISTS realm_enrollment_admission ON public.access_membership_event;
CREATE CONSTRAINT TRIGGER realm_enrollment_admission AFTER INSERT ON public.access_membership_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_realm_enrollment_admission();
DROP TRIGGER IF EXISTS realm_membership_count ON public.access_membership;
CREATE TRIGGER realm_membership_count AFTER UPDATE OF active_generation ON public.access_membership FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_membership_count();
DROP TRIGGER IF EXISTS realm_enrollment_operation_immutable ON public.realm_enrollment_operation;
CREATE TRIGGER realm_enrollment_operation_immutable BEFORE UPDATE OR DELETE ON public.realm_enrollment_operation FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS realm_enrollment_rule_immutable ON public.realm_enrollment_rule_acceptance;
CREATE TRIGGER realm_enrollment_rule_immutable BEFORE UPDATE OR DELETE ON public.realm_enrollment_rule_acceptance FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();

CREATE OR REPLACE FUNCTION public.guard_realm_enrollment_rule_consent()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE member public.access_membership%ROWTYPE; actor uuid;
BEGIN
 SELECT * INTO member FROM public.access_membership WHERE id=NEW.membership_id;
 IF NOT FOUND OR member.subject_id<>NEW.authority_subject_id OR member.active_generation IS DISTINCT FROM NEW.generation THEN RAISE EXCEPTION 'Rule consent requires the selected active admission' USING ERRCODE='23514'; END IF;
 PERFORM public.lock_access_membership_key(member.scope_id,member.subject_id,false);
 IF NOT EXISTS(SELECT 1 FROM public.access_scope sc JOIN public.reference_value r ON r.id=sc.unit_ref JOIN public.realm_rule_revision rr ON rr.realm_id=r.target_realm_id WHERE sc.id=member.scope_id AND rr.id=NEW.revision_id) THEN RAISE EXCEPTION 'Rule consent and membership require the same concrete Realm' USING ERRCODE='23514'; END IF;
 SELECT auth_user_id INTO actor FROM public.access_subject WHERE id=member.subject_id;
 IF actor IS NOT NULL AND actor<>NEW.operator_auth_user_id THEN RAISE EXCEPTION 'Private rule consent cannot name another operator' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS realm_enrollment_rule_consent_guard ON public.realm_enrollment_rule_acceptance;
CREATE TRIGGER realm_enrollment_rule_consent_guard BEFORE INSERT ON public.realm_enrollment_rule_acceptance FOR EACH ROW EXECUTE FUNCTION public.guard_realm_enrollment_rule_consent();


-- Native owner integrity and derived state. This file is the canonical forward-maintained source.
CREATE OR REPLACE FUNCTION public.apply_reaction_change(p_profile_id uuid, p_unit_id uuid, p_realm_id uuid, p_reaction text, p_occurred_at timestamp with time zone, p_direction bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE unit_weight double precision; profile_weight double precision;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.read_unit_state(p_unit_id,true)) THEN RETURN; END IF;

  IF p_realm_id IS NULL OR EXISTS (SELECT 1 FROM realm WHERE id = p_realm_id) THEN
    IF p_direction < 0 THEN
      UPDATE unit_reaction_stat SET reaction_count = reaction_count + p_direction,
        updated_at = now()
      WHERE unit_id = p_unit_id AND realm_id IS NOT DISTINCT FROM p_realm_id
        AND reaction = p_reaction::reaction_kind;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'missing unit_reaction_stat row for decrement: %, %, %',
          p_unit_id, p_realm_id, p_reaction USING ERRCODE = '23514';
      END IF;
    ELSE
      INSERT INTO unit_reaction_stat (unit_id, realm_id, reaction, reaction_count)
      VALUES (p_unit_id, p_realm_id, p_reaction::reaction_kind, p_direction)
      ON CONFLICT (unit_id, realm_id, reaction) DO UPDATE SET
        reaction_count = unit_reaction_stat.reaction_count + excluded.reaction_count,
        updated_at = now();
    END IF;
    DELETE FROM unit_reaction_stat
    WHERE unit_id = p_unit_id AND realm_id IS NOT DISTINCT FROM p_realm_id
      AND reaction = p_reaction::reaction_kind AND reaction_count = 0;
  END IF;

  IF p_direction < 0 THEN
    UPDATE unit_reaction_global_stat SET reaction_count = reaction_count + p_direction,
      updated_at = now()
    WHERE unit_id = p_unit_id AND reaction = p_reaction::reaction_kind;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing unit_reaction_global_stat row for decrement: %, %',
        p_unit_id, p_reaction USING ERRCODE = '23514';
    END IF;
  ELSE
    INSERT INTO unit_reaction_global_stat (unit_id, reaction, reaction_count)
    VALUES (p_unit_id, p_reaction::reaction_kind, p_direction)
    ON CONFLICT (unit_id, reaction) DO UPDATE SET
      reaction_count = unit_reaction_global_stat.reaction_count + excluded.reaction_count,
      updated_at = now();
  END IF;
  DELETE FROM unit_reaction_global_stat
  WHERE unit_id = p_unit_id AND reaction = p_reaction::reaction_kind AND reaction_count = 0;

  IF p_reaction = 'upvote' THEN
    PERFORM apply_unit_engagement_stat(p_unit_id, p_upvotes => p_direction);
    unit_weight := 3; profile_weight := 3;
  ELSE
    PERFORM apply_unit_engagement_stat(p_unit_id, p_downvotes => p_direction);
    unit_weight := 0; profile_weight := -4;
  END IF;
  PERFORM apply_recommendation_unit_signal(
    p_unit_id, p_occurred_at, p_reaction,
    p_direction, p_direction * unit_weight
  );

END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_recommendation_unit_signal(p_unit_id uuid, p_occurred_at timestamp with time zone, p_kind text, p_count_delta bigint, p_weight_delta double precision)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
  bucket timestamptz := date_bin(interval '1 hour', p_occurred_at, timestamptz '2000-01-01 00:00:00+00');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.read_unit_state(p_unit_id,true)) THEN
    RETURN;
  END IF;
  IF p_count_delta < 0 THEN
    UPDATE recommendation_unit_signal_hourly SET
      signal_count = signal_count + p_count_delta,
      weight = weight + p_weight_delta,
      updated_at = now()
    WHERE unit_id = p_unit_id AND bucket_start = bucket
      AND kind = p_kind::recommendation_signal_kind;
  ELSE
    INSERT INTO recommendation_unit_signal_hourly (
      unit_id, bucket_start, kind, signal_count, weight
    ) VALUES (
      p_unit_id, bucket, p_kind::recommendation_signal_kind, p_count_delta, p_weight_delta
    )
    ON CONFLICT (unit_id, bucket_start, kind) DO UPDATE SET
      signal_count = recommendation_unit_signal_hourly.signal_count + excluded.signal_count,
      weight = recommendation_unit_signal_hourly.weight + excluded.weight,
      updated_at = now();
  END IF;

  DELETE FROM recommendation_unit_signal_hourly
  WHERE unit_id = p_unit_id AND bucket_start = bucket
    AND kind = p_kind::recommendation_signal_kind
    AND signal_count = 0 AND weight = 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_unit_engagement_stat(p_unit_id uuid, p_upvotes bigint DEFAULT 0, p_downvotes bigint DEFAULT 0, p_replies bigint DEFAULT 0, p_favorites bigint DEFAULT 0, p_shares bigint DEFAULT 0, p_high_scores bigint DEFAULT 0, p_active_progress bigint DEFAULT 0, p_completions bigint DEFAULT 0, p_negative_progress bigint DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.read_unit_state(p_unit_id,true)) THEN
    RETURN;
  END IF;
  IF p_upvotes = 0 AND p_downvotes = 0 AND p_replies = 0 AND p_favorites = 0
    AND p_shares = 0 AND p_high_scores = 0 AND p_active_progress = 0
    AND p_completions = 0 AND p_negative_progress = 0 THEN
    RETURN;
  END IF;

  UPDATE unit_engagement_stat SET
    upvotes = upvotes + p_upvotes,
    downvotes = downvotes + p_downvotes,
    replies = replies + p_replies,
    favorites = favorites + p_favorites,
    shares = shares + p_shares,
    high_scores = high_scores + p_high_scores,
    active_progress = active_progress + p_active_progress,
    completions = completions + p_completions,
    negative_progress = negative_progress + p_negative_progress,
    updated_at = now()
  WHERE unit_id = p_unit_id;

  IF NOT FOUND THEN
    IF p_upvotes < 0 OR p_downvotes < 0 OR p_replies < 0 OR p_favorites < 0
      OR p_shares < 0 OR p_high_scores < 0 OR p_active_progress < 0
      OR p_completions < 0 OR p_negative_progress < 0 THEN
      RAISE EXCEPTION 'missing unit_engagement_stat row for decrement: %', p_unit_id
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO unit_engagement_stat (
      unit_id, upvotes, downvotes, replies, favorites, shares, high_scores,
      active_progress, completions, negative_progress
    ) VALUES (
      p_unit_id, p_upvotes, p_downvotes, p_replies, p_favorites, p_shares,
      p_high_scores, p_active_progress, p_completions, p_negative_progress
    )
    ON CONFLICT (unit_id) DO UPDATE SET
      upvotes = unit_engagement_stat.upvotes + excluded.upvotes,
      downvotes = unit_engagement_stat.downvotes + excluded.downvotes,
      replies = unit_engagement_stat.replies + excluded.replies,
      favorites = unit_engagement_stat.favorites + excluded.favorites,
      shares = unit_engagement_stat.shares + excluded.shares,
      high_scores = unit_engagement_stat.high_scores + excluded.high_scores,
      active_progress = unit_engagement_stat.active_progress + excluded.active_progress,
      completions = unit_engagement_stat.completions + excluded.completions,
      negative_progress = unit_engagement_stat.negative_progress + excluded.negative_progress,
      updated_at = now();
  END IF;

  DELETE FROM unit_engagement_stat
  WHERE unit_id = p_unit_id AND upvotes = 0 AND downvotes = 0 AND replies = 0
    AND favorites = 0 AND shares = 0 AND high_scores = 0 AND active_progress = 0
    AND completions = 0 AND negative_progress = 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_unit_reference_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    active_count integer;
    pinned_count integer;
    entering_active boolean := false;
    entering_pinned boolean := false;
    reference_kind text := TG_ARGV[0];
BEGIN
    IF TG_OP = 'INSERT' THEN
        entering_active := NEW.withdrawn_at IS NULL;
        entering_pinned := NEW.withdrawn_at IS NULL AND NEW.pinned;
    ELSE
        entering_active := NEW.withdrawn_at IS NULL AND (
            OLD.withdrawn_at IS NOT NULL
            OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
        );
        entering_pinned := NEW.withdrawn_at IS NULL AND NEW.pinned AND (
            NOT OLD.pinned
            OR OLD.withdrawn_at IS NOT NULL
            OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
        );
    END IF;

    IF entering_active OR entering_pinned THEN
        PERFORM pg_advisory_xact_lock(
            hashtextextended('unit-reference:' || reference_kind || ':' || NEW.unit_id::text, 0)
        );
    END IF;

    IF entering_active THEN
        EXECUTE format(
            'SELECT count(*) FROM ('
            || 'SELECT 1 FROM public.%I '
            || 'WHERE unit_id = $1 AND withdrawn_at IS NULL AND id <> $2 LIMIT 128'
            || ') AS active_reference',
            TG_TABLE_NAME
        )
        INTO active_count
        USING NEW.unit_id, NEW.id;
        IF active_count >= 128 THEN
            RAISE EXCEPTION 'Unit % already has 128 active % references',
                NEW.unit_id, reference_kind
                USING ERRCODE = '23514', CONSTRAINT = 'unit_reference_active_limit';
        END IF;
    END IF;

    IF entering_pinned THEN
        EXECUTE format(
            'SELECT count(*) FROM ('
            || 'SELECT 1 FROM public.%I '
            || 'WHERE unit_id = $1 AND withdrawn_at IS NULL AND pinned AND id <> $2 LIMIT 16'
            || ') AS pinned_reference',
            TG_TABLE_NAME
        )
        INTO pinned_count
        USING NEW.unit_id, NEW.id;
        IF pinned_count >= 16 THEN
            RAISE EXCEPTION 'Unit % already has 16 pinned % references',
                NEW.unit_id, reference_kind
                USING ERRCODE = '23514', CONSTRAINT = 'unit_reference_pinned_limit';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_collection_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  INSERT INTO collection_stat (collection_id) VALUES (NEW.id);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_poll_option_vote_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  INSERT INTO poll_option_vote_stat (option_id) VALUES (NEW.id);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_realm_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
    INSERT INTO public.realm_stat (realm_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
    RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.maintain_collection_item_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE changed record;
BEGIN
  FOR changed IN
    SELECT OLD.collection_id AS collection_id, -1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW.collection_id AS collection_id, 1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    UPDATE collection_stat
    SET item_count = item_count + changed.direction, updated_at = now()
    WHERE collection_id = changed.collection_id;
    IF NOT FOUND AND EXISTS (SELECT 1 FROM collection WHERE id = changed.collection_id) THEN
      RAISE EXCEPTION 'missing collection_stat row for %', changed.collection_id
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_poll_option_vote_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE changed record;
BEGIN
  FOR changed IN
    SELECT OLD.option_id AS option_id, -1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW.option_id AS option_id, 1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    UPDATE poll_option_vote_stat
    SET vote_count = vote_count + changed.direction, updated_at = now()
    WHERE option_id = changed.option_id;
    IF NOT FOUND AND EXISTS (SELECT 1 FROM poll_option WHERE id = changed.option_id) THEN
      RAISE EXCEPTION 'missing poll_option_vote_stat row for %', changed.option_id
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_reply_unit_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE relation post_reply%ROWTYPE;
old_counted boolean;
new_counted boolean;
old_visible boolean;
new_visible boolean;
BEGIN
  SELECT * INTO relation FROM post_reply WHERE post_id = OLD.id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  old_counted := OLD.deleted_at IS NULL;
  new_counted := NEW.deleted_at IS NULL;
  old_visible := old_counted AND OLD.status = 'published' AND OLD.visibility = 'public'
    AND OLD.moderation_status = 'approved';
  new_visible := new_counted AND NEW.status = 'published' AND NEW.visibility = 'public'
    AND NEW.moderation_status = 'approved';
  IF old_counted IS DISTINCT FROM new_counted THEN
    PERFORM apply_unit_engagement_stat(
      relation.root_post_id, p_replies => CASE WHEN new_counted THEN 1 ELSE -1 END
    );
    IF relation.parent_post_id IS NOT NULL THEN
      PERFORM apply_unit_engagement_stat(
        relation.parent_post_id, p_replies => CASE WHEN new_counted THEN 1 ELSE -1 END
      );
    END IF;
  END IF;
  PERFORM apply_post_reply_stat_delta(
    relation.root_post_id,
    relation.parent_post_id,
    new_counted::int - old_counted::int,
    new_visible::int - old_visible::int
  );
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_score_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
  row_data score%ROWTYPE;
  direction bigint;
  signal_kind text;
  unit_weight double precision;
  profile_weight double precision;
  change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data;
    direction := change.direction;
    IF EXISTS (SELECT 1 FROM public.read_unit_state(row_data.unit_id,true))
      AND EXISTS (SELECT 1 FROM realm WHERE id = row_data.realm_id) THEN
      IF direction < 0 THEN
        UPDATE score_stat SET
          total_count = total_count + direction,
          total_score = total_score + direction * row_data.value,
          score_1_count = score_1_count + direction * (row_data.value = 1)::int,
          score_2_count = score_2_count + direction * (row_data.value = 2)::int,
          score_3_count = score_3_count + direction * (row_data.value = 3)::int,
          score_4_count = score_4_count + direction * (row_data.value = 4)::int,
          score_5_count = score_5_count + direction * (row_data.value = 5)::int,
          score_6_count = score_6_count + direction * (row_data.value = 6)::int,
          score_7_count = score_7_count + direction * (row_data.value = 7)::int,
          score_8_count = score_8_count + direction * (row_data.value = 8)::int,
          score_9_count = score_9_count + direction * (row_data.value = 9)::int,
          score_10_count = score_10_count + direction * (row_data.value = 10)::int,
          updated_at = now()
        WHERE unit_id = row_data.unit_id AND realm_id = row_data.realm_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing score_stat row for decrement: %, %',
            row_data.unit_id, row_data.realm_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO score_stat (
          unit_id, realm_id, total_count, total_score,
          score_1_count, score_2_count, score_3_count, score_4_count, score_5_count,
          score_6_count, score_7_count, score_8_count, score_9_count, score_10_count
        ) VALUES (
          row_data.unit_id, row_data.realm_id, direction, direction * row_data.value,
          direction * (row_data.value = 1)::int, direction * (row_data.value = 2)::int,
          direction * (row_data.value = 3)::int, direction * (row_data.value = 4)::int,
          direction * (row_data.value = 5)::int, direction * (row_data.value = 6)::int,
          direction * (row_data.value = 7)::int, direction * (row_data.value = 8)::int,
          direction * (row_data.value = 9)::int, direction * (row_data.value = 10)::int
        )
        ON CONFLICT (unit_id, realm_id) DO UPDATE SET
          total_count = score_stat.total_count + excluded.total_count,
          total_score = score_stat.total_score + excluded.total_score,
          score_1_count = score_stat.score_1_count + excluded.score_1_count,
          score_2_count = score_stat.score_2_count + excluded.score_2_count,
          score_3_count = score_stat.score_3_count + excluded.score_3_count,
          score_4_count = score_stat.score_4_count + excluded.score_4_count,
          score_5_count = score_stat.score_5_count + excluded.score_5_count,
          score_6_count = score_stat.score_6_count + excluded.score_6_count,
          score_7_count = score_stat.score_7_count + excluded.score_7_count,
          score_8_count = score_stat.score_8_count + excluded.score_8_count,
          score_9_count = score_stat.score_9_count + excluded.score_9_count,
          score_10_count = score_stat.score_10_count + excluded.score_10_count,
          updated_at = now();
      END IF;
      DELETE FROM score_stat
      WHERE unit_id = row_data.unit_id AND realm_id = row_data.realm_id AND total_count = 0;
    END IF;

    PERFORM apply_unit_engagement_stat(
      row_data.unit_id, p_high_scores => direction * (row_data.value >= 8)::int
    );
    IF row_data.value >= 8 THEN
      signal_kind := 'score_high'; unit_weight := 5; profile_weight := 5;
    ELSIF row_data.value >= 6 THEN
      signal_kind := 'score_medium'; unit_weight := 3; profile_weight := 3;
    ELSIF row_data.value <= 3 THEN
      signal_kind := 'score_low'; unit_weight := 0; profile_weight := -4;
    ELSE
      signal_kind := NULL; unit_weight := 0; profile_weight := 0;
    END IF;
    IF signal_kind IS NOT NULL THEN
      IF unit_weight > 0 THEN
        PERFORM apply_recommendation_unit_signal(
          row_data.unit_id, row_data.updated_at, signal_kind, direction, direction * unit_weight
        );
      END IF;

    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_alias_vote_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.alias_id = NEW.alias_id THEN
        IF OLD.value <> NEW.value THEN
            UPDATE public.unit_alias_vote_stat
            SET score = score + NEW.value - OLD.value, updated_at = now()
            WHERE alias_id = NEW.alias_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'missing unit_alias_vote_stat row for update: %', NEW.alias_id
                    USING ERRCODE = '23514';
            END IF;
        END IF;
        RETURN NULL;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE')
       AND EXISTS (SELECT 1 FROM public.unit_alias WHERE id = OLD.alias_id) THEN
        UPDATE public.unit_alias_vote_stat
        SET score = score - OLD.value, vote_count = vote_count - 1, updated_at = now()
        WHERE alias_id = OLD.alias_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'missing unit_alias_vote_stat row for decrement: %', OLD.alias_id
                USING ERRCODE = '23514';
        END IF;
        DELETE FROM public.unit_alias_vote_stat
        WHERE alias_id = OLD.alias_id AND vote_count = 0;
    END IF;

    IF TG_OP IN ('UPDATE', 'INSERT')
       AND EXISTS (SELECT 1 FROM public.unit_alias WHERE id = NEW.alias_id) THEN
        INSERT INTO public.unit_alias_vote_stat (alias_id, score, vote_count)
        VALUES (NEW.alias_id, NEW.value, 1)
        ON CONFLICT (alias_id) DO UPDATE SET
            score = unit_alias_vote_stat.score + excluded.score,
            vote_count = unit_alias_vote_stat.vote_count + 1,
            updated_at = now();
    END IF;
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_external_link_vote_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.external_link_id = NEW.external_link_id THEN
        IF OLD.value <> NEW.value THEN
            UPDATE public.unit_external_link_vote_stat
            SET score = score + NEW.value - OLD.value, updated_at = now()
            WHERE external_link_id = NEW.external_link_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'missing unit_external_link_vote_stat row for update: %',
                    NEW.external_link_id USING ERRCODE = '23514';
            END IF;
        END IF;
        RETURN NULL;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (
        SELECT 1 FROM public.unit_external_link WHERE id = OLD.external_link_id
    ) THEN
        UPDATE public.unit_external_link_vote_stat
        SET score = score - OLD.value, vote_count = vote_count - 1, updated_at = now()
        WHERE external_link_id = OLD.external_link_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'missing unit_external_link_vote_stat row for decrement: %',
                OLD.external_link_id USING ERRCODE = '23514';
        END IF;
        DELETE FROM public.unit_external_link_vote_stat
        WHERE external_link_id = OLD.external_link_id AND vote_count = 0;
    END IF;

    IF TG_OP IN ('UPDATE', 'INSERT') AND EXISTS (
        SELECT 1 FROM public.unit_external_link WHERE id = NEW.external_link_id
    ) THEN
        INSERT INTO public.unit_external_link_vote_stat (external_link_id, score, vote_count)
        VALUES (NEW.external_link_id, NEW.value, 1)
        ON CONFLICT (external_link_id) DO UPDATE SET
            score = unit_external_link_vote_stat.score + excluded.score,
            vote_count = unit_external_link_vote_stat.vote_count + 1,
            updated_at = now();
    END IF;
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_follow_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE row_data unit_follow%ROWTYPE; direction bigint; change record; target_id uuid;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    target_id := public.reference_value_native_id(row_data.target_reference_id);
      IF direction < 0 THEN
        UPDATE unit_follow_stat SET follower_count = follower_count + direction,
          updated_at = now() WHERE unit_id = target_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing unit_follow_stat row for decrement: %',
            target_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO unit_follow_stat (unit_id, unit_publishing_id, unit_music_id, unit_program_id, unit_software_id, unit_entity_id, unit_grouping_id, unit_reference_id, unit_distribution_id, unit_video_id, unit_audio_id, unit_post_id, unit_poll_id, unit_zone_id, unit_realm_id, unit_realm_rule_id, unit_custom_theme_id, unit_collection_id, unit_tag_id, unit_tag_path_id, unit_label_id, follower_count)
        SELECT target_id, value.target_publishing_id, value.target_music_id, value.target_program_id, value.target_software_id, value.target_entity_id, value.target_grouping_id, value.target_reference_id, value.target_distribution_id, value.target_video_id, value.target_audio_id, value.target_post_id, value.target_poll_id, value.target_zone_id, value.target_realm_id, value.target_realm_rule_id, value.target_custom_theme_id, value.target_collection_id, value.target_tag_id, value.target_tag_path_id, value.target_label_id, direction
        FROM public.reference_value value WHERE value.id=row_data.target_reference_id
        ON CONFLICT (unit_id) DO UPDATE SET
          follower_count = unit_follow_stat.follower_count + excluded.follower_count,
          updated_at = now();
      END IF;
      DELETE FROM unit_follow_stat WHERE unit_id = target_id AND follower_count = 0;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_reaction_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM apply_reaction_change(
      OLD.profile_id, OLD.unit_id, OLD.realm_id, OLD.reaction::text, OLD.updated_at, -1
    );
  END IF;
  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    PERFORM apply_reaction_change(
      NEW.profile_id, NEW.unit_id, NEW.realm_id, NEW.reaction::text, NEW.updated_at, 1
    );
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_share_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE row_data unit_share%ROWTYPE; direction bigint; change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    PERFORM apply_unit_engagement_stat(row_data.unit_id, p_shares => direction);
    PERFORM apply_recommendation_unit_signal(
      row_data.unit_id, row_data.created_at, 'share', direction, direction * 4
    );

  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_reply_signals_before_unit_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE relation post_reply%ROWTYPE;
BEGIN
  SELECT * INTO relation FROM post_reply WHERE post_id = OLD.id;
  IF NOT FOUND THEN RETURN OLD; END IF;
  PERFORM apply_post_reply_stat_delta(
    relation.root_post_id,
    relation.parent_post_id,
    -(OLD.deleted_at IS NULL)::int,
    -(OLD.deleted_at IS NULL AND OLD.status = 'published' AND OLD.visibility = 'public'
      AND OLD.moderation_status = 'approved')::int
  );
  IF OLD.deleted_at IS NULL THEN
    PERFORM apply_unit_engagement_stat(relation.root_post_id, p_replies => -1);
    IF relation.parent_post_id IS NOT NULL THEN
      PERFORM apply_unit_engagement_stat(relation.parent_post_id, p_replies => -1);
    END IF;
  END IF;
  PERFORM apply_recommendation_unit_signal(
    relation.root_post_id, relation.created_at, 'reply', -1, -4
  );
  IF relation.parent_post_id IS NOT NULL THEN
    PERFORM apply_recommendation_unit_signal(
      relation.parent_post_id, relation.created_at, 'reply', -1, -4
    );
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS collection_stat_initialize ON public.collection;
CREATE TRIGGER collection_stat_initialize AFTER INSERT ON public.collection FOR EACH ROW EXECUTE FUNCTION public.initialize_collection_stat();

DROP TRIGGER IF EXISTS collection_item_stat_maintain ON public.collection_item;
CREATE TRIGGER collection_item_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF collection_id ON public.collection_item FOR EACH ROW EXECUTE FUNCTION public.maintain_collection_item_stat();

DROP TRIGGER IF EXISTS poll_option_vote_stat_initialize ON public.poll_option;
CREATE TRIGGER poll_option_vote_stat_initialize AFTER INSERT ON public.poll_option FOR EACH ROW EXECUTE FUNCTION public.initialize_poll_option_vote_stat();

DROP TRIGGER IF EXISTS poll_option_vote_stat_maintain ON public.poll_vote;
CREATE TRIGGER poll_option_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF option_id ON public.poll_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_poll_option_vote_stat();

DROP TRIGGER IF EXISTS realm_stat_initialize ON public.realm;
CREATE TRIGGER realm_stat_initialize AFTER INSERT ON public.realm FOR EACH ROW EXECUTE FUNCTION public.initialize_realm_stat();


DROP TRIGGER IF EXISTS score_stat_maintain ON public.score;
CREATE TRIGGER score_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.score FOR EACH ROW EXECUTE FUNCTION public.maintain_score_stat();

DROP TRIGGER IF EXISTS reply_signals_remove_before_unit_delete ON public.post;
CREATE TRIGGER reply_signals_remove_before_unit_delete BEFORE DELETE ON public.post FOR EACH ROW EXECUTE FUNCTION public.remove_reply_signals_before_unit_delete();

DROP TRIGGER IF EXISTS reply_unit_state_maintain ON public.post;
CREATE TRIGGER reply_unit_state_maintain AFTER UPDATE OF status, visibility, moderation_status, deleted_at ON public.post FOR EACH ROW WHEN (((old.status IS DISTINCT FROM new.status) OR (old.visibility IS DISTINCT FROM new.visibility) OR (old.moderation_status IS DISTINCT FROM new.moderation_status) OR (old.deleted_at IS DISTINCT FROM new.deleted_at))) EXECUTE FUNCTION public.maintain_reply_unit_state();

DROP TRIGGER IF EXISTS unit_alias_reference_limits ON public.unit_alias;
CREATE TRIGGER unit_alias_reference_limits BEFORE INSERT OR UPDATE OF unit_id, withdrawn_at, pinned ON public.unit_alias FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_reference_limits('alias');

DROP TRIGGER IF EXISTS unit_alias_vote_stat_maintain ON public.unit_alias_vote;
CREATE TRIGGER unit_alias_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_alias_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_alias_vote_stat();

DROP TRIGGER IF EXISTS unit_external_link_reference_limits ON public.unit_external_link;
CREATE TRIGGER unit_external_link_reference_limits BEFORE INSERT OR UPDATE OF unit_id, withdrawn_at, pinned ON public.unit_external_link FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_reference_limits('external_link');

DROP TRIGGER IF EXISTS unit_external_link_vote_stat_maintain ON public.unit_external_link_vote;
CREATE TRIGGER unit_external_link_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_external_link_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_external_link_vote_stat();

DROP TRIGGER IF EXISTS unit_follow_stat_maintain ON public.unit_follow;
CREATE TRIGGER unit_follow_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_follow FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_follow_stat();

DROP TRIGGER IF EXISTS unit_reaction_stats_maintain ON public.unit_reaction;
CREATE TRIGGER unit_reaction_stats_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_reaction FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_reaction_stats();

DROP TRIGGER IF EXISTS unit_share_stats_maintain ON public.unit_share;
CREATE TRIGGER unit_share_stats_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_share FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_share_stats();

-- Incremental striped counters avoid rescanning retained event history and a single hot daily row.
CREATE OR REPLACE FUNCTION public.record_recommendation_metric() RETURNS trigger
LANGUAGE plpgsql SET search_path TO pg_catalog, public AS $function$
BEGIN
 INSERT INTO recommendation_metric_daily(day,surface,policy_version,shard,impressions,opens,dwell_30s,not_interested)
 VALUES ((NEW.occurred_at AT TIME ZONE 'UTC')::date,NEW.surface,NEW.policy_version,
  (hashtextextended(NEW.request_id::text,0) & 127)::smallint,
  (NEW.type='impression')::integer,(NEW.type='open')::integer,(NEW.type='dwell_30s')::integer,(NEW.type='not_interested')::integer)
 ON CONFLICT(day,surface,policy_version,shard) DO UPDATE SET
  impressions=recommendation_metric_daily.impressions+excluded.impressions,
  opens=recommendation_metric_daily.opens+excluded.opens,
  dwell_30s=recommendation_metric_daily.dwell_30s+excluded.dwell_30s,
  not_interested=recommendation_metric_daily.not_interested+excluded.not_interested;
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS recommendation_metric_on_insert ON public.recommendation_event;
CREATE TRIGGER recommendation_metric_on_insert
AFTER INSERT ON public.recommendation_event FOR EACH ROW EXECUTE FUNCTION public.record_recommendation_metric();
