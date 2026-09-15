SET search_path TO public;

CREATE TABLE "access_assignment_approval" (
	"id" uuid PRIMARY KEY,
	"review_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"proof" jsonb NOT NULL,
	"selection" jsonb NOT NULL,
	"source_digest" text NOT NULL,
	"proposal_digest" text NOT NULL,
	"effect_digest" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp(3) with time zone NOT NULL,
	"revoked_at" timestamp(3) with time zone,
	"revoke_operation_id" uuid,
	CONSTRAINT "access_assignment_approval_payload_check" CHECK (octet_length("proof"::text)<=1024 and octet_length("selection"::text)<=8192),
	CONSTRAINT "access_assignment_approval_digest_check" CHECK ("source_digest" ~ '^[0-9a-f]{64}$' and "proposal_digest" ~ '^[0-9a-f]{64}$' and "effect_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "access_assignment_approval_time_check" CHECK (isfinite("valid_until") and "valid_until">"created_at" and ("revoked_at" is null)=("revoke_operation_id" is null))
);

CREATE TABLE "access_assignment_receipt" (
	"review_id" uuid PRIMARY KEY,
	"operation_id" uuid NOT NULL UNIQUE,
	"proposal_digest" text NOT NULL,
	"effect_digest" text NOT NULL,
	"receipt" jsonb NOT NULL,
	"approval_ids" jsonb NOT NULL,
	"recovery_path_ids" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_assignment_receipt_budget_check" CHECK (octet_length("receipt"::text)<=4096 and jsonb_array_length("approval_ids")<=1 and jsonb_array_length("recovery_path_ids")<=64)
);

CREATE TABLE "access_assignment_review" (
	"id" uuid PRIMARY KEY,
	"scope_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"proof" jsonb NOT NULL,
	"selection" jsonb NOT NULL,
	"command" jsonb NOT NULL,
	"proposal_digest" text NOT NULL,
	"source_digest" text NOT NULL,
	"effect_digest" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"effect_count" integer NOT NULL,
	"requires_approval" boolean NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"base_snapshot" text DEFAULT pg_current_snapshot() NOT NULL,
	"valid_until" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "access_assignment_review_budget_check" CHECK (octet_length("proof"::text)<=1024 and octet_length("selection"::text)<=8192 and octet_length("command"::text)<=65536 and octet_length("evidence"::text)<=16777216 and "effect_count" between 0 and 4096),
	CONSTRAINT "access_assignment_review_digest_check" CHECK ("proposal_digest" ~ '^[0-9a-f]{64}$' and "source_digest" ~ '^[0-9a-f]{64}$' and "effect_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "access_assignment_review_time_check" CHECK (isfinite("valid_until") and "valid_until">"created_at")
);

CREATE UNIQUE INDEX "access_assignment_approval_principal_key" ON "access_assignment_approval" ("review_id","principal_id");
CREATE INDEX "access_assignment_review_principal_idx" ON "access_assignment_review" ("principal_id","valid_until","id");
ALTER TABLE "access_assignment_approval" ADD CONSTRAINT "access_assignment_approval_HtkxZfS7469x_fkey" FOREIGN KEY ("review_id") REFERENCES "access_assignment_review"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_approval" ADD CONSTRAINT "access_assignment_approval_principal_id_users_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_approval" ADD CONSTRAINT "access_assignment_approval_subject_id_access_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "access_subject"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_receipt" ADD CONSTRAINT "access_assignment_receipt_GklIyZGTDh5M_fkey" FOREIGN KEY ("review_id") REFERENCES "access_assignment_review"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_review" ADD CONSTRAINT "access_assignment_review_scope_id_access_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_scope"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_review" ADD CONSTRAINT "access_assignment_review_principal_id_users_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "access_assignment_review" ADD CONSTRAINT "access_assignment_review_subject_id_access_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "access_subject"("id") ON DELETE RESTRICT;

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
