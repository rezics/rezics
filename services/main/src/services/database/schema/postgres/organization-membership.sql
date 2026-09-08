-- Operational membership is separate from sourced catalog affiliations and capability grants.
CREATE OR REPLACE FUNCTION public.organization_membership_lock_admission(organization_id uuid, recipient_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  -- All invitation admissions acquire the inbox lock before the organization lock.
  PERFORM pg_advisory_xact_lock(hashtextextended('organization-membership-inbox:' || recipient_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('organization-membership-organization:' || organization_id::text, 0));
END $$;

CREATE OR REPLACE FUNCTION public.organization_membership_assert_invitation_authority(
  organization_id uuid, organization_revision bigint, issuer_id uuid, issuer_revision bigint,
  grant_id uuid, grant_revision bigint)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM 1 FROM public.users WHERE id = issuer_id AND principal_kind = 'human' AND erased_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership invitation issuer is unavailable' USING ERRCODE = '23514'; END IF;
  PERFORM 1 FROM public.entity_participation WHERE entity_id = organization_id AND state = 'active' AND revision = organization_revision FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership organization generation is unavailable' USING ERRCODE = '23514'; END IF;
  PERFORM 1 FROM public.entity_identity WHERE id = organization_id AND shape = 'organization' AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operational membership requires a controlled organization' USING ERRCODE = '23514'; END IF;
  PERFORM 1 FROM public.auth_entity WHERE auth_user_id = issuer_id AND state = 'active' AND revision = issuer_revision FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership invitation issuer binding changed' USING ERRCODE = '23514'; END IF;
  PERFORM 1 FROM public.participation_grant WHERE id = grant_id AND revision = grant_revision
    AND auth_user_id = issuer_id AND service_principal_id IS NULL
    AND acting_entity_id = organization_id AND entity_id = organization_id
    AND capability = 'entity.membership' AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > clock_timestamp()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership invitation authority changed' USING ERRCODE = '23514'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.organization_membership_guard_invitation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE pending_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.users WHERE id = OLD.recipient_auth_user_id AND erased_at IS NOT NULL) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Membership invitations are retained until recipient account erasure' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.id, NEW.organization_entity_id, NEW.organization_revision, NEW.recipient_auth_user_id,
      NEW.recipient_entity_id, NEW.invited_by_auth_user_id, NEW.inviter_authorization_revision,
      NEW.authorization_grant_id, NEW.authorization_grant_revision, NEW.expires_at, NEW.created_at)
      IS DISTINCT FROM (OLD.id, OLD.organization_entity_id, OLD.organization_revision, OLD.recipient_auth_user_id,
      OLD.recipient_entity_id, OLD.invited_by_auth_user_id, OLD.inviter_authorization_revision,
      OLD.authorization_grant_id, OLD.authorization_grant_revision, OLD.expires_at, OLD.created_at)
      OR OLD.state <> 'pending' OR NEW.state = 'pending' OR NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION 'Membership invitation identity and terminal state are immutable' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.state <> 'pending' OR NEW.revision <> 1 THEN
      RAISE EXCEPTION 'Membership invitations start pending at revision one' USING ERRCODE = '23514';
    END IF;
    PERFORM public.organization_membership_lock_admission(NEW.organization_entity_id, NEW.recipient_auth_user_id);
    IF EXISTS (SELECT 1 FROM public.organization_membership WHERE organization_entity_id = NEW.organization_entity_id
      AND member_auth_user_id = NEW.recipient_auth_user_id AND removed_at IS NULL) THEN
      RAISE EXCEPTION 'An active member does not need a new invitation' USING ERRCODE = '23514';
    END IF;
    SELECT count(*)::integer INTO pending_count FROM (
      SELECT id FROM public.organization_membership_invitation
      WHERE organization_entity_id = NEW.organization_entity_id AND state = 'pending' LIMIT 1001
    ) bounded;
    IF pending_count >= 1000 THEN RAISE EXCEPTION 'Organization pending invitation capacity reached' USING ERRCODE = '23514'; END IF;
    SELECT count(*)::integer INTO pending_count FROM (
      SELECT id FROM public.organization_membership_invitation
      WHERE recipient_auth_user_id = NEW.recipient_auth_user_id AND state = 'pending' LIMIT 1001
    ) bounded;
    IF pending_count >= 1000 THEN RAISE EXCEPTION 'Recipient pending invitation capacity reached' USING ERRCODE = '23514'; END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.state = 'accepted' THEN
    PERFORM public.organization_membership_lock_admission(NEW.organization_entity_id, NEW.recipient_auth_user_id);
    PERFORM public.organization_membership_assert_invitation_authority(
      NEW.organization_entity_id, NEW.organization_revision, NEW.invited_by_auth_user_id,
      NEW.inviter_authorization_revision, NEW.authorization_grant_id, NEW.authorization_grant_revision);
    PERFORM 1 FROM public.users WHERE id = NEW.recipient_auth_user_id AND principal_kind = 'human' AND erased_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Membership recipient is unavailable' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
    PERFORM 1 FROM public.auth_entity WHERE auth_user_id = NEW.recipient_auth_user_id
      AND entity_id = NEW.recipient_entity_id AND state = 'active' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Membership recipient is not this account self identity' USING ERRCODE = '23514'; END IF;
    IF NEW.expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'Membership invitation expired' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS organization_membership_invitation_guard ON public.organization_membership_invitation;
CREATE TRIGGER organization_membership_invitation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.organization_membership_invitation
FOR EACH ROW EXECUTE FUNCTION public.organization_membership_guard_invitation();

CREATE OR REPLACE FUNCTION public.organization_membership_guard_member()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE invitation public.organization_membership_invitation%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.users WHERE id = OLD.member_auth_user_id AND erased_at IS NOT NULL) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Membership removal retains its account-owned record until erasure' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.organization_entity_id, NEW.member_auth_user_id, NEW.member_entity_id, NEW.created_at)
      IS DISTINCT FROM (OLD.organization_entity_id, OLD.member_auth_user_id, OLD.member_entity_id, OLD.created_at)
      OR NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION 'Membership identity is immutable and revisions advance exactly once' USING ERRCODE = '23514';
    END IF;
    IF NEW.removed_at IS NOT NULL THEN
      IF OLD.removed_at IS NOT NULL OR NEW.accepted_invitation_id <> OLD.accepted_invitation_id OR NEW.joined_at <> OLD.joined_at THEN
        RAISE EXCEPTION 'Only an active membership can be removed' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END IF;
    IF OLD.removed_at IS NULL OR NEW.accepted_invitation_id = OLD.accepted_invitation_id THEN
      RAISE EXCEPTION 'Rejoining requires a different accepted invitation' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.revision <> 1 OR NEW.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Membership begins active at revision one' USING ERRCODE = '23514';
  END IF;
  PERFORM public.organization_membership_lock_admission(NEW.organization_entity_id, NEW.member_auth_user_id);
  SELECT * INTO invitation FROM public.organization_membership_invitation WHERE id = NEW.accepted_invitation_id FOR SHARE;
  IF NOT FOUND OR invitation.state <> 'accepted' OR invitation.organization_entity_id <> NEW.organization_entity_id
    OR invitation.recipient_auth_user_id <> NEW.member_auth_user_id OR invitation.recipient_entity_id <> NEW.member_entity_id
    OR invitation.resolved_by_auth_user_id IS DISTINCT FROM NEW.member_auth_user_id OR invitation.resolved_at IS DISTINCT FROM NEW.joined_at THEN
    RAISE EXCEPTION 'Membership requires the exact recipient accepted invitation' USING ERRCODE = '23514';
  END IF;
  PERFORM public.organization_membership_assert_invitation_authority(
    invitation.organization_entity_id, invitation.organization_revision, invitation.invited_by_auth_user_id,
    invitation.inviter_authorization_revision, invitation.authorization_grant_id, invitation.authorization_grant_revision);
  PERFORM 1 FROM public.users WHERE id = NEW.member_auth_user_id AND principal_kind = 'human' AND erased_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership account is unavailable' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  PERFORM 1 FROM public.auth_entity WHERE auth_user_id = NEW.member_auth_user_id AND entity_id = NEW.member_entity_id AND state = 'active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership belongs to another self identity' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS organization_membership_guard ON public.organization_membership;
CREATE TRIGGER organization_membership_guard BEFORE INSERT OR UPDATE OR DELETE ON public.organization_membership
FOR EACH ROW EXECUTE FUNCTION public.organization_membership_guard_member();
