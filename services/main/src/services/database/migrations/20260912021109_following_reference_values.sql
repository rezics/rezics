SET search_path TO public;

-- Remove input triggers before their referenced column is dropped.
DROP TRIGGER IF EXISTS unit_reference_unit ON public.unit_follow;
DROP TRIGGER IF EXISTS reject_merged_unit_unit_follow_unit_id ON public.unit_follow;
-- Atlas's structural diff drops the parent key before modifying this child.
ALTER TABLE public.account_follow_preference DROP CONSTRAINT IF EXISTS account_follow_preference_follow_fk;

-- Drop index "unit_follow_unit_created_at_idx" from table: "unit_follow"
DROP INDEX "unit_follow_unit_created_at_idx";
-- Modify "unit_follow" table
ALTER TABLE "unit_follow" DROP CONSTRAINT "unit_follow_not_self_check", DROP CONSTRAINT "unit_follow_unit_id_check", DROP CONSTRAINT "unit_follow_unit_target_check", DROP CONSTRAINT "unit_follow_pkey", DROP COLUMN "unit_id", DROP COLUMN "unit_publishing_id", DROP COLUMN "unit_music_id", DROP COLUMN "unit_program_id", DROP COLUMN "unit_software_id", DROP COLUMN "unit_entity_id", DROP COLUMN "unit_grouping_id", DROP COLUMN "unit_reference_id", DROP COLUMN "unit_distribution_id", DROP COLUMN "unit_video_id", DROP COLUMN "unit_audio_id", DROP COLUMN "unit_post_id", DROP COLUMN "unit_poll_id", DROP COLUMN "unit_zone_id", DROP COLUMN "unit_realm_id", DROP COLUMN "unit_realm_rule_id", DROP COLUMN "unit_custom_theme_id", DROP COLUMN "unit_collection_id", DROP COLUMN "unit_tag_id", DROP COLUMN "unit_tag_path_id", DROP COLUMN "unit_label_id", ADD COLUMN "target_reference_id" uuid NOT NULL, ADD PRIMARY KEY ("follower_profile_id", "target_reference_id"), ADD CONSTRAINT "unit_follow_target_reference_id_reference_value_id_fkey" FOREIGN KEY ("target_reference_id") REFERENCES "reference_value" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "unit_follow_unit_created_at_idx" to table: "unit_follow"
CREATE INDEX "unit_follow_unit_created_at_idx" ON "unit_follow" ("target_reference_id", "created_at" DESC NULLS LAST, "follower_profile_id");
-- Drop index "account_follow_preference_auth_order_idx" from table: "account_follow_preference"
DROP INDEX "account_follow_preference_auth_order_idx";
-- Drop index "account_follow_preference_enabled_unit_idx" from table: "account_follow_preference"
DROP INDEX "account_follow_preference_enabled_unit_idx";
-- Modify "account_follow_preference" table
ALTER TABLE "account_follow_preference" DROP CONSTRAINT "account_follow_preference_pkey", DROP CONSTRAINT "account_follow_preference_follow_key", DROP COLUMN "unit_id", ADD COLUMN "target_reference_id" uuid NOT NULL, ADD PRIMARY KEY ("auth_user_id", "target_reference_id"), ADD CONSTRAINT "account_follow_preference_follow_key" UNIQUE ("follower_entity_id", "target_reference_id"), ADD CONSTRAINT "account_follow_preference_follow_fk" FOREIGN KEY ("follower_entity_id", "target_reference_id") REFERENCES "unit_follow" ("follower_profile_id", "target_reference_id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Create index "account_follow_preference_auth_order_idx" to table: "account_follow_preference"
CREATE INDEX "account_follow_preference_auth_order_idx" ON "account_follow_preference" ("auth_user_id", "favorite" DESC NULLS LAST, "position", "target_reference_id");
-- Create index "account_follow_preference_enabled_unit_idx" to table: "account_follow_preference"
CREATE INDEX "account_follow_preference_enabled_unit_idx" ON "account_follow_preference" ("target_reference_id", "auth_user_id") WHERE in_app;

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
DROP TRIGGER IF EXISTS unit_reference_unit ON public.unit_follow;

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


-- Native owner integrity and derived state. This file is the canonical forward-maintained source.
CREATE OR REPLACE FUNCTION public.apply_reaction_change(p_profile_id uuid, p_unit_id uuid, p_realm_id uuid, p_reaction text, p_occurred_at timestamp with time zone, p_direction bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE unit_weight double precision; profile_weight double precision;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.read_unit_state(p_unit_id,true)) THEN RETURN; END IF;

  IF p_realm_id IS NULL OR EXISTS (SELECT 1 FROM realm WHERE id = p_realm_id) THEN
    IF p_direction < 0 THEN
      UPDATE unit_reaction_stat SET reaction_count = reaction_count + p_direction,
        updated_at = now()
      WHERE unit_id = p_unit_id AND realm_id IS NOT DISTINCT FROM p_realm_id
        AND reaction = p_reaction::reaction_kind;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'missing unit_reaction_stat row for decrement: %, %, %',
          p_unit_id, p_realm_id, p_reaction USING ERRCODE = '23514';
      END IF;
    ELSE
      INSERT INTO unit_reaction_stat (unit_id, realm_id, reaction, reaction_count)
      VALUES (p_unit_id, p_realm_id, p_reaction::reaction_kind, p_direction)
      ON CONFLICT (unit_id, realm_id, reaction) DO UPDATE SET
        reaction_count = unit_reaction_stat.reaction_count + excluded.reaction_count,
        updated_at = now();
    END IF;
    DELETE FROM unit_reaction_stat
    WHERE unit_id = p_unit_id AND realm_id IS NOT DISTINCT FROM p_realm_id
      AND reaction = p_reaction::reaction_kind AND reaction_count = 0;
  END IF;

  IF p_direction < 0 THEN
    UPDATE unit_reaction_global_stat SET reaction_count = reaction_count + p_direction,
      updated_at = now()
    WHERE unit_id = p_unit_id AND reaction = p_reaction::reaction_kind;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing unit_reaction_global_stat row for decrement: %, %',
        p_unit_id, p_reaction USING ERRCODE = '23514';
    END IF;
  ELSE
    INSERT INTO unit_reaction_global_stat (unit_id, reaction, reaction_count)
    VALUES (p_unit_id, p_reaction::reaction_kind, p_direction)
    ON CONFLICT (unit_id, reaction) DO UPDATE SET
      reaction_count = unit_reaction_global_stat.reaction_count + excluded.reaction_count,
      updated_at = now();
  END IF;
  DELETE FROM unit_reaction_global_stat
  WHERE unit_id = p_unit_id AND reaction = p_reaction::reaction_kind AND reaction_count = 0;

  IF p_reaction = 'upvote' THEN
    PERFORM apply_unit_engagement_stat(p_unit_id, p_upvotes => p_direction);
    unit_weight := 3; profile_weight := 3;
  ELSE
    PERFORM apply_unit_engagement_stat(p_unit_id, p_downvotes => p_direction);
    unit_weight := 0; profile_weight := -4;
  END IF;
  PERFORM apply_recommendation_unit_signal(
    p_unit_id, p_occurred_at, p_reaction,
    p_direction, p_direction * unit_weight
  );

END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_recommendation_unit_signal(p_unit_id uuid, p_occurred_at timestamp with time zone, p_kind text, p_count_delta bigint, p_weight_delta double precision)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
  bucket timestamptz := date_bin(interval '1 hour', p_occurred_at, timestamptz '2000-01-01 00:00:00+00');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.read_unit_state(p_unit_id,true)) THEN
    RETURN;
  END IF;
  IF p_count_delta < 0 THEN
    UPDATE recommendation_unit_signal_hourly SET
      signal_count = signal_count + p_count_delta,
      weight = weight + p_weight_delta,
      updated_at = now()
    WHERE unit_id = p_unit_id AND bucket_start = bucket
      AND kind = p_kind::recommendation_signal_kind;
  ELSE
    INSERT INTO recommendation_unit_signal_hourly (
      unit_id, bucket_start, kind, signal_count, weight
    ) VALUES (
      p_unit_id, bucket, p_kind::recommendation_signal_kind, p_count_delta, p_weight_delta
    )
    ON CONFLICT (unit_id, bucket_start, kind) DO UPDATE SET
      signal_count = recommendation_unit_signal_hourly.signal_count + excluded.signal_count,
      weight = recommendation_unit_signal_hourly.weight + excluded.weight,
      updated_at = now();
  END IF;

  DELETE FROM recommendation_unit_signal_hourly
  WHERE unit_id = p_unit_id AND bucket_start = bucket
    AND kind = p_kind::recommendation_signal_kind
    AND signal_count = 0 AND weight = 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_unit_engagement_stat(p_unit_id uuid, p_upvotes bigint DEFAULT 0, p_downvotes bigint DEFAULT 0, p_replies bigint DEFAULT 0, p_favorites bigint DEFAULT 0, p_shares bigint DEFAULT 0, p_high_scores bigint DEFAULT 0, p_active_progress bigint DEFAULT 0, p_completions bigint DEFAULT 0, p_negative_progress bigint DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.read_unit_state(p_unit_id,true)) THEN
    RETURN;
  END IF;
  IF p_upvotes = 0 AND p_downvotes = 0 AND p_replies = 0 AND p_favorites = 0
    AND p_shares = 0 AND p_high_scores = 0 AND p_active_progress = 0
    AND p_completions = 0 AND p_negative_progress = 0 THEN
    RETURN;
  END IF;

  UPDATE unit_engagement_stat SET
    upvotes = upvotes + p_upvotes,
    downvotes = downvotes + p_downvotes,
    replies = replies + p_replies,
    favorites = favorites + p_favorites,
    shares = shares + p_shares,
    high_scores = high_scores + p_high_scores,
    active_progress = active_progress + p_active_progress,
    completions = completions + p_completions,
    negative_progress = negative_progress + p_negative_progress,
    updated_at = now()
  WHERE unit_id = p_unit_id;

  IF NOT FOUND THEN
    IF p_upvotes < 0 OR p_downvotes < 0 OR p_replies < 0 OR p_favorites < 0
      OR p_shares < 0 OR p_high_scores < 0 OR p_active_progress < 0
      OR p_completions < 0 OR p_negative_progress < 0 THEN
      RAISE EXCEPTION 'missing unit_engagement_stat row for decrement: %', p_unit_id
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO unit_engagement_stat (
      unit_id, upvotes, downvotes, replies, favorites, shares, high_scores,
      active_progress, completions, negative_progress
    ) VALUES (
      p_unit_id, p_upvotes, p_downvotes, p_replies, p_favorites, p_shares,
      p_high_scores, p_active_progress, p_completions, p_negative_progress
    )
    ON CONFLICT (unit_id) DO UPDATE SET
      upvotes = unit_engagement_stat.upvotes + excluded.upvotes,
      downvotes = unit_engagement_stat.downvotes + excluded.downvotes,
      replies = unit_engagement_stat.replies + excluded.replies,
      favorites = unit_engagement_stat.favorites + excluded.favorites,
      shares = unit_engagement_stat.shares + excluded.shares,
      high_scores = unit_engagement_stat.high_scores + excluded.high_scores,
      active_progress = unit_engagement_stat.active_progress + excluded.active_progress,
      completions = unit_engagement_stat.completions + excluded.completions,
      negative_progress = unit_engagement_stat.negative_progress + excluded.negative_progress,
      updated_at = now();
  END IF;

  DELETE FROM unit_engagement_stat
  WHERE unit_id = p_unit_id AND upvotes = 0 AND downvotes = 0 AND replies = 0
    AND favorites = 0 AND shares = 0 AND high_scores = 0 AND active_progress = 0
    AND completions = 0 AND negative_progress = 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_unit_reference_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    active_count integer;
    pinned_count integer;
    entering_active boolean := false;
    entering_pinned boolean := false;
    reference_kind text := TG_ARGV[0];
BEGIN
    IF TG_OP = 'INSERT' THEN
        entering_active := NEW.withdrawn_at IS NULL;
        entering_pinned := NEW.withdrawn_at IS NULL AND NEW.pinned;
    ELSE
        entering_active := NEW.withdrawn_at IS NULL AND (
            OLD.withdrawn_at IS NOT NULL
            OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
        );
        entering_pinned := NEW.withdrawn_at IS NULL AND NEW.pinned AND (
            NOT OLD.pinned
            OR OLD.withdrawn_at IS NOT NULL
            OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
        );
    END IF;

    IF entering_active OR entering_pinned THEN
        PERFORM pg_advisory_xact_lock(
            hashtextextended('unit-reference:' || reference_kind || ':' || NEW.unit_id::text, 0)
        );
    END IF;

    IF entering_active THEN
        EXECUTE format(
            'SELECT count(*) FROM ('
            || 'SELECT 1 FROM public.%I '
            || 'WHERE unit_id = $1 AND withdrawn_at IS NULL AND id <> $2 LIMIT 128'
            || ') AS active_reference',
            TG_TABLE_NAME
        )
        INTO active_count
        USING NEW.unit_id, NEW.id;
        IF active_count >= 128 THEN
            RAISE EXCEPTION 'Unit % already has 128 active % references',
                NEW.unit_id, reference_kind
                USING ERRCODE = '23514', CONSTRAINT = 'unit_reference_active_limit';
        END IF;
    END IF;

    IF entering_pinned THEN
        EXECUTE format(
            'SELECT count(*) FROM ('
            || 'SELECT 1 FROM public.%I '
            || 'WHERE unit_id = $1 AND withdrawn_at IS NULL AND pinned AND id <> $2 LIMIT 16'
            || ') AS pinned_reference',
            TG_TABLE_NAME
        )
        INTO pinned_count
        USING NEW.unit_id, NEW.id;
        IF pinned_count >= 16 THEN
            RAISE EXCEPTION 'Unit % already has 16 pinned % references',
                NEW.unit_id, reference_kind
                USING ERRCODE = '23514', CONSTRAINT = 'unit_reference_pinned_limit';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_collection_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  INSERT INTO collection_stat (collection_id) VALUES (NEW.id);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_poll_option_vote_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  INSERT INTO poll_option_vote_stat (option_id) VALUES (NEW.id);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_realm_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
    INSERT INTO public.realm_stat (realm_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
    RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.maintain_collection_item_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE changed record;
BEGIN
  FOR changed IN
    SELECT OLD.collection_id AS collection_id, -1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW.collection_id AS collection_id, 1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    UPDATE collection_stat
    SET item_count = item_count + changed.direction, updated_at = now()
    WHERE collection_id = changed.collection_id;
    IF NOT FOUND AND EXISTS (SELECT 1 FROM collection WHERE id = changed.collection_id) THEN
      RAISE EXCEPTION 'missing collection_stat row for %', changed.collection_id
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_poll_option_vote_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE changed record;
BEGIN
  FOR changed IN
    SELECT OLD.option_id AS option_id, -1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW.option_id AS option_id, 1::bigint AS direction
      WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    UPDATE poll_option_vote_stat
    SET vote_count = vote_count + changed.direction, updated_at = now()
    WHERE option_id = changed.option_id;
    IF NOT FOUND AND EXISTS (SELECT 1 FROM poll_option WHERE id = changed.option_id) THEN
      RAISE EXCEPTION 'missing poll_option_vote_stat row for %', changed.option_id
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_realm_member_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
    old_delta bigint := CASE WHEN TG_OP <> 'INSERT' AND OLD.state = 'active' THEN -1 ELSE 0 END;
    new_delta bigint := CASE WHEN TG_OP <> 'DELETE' AND NEW.state = 'active' THEN 1 ELSE 0 END;
BEGIN
    IF TG_OP <> 'INSERT' AND old_delta <> 0
       AND EXISTS (SELECT 1 FROM public.realm WHERE id = OLD.realm_id) THEN
        -- CHECK constraints apply to the proposed INSERT before conflict handling.
        -- Decrements update an existing counter; they must never insert a negative row.
        UPDATE public.realm_stat
        SET active_member_count = active_member_count + old_delta, updated_at = now()
        WHERE realm_id = OLD.realm_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'missing realm_stat row for decrement: %', OLD.realm_id
                USING ERRCODE = '23514';
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' AND new_delta <> 0 THEN
        INSERT INTO public.realm_stat (realm_id, active_member_count)
        VALUES (NEW.realm_id, new_delta)
        ON CONFLICT (realm_id) DO UPDATE SET
            active_member_count = public.realm_stat.active_member_count + EXCLUDED.active_member_count,
            updated_at = now();
    END IF;
    RETURN coalesce(NEW, OLD);
END
$function$;

CREATE OR REPLACE FUNCTION public.maintain_reply_unit_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE relation post_reply%ROWTYPE;
old_counted boolean;
new_counted boolean;
old_visible boolean;
new_visible boolean;
BEGIN
  SELECT * INTO relation FROM post_reply WHERE post_id = OLD.id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  old_counted := OLD.deleted_at IS NULL;
  new_counted := NEW.deleted_at IS NULL;
  old_visible := old_counted AND OLD.status = 'published' AND OLD.visibility = 'public'
    AND OLD.moderation_status = 'approved';
  new_visible := new_counted AND NEW.status = 'published' AND NEW.visibility = 'public'
    AND NEW.moderation_status = 'approved';
  IF old_counted IS DISTINCT FROM new_counted THEN
    PERFORM apply_unit_engagement_stat(
      relation.root_post_id, p_replies => CASE WHEN new_counted THEN 1 ELSE -1 END
    );
    IF relation.parent_post_id IS NOT NULL THEN
      PERFORM apply_unit_engagement_stat(
        relation.parent_post_id, p_replies => CASE WHEN new_counted THEN 1 ELSE -1 END
      );
    END IF;
  END IF;
  PERFORM apply_post_reply_stat_delta(
    relation.root_post_id,
    relation.parent_post_id,
    new_counted::int - old_counted::int,
    new_visible::int - old_visible::int
  );
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_score_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
  row_data score%ROWTYPE;
  direction bigint;
  signal_kind text;
  unit_weight double precision;
  profile_weight double precision;
  change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL
    SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data;
    direction := change.direction;
    IF EXISTS (SELECT 1 FROM public.read_unit_state(row_data.unit_id,true))
      AND EXISTS (SELECT 1 FROM realm WHERE id = row_data.realm_id) THEN
      IF direction < 0 THEN
        UPDATE score_stat SET
          total_count = total_count + direction,
          total_score = total_score + direction * row_data.value,
          score_1_count = score_1_count + direction * (row_data.value = 1)::int,
          score_2_count = score_2_count + direction * (row_data.value = 2)::int,
          score_3_count = score_3_count + direction * (row_data.value = 3)::int,
          score_4_count = score_4_count + direction * (row_data.value = 4)::int,
          score_5_count = score_5_count + direction * (row_data.value = 5)::int,
          score_6_count = score_6_count + direction * (row_data.value = 6)::int,
          score_7_count = score_7_count + direction * (row_data.value = 7)::int,
          score_8_count = score_8_count + direction * (row_data.value = 8)::int,
          score_9_count = score_9_count + direction * (row_data.value = 9)::int,
          score_10_count = score_10_count + direction * (row_data.value = 10)::int,
          updated_at = now()
        WHERE unit_id = row_data.unit_id AND realm_id = row_data.realm_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing score_stat row for decrement: %, %',
            row_data.unit_id, row_data.realm_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO score_stat (
          unit_id, realm_id, total_count, total_score,
          score_1_count, score_2_count, score_3_count, score_4_count, score_5_count,
          score_6_count, score_7_count, score_8_count, score_9_count, score_10_count
        ) VALUES (
          row_data.unit_id, row_data.realm_id, direction, direction * row_data.value,
          direction * (row_data.value = 1)::int, direction * (row_data.value = 2)::int,
          direction * (row_data.value = 3)::int, direction * (row_data.value = 4)::int,
          direction * (row_data.value = 5)::int, direction * (row_data.value = 6)::int,
          direction * (row_data.value = 7)::int, direction * (row_data.value = 8)::int,
          direction * (row_data.value = 9)::int, direction * (row_data.value = 10)::int
        )
        ON CONFLICT (unit_id, realm_id) DO UPDATE SET
          total_count = score_stat.total_count + excluded.total_count,
          total_score = score_stat.total_score + excluded.total_score,
          score_1_count = score_stat.score_1_count + excluded.score_1_count,
          score_2_count = score_stat.score_2_count + excluded.score_2_count,
          score_3_count = score_stat.score_3_count + excluded.score_3_count,
          score_4_count = score_stat.score_4_count + excluded.score_4_count,
          score_5_count = score_stat.score_5_count + excluded.score_5_count,
          score_6_count = score_stat.score_6_count + excluded.score_6_count,
          score_7_count = score_stat.score_7_count + excluded.score_7_count,
          score_8_count = score_stat.score_8_count + excluded.score_8_count,
          score_9_count = score_stat.score_9_count + excluded.score_9_count,
          score_10_count = score_stat.score_10_count + excluded.score_10_count,
          updated_at = now();
      END IF;
      DELETE FROM score_stat
      WHERE unit_id = row_data.unit_id AND realm_id = row_data.realm_id AND total_count = 0;
    END IF;

    PERFORM apply_unit_engagement_stat(
      row_data.unit_id, p_high_scores => direction * (row_data.value >= 8)::int
    );
    IF row_data.value >= 8 THEN
      signal_kind := 'score_high'; unit_weight := 5; profile_weight := 5;
    ELSIF row_data.value >= 6 THEN
      signal_kind := 'score_medium'; unit_weight := 3; profile_weight := 3;
    ELSIF row_data.value <= 3 THEN
      signal_kind := 'score_low'; unit_weight := 0; profile_weight := -4;
    ELSE
      signal_kind := NULL; unit_weight := 0; profile_weight := 0;
    END IF;
    IF signal_kind IS NOT NULL THEN
      IF unit_weight > 0 THEN
        PERFORM apply_recommendation_unit_signal(
          row_data.unit_id, row_data.updated_at, signal_kind, direction, direction * unit_weight
        );
      END IF;

    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_alias_vote_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.alias_id = NEW.alias_id THEN
        IF OLD.value <> NEW.value THEN
            UPDATE public.unit_alias_vote_stat
            SET score = score + NEW.value - OLD.value, updated_at = now()
            WHERE alias_id = NEW.alias_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'missing unit_alias_vote_stat row for update: %', NEW.alias_id
                    USING ERRCODE = '23514';
            END IF;
        END IF;
        RETURN NULL;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE')
       AND EXISTS (SELECT 1 FROM public.unit_alias WHERE id = OLD.alias_id) THEN
        UPDATE public.unit_alias_vote_stat
        SET score = score - OLD.value, vote_count = vote_count - 1, updated_at = now()
        WHERE alias_id = OLD.alias_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'missing unit_alias_vote_stat row for decrement: %', OLD.alias_id
                USING ERRCODE = '23514';
        END IF;
        DELETE FROM public.unit_alias_vote_stat
        WHERE alias_id = OLD.alias_id AND vote_count = 0;
    END IF;

    IF TG_OP IN ('UPDATE', 'INSERT')
       AND EXISTS (SELECT 1 FROM public.unit_alias WHERE id = NEW.alias_id) THEN
        INSERT INTO public.unit_alias_vote_stat (alias_id, score, vote_count)
        VALUES (NEW.alias_id, NEW.value, 1)
        ON CONFLICT (alias_id) DO UPDATE SET
            score = unit_alias_vote_stat.score + excluded.score,
            vote_count = unit_alias_vote_stat.vote_count + 1,
            updated_at = now();
    END IF;
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_external_link_vote_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.external_link_id = NEW.external_link_id THEN
        IF OLD.value <> NEW.value THEN
            UPDATE public.unit_external_link_vote_stat
            SET score = score + NEW.value - OLD.value, updated_at = now()
            WHERE external_link_id = NEW.external_link_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'missing unit_external_link_vote_stat row for update: %',
                    NEW.external_link_id USING ERRCODE = '23514';
            END IF;
        END IF;
        RETURN NULL;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (
        SELECT 1 FROM public.unit_external_link WHERE id = OLD.external_link_id
    ) THEN
        UPDATE public.unit_external_link_vote_stat
        SET score = score - OLD.value, vote_count = vote_count - 1, updated_at = now()
        WHERE external_link_id = OLD.external_link_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'missing unit_external_link_vote_stat row for decrement: %',
                OLD.external_link_id USING ERRCODE = '23514';
        END IF;
        DELETE FROM public.unit_external_link_vote_stat
        WHERE external_link_id = OLD.external_link_id AND vote_count = 0;
    END IF;

    IF TG_OP IN ('UPDATE', 'INSERT') AND EXISTS (
        SELECT 1 FROM public.unit_external_link WHERE id = NEW.external_link_id
    ) THEN
        INSERT INTO public.unit_external_link_vote_stat (external_link_id, score, vote_count)
        VALUES (NEW.external_link_id, NEW.value, 1)
        ON CONFLICT (external_link_id) DO UPDATE SET
            score = unit_external_link_vote_stat.score + excluded.score,
            vote_count = unit_external_link_vote_stat.vote_count + 1,
            updated_at = now();
    END IF;
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_follow_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE row_data unit_follow%ROWTYPE; direction bigint; change record; target_id uuid;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    target_id := public.reference_value_native_id(row_data.target_reference_id);
      IF direction < 0 THEN
        UPDATE unit_follow_stat SET follower_count = follower_count + direction,
          updated_at = now() WHERE unit_id = target_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'missing unit_follow_stat row for decrement: %',
            target_id USING ERRCODE = '23514';
        END IF;
      ELSE
        INSERT INTO unit_follow_stat (unit_id, unit_publishing_id, unit_music_id, unit_program_id, unit_software_id, unit_entity_id, unit_grouping_id, unit_reference_id, unit_distribution_id, unit_video_id, unit_audio_id, unit_post_id, unit_poll_id, unit_zone_id, unit_realm_id, unit_realm_rule_id, unit_custom_theme_id, unit_collection_id, unit_tag_id, unit_tag_path_id, unit_label_id, follower_count)
        SELECT target_id, value.target_publishing_id, value.target_music_id, value.target_program_id, value.target_software_id, value.target_entity_id, value.target_grouping_id, value.target_reference_id, value.target_distribution_id, value.target_video_id, value.target_audio_id, value.target_post_id, value.target_poll_id, value.target_zone_id, value.target_realm_id, value.target_realm_rule_id, value.target_custom_theme_id, value.target_collection_id, value.target_tag_id, value.target_tag_path_id, value.target_label_id, direction
        FROM public.reference_value value WHERE value.id=row_data.target_reference_id
        ON CONFLICT (unit_id) DO UPDATE SET
          follower_count = unit_follow_stat.follower_count + excluded.follower_count,
          updated_at = now();
      END IF;
      DELETE FROM unit_follow_stat WHERE unit_id = target_id AND follower_count = 0;
  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_reaction_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM apply_reaction_change(
      OLD.profile_id, OLD.unit_id, OLD.realm_id, OLD.reaction::text, OLD.updated_at, -1
    );
  END IF;
  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    PERFORM apply_reaction_change(
      NEW.profile_id, NEW.unit_id, NEW.realm_id, NEW.reaction::text, NEW.updated_at, 1
    );
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_unit_share_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE row_data unit_share%ROWTYPE; direction bigint; change record;
BEGIN
  FOR change IN
    SELECT OLD AS row_data, -1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'DELETE')
    UNION ALL SELECT NEW AS row_data, 1::bigint AS direction WHERE TG_OP IN ('UPDATE', 'INSERT')
  LOOP
    row_data := change.row_data; direction := change.direction;
    PERFORM apply_unit_engagement_stat(row_data.unit_id, p_shares => direction);
    PERFORM apply_recommendation_unit_signal(
      row_data.unit_id, row_data.created_at, 'share', direction, direction * 4
    );

  END LOOP;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_reply_signals_before_unit_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE relation post_reply%ROWTYPE;
BEGIN
  SELECT * INTO relation FROM post_reply WHERE post_id = OLD.id;
  IF NOT FOUND THEN RETURN OLD; END IF;
  PERFORM apply_post_reply_stat_delta(
    relation.root_post_id,
    relation.parent_post_id,
    -(OLD.deleted_at IS NULL)::int,
    -(OLD.deleted_at IS NULL AND OLD.status = 'published' AND OLD.visibility = 'public'
      AND OLD.moderation_status = 'approved')::int
  );
  IF OLD.deleted_at IS NULL THEN
    PERFORM apply_unit_engagement_stat(relation.root_post_id, p_replies => -1);
    IF relation.parent_post_id IS NOT NULL THEN
      PERFORM apply_unit_engagement_stat(relation.parent_post_id, p_replies => -1);
    END IF;
  END IF;
  PERFORM apply_recommendation_unit_signal(
    relation.root_post_id, relation.created_at, 'reply', -1, -4
  );
  IF relation.parent_post_id IS NOT NULL THEN
    PERFORM apply_recommendation_unit_signal(
      relation.parent_post_id, relation.created_at, 'reply', -1, -4
    );
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS collection_stat_initialize ON public.collection;
CREATE TRIGGER collection_stat_initialize AFTER INSERT ON public.collection FOR EACH ROW EXECUTE FUNCTION public.initialize_collection_stat();

DROP TRIGGER IF EXISTS collection_item_stat_maintain ON public.collection_item;
CREATE TRIGGER collection_item_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF collection_id ON public.collection_item FOR EACH ROW EXECUTE FUNCTION public.maintain_collection_item_stat();

DROP TRIGGER IF EXISTS poll_option_vote_stat_initialize ON public.poll_option;
CREATE TRIGGER poll_option_vote_stat_initialize AFTER INSERT ON public.poll_option FOR EACH ROW EXECUTE FUNCTION public.initialize_poll_option_vote_stat();

DROP TRIGGER IF EXISTS poll_option_vote_stat_maintain ON public.poll_vote;
CREATE TRIGGER poll_option_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF option_id ON public.poll_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_poll_option_vote_stat();

DROP TRIGGER IF EXISTS realm_stat_initialize ON public.realm;
CREATE TRIGGER realm_stat_initialize AFTER INSERT ON public.realm FOR EACH ROW EXECUTE FUNCTION public.initialize_realm_stat();

DROP TRIGGER IF EXISTS realm_member_stat_maintain ON public.realm_member;
CREATE TRIGGER realm_member_stat_maintain AFTER INSERT OR DELETE OR UPDATE OF realm_id, state ON public.realm_member FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_member_stat();

DROP TRIGGER IF EXISTS score_stat_maintain ON public.score;
CREATE TRIGGER score_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.score FOR EACH ROW EXECUTE FUNCTION public.maintain_score_stat();

DROP TRIGGER IF EXISTS reply_signals_remove_before_unit_delete ON public.post;
CREATE TRIGGER reply_signals_remove_before_unit_delete BEFORE DELETE ON public.post FOR EACH ROW EXECUTE FUNCTION public.remove_reply_signals_before_unit_delete();

DROP TRIGGER IF EXISTS reply_unit_state_maintain ON public.post;
CREATE TRIGGER reply_unit_state_maintain AFTER UPDATE OF status, visibility, moderation_status, deleted_at ON public.post FOR EACH ROW WHEN (((old.status IS DISTINCT FROM new.status) OR (old.visibility IS DISTINCT FROM new.visibility) OR (old.moderation_status IS DISTINCT FROM new.moderation_status) OR (old.deleted_at IS DISTINCT FROM new.deleted_at))) EXECUTE FUNCTION public.maintain_reply_unit_state();

DROP TRIGGER IF EXISTS unit_alias_reference_limits ON public.unit_alias;
CREATE TRIGGER unit_alias_reference_limits BEFORE INSERT OR UPDATE OF unit_id, withdrawn_at, pinned ON public.unit_alias FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_reference_limits('alias');

DROP TRIGGER IF EXISTS unit_alias_vote_stat_maintain ON public.unit_alias_vote;
CREATE TRIGGER unit_alias_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_alias_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_alias_vote_stat();

DROP TRIGGER IF EXISTS unit_external_link_reference_limits ON public.unit_external_link;
CREATE TRIGGER unit_external_link_reference_limits BEFORE INSERT OR UPDATE OF unit_id, withdrawn_at, pinned ON public.unit_external_link FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_reference_limits('external_link');

DROP TRIGGER IF EXISTS unit_external_link_vote_stat_maintain ON public.unit_external_link_vote;
CREATE TRIGGER unit_external_link_vote_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_external_link_vote FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_external_link_vote_stat();

DROP TRIGGER IF EXISTS unit_follow_stat_maintain ON public.unit_follow;
CREATE TRIGGER unit_follow_stat_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_follow FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_follow_stat();

DROP TRIGGER IF EXISTS unit_reaction_stats_maintain ON public.unit_reaction;
CREATE TRIGGER unit_reaction_stats_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_reaction FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_reaction_stats();

DROP TRIGGER IF EXISTS unit_share_stats_maintain ON public.unit_share;
CREATE TRIGGER unit_share_stats_maintain AFTER INSERT OR DELETE OR UPDATE ON public.unit_share FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_share_stats();

-- Incremental striped counters avoid rescanning retained event history and a single hot daily row.
CREATE OR REPLACE FUNCTION public.record_recommendation_metric() RETURNS trigger
LANGUAGE plpgsql SET search_path TO pg_catalog, public AS $function$
BEGIN
 INSERT INTO recommendation_metric_daily(day,surface,policy_version,shard,impressions,opens,dwell_30s,not_interested)
 VALUES ((NEW.occurred_at AT TIME ZONE 'UTC')::date,NEW.surface,NEW.policy_version,
  (hashtextextended(NEW.request_id::text,0) & 127)::smallint,
  (NEW.type='impression')::integer,(NEW.type='open')::integer,(NEW.type='dwell_30s')::integer,(NEW.type='not_interested')::integer)
 ON CONFLICT(day,surface,policy_version,shard) DO UPDATE SET
  impressions=recommendation_metric_daily.impressions+excluded.impressions,
  opens=recommendation_metric_daily.opens+excluded.opens,
  dwell_30s=recommendation_metric_daily.dwell_30s+excluded.dwell_30s,
  not_interested=recommendation_metric_daily.not_interested+excluded.not_interested;
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS recommendation_metric_on_insert ON public.recommendation_event;
CREATE TRIGGER recommendation_metric_on_insert
AFTER INSERT ON public.recommendation_event FOR EACH ROW EXECUTE FUNCTION public.record_recommendation_metric();


-- Native owner integrity and derived state. This file is the canonical forward-maintained source.
CREATE OR REPLACE FUNCTION public.reject_merged_unit_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
    referenced_unit_id uuid;
BEGIN
    referenced_unit_id := NULLIF(to_jsonb(NEW) ->> TG_ARGV[0], '')::uuid;
    IF TG_OP='UPDATE' AND (to_jsonb(NEW)->TG_ARGV[0]) IS NOT DISTINCT FROM (to_jsonb(OLD)->TG_ARGV[0]) THEN RETURN NEW; END IF;
    IF TG_NARGS > 1 AND TG_ARGV[1] = 'reference_value' THEN
        referenced_unit_id := public.reference_value_native_id(referenced_unit_id);
    END IF;
    IF referenced_unit_id IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM public.unit_merge_redirect
           WHERE source_unit_id = referenced_unit_id
       ) THEN
        RAISE EXCEPTION 'A live reference cannot target a merged Unit identity'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'merged_unit_reference_forbidden',
                  DETAIL = json_build_object(
                      'table', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
                      'column', TG_ARGV[0],
                      'sourceUnitId', referenced_unit_id
                  )::text;
	END IF;
	RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_unit_merge_immutable_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
	RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME
		USING ERRCODE = '23514', CONSTRAINT = TG_TABLE_NAME || '_immutable';
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_canonical_unit_id(input_unit_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE STRICT
 SET search_path TO 'pg_catalog', 'public'
AS $function$
    WITH RECURSIVE chain(unit_id, depth) AS (
        SELECT input_unit_id, 0
        UNION ALL
        SELECT redirect.target_unit_id, chain.depth + 1
        FROM chain
        JOIN public.unit_merge_redirect AS redirect
          ON redirect.source_unit_id = chain.unit_id
        WHERE chain.depth < 32
    )
    SELECT unit_id
    FROM chain
    ORDER BY depth DESC
    LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.validate_unit_merge_redirect()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    affected_unit_id uuid;
    r public.unit_merge_request%ROWTYPE;
    source_state record;
    target_state record;
    upstream_depth smallint;
BEGIN
    SELECT * INTO STRICT r FROM public.unit_merge_request WHERE id=NEW.request_id FOR UPDATE;
    SELECT * INTO STRICT source_state FROM public.read_unit_state(NEW.source_unit_id);
    SELECT * INTO STRICT target_state FROM public.read_unit_state(NEW.target_unit_id);
    IF r.state NOT IN ('accepted','executing') OR r.owner<>NEW.owner OR r.source_unit_id<>NEW.source_unit_id OR r.target_unit_id<>NEW.target_unit_id
       OR source_state.owner<>NEW.owner OR target_state.owner<>NEW.owner OR source_state.shape<>r.shape OR target_state.shape<>r.shape
       OR source_state.status<>'archived' OR source_state.revision<>r.source_revision+1 OR target_state.revision<>r.target_revision
       OR source_state.visibility<>r.visibility_at_request OR target_state.visibility<>r.visibility_at_request
       OR EXISTS(SELECT 1 FROM public.entity_participation WHERE entity_id IN(NEW.source_unit_id,NEW.target_unit_id))
       OR EXISTS(SELECT 1 FROM public.auth_entity WHERE entity_id IN(NEW.source_unit_id,NEW.target_unit_id))
       OR (SELECT count(*) FROM public.unit_merge_review WHERE request_id=r.id AND decision='approve')<>2
       OR EXISTS(SELECT 1 FROM public.unit_merge_review WHERE request_id=r.id AND decision='reject') THEN
      RAISE EXCEPTION 'Canonicalization requires the approved native pair and archive revision' USING ERRCODE='23514',CONSTRAINT='unit_merge_redirect_reviewed_pair';
    END IF;
    NEW.source_was_public := r.status_at_request='published' AND r.visibility_at_request<>'private';
    FOR affected_unit_id IN
        SELECT value
        FROM unnest(ARRAY[NEW.source_unit_id, NEW.target_unit_id]) AS ids(value)
        ORDER BY value
    LOOP
        PERFORM pg_advisory_xact_lock(
            hashtextextended('unit-merge:' || affected_unit_id::text, 0)
        );
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM public.unit_merge_redirect
        WHERE source_unit_id = NEW.target_unit_id
    ) THEN
        RAISE EXCEPTION 'Unit merge redirect target must be canonical'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'unit_merge_redirect_target_not_canonical';
    END IF;

    SELECT redirect.max_depth
    INTO upstream_depth
    FROM public.unit_merge_redirect AS redirect
    WHERE redirect.target_unit_id = NEW.source_unit_id
    ORDER BY redirect.max_depth DESC, redirect.source_unit_id
    LIMIT 1;

    NEW.max_depth := coalesce(upstream_depth, 0) + 1;
    IF NEW.max_depth > 32 THEN
        RAISE EXCEPTION 'Unit merge redirect chain exceeds 32 edges'
            USING ERRCODE = '23514', CONSTRAINT = 'unit_merge_redirect_depth';
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_unit_merge_review()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public AS $function$
DECLARE r public.unit_merge_request%ROWTYPE; n integer;
BEGIN
 SELECT * INTO STRICT r FROM public.unit_merge_request WHERE id=NEW.request_id FOR UPDATE;
 IF r.state<>'pending_review' OR r.expires_at<=clock_timestamp() OR r.proposer_auth_user_id=NEW.reviewer_auth_user_id OR r.request_fingerprint<>NEW.request_fingerprint THEN
 RAISE EXCEPTION 'Review requires a pending pinned request and an independent human' USING ERRCODE='23514',CONSTRAINT='unit_merge_review_admission'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.auth_entity a JOIN public.users u ON u.id=a.auth_user_id WHERE a.entity_id=NEW.reviewer_profile_id AND a.auth_user_id=NEW.reviewer_auth_user_id AND a.state='active' AND a.revision=(NEW.reviewer_authority->>'authorizationRevision')::bigint AND u.erased_at IS NULL AND u.principal_kind='human') THEN
 RAISE EXCEPTION 'Reviewer must have a current human self binding' USING ERRCODE='23514',CONSTRAINT='unit_merge_review_human'; END IF;
 SELECT count(*) INTO n FROM (SELECT 1 FROM public.unit_merge_review WHERE request_id=r.id LIMIT 2) q;
 IF n>=2 THEN RAISE EXCEPTION 'At most two independent reviews are admitted' USING ERRCODE='23514',CONSTRAINT='unit_merge_review_bound'; END IF;
 RETURN NEW;
END;$function$;

DROP TRIGGER IF EXISTS reject_merged_unit_collection_item_unit_id ON public.collection_item;
CREATE TRIGGER reject_merged_unit_collection_item_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.collection_item FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_content_structure_node_content_unit_id ON public.content_structure_node;
CREATE TRIGGER reject_merged_unit_content_structure_node_content_unit_id BEFORE INSERT OR UPDATE OF content_unit_id ON public.content_structure_node FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('content_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_content_structure_node_target_unit_id ON public.content_structure_node;
CREATE TRIGGER reject_merged_unit_content_structure_node_target_unit_id BEFORE INSERT OR UPDATE OF target_unit_id ON public.content_structure_node FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_credit_attribution_source_unit_id ON public.credit_attribution;
CREATE TRIGGER reject_merged_unit_credit_attribution_source_unit_id BEFORE INSERT OR UPDATE OF source_unit_id ON public.credit_attribution FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('source_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_notification_subject_unit_id ON public.notification;
CREATE TRIGGER reject_merged_unit_notification_subject_unit_id BEFORE INSERT OR UPDATE OF subject_unit_id ON public.notification FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('subject_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_poll_option_target_unit_id ON public.poll_option;
CREATE TRIGGER reject_merged_unit_poll_option_target_unit_id BEFORE INSERT OR UPDATE OF target_unit_id ON public.poll_option FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_post_subject_unit_id ON public.post;
CREATE TRIGGER reject_merged_unit_post_subject_unit_id BEFORE INSERT OR UPDATE OF subject_unit_id ON public.post FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('subject_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_profile_resource_participation_resource_unit ON public.profile_resource_participation;
CREATE TRIGGER reject_merged_unit_profile_resource_participation_resource_unit BEFORE INSERT OR UPDATE OF resource_unit_id ON public.profile_resource_participation FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('resource_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_realm_pin_unit_id ON public.realm_pin;
CREATE TRIGGER reject_merged_unit_realm_pin_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.realm_pin FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_realm_unit_unit_id ON public.realm_unit;
CREATE TRIGGER reject_merged_unit_realm_unit_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.realm_unit FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_realm_unit_tag_unit_id ON public.realm_unit_tag;
CREATE TRIGGER reject_merged_unit_realm_unit_tag_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.realm_unit_tag FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_recommendation_exclusion_unit_id ON public.recommendation_exclusion;
DROP TRIGGER IF EXISTS reject_merged_unit_recommendation_exclusion_target_reference_id ON public.recommendation_exclusion;
CREATE TRIGGER reject_merged_unit_recommendation_exclusion_target_reference_id BEFORE INSERT OR UPDATE OF target_reference_id ON public.recommendation_exclusion FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_reference_id', 'reference_value');

DROP TRIGGER IF EXISTS reject_merged_unit_score_unit_id ON public.score;
CREATE TRIGGER reject_merged_unit_score_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.score FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_studio_realm_editor_candidate_unit_id ON public.studio_realm_editor_candidate;
CREATE TRIGGER reject_merged_unit_studio_realm_editor_candidate_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.studio_realm_editor_candidate FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_studio_resource_visit_resource_unit_id ON public.studio_resource_visit;
CREATE TRIGGER reject_merged_unit_studio_resource_visit_resource_unit_id BEFORE INSERT OR UPDATE OF resource_unit_id ON public.studio_resource_visit FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('resource_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_subject_association_entity_id ON public.subject_association;
CREATE TRIGGER reject_merged_unit_subject_association_entity_id BEFORE INSERT OR UPDATE OF entity_id ON public.subject_association FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('entity_id');

DROP TRIGGER IF EXISTS reject_merged_unit_subject_association_unit_id ON public.subject_association;
CREATE TRIGGER reject_merged_unit_subject_association_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.subject_association FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_alias_unit_id ON public.unit_alias;
CREATE TRIGGER reject_merged_unit_unit_alias_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_alias FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_association_proposal_source_unit_id ON public.unit_association_proposal;
CREATE TRIGGER reject_merged_unit_unit_association_proposal_source_unit_id BEFORE INSERT OR UPDATE OF source_unit_id ON public.unit_association_proposal FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('source_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_association_proposal_target_unit_id ON public.unit_association_proposal;
CREATE TRIGGER reject_merged_unit_unit_association_proposal_target_unit_id BEFORE INSERT OR UPDATE OF target_unit_id ON public.unit_association_proposal FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_best_score_unit_id ON public.unit_best_score;
CREATE TRIGGER reject_merged_unit_unit_best_score_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_best_score FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_external_link_source_entity_id ON public.unit_external_link;
CREATE TRIGGER reject_merged_unit_unit_external_link_source_entity_id BEFORE INSERT OR UPDATE OF source_entity_id ON public.unit_external_link FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('source_entity_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_external_link_unit_id ON public.unit_external_link;
CREATE TRIGGER reject_merged_unit_unit_external_link_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_external_link FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_follow_unit_id ON public.unit_follow;
DROP TRIGGER IF EXISTS reject_merged_unit_unit_follow_target_reference_id ON public.unit_follow;
CREATE TRIGGER reject_merged_unit_unit_follow_target_reference_id BEFORE INSERT OR UPDATE OF target_reference_id ON public.unit_follow FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_reference_id', 'reference_value');

DROP TRIGGER IF EXISTS unit_merge_redirect_immutable ON public.unit_merge_redirect;
CREATE TRIGGER unit_merge_redirect_immutable BEFORE DELETE OR UPDATE ON public.unit_merge_redirect FOR EACH ROW EXECUTE FUNCTION public.reject_unit_merge_immutable_mutation();

DROP TRIGGER IF EXISTS unit_merge_redirect_validate ON public.unit_merge_redirect;
CREATE TRIGGER unit_merge_redirect_validate BEFORE INSERT ON public.unit_merge_redirect FOR EACH ROW EXECUTE FUNCTION public.validate_unit_merge_redirect();

DROP TRIGGER IF EXISTS unit_merge_review_immutable ON public.unit_merge_review;
CREATE TRIGGER unit_merge_review_immutable BEFORE DELETE OR UPDATE ON public.unit_merge_review FOR EACH ROW EXECUTE FUNCTION public.reject_unit_merge_immutable_mutation();

DROP TRIGGER IF EXISTS unit_merge_review_validate ON public.unit_merge_review;
CREATE TRIGGER unit_merge_review_validate BEFORE INSERT ON public.unit_merge_review FOR EACH ROW EXECUTE FUNCTION public.validate_unit_merge_review();

DROP TRIGGER IF EXISTS reject_merged_unit_unit_progress_unit_id ON public.unit_progress;
CREATE TRIGGER reject_merged_unit_unit_progress_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_progress FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_progress_entry_unit_id ON public.unit_progress_entry;
CREATE TRIGGER reject_merged_unit_unit_progress_entry_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_progress_entry FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_reaction_unit_id ON public.unit_reaction;
CREATE TRIGGER reject_merged_unit_unit_reaction_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_reaction FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS unit_revision_credit_reject_merged_entity ON public.unit_revision_credit_attribution;
CREATE TRIGGER unit_revision_credit_reject_merged_entity BEFORE INSERT ON public.unit_revision_credit_attribution FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('credited_entity_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_search_document_unit_id ON public.unit_search_document;
CREATE TRIGGER reject_merged_unit_unit_search_document_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_search_document FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_share_unit_id ON public.unit_share;
CREATE TRIGGER reject_merged_unit_unit_share_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_share FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_slug_address_scope_unit_id ON public.unit_slug_address;
CREATE TRIGGER reject_merged_unit_unit_slug_address_scope_unit_id BEFORE INSERT OR UPDATE OF scope_unit_id ON public.unit_slug_address FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('scope_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_slug_address_target_unit_id ON public.unit_slug_address;
CREATE TRIGGER reject_merged_unit_unit_slug_address_target_unit_id BEFORE INSERT OR UPDATE OF target_unit_id ON public.unit_slug_address FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('target_unit_id');

DROP TRIGGER IF EXISTS reject_merged_unit_unit_tag_unit_id ON public.unit_tag;
CREATE TRIGGER reject_merged_unit_unit_tag_unit_id BEFORE INSERT OR UPDATE OF unit_id ON public.unit_tag FOR EACH ROW EXECUTE FUNCTION public.reject_merged_unit_reference('unit_id');

CREATE OR REPLACE FUNCTION public.guard_native_merge_request()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public AS $function$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Merge intent is immutable' USING ERRCODE='23514',CONSTRAINT='unit_merge_request_immutable'; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['state','accepted_at','canonicalized_at','completed_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','accepted_at','canonicalized_at','completed_at','updated_at']) THEN
 RAISE EXCEPTION 'Reviewed merge intent is immutable' USING ERRCODE='23514',CONSTRAINT='unit_merge_request_immutable'; END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM public.auth_entity a JOIN public.users u ON u.id=a.auth_user_id WHERE a.entity_id=NEW.proposer_profile_id AND a.auth_user_id=NEW.proposer_auth_user_id AND a.state='active' AND u.erased_at IS NULL AND u.principal_kind='human') THEN
 RAISE EXCEPTION 'Proposer must have a current human self binding' USING ERRCODE='23514',CONSTRAINT='unit_merge_request_human'; END IF;
 IF NEW.state IN ('accepted','executing','completed','action_required','failed') AND (SELECT count(*) FROM public.unit_merge_review WHERE request_id=NEW.id AND decision='approve')<>2 THEN
 RAISE EXCEPTION 'Execution needs two independent approvals' USING ERRCODE='23514',CONSTRAINT='unit_merge_request_approved'; END IF;
 IF NEW.state='completed' AND NOT EXISTS(SELECT 1 FROM public.unit_merge_operation WHERE request_id=NEW.id AND state='completed') THEN
 RAISE EXCEPTION 'Merge has unfinished reconciliation' USING ERRCODE='23514',CONSTRAINT='unit_merge_request_completed'; END IF;
 RETURN NEW;
END;$function$;
DROP TRIGGER IF EXISTS native_merge_request_guard ON public.unit_merge_request;
CREATE TRIGGER native_merge_request_guard BEFORE INSERT OR UPDATE OR DELETE ON public.unit_merge_request FOR EACH ROW EXECUTE FUNCTION public.guard_native_merge_request();

CREATE OR REPLACE FUNCTION public.guard_native_merge_item()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public AS $function$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Merge receipts are retained' USING ERRCODE='23514',CONSTRAINT='unit_merge_item_retained'; END IF;
 IF TG_OP='UPDATE' AND (OLD.state IN ('applied','retained') OR (to_jsonb(NEW)-ARRAY['state','decision','target_name_id','target_name_revision','target_identifier_id','target_identifier_revision','target_owner_revision','target_binding_revision','error_code','resolved_at','resolved_by_auth_user_id','source_publishing_owner_id','source_music_owner_id','source_program_owner_id','source_software_owner_id','source_entity_owner_id','source_grouping_owner_id','source_reference_owner_id','source_distribution_owner_id','target_publishing_owner_id','target_music_owner_id','target_program_owner_id','target_software_owner_id','target_entity_owner_id','target_grouping_owner_id','target_reference_owner_id','target_distribution_owner_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','decision','target_name_id','target_name_revision','target_identifier_id','target_identifier_revision','target_owner_revision','target_binding_revision','error_code','resolved_at','resolved_by_auth_user_id','source_publishing_owner_id','source_music_owner_id','source_program_owner_id','source_software_owner_id','source_entity_owner_id','source_grouping_owner_id','source_reference_owner_id','source_distribution_owner_id','target_publishing_owner_id','target_music_owner_id','target_program_owner_id','target_software_owner_id','target_entity_owner_id','target_grouping_owner_id','target_reference_owner_id','target_distribution_owner_id'])) THEN
 RAISE EXCEPTION 'Merge source evidence and resolved receipts are immutable' USING ERRCODE='23514',CONSTRAINT='unit_merge_item_immutable'; END IF;
 RETURN NEW;
END;$function$;
DROP TRIGGER IF EXISTS native_merge_item_guard ON public.unit_merge_reconciliation_item;
CREATE TRIGGER native_merge_item_guard BEFORE UPDATE OR DELETE ON public.unit_merge_reconciliation_item FOR EACH ROW EXECUTE FUNCTION public.guard_native_merge_item();

CREATE OR REPLACE FUNCTION public.guard_merged_catalog_identity_write()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM public.unit_merge_redirect WHERE source_unit_id=OLD.id) THEN
 RAISE EXCEPTION 'Merged source identity is retained read-only' USING ERRCODE='23514',CONSTRAINT='merged_catalog_identity_read_only'; END IF;
 IF EXISTS(SELECT 1 FROM public.unit_merge_graph_lock l JOIN public.unit_merge_operation o ON o.id=l.operation_id
   WHERE l.unit_id=OLD.id AND o.source_unit_id=OLD.id
   AND NOT coalesce(o.request_id::text=current_setting('rezics.merge_request_id',true)
    AND o.lease_token::text=current_setting('rezics.merge_lease_token',true)
    AND o.state='processing' AND o.lease_expires_at>clock_timestamp(),false)) THEN
 RAISE EXCEPTION 'Accepted merge source is frozen until its worker canonicalizes it'
 USING ERRCODE='23514',CONSTRAINT='accepted_catalog_merge_source_read_only'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;$function$;

DROP TRIGGER IF EXISTS publishing_merged_identity_write_guard ON public.publishing_identity;
CREATE TRIGGER publishing_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.publishing_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS music_merged_identity_write_guard ON public.music_identity;
CREATE TRIGGER music_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.music_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS program_merged_identity_write_guard ON public.program_identity;
CREATE TRIGGER program_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.program_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS software_merged_identity_write_guard ON public.software_identity;
CREATE TRIGGER software_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.software_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS entity_merged_identity_write_guard ON public.entity_identity;
CREATE TRIGGER entity_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.entity_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS grouping_merged_identity_write_guard ON public.grouping_identity;
CREATE TRIGGER grouping_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.grouping_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS reference_merged_identity_write_guard ON public.reference_identity;
CREATE TRIGGER reference_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.reference_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

DROP TRIGGER IF EXISTS distribution_merged_identity_write_guard ON public.distribution_identity;
CREATE TRIGGER distribution_merged_identity_write_guard BEFORE UPDATE OR DELETE ON public.distribution_identity FOR EACH ROW EXECUTE FUNCTION public.guard_merged_catalog_identity_write();

CREATE OR REPLACE FUNCTION public.guard_native_merge_operation()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog,public AS $function$
DECLARE r public.unit_merge_request%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Merge jobs retain their receipts' USING ERRCODE='23514',CONSTRAINT='unit_merge_operation_retained'; END IF;
 SELECT * INTO STRICT r FROM public.unit_merge_request WHERE id=NEW.request_id;
 IF r.state NOT IN ('accepted','executing','action_required','failed','completed') OR (SELECT count(*) FROM public.unit_merge_review WHERE request_id=r.id AND decision='approve')<>2 THEN
 RAISE EXCEPTION 'Reconciliation requires two accepted reviews' USING ERRCODE='23514',CONSTRAINT='unit_merge_operation_approved'; END IF;
 IF TG_OP='UPDATE' AND (OLD.state='completed' OR ROW(NEW.request_id,NEW.owner,NEW.source_unit_id,NEW.target_unit_id,NEW.shard) IS DISTINCT FROM ROW(OLD.request_id,OLD.owner,OLD.source_unit_id,OLD.target_unit_id,OLD.shard)) THEN
 RAISE EXCEPTION 'Merge job identity and completed state are immutable' USING ERRCODE='23514',CONSTRAINT='unit_merge_operation_immutable'; END IF;
 IF NEW.state='completed' AND (NEW.phase<>'finalize' OR NEW.total_items<>NEW.resolved_items OR EXISTS(SELECT 1 FROM public.unit_merge_reconciliation_item WHERE request_id=NEW.request_id AND state IN('pending','action_required') LIMIT 1)) THEN
 RAISE EXCEPTION 'Unresolved merge items prevent completion' USING ERRCODE='23514',CONSTRAINT='unit_merge_operation_settled'; END IF;
 RETURN NEW;
END;$function$;
DROP TRIGGER IF EXISTS native_merge_operation_guard ON public.unit_merge_operation;
CREATE TRIGGER native_merge_operation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.unit_merge_operation FOR EACH ROW EXECUTE FUNCTION public.guard_native_merge_operation();
