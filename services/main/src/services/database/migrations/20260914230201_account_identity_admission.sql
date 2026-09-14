SET search_path TO public;

CREATE TABLE "account_identity_admission" (
	"auth_user_id" uuid,
	"operation_id" uuid,
	"request_digest" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"representation_id" uuid NOT NULL,
	"main_preference_version" bigint,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_identity_admission_pkey" PRIMARY KEY("auth_user_id","operation_id"),
	CONSTRAINT "account_identity_admission_digest_check" CHECK ("request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "account_identity_admission_version_check" CHECK ("main_preference_version" is null or "main_preference_version" between 1 and 9007199254740991)
);

CREATE UNIQUE INDEX "account_identity_admission_entity_key" ON "account_identity_admission" ("entity_id");
CREATE UNIQUE INDEX "account_identity_admission_representation_key" ON "account_identity_admission" ("representation_id");
CREATE INDEX "account_identity_admission_created_idx" ON "account_identity_admission" ("auth_user_id","created_at","operation_id");
ALTER TABLE "account_identity_admission" ADD CONSTRAINT "account_identity_admission_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "account_identity_admission" ADD CONSTRAINT "account_identity_admission_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity"("id") ON DELETE RESTRICT;
ALTER TABLE "account_identity_admission" ADD CONSTRAINT "account_identity_admission_B5amEokI5KXp_fkey" FOREIGN KEY ("representation_id") REFERENCES "access_representation"("id") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.guard_account_identity_admission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE owner_id uuid; erased timestamptz;
BEGIN
 owner_id:=CASE WHEN TG_OP='DELETE' THEN OLD.auth_user_id ELSE NEW.auth_user_id END;
 SELECT erased_at INTO erased FROM public.users WHERE id=owner_id AND principal_kind='human' FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Identity admission requires a human account' USING ERRCODE='23503'; END IF;
 IF TG_OP='DELETE' THEN
  IF erased IS NULL THEN RAISE EXCEPTION 'Identity admission receipts are retained until account erasure' USING ERRCODE='55000'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Identity admission receipts are immutable' USING ERRCODE='55000'; END IF;
 IF erased IS NOT NULL THEN RAISE EXCEPTION 'Erased accounts cannot create identities' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.access_representation r
  JOIN public.access_subject s ON s.id=r.recipient_subject_id
  JOIN public.access_representation_revision t ON t.grant_id=r.id AND t.revision=1
  WHERE r.id=NEW.representation_id AND r.entity_id=NEW.entity_id AND r.parent_grant_id IS NULL
   AND r.recipient_kind='subject' AND s.auth_user_id=NEW.auth_user_id
   AND r.version=1 AND r.terms_revision=1 AND r.state='active'
   AND t.sealed AND t.target_kind='all-scopes' AND t.can_redelegate AND NOT t.require_fresh_session
   AND t.valid_until IS NULL AND t.membership_id IS NULL)
 THEN RAISE EXCEPTION 'Identity admission must retain its initial direct control grant' USING ERRCODE='23514'; END IF;
 IF NEW.main_preference_version IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.identity_preference p
  JOIN public.identity_preference_event e ON e.preference_id=p.id AND e.version=NEW.main_preference_version
  WHERE p.auth_user_id=NEW.auth_user_id AND p.client_id IS NULL AND p.version=NEW.main_preference_version
   AND p.selection_kind='entity' AND p.entity_id=NEW.entity_id
   AND e.operation_id=NEW.operation_id AND e.entity_id=NEW.entity_id)
 THEN RAISE EXCEPTION 'Initial main selection must match the admitted identity' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS account_identity_admission_guard ON public.account_identity_admission;
CREATE TRIGGER account_identity_admission_guard BEFORE INSERT OR UPDATE OR DELETE ON public.account_identity_admission
 FOR EACH ROW EXECUTE FUNCTION public.guard_account_identity_admission();
