-- Internal bounded metadata lookup. Callers apply the owning read or write policy.
CREATE OR REPLACE FUNCTION public.read_unit_state(target_id uuid, include_deleted boolean DEFAULT false)
RETURNS TABLE (
 id uuid, owner text, shape text, status text, visibility text,
 content_rating text, moderation_status text, ai_disclosure text,
 post_targeting_locked boolean, published_at timestamptz,
 revision bigint, routing_generation integer, created_by_auth_user_id uuid,
 deleted_at timestamptz, created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE route record; table_name text; routing_ready boolean; shape_expression text; optional_columns text;
BEGIN
 SELECT c.ready INTO routing_ready FROM public.catalog_routing_control c WHERE c.singleton;
 IF routing_ready IS DISTINCT FROM true THEN RETURN; END IF;
 SELECT l.owner,l.generation INTO route FROM public.catalog_unit_locator l WHERE l.id=target_id;
 IF NOT FOUND THEN RETURN; END IF;
 IF route.owner=ANY(ARRAY['publishing','music','program','software','entity','grouping','reference','distribution']) THEN
  table_name:=route.owner||'_identity';shape_expression:='r.shape::text';
  optional_columns:='NULL::text,r.post_targeting_locked,NULL::timestamptz';
 ELSIF route.owner=ANY(ARRAY['post','video','audio','poll','zone','realm','realm_rule','custom_theme','collection','tag','tag_path','label']) THEN
  table_name:=route.owner;shape_expression:=CASE WHEN route.owner='post' THEN 'r.kind::text' ELSE format('%L::text',route.owner) END;
  optional_columns:='r.ai_disclosure::text,r.post_targeting_locked,r.published_at';
 ELSE RETURN;
 END IF;
 -- Select only metadata: wide Zone documents never enter this routing read.
 RETURN QUERY EXECUTE format('SELECT r.id,%L::text,%s,r.status::text,r.visibility::text,r.content_rating::text,r.moderation_status::text,%s,
  r.revision,r.routing_generation,r.created_by_auth_user_id,r.deleted_at,r.created_at,r.updated_at
  FROM public.%I r WHERE r.id=$1 AND r.routing_generation=$2 AND ($3 OR r.deleted_at IS NULL)',route.owner,shape_expression,optional_columns,table_name)
  USING target_id,route.generation,include_deleted;
END $$;

CREATE OR REPLACE FUNCTION public.maintain_platform_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF (NEW.id,NEW.created_at,NEW.created_by_auth_user_id,NEW.routing_generation)
  IS DISTINCT FROM (OLD.id,OLD.created_at,OLD.created_by_auth_user_id,OLD.routing_generation) THEN
  RAISE EXCEPTION 'Platform identity and creation provenance are immutable' USING ERRCODE='23514';
 END IF;
 IF OLD.revision>=9007199254740991 OR NEW.revision IS NULL OR NEW.revision NOT IN (OLD.revision,OLD.revision+1) THEN
  RAISE EXCEPTION 'Platform mutation requires its next revision' USING ERRCODE='23514';
 END IF;
 NEW.revision:=OLD.revision+1;
 NEW.updated_at:=greatest(clock_timestamp(),OLD.updated_at+interval '1 millisecond');
 RETURN NEW;
END $$;
DO $$ DECLARE owner_name text;
BEGIN
 FOREACH owner_name IN ARRAY ARRAY['post','video','audio','poll','zone','realm','realm_rule','custom_theme','collection','tag','tag_path','label'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS platform_identity_guard ON public.%I',owner_name);
  EXECUTE format('CREATE TRIGGER platform_identity_guard BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.maintain_platform_identity()',owner_name);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.require_zone_page_post()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE target_id uuid; actual_post record; actual_page record;
BEGIN
 target_id:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
 PERFORM pg_advisory_xact_lock(hashtextextended('zone-page:'||target_id::text,0));
 SELECT p.kind,p.subject_unit_id INTO actual_post FROM public.post p WHERE p.id=target_id FOR SHARE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT p.zone_id INTO actual_page FROM public.zone_page p WHERE p.id=target_id;
 IF actual_post.kind='page' THEN
  IF NOT FOUND OR actual_page.zone_id IS DISTINCT FROM actual_post.subject_unit_id THEN
   RAISE EXCEPTION 'A Zone Page requires its same-ID Page Post and exact Zone subject' USING ERRCODE='23514';
  END IF;
 ELSIF FOUND THEN
  RAISE EXCEPTION 'A Zone Page cannot be attached to another Post kind' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS zone_page_post_required ON public.zone_page;
CREATE CONSTRAINT TRIGGER zone_page_post_required AFTER INSERT OR UPDATE OR DELETE ON public.zone_page
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.require_zone_page_post();
DROP TRIGGER IF EXISTS post_zone_page_required ON public.post;
CREATE CONSTRAINT TRIGGER post_zone_page_required AFTER INSERT OR UPDATE ON public.post
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.require_zone_page_post();
