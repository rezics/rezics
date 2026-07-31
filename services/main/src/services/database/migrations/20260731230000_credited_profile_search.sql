-- Replace publisher-only Search invalidation with the public Profile credit
-- relation used by projection v11. The regular projection triggers already
-- touch a changed credit's source and a changed Unit itself; these triggers
-- add sources affected through a credited Profile or one credited Entity hop.
DROP TRIGGER "search_projection_touch_publisher_chain_credit_insert" ON public.credit_attribution;
DROP TRIGGER "search_projection_touch_publisher_chain_credit_update" ON public.credit_attribution;
DROP TRIGGER "search_projection_touch_publisher_chain_credit_delete" ON public.credit_attribution;
DROP TRIGGER "search_projection_touch_publisher_chain_unit_insert" ON public.unit;
DROP TRIGGER "search_projection_touch_publisher_chain_unit_update" ON public.unit;
DROP TRIGGER "search_projection_touch_publisher_chain_unit_delete" ON public.unit;
DROP FUNCTION search_touch_publisher_chain_statement();

CREATE FUNCTION search_touch_credited_profile_chain_statement() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	changed_rows jsonb[];
	changed_ids uuid[];
	first_sources uuid[];
	dependent_sources uuid[];
BEGIN
	IF TG_OP = 'INSERT' THEN
		SELECT array_agg(to_jsonb(row_value)) INTO changed_rows FROM new_rows AS row_value;
	ELSIF TG_OP = 'DELETE' THEN
		SELECT array_agg(to_jsonb(row_value)) INTO changed_rows FROM old_rows AS row_value;
	ELSE
		SELECT array_agg(row_data) INTO changed_rows FROM (
			SELECT to_jsonb(row_value) AS row_data FROM old_rows AS row_value
			UNION ALL
			SELECT to_jsonb(row_value) AS row_data FROM new_rows AS row_value
		) AS combined;
	END IF;

	IF TG_TABLE_NAME = 'credit_attribution' THEN
		changed_ids := search_transition_keys(
			coalesce(changed_rows, ARRAY[]::jsonb[]),
			ARRAY['source_unit_id']
		);
		SELECT coalesce(array_agg(DISTINCT source_credit.source_unit_id), ARRAY[]::uuid[])
		INTO dependent_sources
		FROM public.credit_attribution AS source_credit
		JOIN public.unit AS credited_entity
			ON credited_entity.id = source_credit.credited_unit_id
			AND credited_entity.kind = 'entity'
		WHERE credited_entity.id = ANY(changed_ids);
		PERFORM touch_search_unit_projection(dependent_sources);
		RETURN NULL;
	END IF;

	changed_ids := search_transition_keys(
		coalesce(changed_rows, ARRAY[]::jsonb[]),
		ARRAY['id']
	);
	SELECT coalesce(array_agg(DISTINCT direct_credit.source_unit_id), ARRAY[]::uuid[])
	INTO first_sources
	FROM public.credit_attribution AS direct_credit
	WHERE direct_credit.credited_unit_id = ANY(changed_ids);

	SELECT coalesce(array_agg(DISTINCT source_credit.source_unit_id), ARRAY[]::uuid[])
	INTO dependent_sources
	FROM public.credit_attribution AS source_credit
	JOIN public.unit AS credited_entity
		ON credited_entity.id = source_credit.credited_unit_id
		AND credited_entity.kind = 'entity'
	WHERE credited_entity.id = ANY(first_sources);

	PERFORM touch_search_unit_projection(first_sources || dependent_sources);
	RETURN NULL;
END
$$;

CREATE TRIGGER "search_projection_touch_credited_profile_chain_credit_insert"
AFTER INSERT ON public.credit_attribution
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_credited_profile_chain_statement();
CREATE TRIGGER "search_projection_touch_credited_profile_chain_credit_update"
AFTER UPDATE ON public.credit_attribution
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_credited_profile_chain_statement();
CREATE TRIGGER "search_projection_touch_credited_profile_chain_credit_delete"
AFTER DELETE ON public.credit_attribution
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_credited_profile_chain_statement();

CREATE TRIGGER "search_projection_touch_credited_profile_chain_unit_insert"
AFTER INSERT ON public.unit
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_credited_profile_chain_statement();
CREATE TRIGGER "search_projection_touch_credited_profile_chain_unit_update"
AFTER UPDATE ON public.unit
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_credited_profile_chain_statement();
CREATE TRIGGER "search_projection_touch_credited_profile_chain_unit_delete"
AFTER DELETE ON public.unit
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_credited_profile_chain_statement();
