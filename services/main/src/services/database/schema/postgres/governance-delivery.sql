-- Referral admission and action closure share the case row lock. A job's reviewed
-- prefix is immutable, so retries cannot omit or silently replace its recipients.
CREATE OR REPLACE FUNCTION public.guard_governance_delivery_referral()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE case_state public.content_review_case_state;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT state INTO case_state FROM public.content_review_case WHERE id = NEW.case_id FOR SHARE;
    IF case_state NOT IN ('new','triaged','assigned','escalated','reviewing') THEN
      RAISE EXCEPTION 'Report referral requires an active review case' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Report referral evidence is immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  ELSE
    IF EXISTS (SELECT 1 FROM public.governance_report_delivery WHERE case_id = OLD.case_id AND completed_at IS NULL LIMIT 1) THEN
      RAISE EXCEPTION 'Pending report delivery retains its referral evidence' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
  END IF;
END $$;
CREATE TRIGGER governance_delivery_referral_guard BEFORE INSERT OR UPDATE OR DELETE ON public.content_report_referral
FOR EACH ROW EXECUTE FUNCTION public.guard_governance_delivery_referral();

CREATE OR REPLACE FUNCTION public.guard_governance_report_delivery()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    (NEW.id, NEW.case_id, NEW.action_id, NEW.public_notice_post_id, NEW.actor_entity_id, NEW.actor_auth_user_id, NEW.kind, NEW.shard, NEW.through_referral_id, NEW.created_at)
    IS DISTINCT FROM
    (OLD.id, OLD.case_id, OLD.action_id, OLD.public_notice_post_id, OLD.actor_entity_id, OLD.actor_auth_user_id, OLD.kind, OLD.shard, OLD.through_referral_id, OLD.created_at)
    OR (OLD.after_referral_id IS NOT NULL AND (NEW.after_referral_id IS NULL OR NEW.after_referral_id < OLD.after_referral_id))
    OR (OLD.completed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD)
  ) THEN RAISE EXCEPTION 'Delivery inputs and committed progress are immutable' USING ERRCODE='23514'; END IF;
  IF NEW.public_notice_post_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.governance_post_binding WHERE post_id=NEW.public_notice_post_id AND role='public_notice'
      AND ((subject_kind='content_governance_action' AND subject_id=NEW.action_id)
        OR (subject_kind='content_review_case' AND subject_id=NEW.case_id))
  ) THEN RAISE EXCEPTION 'Delivery notice does not belong to its reviewed subject' USING ERRCODE='23514'; END IF;
  IF NEW.action_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.content_governance_action WHERE id=NEW.action_id AND case_id=NEW.case_id AND actor_profile_id=NEW.actor_entity_id
  ) THEN RAISE EXCEPTION 'Delivery action does not belong to the case and operator' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    PERFORM 1 FROM public.content_review_case WHERE id=NEW.case_id FOR UPDATE;
    IF NEW.after_referral_id IS NOT NULL OR NEW.completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Delivery starts before its first referral' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.content_report_referral WHERE case_id=NEW.case_id AND id=NEW.through_referral_id) THEN
      RAISE EXCEPTION 'Delivery requires an exact retained referral boundary' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER governance_report_delivery_guard BEFORE INSERT OR UPDATE ON public.governance_report_delivery
FOR EACH ROW EXECUTE FUNCTION public.guard_governance_report_delivery();

CREATE OR REPLACE FUNCTION public.guard_governance_notice_recipient()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Notice recipient receipts are immutable' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.governance_post_binding WHERE post_id=NEW.post_id AND role='public_notice') THEN
    RAISE EXCEPTION 'Only public governance notices receive read receipts' USING ERRCODE='23514'; END IF;
  PERFORM 1 FROM public.users WHERE id=NEW.auth_user_id AND erased_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Notice recipient account is unavailable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER governance_notice_recipient_guard BEFORE INSERT OR UPDATE ON public.governance_notice_recipient
FOR EACH ROW EXECUTE FUNCTION public.guard_governance_notice_recipient();
