-- A public follow has at most one private preference row, owned by its human account.
CREATE OR REPLACE FUNCTION public.participation_guard_follow_preference()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.auth_user_id, NEW.follower_entity_id, NEW.unit_id) IS DISTINCT FROM
    (OLD.auth_user_id, OLD.follower_entity_id, OLD.unit_id) THEN
    RAISE EXCEPTION 'Private following ownership is immutable' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.users WHERE id = NEW.auth_user_id AND erased_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Private following requires an active Auth account' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  PERFORM 1 FROM public.auth_entity WHERE auth_user_id = NEW.auth_user_id AND entity_id = NEW.follower_entity_id AND state = 'active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Private following belongs to the account self identity' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_follow_preference_guard ON public.account_follow_preference;
CREATE TRIGGER participation_follow_preference_guard BEFORE INSERT OR UPDATE ON public.account_follow_preference
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_follow_preference();
