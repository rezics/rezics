-- Native catalog names remain independently indexed rows. Editing one name never
-- concatenates every alias into an identity-wide document or rewrites its siblings.
CREATE OR REPLACE FUNCTION public.search_catalog_name_candidates(
 p_owner text, p_queries text[], p_languages text[], p_shapes text[],
 p_after_updated_at_micros bigint, p_after_unit_id uuid,
 p_estimated_postings_limit integer, p_limit integer
) RETURNS TABLE(unit_id uuid, unit_updated_at_micros bigint, search_matched boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
 expanded_query text; index_column text; keyword text; estimate jsonb;
 estimated_postings bigint := 0; index_name text; candidates uuid[];
BEGIN
 IF p_owner IS NULL OR NOT p_owner=ANY(ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'])
 OR p_queries IS NULL OR cardinality(p_queries) NOT BETWEEN 1 AND 3
 OR EXISTS(SELECT 1 FROM unnest(p_queries) q WHERE q IS NULL OR btrim(q)='' OR char_length(q)>512)
 OR p_languages IS NULL OR cardinality(p_languages)>50
 OR p_shapes IS NULL OR cardinality(p_shapes)>50
 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 4097
 OR p_estimated_postings_limit IS NULL OR p_estimated_postings_limit NOT BETWEEN 1 AND 50000
 OR num_nonnulls(p_after_updated_at_micros,p_after_unit_id) NOT IN (0,2)
 OR p_after_updated_at_micros<0 THEN
  RAISE EXCEPTION 'invalid native name search input' USING ERRCODE='22023';
 END IF;
 SELECT string_agg('('||public.pgroonga_query_escape(q)||')',' OR ' ORDER BY n)
 INTO expanded_query FROM unnest(p_queries) WITH ORDINALITY v(q,n);
 index_name := p_owner||'_named_form_search_idx';
 index_column := public.pgroonga_index_column_name(index_name::cstring,'value');
 FOREACH keyword IN ARRAY public.pgroonga_query_extract_keywords(expanded_query) LOOP
  estimate := public.pgroonga_command('table_tokenize',ARRAY[
   'table',split_part(index_column,'.',1),'string',keyword,
   'index_column',split_part(index_column,'.',2),'mode','GET'])::jsonb;
  IF (estimate #>> '{0,0}')::integer IS DISTINCT FROM 0 THEN
   RAISE EXCEPTION 'native name posting estimate failed';
  END IF;
  SELECT estimated_postings+coalesce(sum((token->>'estimated_size')::bigint),0)
  INTO estimated_postings FROM jsonb_array_elements(coalesce(estimate #> '{1}','[]'::jsonb)) token;
  EXIT WHEN estimated_postings>p_estimated_postings_limit;
 END LOOP;
 IF estimated_postings<=p_estimated_postings_limit THEN
  -- LIMIT is before DISTINCT, identity joins and sorting. A stale underestimate
  -- is detected by the extra row and switches to the same bounded scan fallback.
  EXECUTE format('SELECT array_agg(owner_id) FROM (
   SELECT owner_id FROM public.%I WHERE state=''active'' AND spoiler=0 AND scope_owner_id IS NULL
    AND value &@~ $1 AND (cardinality($2)=0 OR split_part(lower(language_tag),''-'',1)=ANY($2))
   LIMIT $3) hits',p_owner||'_named_form')
   INTO candidates USING expanded_query,p_languages,p_estimated_postings_limit+1;
  IF coalesce(cardinality(candidates),0)<=p_estimated_postings_limit THEN
   RETURN QUERY EXECUTE format('SELECT identity.id,(extract(epoch FROM identity.updated_at)*1000000)::bigint,true
    FROM (SELECT DISTINCT id FROM unnest($1) ids(id)) matches JOIN public.%I identity ON identity.id=matches.id
    WHERE identity.status=''published'' AND identity.visibility=''public'' AND identity.moderation_status=''approved'' AND identity.deleted_at IS NULL
     AND (cardinality($2)=0 OR identity.shape=ANY($2))
     AND ($3 IS NULL OR (identity.updated_at,identity.id)<(to_timestamp($4::numeric/1000000),$3))
    ORDER BY identity.updated_at DESC,identity.id DESC LIMIT $5',p_owner||'_identity')
    USING coalesce(candidates,ARRAY[]::uuid[]),p_shapes,p_after_unit_id,p_after_updated_at_micros,p_limit;
   RETURN;
  END IF;
 END IF;
 RETURN QUERY EXECUTE format('SELECT identity.id,(extract(epoch FROM identity.updated_at)*1000000)::bigint,false
  FROM public.%I identity WHERE identity.status=''published'' AND identity.visibility=''public''
   AND identity.moderation_status=''approved'' AND identity.deleted_at IS NULL
   AND (cardinality($1)=0 OR identity.shape=ANY($1))
   AND ($2 IS NULL OR (identity.updated_at,identity.id)<(to_timestamp($3::numeric/1000000),$2))
  ORDER BY identity.updated_at DESC,identity.id DESC LIMIT $4',p_owner||'_identity')
  USING p_shapes,p_after_unit_id,p_after_updated_at_micros,p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.search_catalog_name_candidates(text,text[],text[],text[],bigint,uuid,integer,integer) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.catalog_name_matches(p_id uuid,p_queries text[],p_languages text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_owner text; matched boolean; query text; inspected integer; candidate_ids uuid[]; name_bytes bigint;
BEGIN
 SELECT owner INTO v_owner FROM public.catalog_unit_locator WHERE id=p_id;
 IF v_owner IS NULL OR NOT v_owner=ANY(ARRAY['publishing','music','program','software','entity','grouping','reference','distribution']) THEN RETURN false; END IF;
 IF p_queries IS NULL OR cardinality(p_queries) NOT BETWEEN 1 AND 3
  OR EXISTS(SELECT 1 FROM unnest(p_queries) q WHERE q IS NULL OR btrim(q)='' OR char_length(q)>512)
  OR p_languages IS NULL OR cardinality(p_languages)>50 THEN
  RAISE EXCEPTION 'invalid bounded name search input' USING ERRCODE='22023';
 END IF;
 SELECT string_agg('('||public.pgroonga_query_escape(q)||')',' OR ' ORDER BY n)
 INTO query FROM unnest(p_queries) WITH ORDINALITY v(q,n);
 -- Rare-term postings still cover all names. A broad residual has a fixed count and byte budget;
 -- exceeded budgets report unavailable instead of silently treating unexamined aliases as non-matches.
 EXECUTE format('SELECT array_agg(id),coalesce(sum(bytes),0),count(*)::integer FROM (
  SELECT id,octet_length(value) bytes FROM public.%I WHERE owner_id=$1 AND state=''active'' AND spoiler=0 AND scope_owner_id IS NULL
  AND (cardinality($2)=0 OR split_part(lower(language_tag),''-'',1)=ANY($2)) LIMIT 513
 ) bounded',v_owner||'_named_form') INTO candidate_ids,name_bytes,inspected USING p_id,p_languages;
 IF inspected>512 OR name_bytes>65536 THEN RAISE EXCEPTION 'Native name residual budget exceeded; refine the query' USING ERRCODE='54000'; END IF;
 EXECUTE format('WITH bounded AS MATERIALIZED (SELECT value FROM public.%I WHERE owner_id=$1 AND id=ANY($2))
  SELECT coalesce(bool_or(value &@~ $3),false) FROM bounded',v_owner||'_named_form')
 INTO matched USING p_id,coalesce(candidate_ids,ARRAY[]::uuid[]),query;
 RETURN matched;
END;
$$;
REVOKE ALL ON FUNCTION public.catalog_name_matches(uuid,text[],text[]) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.catalog_name_has_languages(p_id uuid,p_languages text[],p_all boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_owner text; matched boolean;
BEGIN
 IF p_languages IS NULL OR cardinality(p_languages) NOT BETWEEN 1 AND 50 OR p_all IS NULL THEN
  RAISE EXCEPTION 'invalid name language boundary' USING ERRCODE='22023';
 END IF;
 SELECT owner INTO v_owner FROM public.catalog_unit_locator WHERE id=p_id;
 IF v_owner IS NULL OR NOT v_owner=ANY(ARRAY['publishing','music','program','software','entity','grouping','reference','distribution']) THEN RETURN false; END IF;
 IF p_all THEN
  EXECUTE format('SELECT NOT EXISTS(SELECT 1 FROM unnest($2) requested(language) WHERE NOT EXISTS(
   SELECT 1 FROM public.%I WHERE owner_id=$1 AND state=''active'' AND spoiler=0 AND scope_owner_id IS NULL
   AND split_part(lower(language_tag),''-'',1)=requested.language))',v_owner||'_named_form') INTO matched USING p_id,p_languages;
 ELSE
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE owner_id=$1 AND state=''active'' AND spoiler=0 AND scope_owner_id IS NULL
   AND split_part(lower(language_tag),''-'',1)=ANY($2))',v_owner||'_named_form') INTO matched USING p_id,p_languages;
 END IF;
 RETURN matched;
END;
$$;
REVOKE ALL ON FUNCTION public.catalog_name_has_languages(uuid,text[],boolean) FROM PUBLIC;
