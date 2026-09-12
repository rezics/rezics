-- A reference value is a separate namespace; self-follow compares its native target.
CREATE OR REPLACE FUNCTION public.guard_follow_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF public.reference_value_native_id(NEW.target_reference_id)=NEW.follower_profile_id THEN
  RAISE EXCEPTION 'An Entity cannot follow itself' USING ERRCODE='23514',CONSTRAINT='unit_follow_not_self';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS unit_follow_reference_guard ON public.unit_follow;
CREATE TRIGGER unit_follow_reference_guard BEFORE INSERT OR UPDATE OF follower_profile_id,target_reference_id ON public.unit_follow
FOR EACH ROW EXECUTE FUNCTION public.guard_follow_reference();

-- A public follow has at most one private preference row, owned by its human account.
CREATE OR REPLACE FUNCTION public.participation_guard_follow_preference()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.auth_user_id, NEW.follower_entity_id, NEW.target_reference_id) IS DISTINCT FROM
    (OLD.auth_user_id, OLD.follower_entity_id, OLD.target_reference_id) THEN
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
