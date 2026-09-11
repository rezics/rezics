SET search_path TO public;

-- Drop index "recommendation_event_target_occurred_at_idx" from table: "recommendation_event"
DROP INDEX "recommendation_event_target_occurred_at_idx";
-- Modify "recommendation_event" table
ALTER TABLE "recommendation_event" DROP CONSTRAINT "recommendation_event_target_unit_id_check", DROP CONSTRAINT "recommendation_event_target_unit_target_check", DROP CONSTRAINT "recommendation_event_request_target_type_key", DROP COLUMN "target_unit_id", DROP COLUMN "target_unit_publishing_id", DROP COLUMN "target_unit_music_id", DROP COLUMN "target_unit_program_id", DROP COLUMN "target_unit_software_id", DROP COLUMN "target_unit_entity_id", DROP COLUMN "target_unit_grouping_id", DROP COLUMN "target_unit_reference_id", DROP COLUMN "target_unit_distribution_id", DROP COLUMN "target_unit_video_id", DROP COLUMN "target_unit_audio_id", DROP COLUMN "target_unit_post_id", DROP COLUMN "target_unit_poll_id", DROP COLUMN "target_unit_zone_id", DROP COLUMN "target_unit_realm_id", DROP COLUMN "target_unit_realm_rule_id", DROP COLUMN "target_unit_custom_theme_id", DROP COLUMN "target_unit_collection_id", DROP COLUMN "target_unit_tag_id", DROP COLUMN "target_unit_tag_path_id", DROP COLUMN "target_unit_label_id", ADD COLUMN "target_reference_id" uuid NOT NULL, ADD CONSTRAINT "recommendation_event_request_target_type_key" UNIQUE ("request_id", "target_reference_id", "type"), ADD CONSTRAINT "recommendation_event_3X9Gff8k5P3Q_fkey" FOREIGN KEY ("target_reference_id") REFERENCES "reference_value" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "recommendation_event_target_occurred_at_idx" to table: "recommendation_event"
CREATE INDEX "recommendation_event_target_occurred_at_idx" ON "recommendation_event" ("target_reference_id", "occurred_at" DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.unit_publish_platform_route()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE ready boolean; affected integer;
BEGIN
  SELECT c.ready INTO ready FROM public.catalog_routing_control c WHERE singleton FOR SHARE;
  IF ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'Identity routing is fenced for repair' USING ERRCODE='55000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-identity:' || NEW.id::text,0));
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.routing_generation<OLD.routing_generation) THEN RAISE EXCEPTION 'Unit identity or routing generation cannot move backwards' USING ERRCODE='23514'; END IF;
  INSERT INTO public.catalog_unit_locator(id,owner,generation) VALUES(NEW.id,TG_ARGV[0],NEW.routing_generation)
    ON CONFLICT(id) DO UPDATE SET generation=EXCLUDED.generation WHERE catalog_unit_locator.owner=EXCLUDED.owner AND catalog_unit_locator.generation<=EXCLUDED.generation;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Identity belongs to another physical owner' USING ERRCODE='23505'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.unit_remove_platform_route()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  DELETE FROM public.catalog_unit_locator WHERE id=OLD.id AND owner=TG_ARGV[0] AND generation=OLD.routing_generation;
  RETURN OLD;
END $$;

/** Resolve a logical input ID once; concrete FKs and the row check remain the persisted authority. */
CREATE OR REPLACE FUNCTION public.unit_populate_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE value jsonb; previous jsonb; reference_patch jsonb:='{}'; raw_id uuid; selected_owner text; owner_name text; column_name text;
  present_count integer:=0; supplied_owner text; supplied_id uuid; routing_ready boolean; alternatives_unchanged boolean:=true;
  owners text[]:=ARRAY['publishing','music','program','software','entity','grouping','reference','distribution','video','audio','post','poll','zone','realm','realm_rule','custom_theme','collection','tag','tag_path','label'];
BEGIN
  value:=to_jsonb(NEW); raw_id:=(value->>TG_ARGV[0])::uuid;
  IF TG_OP='UPDATE' THEN previous:=to_jsonb(OLD); END IF;
  FOREACH owner_name IN ARRAY owners LOOP
    column_name:=TG_ARGV[1] || '_' || owner_name || '_id';
    IF NOT value ? column_name THEN RAISE EXCEPTION 'Registered reference column is missing' USING ERRCODE='23514'; END IF;
    IF TG_OP='UPDATE' AND value->column_name IS DISTINCT FROM previous->column_name THEN alternatives_unchanged:=false; END IF;
    IF value->>column_name IS NOT NULL THEN present_count:=present_count+1; supplied_owner:=owner_name; supplied_id:=(value->>column_name)::uuid; END IF;
  END LOOP;
  IF TG_OP='UPDATE' AND alternatives_unchanged AND (previous->>TG_ARGV[0])::uuid IS DISTINCT FROM raw_id THEN
    FOREACH owner_name IN ARRAY owners LOOP reference_patch:=jsonb_set(reference_patch,ARRAY[TG_ARGV[1] || '_' || owner_name || '_id'],'null'::jsonb); END LOOP;
    present_count:=0;
  END IF;
  IF TG_OP='UPDATE' AND TG_ARGV[2]='optional' AND raw_id IS NOT NULL AND present_count=0 THEN
    IF previous->>TG_ARGV[0]=raw_id::text THEN
      -- A concrete FK SET NULL clears its derived logical input in the same row mutation.
      reference_patch:=jsonb_set(reference_patch,ARRAY[TG_ARGV[0]],'null'::jsonb); raw_id:=NULL;
    END IF;
  END IF;
  IF raw_id IS NULL THEN
    IF TG_ARGV[2]<>'optional' OR present_count<>0 THEN RAISE EXCEPTION 'Unit reference requires exactly one target' USING ERRCODE='23514'; END IF;
  ELSE
    IF present_count=1 AND supplied_id=raw_id THEN
      -- Explicit checked references are validated by their concrete FK, independently of routing-cache availability.
      RETURN NEW;
    END IF;
    IF present_count<>0 THEN RAISE EXCEPTION 'Unit reference alternatives disagree with its logical identity' USING ERRCODE='23514'; END IF;
    SELECT ready INTO routing_ready FROM public.catalog_routing_control WHERE singleton FOR SHARE;
    IF routing_ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'Identity routing is fenced for repair' USING ERRCODE='55000'; END IF;
    SELECT owner INTO selected_owner FROM public.catalog_unit_locator WHERE id=raw_id FOR KEY SHARE;
    IF NOT FOUND OR NOT selected_owner=ANY(owners) THEN RAISE EXCEPTION 'Unit reference routing is unavailable' USING ERRCODE='23503'; END IF;
    IF present_count>1 OR (present_count=1 AND (supplied_owner<>selected_owner OR supplied_id<>raw_id)) THEN RAISE EXCEPTION 'Unit reference alternatives disagree with its routed identity' USING ERRCODE='23514'; END IF;
    FOREACH owner_name IN ARRAY owners LOOP
      column_name:=TG_ARGV[1] || '_' || owner_name || '_id';
      reference_patch:=jsonb_set(reference_patch,ARRAY[column_name],CASE WHEN owner_name=selected_owner THEN to_jsonb(raw_id) ELSE 'null'::jsonb END);
    END LOOP;
  END IF;
  -- Copy only reference scalars, never rebuild a potentially large document row twenty times.
  NEW:=jsonb_populate_record(NEW,reference_patch);
  RETURN NEW;
END $$;

DO $$ DECLARE owner_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['video','audio','post','poll','zone','realm','realm_rule','custom_theme','collection','tag','tag_path','label'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS unit_platform_route_publish ON public.%I',owner_name);
    EXECUTE format('CREATE TRIGGER unit_platform_route_publish AFTER INSERT OR UPDATE OF id,routing_generation ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_publish_platform_route(%L)',owner_name,owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS unit_platform_route_remove ON public.%I',owner_name);
    EXECUTE format('CREATE TRIGGER unit_platform_route_remove AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_remove_platform_route(%L)',owner_name,owner_name);
  END LOOP;
END $$;

-- Favorites now store canonical reference values, not logical-ID input alternatives.
DROP TRIGGER IF EXISTS unit_reference_target_unit ON public.account_favorite;
DROP TRIGGER IF EXISTS unit_reference_target_unit ON public.account_favorite_revision;

DROP TRIGGER IF EXISTS unit_reference_unit ON public.account_unit_tag;
DROP TRIGGER IF EXISTS unit_reference_unit ON public.recommendation_exclusion;
DROP TRIGGER IF EXISTS unit_reference_target_unit ON public.recommendation_event;

-- Registered logical reference inputs.
DO $$ DECLARE specification text; entry text[]; trigger_name text;
BEGIN
 FOREACH specification IN ARRAY ARRAY[
  'collection_item|unit_id|unit|required',
  'content_report|target_unit_id|target_unit|required',
  'content_review_case|target_unit_id|target_unit|required',
  'content_structure|owner_unit_id|owner_unit|required',
  'content_structure_node|content_unit_id|content_unit|required',
  'content_structure_node|target_unit_id|target_unit|optional',
  'credit_attribution|source_unit_id|source_unit|required',
  'custom_theme_revision|approved_host_unit_id|approved_host_unit|optional',
  'governance_decision|authority_unit_id|authority_unit|optional',
  'governance_decision|target_unit_id|target_unit|optional',
  'notification|subject_unit_id|subject_unit|optional',
  'poll_option|target_unit_id|target_unit|optional',
  'post|subject_unit_id|subject_unit|optional',
  'profile_resource_participation|resource_unit_id|resource_unit|required',
  'realm_pin|unit_id|unit|required',
  'realm_tag_judgment|unit_id|unit|required',
  'realm_tag_judgment_stat|unit_id|unit|required',
  'realm_unit|unit_id|unit|required',
  'realm_unit_status_event|unit_id|unit|required',
  'recommendation_unit_signal_hourly|unit_id|unit|required',
  'score|unit_id|unit|required',
  'score_stat|unit_id|unit|required',
  'studio_auth_editor_candidate|unit_id|unit|required',
  'studio_realm_editor_candidate|unit_id|unit|required',
  'studio_resource_visit|resource_unit_id|resource_unit|required',
  'subject_association|unit_id|unit|required',
  'unit_access_grant|unit_id|unit|required',
  'unit_access_invitation|unit_id|unit|required',
  'unit_access_restriction|unit_id|unit|required',
  'unit_alias|unit_id|unit|required',
  'unit_association_proposal|source_unit_id|source_unit|required',
  'unit_association_proposal|target_unit_id|target_unit|required',
  'unit_best_score|unit_id|unit|required',
  'unit_content_language_search|unit_id|unit|required',
  'unit_content_language_support|unit_id|unit|required',
  'unit_custom_theme_installation|host_unit_id|host_unit|required',
  'unit_dock|unit_id|unit|required',
  'unit_effective_tag|unit_id|unit|required',
  'unit_engagement_stat|unit_id|unit|required',
  'unit_expression_assertion|unit_id|unit|required',
  'unit_external_link|unit_id|unit|required',
  'unit_follow|unit_id|unit|required',
  'unit_follow_stat|unit_id|unit|required',
  'unit_license_grant|unit_id|unit|required',
  'unit_localization|unit_id|unit|required',
  'unit_merge_graph_lock|unit_id|unit|required',
  'unit_merge_reconciliation_item|source_unit_id|source_unit|required',
  'unit_merge_reconciliation_item|target_unit_id|target_unit|required',
  'unit_merge_redirect|source_unit_id|source_unit|required',
  'unit_merge_redirect|target_unit_id|target_unit|required',
  'unit_merge_request|source_unit_id|source_unit|required',
  'unit_merge_request|target_unit_id|target_unit|required',
  'unit_ownership|unit_id|unit|required',
  'unit_presentation_document|host_unit_id|host_unit|required',
  'unit_progress|unit_id|unit|required',
  'unit_progress_entry|unit_id|unit|required',
  'unit_reaction|unit_id|unit|required',
  'unit_reaction_global_stat|unit_id|unit|required',
  'unit_reaction_stat|unit_id|unit|required',
  'unit_reference_curation_head|unit_id|unit|required',
  'unit_revision|unit_id|unit|required',
  'unit_revision_head|unit_id|unit|required',
  'unit_search_document|unit_id|unit|required',
  'unit_share|unit_id|unit|required',
  'unit_slug_address|scope_unit_id|scope_unit|optional',
  'unit_slug_address|target_unit_id|target_unit|required',
  'unit_status_event|unit_id|unit|required',
  'unit_tag|unit_id|unit|required',
  'unit_tag_judgment|unit_id|unit|required',
  'unit_tag_path_application|unit_id|unit|required'
 ] LOOP
  entry:=string_to_array(specification,'|'); trigger_name:='unit_reference_'||entry[3];
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',trigger_name,entry[1]);
  EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.unit_populate_reference(%L,%L,%L)',trigger_name,entry[1],entry[2],entry[3],entry[4]);
 END LOOP;
END $$;


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
  IF (to_jsonb(NEW)-ARRAY['position','note','snapshot','revision','updated_at']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['position','note','snapshot','revision','updated_at']) OR NEW.revision <= OLD.revision THEN
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
DECLARE row_data public.account_favorite%ROWTYPE; direction bigint; target_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN row_data := NEW; direction := 1;
  ELSE row_data := OLD; direction := -1; END IF;
  target_id := public.reference_value_native_id(row_data.target_reference_id);
  PERFORM public.apply_unit_engagement_stat(target_id, p_favorites => direction);
  PERFORM public.apply_recommendation_unit_signal(target_id, row_data.created_at, 'favorite', direction, direction * 5);
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
        public.reference_value_native_id(row_data.target_reference_id), row_data.occurred_at,
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
