-- Org policy is a native owner over shared scope/subject admission generations.
CREATE OR REPLACE FUNCTION public.organization_enrollment_lock_admission(p_scope uuid,p_subject uuid)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('org-enrollment-scope:'||p_scope::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('org-enrollment-subject:'||p_subject::text,0));
END $$;

CREATE OR REPLACE FUNCTION public.guard_organization_enrollment_contact()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
 IF TG_OP='DELETE' THEN
  IF NOT EXISTS(SELECT 1 FROM public.access_subject s JOIN public.users u ON u.id=s.auth_user_id WHERE s.id=OLD.subject_id AND u.erased_at IS NOT NULL) THEN RAISE EXCEPTION 'Contact deletion requires recipient erasure' USING ERRCODE='55000'; END IF;
  RETURN OLD;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('org-enrollment-contact:'||NEW.subject_id::text,0));
 IF TG_OP='INSERT' THEN
  SELECT count(*) INTO n FROM(SELECT id FROM public.organization_enrollment_contact WHERE subject_id=NEW.subject_id AND revoked_at IS NULL LIMIT 65) candidates;
  IF n>=64 THEN RAISE EXCEPTION 'Recipient contact budget exceeded' USING ERRCODE='54000'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.access_subject s JOIN public.users u ON u.id=s.auth_user_id WHERE s.id=NEW.subject_id AND u.principal_kind='human' AND u.erased_at IS NULL) THEN RAISE EXCEPTION 'Private contact requires an eligible human principal' USING ERRCODE='23514'; END IF;
  IF NEW.version<>1 OR NEW.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Contact must start active' USING ERRCODE='23514'; END IF;
 ELSE
  IF ROW(NEW.id,NEW.scope_id,NEW.subject_id,NEW.secret_digest,NEW.expires_at,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.scope_id,OLD.subject_id,OLD.secret_digest,OLD.expires_at,OLD.created_at) OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Contact identity is immutable and revocation is terminal' USING ERRCODE='55000'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_organization_enrollment_invitation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE n integer; principal uuid; member public.access_membership%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN
  IF NOT EXISTS(SELECT 1 FROM public.access_subject s JOIN public.users u ON u.id=s.auth_user_id WHERE s.id=OLD.recipient_subject_id AND u.erased_at IS NOT NULL) THEN RAISE EXCEPTION 'Invitation deletion requires recipient erasure' USING ERRCODE='55000'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW.organization_entity_id,NEW.scope_id,NEW.organization_revision,NEW.recipient_subject_id,NEW.contact_id,NEW.invited_by_auth_user_id,NEW.authority_subject_id,NEW.expires_at,NEW.created_at)
   IS DISTINCT FROM ROW(OLD.id,OLD.organization_entity_id,OLD.scope_id,OLD.organization_revision,OLD.recipient_subject_id,OLD.contact_id,OLD.invited_by_auth_user_id,OLD.authority_subject_id,OLD.expires_at,OLD.created_at)
   OR OLD.state<>'pending' OR NEW.state='pending' OR NEW.revision<>OLD.revision+1 OR NEW.authority IS NOT NULL THEN RAISE EXCEPTION 'Invitation resolution is an immutable terminal transition' USING ERRCODE='55000'; END IF;
 ELSE
  IF NEW.state<>'pending' OR NEW.revision<>1 THEN RAISE EXCEPTION 'Invitation starts pending at revision one' USING ERRCODE='23514'; END IF;
  PERFORM public.organization_enrollment_lock_admission(NEW.scope_id,NEW.recipient_subject_id);
  IF NOT EXISTS(SELECT 1 FROM public.access_scope s JOIN public.reference_value r ON r.id=s.unit_ref JOIN public.entity_identity e ON e.id=r.target_entity_id JOIN public.entity_participation p ON p.entity_id=e.id
   WHERE s.id=NEW.scope_id AND e.id=NEW.organization_entity_id AND e.shape='organization' AND e.deleted_at IS NULL AND p.state='active' AND p.revision=NEW.organization_revision) THEN RAISE EXCEPTION 'Invitation requires its exact active Org scope' USING ERRCODE='23514'; END IF;
  SELECT auth_user_id INTO principal FROM public.access_subject WHERE id=NEW.recipient_subject_id;
  IF principal IS NOT NULL THEN
   IF NEW.contact_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.organization_enrollment_contact c WHERE c.id=NEW.contact_id AND c.scope_id=NEW.scope_id AND c.subject_id=NEW.recipient_subject_id AND c.revoked_at IS NULL AND c.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'Private invitation requires recipient contact consent' USING ERRCODE='23514'; END IF;
  ELSIF NEW.contact_id IS NOT NULL THEN RAISE EXCEPTION 'Entity admission does not use private account contact' USING ERRCODE='23514'; END IF;
  IF public.access_subject_is_eligible(NEW.recipient_subject_id,'write') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Recipient is not currently eligible' USING ERRCODE='23514'; END IF;
  IF (NEW.authority->>'principalId')::uuid IS DISTINCT FROM NEW.invited_by_auth_user_id OR NEW.authority->>'sourceDigest' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invitation authority evidence is incomplete' USING ERRCODE='23514'; END IF;
  SELECT count(*) INTO n FROM(SELECT id FROM public.organization_enrollment_invitation WHERE scope_id=NEW.scope_id AND state='pending' LIMIT 1000) candidates;
  IF n>=1000 THEN RAISE EXCEPTION 'Org pending invitation budget exceeded' USING ERRCODE='54000'; END IF;
  SELECT count(*) INTO n FROM(SELECT id FROM public.organization_enrollment_invitation WHERE recipient_subject_id=NEW.recipient_subject_id AND state='pending' LIMIT 1000) candidates;
  IF n>=1000 THEN RAISE EXCEPTION 'Recipient pending invitation budget exceeded' USING ERRCODE='54000'; END IF;
 END IF;
 IF NEW.state='accepted' THEN
  SELECT * INTO member FROM public.access_membership WHERE id=NEW.membership_id;
  IF NOT FOUND OR member.scope_id<>NEW.scope_id OR member.subject_id<>NEW.recipient_subject_id OR member.active_generation IS DISTINCT FROM NEW.generation THEN RAISE EXCEPTION 'Accepted invitation requires its exact active shared admission' USING ERRCODE='23514'; END IF;
  IF NEW.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Expired invitation cannot be accepted' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_organization_enrollment_operation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' AND EXISTS(SELECT 1 FROM public.access_subject s JOIN public.users u ON u.id=s.auth_user_id WHERE s.id=OLD.recipient_subject_id AND u.erased_at IS NOT NULL) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Enrollment operation receipts are immutable outside recipient erasure' USING ERRCODE='55000';
END $$;

CREATE OR REPLACE FUNCTION public.require_organization_enrollment_admission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE member public.access_membership%ROWTYPE;
BEGIN
 IF NEW.operation<>'admit' THEN RETURN NULL; END IF;
 SELECT * INTO member FROM public.access_membership WHERE id=NEW.membership_id;
 IF EXISTS(SELECT 1 FROM public.access_scope s JOIN public.reference_value r ON r.id=s.unit_ref JOIN public.entity_identity e ON e.id=r.target_entity_id WHERE s.id=member.scope_id AND e.shape='organization') THEN
  IF NOT EXISTS(SELECT 1 FROM public.organization_enrollment_invitation i JOIN public.organization_enrollment_operation o ON o.scope_id=i.scope_id AND o.operation_id=NEW.operation_id
   WHERE i.membership_id=NEW.membership_id AND i.generation=NEW.active_generation AND i.state='accepted' AND i.recipient_subject_id=member.subject_id AND o.invitation_id=i.id AND o.operator_auth_user_id=NEW.operator_auth_user_id AND o.authority_subject_id=member.subject_id) THEN RAISE EXCEPTION 'Org admission requires exact accepted consent and receipt' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS organization_enrollment_contact_guard ON public.organization_enrollment_contact;
CREATE TRIGGER organization_enrollment_contact_guard BEFORE INSERT OR UPDATE OR DELETE ON public.organization_enrollment_contact FOR EACH ROW EXECUTE FUNCTION public.guard_organization_enrollment_contact();
DROP TRIGGER IF EXISTS organization_enrollment_invitation_guard ON public.organization_enrollment_invitation;
CREATE TRIGGER organization_enrollment_invitation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.organization_enrollment_invitation FOR EACH ROW EXECUTE FUNCTION public.guard_organization_enrollment_invitation();
DROP TRIGGER IF EXISTS organization_enrollment_operation_guard ON public.organization_enrollment_operation;
CREATE TRIGGER organization_enrollment_operation_guard BEFORE UPDATE OR DELETE ON public.organization_enrollment_operation FOR EACH ROW EXECUTE FUNCTION public.guard_organization_enrollment_operation();
DROP TRIGGER IF EXISTS organization_enrollment_admission_required ON public.access_membership_event;
CREATE CONSTRAINT TRIGGER organization_enrollment_admission_required AFTER INSERT ON public.access_membership_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.require_organization_enrollment_admission();

CREATE OR REPLACE FUNCTION public.schedule_organization_enrollment_review()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.state='pending' THEN
  INSERT INTO public.organization_enrollment_review(invitation_id,due_at) VALUES(NEW.id,clock_timestamp()+interval '5 minutes');
 ELSE DELETE FROM public.organization_enrollment_review WHERE invitation_id=NEW.id;
 END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS organization_enrollment_review_schedule ON public.organization_enrollment_invitation;
CREATE TRIGGER organization_enrollment_review_schedule AFTER INSERT OR UPDATE ON public.organization_enrollment_invitation FOR EACH ROW EXECUTE FUNCTION public.schedule_organization_enrollment_review();
