-- Private account admission and immutable public-participation evidence.
CREATE OR REPLACE FUNCTION public.participation_guard_self_binding()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE account_kind text; identity_shape text; erased timestamptz;
BEGIN
  SELECT principal_kind, erased_at INTO account_kind, erased FROM public.users WHERE id = NEW.auth_user_id FOR SHARE;
  SELECT shape INTO identity_shape FROM public.entity_identity WHERE id = NEW.entity_id FOR SHARE;
  IF account_kind IS DISTINCT FROM 'human' OR identity_shape IS DISTINCT FROM 'person' OR erased IS NOT NULL THEN
    RAISE EXCEPTION 'Self participation requires an active human account and a person identity' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.auth_user_id <> OLD.auth_user_id OR NEW.entity_id <> OLD.entity_id OR NEW.revision <> OLD.revision + 1) THEN
    RAISE EXCEPTION 'Self identity is immutable and authorization revisions must advance exactly once' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_self_binding_guard ON public.auth_entity;
CREATE TRIGGER participation_self_binding_guard BEFORE INSERT OR UPDATE ON public.auth_entity
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_self_binding();

CREATE OR REPLACE FUNCTION public.participation_guard_account_kind()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.principal_kind IS DISTINCT FROM OLD.principal_kind THEN
    RAISE EXCEPTION 'A principal cannot change its authentication kind' USING ERRCODE = '23514';
  END IF;
  IF OLD.erased_at IS NOT NULL AND (NEW.erased_at IS DISTINCT FROM OLD.erased_at OR NEW.name <> '' OR NEW.image IS NOT NULL OR NEW.email_verified OR NEW.email IS DISTINCT FROM OLD.email OR NEW.principal_kind <> OLD.principal_kind) THEN
    RAISE EXCEPTION 'Erased authentication accounts cannot be restored' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_account_kind_guard ON public.users;
CREATE TRIGGER participation_account_kind_guard BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_account_kind();

CREATE OR REPLACE FUNCTION public.participation_guard_entity_shape()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.shape IS DISTINCT FROM OLD.shape AND current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Entity shape admission requires READ COMMITTED for current dependent identities' USING ERRCODE='40001';
  END IF;
  IF NEW.shape <> OLD.shape AND
     (EXISTS(SELECT 1 FROM public.auth_entity WHERE entity_id = OLD.id) OR EXISTS(SELECT 1 FROM public.service_principal WHERE entity_id = OLD.id)
      OR EXISTS(SELECT 1 FROM public.reference_value r JOIN public.access_scope s ON s.unit_ref=r.id
       JOIN public.workload_principal w ON w.owner_scope_id=s.id WHERE r.target_entity_id=OLD.id)) THEN
    RAISE EXCEPTION 'An admitted participant cannot change identity shape' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_entity_shape_guard ON public.entity_identity;
CREATE TRIGGER participation_entity_shape_guard BEFORE UPDATE OF shape ON public.entity_identity
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_entity_shape();

CREATE OR REPLACE FUNCTION public.participation_guard_service()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE account_kind text; identity_shape text;
BEGIN
  SELECT principal_kind INTO account_kind FROM public.users WHERE id = NEW.auth_user_id FOR SHARE;
  SELECT shape INTO identity_shape FROM public.entity_identity WHERE id = NEW.entity_id FOR SHARE;
  IF account_kind IS DISTINCT FROM 'service' OR identity_shape IS DISTINCT FROM 'service_actor' THEN
    RAISE EXCEPTION 'Machine credentials require a distinct service principal and service actor' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.auth_user_id <> OLD.auth_user_id OR NEW.entity_id <> OLD.entity_id OR
     NEW.created_by_auth_user_id IS DISTINCT FROM OLD.created_by_auth_user_id OR NEW.revision <> OLD.revision + 1 OR OLD.revoked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Service identity is immutable and revoked credentials cannot be restored' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_service_guard ON public.service_principal;
CREATE TRIGGER participation_service_guard BEFORE INSERT OR UPDATE ON public.service_principal
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_service();

CREATE OR REPLACE FUNCTION public.participation_guard_grant()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Participation grants retain their immutable scope and revocation history' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND ((to_jsonb(NEW) - ARRAY['revision','revoked_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['revision','revoked_at']) OR
     NEW.revision <> OLD.revision + 1 OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Only a consecutive, one-way grant revocation is permitted' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_grant_guard ON public.participation_grant;
CREATE TRIGGER participation_grant_guard BEFORE UPDATE OR DELETE ON public.participation_grant
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_grant();

CREATE OR REPLACE FUNCTION public.participation_require_grant_event()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.participation_grant_event WHERE grant_id = NEW.id AND revision = NEW.revision) THEN
    RAISE EXCEPTION 'Every participation authorization revision requires immutable operator evidence' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_grant_event_required ON public.participation_grant;
CREATE CONSTRAINT TRIGGER participation_grant_event_required AFTER INSERT OR UPDATE ON public.participation_grant
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.participation_require_grant_event();

CREATE OR REPLACE FUNCTION public.participation_guard_immutable_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Participation evidence is immutable' USING ERRCODE = '23514';
END $$;
DROP TRIGGER IF EXISTS participation_grant_event_immutable ON public.participation_grant_event;
CREATE TRIGGER participation_grant_event_immutable BEFORE UPDATE OR DELETE ON public.participation_grant_event
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_immutable_evidence();
DROP TRIGGER IF EXISTS entity_recovery_event_immutable ON public.entity_recovery_event;
CREATE TRIGGER entity_recovery_event_immutable BEFORE UPDATE OR DELETE ON public.entity_recovery_event
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_immutable_evidence();
DROP TRIGGER IF EXISTS entity_presentation_revision_immutable ON public.entity_presentation_revision;
CREATE TRIGGER entity_presentation_revision_immutable BEFORE UPDATE OR DELETE ON public.entity_presentation_revision
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_immutable_evidence();

CREATE OR REPLACE FUNCTION public.participation_guard_presentation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND (NEW.entity_id <> OLD.entity_id OR NEW.language <> OLD.language OR NEW.revision <> OLD.revision + 1)) THEN
    RAISE EXCEPTION 'Entity presentation identities are retained and revisions advance exactly once' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS entity_presentation_guard ON public.entity_presentation;
CREATE TRIGGER entity_presentation_guard BEFORE UPDATE OR DELETE ON public.entity_presentation
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_presentation();

CREATE OR REPLACE FUNCTION public.participation_require_presentation_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.entity_presentation_revision WHERE entity_id = NEW.entity_id AND language = NEW.language AND revision = NEW.revision) THEN
    RAISE EXCEPTION 'Entity presentation requires its immutable revision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS entity_presentation_revision_required ON public.entity_presentation;
CREATE CONSTRAINT TRIGGER entity_presentation_revision_required AFTER INSERT OR UPDATE ON public.entity_presentation
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.participation_require_presentation_revision();

CREATE OR REPLACE FUNCTION public.participation_require_unerased_account()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE subject_id uuid; erased timestamptz;
BEGIN
  subject_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  IF subject_id IS NULL THEN RETURN NEW; END IF;
  SELECT erased_at INTO erased FROM public.users WHERE id = subject_id FOR SHARE;
  IF NOT FOUND OR erased IS NOT NULL THEN
    RAISE EXCEPTION 'An erased account cannot create new private state' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.sessions;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF user_id ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.accounts;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF user_id ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.apikeys;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF reference_id ON public.apikeys
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('reference_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_preference;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_preference
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.notification;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF recipient_auth_user_id ON public.notification
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('recipient_auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.notification_preference;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.notification_preference
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.notification_recipient_stat;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.notification_recipient_stat
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_progress;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.unit_progress
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_progress_entry;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.unit_progress_entry
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.content_structure_node_progress;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.content_structure_node_progress
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_access_grant;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.unit_access_grant
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_access_restriction;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.unit_access_restriction
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.unit_access_invitation;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF invited_auth_user_id ON public.unit_access_invitation
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('invited_auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.platform_capability_grant;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.platform_capability_grant
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_enforcement;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_enforcement
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_evidence_truncate_guard ON public.participation_grant;
CREATE TRIGGER participation_evidence_truncate_guard BEFORE TRUNCATE ON public.participation_grant
FOR EACH STATEMENT EXECUTE FUNCTION public.participation_guard_immutable_evidence();

DROP TRIGGER IF EXISTS participation_evidence_truncate_guard ON public.participation_grant_event;
CREATE TRIGGER participation_evidence_truncate_guard BEFORE TRUNCATE ON public.participation_grant_event
FOR EACH STATEMENT EXECUTE FUNCTION public.participation_guard_immutable_evidence();

DROP TRIGGER IF EXISTS participation_evidence_truncate_guard ON public.entity_recovery_event;
CREATE TRIGGER participation_evidence_truncate_guard BEFORE TRUNCATE ON public.entity_recovery_event
FOR EACH STATEMENT EXECUTE FUNCTION public.participation_guard_immutable_evidence();

DROP TRIGGER IF EXISTS participation_evidence_truncate_guard ON public.entity_presentation_revision;
CREATE TRIGGER participation_evidence_truncate_guard BEFORE TRUNCATE ON public.entity_presentation_revision
FOR EACH STATEMENT EXECUTE FUNCTION public.participation_guard_immutable_evidence();
