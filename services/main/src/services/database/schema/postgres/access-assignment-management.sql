-- Review/approval/receipt payloads are private server evidence, not client authority.
CREATE OR REPLACE FUNCTION public.guard_access_assignment_review()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE principal uuid; body jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Assignment review evidence is immutable' USING ERRCODE='55000'; END IF;
 body=NEW.command->'command';
 SELECT auth_user_id INTO principal FROM public.access_subject WHERE id=NEW.subject_id;
 IF NOT FOUND OR (principal IS NOT NULL AND principal<>NEW.principal_id)
  OR NEW.proof->>'kind' IS DISTINCT FROM 'session' OR NEW.proof->>'principalId' IS DISTINCT FROM NEW.principal_id::text
  OR body->>'operatorAuthUserId' IS DISTINCT FROM NEW.principal_id::text OR body->>'authoritySubjectId' IS DISTINCT FROM NEW.subject_id::text
  OR coalesce(body->>'scopeId',body->>'targetScopeId') IS DISTINCT FROM NEW.scope_id::text
  OR NEW.command->>'kind' NOT IN ('role','binding','ceiling')
  OR NEW.valid_until<=clock_timestamp() OR NEW.valid_until>clock_timestamp()+interval '5 minutes' THEN
  RAISE EXCEPTION 'Assignment review requires exact current private attribution and bounded expiry' USING ERRCODE='23514';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('assignment-review:'||NEW.principal_id::text,0));
 IF (SELECT count(*) FROM (SELECT 1 FROM public.access_assignment_review WHERE principal_id=NEW.principal_id AND valid_until>clock_timestamp() LIMIT 16) bounded)>=16 THEN
  RAISE EXCEPTION 'Active assignment review budget exceeded' USING ERRCODE='54000';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.guard_access_assignment_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE review public.access_assignment_review%ROWTYPE; principal uuid;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Independent assignment approvals retain audit evidence' USING ERRCODE='55000'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'revoked_at'-'revoke_operation_id') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'-'revoke_operation_id')
   OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoke_operation_id IS NULL THEN
   RAISE EXCEPTION 'Assignment approval only supports terminal revocation' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO review FROM public.access_assignment_review WHERE id=NEW.review_id FOR UPDATE;
 IF NOT FOUND OR NEW.principal_id=review.principal_id OR NEW.subject_id=review.subject_id
  OR NEW.proposal_digest<>review.proposal_digest OR NEW.effect_digest<>review.effect_digest
  OR NEW.valid_until>review.valid_until OR NEW.valid_until<=clock_timestamp() THEN
  RAISE EXCEPTION 'Assignment approval requires complete current independent evidence' USING ERRCODE='23514';
 END IF;
 IF (SELECT count(*) FROM (SELECT 1 FROM public.access_assignment_approval WHERE review_id=NEW.review_id LIMIT 64) bounded)>=64 THEN
  RAISE EXCEPTION 'Assignment approval budget exceeded' USING ERRCODE='54000';
 END IF;
 SELECT auth_user_id INTO principal FROM public.access_subject WHERE id=NEW.subject_id;
 IF NOT FOUND OR (principal IS NOT NULL AND principal<>NEW.principal_id) OR NEW.proof->>'kind' IS DISTINCT FROM 'session' OR NEW.proof->>'principalId' IS DISTINCT FROM NEW.principal_id::text THEN
  RAISE EXCEPTION 'Independent assignment approval attribution mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.guard_access_assignment_receipt()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE review public.access_assignment_review%ROWTYPE; body jsonb; actual jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Assignment receipts retain audit evidence' USING ERRCODE='55000'; END IF;
 SELECT * INTO review FROM public.access_assignment_review WHERE id=NEW.review_id FOR UPDATE;
 IF NOT FOUND OR NEW.proposal_digest<>review.proposal_digest OR NEW.effect_digest<>review.effect_digest THEN
  RAISE EXCEPTION 'Assignment receipt must retain its exact review' USING ERRCODE='23514';
 END IF;
 body=review.command->'command';
 IF NEW.operation_id::text IS DISTINCT FROM body->>'operationId' OR NEW.receipt->>'operationId' IS DISTINCT FROM body->>'operationId'
  OR (NEW.receipt->>'version')::bigint IS DISTINCT FROM (body->>'expectedVersion')::bigint+1
  OR jsonb_array_length(NEW.recovery_path_ids)<1 OR (review.requires_approval AND jsonb_array_length(NEW.approval_ids)<>1) THEN
  RAISE EXCEPTION 'Assignment receipt requires exact operation and recovery attribution' USING ERRCODE='23514';
 END IF;
 IF review.command->>'kind'='role' THEN
  SELECT to_jsonb(e) INTO actual FROM public.access_role_event e WHERE role_id=(body->>'roleId')::uuid AND operation_id=NEW.operation_id;
 ELSIF review.command->>'kind'='binding' THEN
  SELECT to_jsonb(e) INTO actual FROM public.access_role_binding_event e WHERE binding_id=(body->>'bindingId')::uuid AND operation_id=NEW.operation_id;
 ELSIF review.command->>'kind'='ceiling' THEN
  SELECT to_jsonb(e) INTO actual FROM public.access_assignment_ceiling_event e WHERE ceiling_id=(body->>'ceilingId')::uuid AND operation_id=NEW.operation_id;
 END IF;
 IF actual IS NULL OR actual->>'operation' IS DISTINCT FROM body->>'operation'
  OR actual->>'operator_auth_user_id' IS DISTINCT FROM review.principal_id::text OR actual->>'authority_subject_id' IS DISTINCT FROM review.subject_id::text
  OR actual->>'version' IS DISTINCT FROM NEW.receipt->>'version' THEN
  RAISE EXCEPTION 'Assignment receipt requires its exact native domain event' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS access_assignment_review_guard ON public.access_assignment_review;
CREATE TRIGGER access_assignment_review_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_assignment_review FOR EACH ROW EXECUTE FUNCTION public.guard_access_assignment_review();
DROP TRIGGER IF EXISTS access_assignment_approval_guard ON public.access_assignment_approval;
CREATE TRIGGER access_assignment_approval_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_assignment_approval FOR EACH ROW EXECUTE FUNCTION public.guard_access_assignment_approval();
DROP TRIGGER IF EXISTS access_assignment_receipt_guard ON public.access_assignment_receipt;
CREATE TRIGGER access_assignment_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_assignment_receipt FOR EACH ROW EXECUTE FUNCTION public.guard_access_assignment_receipt();
