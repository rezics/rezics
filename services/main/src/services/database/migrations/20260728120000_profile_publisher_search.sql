-- Invalidate every derived publisher document when either edge of
-- Work -> Entity -> Profile changes. The ordinary projection trigger already
-- touches the changed source or Unit itself; this trigger adds its dependants.
CREATE FUNCTION search_touch_publisher_chain_statement() RETURNS trigger
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
		SELECT coalesce(array_agg(DISTINCT work_credit.source_unit_id), ARRAY[]::uuid[])
		INTO dependent_sources
		FROM public.credit_attribution AS work_credit
		JOIN public.unit AS publisher_entity
			ON publisher_entity.id = work_credit.credited_unit_id
			AND publisher_entity.kind = 'entity'
		WHERE publisher_entity.id = ANY(changed_ids)
			AND work_credit.role = 'publisher';
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
	WHERE direct_credit.credited_unit_id = ANY(changed_ids)
		AND direct_credit.role = 'publisher';

	SELECT coalesce(array_agg(DISTINCT work_credit.source_unit_id), ARRAY[]::uuid[])
	INTO dependent_sources
	FROM public.credit_attribution AS work_credit
	JOIN public.unit AS publisher_entity
		ON publisher_entity.id = work_credit.credited_unit_id
		AND publisher_entity.kind = 'entity'
	WHERE publisher_entity.id = ANY(first_sources)
		AND work_credit.role = 'publisher';

	PERFORM touch_search_unit_projection(first_sources || dependent_sources);
	RETURN NULL;
END
$$;

CREATE TRIGGER "search_projection_touch_publisher_chain_credit_insert"
AFTER INSERT ON "credit_attribution"
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_publisher_chain_statement();
CREATE TRIGGER "search_projection_touch_publisher_chain_credit_update"
AFTER UPDATE ON "credit_attribution"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_publisher_chain_statement();
CREATE TRIGGER "search_projection_touch_publisher_chain_credit_delete"
AFTER DELETE ON "credit_attribution"
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_publisher_chain_statement();

CREATE TRIGGER "search_projection_touch_publisher_chain_unit_insert"
AFTER INSERT ON "unit"
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_publisher_chain_statement();
CREATE TRIGGER "search_projection_touch_publisher_chain_unit_update"
AFTER UPDATE ON "unit"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_publisher_chain_statement();
CREATE TRIGGER "search_projection_touch_publisher_chain_unit_delete"
AFTER DELETE ON "unit"
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_publisher_chain_statement();
