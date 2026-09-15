-- Durable private evidence is immutable apart from terminal revocation and bounded expiry erasure.
CREATE OR REPLACE FUNCTION public.guard_access_group_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE review public.access_group_impact_review%ROWTYPE; principal uuid;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.valid_until>=clock_timestamp()-interval '1 day' THEN RAISE EXCEPTION 'Approval retention has not elapsed' USING ERRCODE='55000'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'revoked_at'-'revoke_operation_id') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'-'revoke_operation_id')
   OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoke_operation_id IS NULL THEN
   RAISE EXCEPTION 'Approval only supports terminal revocation' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO review FROM public.access_group_impact_review WHERE id=NEW.review_id FOR UPDATE;
 IF NOT FOUND OR review.status<>'complete' OR NEW.principal_id=review.operator_auth_user_id OR NEW.subject_id=review.authority_subject_id
  OR NEW.valid_until>review.valid_until OR NEW.valid_until<=clock_timestamp() THEN
  RAISE EXCEPTION 'Approval requires current exact independent review evidence' USING ERRCODE='23514';
 END IF;
 IF (SELECT count(*) FROM (SELECT 1 FROM public.access_group_approval WHERE review_id=NEW.review_id LIMIT 64) bounded)>=64 THEN
  RAISE EXCEPTION 'Approval budget exceeded' USING ERRCODE='54000';
 END IF;
 SELECT auth_user_id INTO principal FROM public.access_subject WHERE id=NEW.subject_id;
 IF NOT FOUND OR (principal IS NOT NULL AND principal<>NEW.principal_id) OR NEW.proof->>'kind'<>'session' OR (NEW.proof->>'principalId')::uuid<>NEW.principal_id THEN
  RAISE EXCEPTION 'Approval private attribution mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.guard_access_recovery_path()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE principal uuid;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.valid_until>=clock_timestamp()-interval '1 day' THEN RAISE EXCEPTION 'Recovery evidence retention has not elapsed' USING ERRCODE='55000'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'revoked_at'-'revoke_operation_id') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'-'revoke_operation_id')
   OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoke_operation_id IS NULL THEN
   RAISE EXCEPTION 'Recovery evidence only supports terminal revocation' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 PERFORM scope_id FROM public.access_recovery_policy WHERE scope_id=NEW.scope_id FOR UPDATE;
 IF NOT FOUND OR NEW.created_xid IS DISTINCT FROM pg_current_xact_id()::text OR NEW.valid_until>clock_timestamp()+interval '15 minutes' OR NEW.valid_until<=clock_timestamp() THEN
  RAISE EXCEPTION 'Recovery evidence requires current bounded policy' USING ERRCODE='23514';
 END IF;
 IF (SELECT count(*) FROM (SELECT 1 FROM public.access_recovery_path WHERE scope_id=NEW.scope_id AND revoked_at IS NULL AND valid_until>clock_timestamp() LIMIT 8) bounded)>=8 THEN
  RAISE EXCEPTION 'Recovery path budget exceeded' USING ERRCODE='54000';
 END IF;
 SELECT auth_user_id INTO principal FROM public.access_subject WHERE id=NEW.subject_id;
 IF NOT FOUND OR (principal IS NOT NULL AND principal<>NEW.principal_id) OR NEW.proof->>'kind'<>'session' OR (NEW.proof->>'principalId')::uuid<>NEW.principal_id THEN
  RAISE EXCEPTION 'Recovery private attribution mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS access_group_approval_guard ON public.access_group_approval;
CREATE TRIGGER access_group_approval_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_group_approval FOR EACH ROW EXECUTE FUNCTION public.guard_access_group_approval();
DROP TRIGGER IF EXISTS access_recovery_path_guard ON public.access_recovery_path;
CREATE TRIGGER access_recovery_path_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_recovery_path FOR EACH ROW EXECUTE FUNCTION public.guard_access_recovery_path();
DROP TRIGGER IF EXISTS access_recovery_policy_immutable ON public.access_recovery_policy;
CREATE TRIGGER access_recovery_policy_immutable BEFORE UPDATE OR DELETE ON public.access_recovery_policy FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_group_admission_receipt_immutable ON public.access_group_admission_receipt;
CREATE TRIGGER access_group_admission_receipt_immutable BEFORE UPDATE OR DELETE ON public.access_group_admission_receipt FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
