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
