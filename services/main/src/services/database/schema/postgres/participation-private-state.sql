-- Private history is append-only during account lifetime and physically removable by account erasure.
CREATE OR REPLACE FUNCTION public.participation_guard_private_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND EXISTS(SELECT 1 FROM public.users WHERE id = OLD.auth_user_id AND erased_at IS NOT NULL) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Private Favorites history is retained until account erasure' USING ERRCODE = '23514';
END $$;
DROP TRIGGER IF EXISTS participation_private_history_guard ON public.account_favorite_revision;
CREATE TRIGGER participation_private_history_guard BEFORE UPDATE OR DELETE ON public.account_favorite_revision
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_private_history();

CREATE OR REPLACE FUNCTION public.participation_guard_favorite_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF (to_jsonb(NEW)-ARRAY['position','note','snapshot','revision','updated_at','target_owner']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['position','note','snapshot','revision','updated_at','target_owner']) OR NEW.revision <= OLD.revision THEN
    RAISE EXCEPTION 'Favorite ownership and target are immutable; revisions must advance' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_favorite_identity_guard ON public.account_favorite;
CREATE TRIGGER participation_favorite_identity_guard BEFORE UPDATE ON public.account_favorite
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_favorite_identity();

CREATE OR REPLACE FUNCTION public.participation_guard_image_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE erased timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id, NEW.owner_auth_user_id, NEW.uploader_auth_user_id, NEW.access, NEW.created_at) IS DISTINCT FROM
    (OLD.id, OLD.owner_auth_user_id, OLD.uploader_auth_user_id, OLD.access, OLD.created_at) THEN
    RAISE EXCEPTION 'Image identity, account ownership and access are immutable' USING ERRCODE = '23514';
  END IF;
  SELECT erased_at INTO erased FROM public.users WHERE id = NEW.owner_auth_user_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Image requires an Auth owner' USING ERRCODE = '23514'; END IF;
  IF erased IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.deleted_at IS NULL OR
    (to_jsonb(NEW) - ARRAY['deleted_at','content_erased_at','erasure_fence_version_id','updated_at']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['deleted_at','content_erased_at','erasure_fence_version_id','updated_at'])) THEN
    RAISE EXCEPTION 'Erased accounts cannot write image content' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required';
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.content_erased_at IS NOT NULL AND NEW.content_erased_at IS DISTINCT FROM OLD.content_erased_at OR
    OLD.erasure_fence_version_id IS NOT NULL AND NEW.erasure_fence_version_id IS DISTINCT FROM OLD.erasure_fence_version_id) THEN
    RAISE EXCEPTION 'Private image erasure is irreversible' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_image_owner_guard ON public.image_asset;
CREATE TRIGGER participation_image_owner_guard BEFORE INSERT OR UPDATE ON public.image_asset
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_image_owner();

CREATE OR REPLACE FUNCTION public.participation_guard_image_child()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM 1 FROM public.image_asset asset JOIN public.users account ON account.id = asset.owner_auth_user_id
    WHERE asset.id = NEW.asset_id AND asset.deleted_at IS NULL AND account.erased_at IS NULL FOR SHARE OF account, asset;
  IF NOT FOUND THEN RAISE EXCEPTION 'Image content requires an active Auth owner' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_image_child_guard ON public.image_object;
CREATE TRIGGER participation_image_child_guard BEFORE INSERT OR UPDATE ON public.image_object
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_image_child();
DROP TRIGGER IF EXISTS participation_image_child_guard ON public.image_asset_presentation;
CREATE TRIGGER participation_image_child_guard BEFORE INSERT OR UPDATE ON public.image_asset_presentation
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_image_child();

CREATE OR REPLACE FUNCTION public.participation_guard_quota_subject()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE subject_id uuid;
BEGIN
  subject_id := coalesce(to_jsonb(NEW) ->> 'account_user_id', to_jsonb(NEW) ->> 'user_id')::uuid;
  IF subject_id IS NULL THEN
    SELECT reference_id INTO subject_id FROM public.apikeys WHERE id = (to_jsonb(NEW) ->> 'token_id')::uuid;
  END IF;
  PERFORM 1 FROM public.users WHERE id = subject_id AND erased_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quota state requires an active Auth account' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.participation_guard_conversation_member()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE marker_id uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.conversation WHERE id = NEW.conversation_id AND NEW.auth_user_id IN (participant_low_auth_user_id, participant_high_auth_user_id)) THEN
    RAISE EXCEPTION 'Private conversation state requires an admitted participant' USING ERRCODE = '23514';
  END IF;
  marker_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  IF marker_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.message WHERE id = marker_id AND conversation_id = NEW.conversation_id) THEN
    RAISE EXCEPTION 'Conversation marker must belong to the same conversation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS participation_conversation_member_guard ON public.conversation_read;
CREATE TRIGGER participation_conversation_member_guard BEFORE INSERT OR UPDATE ON public.conversation_read
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_conversation_member('last_read_message_id');
DROP TRIGGER IF EXISTS participation_conversation_member_guard ON public.conversation_participant_stat;
CREATE TRIGGER participation_conversation_member_guard BEFORE INSERT OR UPDATE ON public.conversation_participant_stat
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_conversation_member('last_message_id');

-- Favorites engagement is derived from the private relation without exposing the owning account.
DROP TRIGGER IF EXISTS favorite_item_stats_maintain ON public.collection_item;
DROP FUNCTION IF EXISTS public.maintain_favorite_item_stats();
CREATE OR REPLACE FUNCTION public.maintain_account_favorite_stats()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE row_data public.account_favorite%ROWTYPE; direction bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN row_data := NEW; direction := 1;
  ELSE row_data := OLD; direction := -1; END IF;
  PERFORM public.apply_unit_engagement_stat(row_data.target_unit_id, p_favorites => direction);
  PERFORM public.apply_recommendation_unit_signal(row_data.target_unit_id, row_data.created_at, 'favorite', direction, direction * 5);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS account_favorite_stats_maintain ON public.account_favorite;
CREATE TRIGGER account_favorite_stats_maintain AFTER INSERT OR DELETE ON public.account_favorite
FOR EACH ROW EXECUTE FUNCTION public.maintain_account_favorite_stats();

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.recommendation_event;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.recommendation_event
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.recommendation_exclusion;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.recommendation_exclusion
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.studio_resource_visit;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.studio_resource_visit
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.studio_auth_editor_candidate;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.studio_auth_editor_candidate
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_favorites_state;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_favorites_state
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_favorite;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_favorite
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_favorite_revision;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_favorite_revision
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_realm_tag_subscription;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_realm_tag_subscription
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_unit_tag;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.account_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.book_chapter_progress_stat;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.book_chapter_progress_stat
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.conversation_participant_stat;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.conversation_participant_stat
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.api_token_creation_reservation;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF account_user_id ON public.api_token_creation_reservation
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('account_user_id');

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_account_quota_binding;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_account_quota_binding
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_token_quota_binding;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_token_quota_binding
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_token_quota_override;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_token_quota_override
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_quota_rate_state;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_quota_rate_state
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_quota_daily_usage;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_quota_daily_usage
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

DROP TRIGGER IF EXISTS participation_quota_subject_guard ON public.api_quota_request_lease;
CREATE TRIGGER participation_quota_subject_guard BEFORE INSERT OR UPDATE ON public.api_quota_request_lease
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_quota_subject();

-- Aggregate recommendation signals outlive event-log retention; event erasure removes private attribution only.
CREATE OR REPLACE FUNCTION public.maintain_recommendation_event_signals() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE row_data recommendation_event%ROWTYPE; direction bigint;
unit_weight double precision;
change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    IF row_data.auth_user_id IS NOT NULL
      AND row_data.type IN ('impression', 'open', 'dwell_30s', 'not_interested') THEN
      unit_weight := CASE row_data.type WHEN 'open' THEN 1 WHEN 'dwell_30s' THEN 2 ELSE 0 END;
      PERFORM apply_recommendation_unit_signal(
        row_data.target_unit_id, row_data.occurred_at,
        row_data.type::text, direction, direction * unit_weight
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS recommendation_event_signals_maintain ON public.recommendation_event;
CREATE TRIGGER recommendation_event_signals_maintain AFTER INSERT OR UPDATE ON public.recommendation_event
FOR EACH ROW EXECUTE FUNCTION public.maintain_recommendation_event_signals();
