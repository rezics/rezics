-- Migrate persisted Search v1 documents after the catalog domain was replaced.
-- SearchDocument history is content-addressed, so transformed checkpoints receive
-- new immutable content rows before their revision references are repointed.

CREATE FUNCTION pg_temp.search_unit_contract_canonical_json(value jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
	canonical text;
BEGIN
	CASE jsonb_typeof(value)
		WHEN 'array' THEN
			SELECT '[' || coalesce(
				string_agg(
					pg_temp.search_unit_contract_canonical_json(element.value),
					','
					ORDER BY element.ordinality
				),
				''
			) || ']'
			INTO canonical
			FROM jsonb_array_elements(value) WITH ORDINALITY AS element(value, ordinality);
			RETURN canonical;
		WHEN 'object' THEN
			SELECT '{' || coalesce(
				string_agg(
					to_jsonb(entry.key)::text || ':' ||
						pg_temp.search_unit_contract_canonical_json(entry.value),
					','
					ORDER BY entry.key COLLATE "C"
				),
				''
			) || '}'
			INTO canonical
			FROM jsonb_each(value) AS entry(key, value);
			RETURN canonical;
		ELSE
			RETURN value::text;
	END CASE;
END
$$;

CREATE FUNCTION pg_temp.search_unit_contract_release_field(template_id text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
	SELECT CASE template_id
		WHEN 'media' THEN 'media-release-date'
		WHEN 'software' THEN 'software-release-date'
	END
$$;

CREATE FUNCTION pg_temp.search_unit_contract_scalar(value jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT AS $$
	SELECT CASE value
		WHEN '"entity"'::jsonb THEN '"entities"'::jsonb
		ELSE value
	END
$$;

CREATE FUNCTION pg_temp.search_unit_contract_scalar_array(value jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT AS $$
	SELECT coalesce(
		jsonb_agg(
			pg_temp.search_unit_contract_scalar(element.value)
			ORDER BY element.ordinality
		),
		'[]'::jsonb
	)
	FROM jsonb_array_elements(value) WITH ORDINALITY AS element(value, ordinality)
$$;

CREATE FUNCTION pg_temp.search_unit_contract_field(
	field_name text,
	template_id text
) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
	release_field text;
BEGIN
	IF field_name = 'catalog-licensed' THEN
		RETURN 'content-license';
	END IF;
	IF field_name <> 'catalog-release-date' THEN
		RETURN field_name;
	END IF;
	release_field := pg_temp.search_unit_contract_release_field(template_id);
	IF release_field IS NULL THEN
		RAISE EXCEPTION
			'Search document template % cannot migrate catalog-release-date',
			template_id;
	END IF;
	RETURN release_field;
END
$$;

CREATE FUNCTION pg_temp.search_unit_contract_filter(
	input jsonb,
	template_id text
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
	field_name text := input ->> 'field';
	output jsonb;
BEGIN
	output := jsonb_set(
		input,
		'{field}',
		to_jsonb(pg_temp.search_unit_contract_field(field_name, template_id)),
		false
	);
	IF field_name = 'category' AND input ? 'value' THEN
		output := jsonb_set(
			output,
			'{value}',
			pg_temp.search_unit_contract_scalar(input -> 'value'),
			false
		);
	END IF;
	IF field_name = 'category' AND input ? 'values' THEN
		output := jsonb_set(
			output,
			'{values}',
			pg_temp.search_unit_contract_scalar_array(input -> 'values'),
			false
		);
	END IF;
	RETURN output;
END
$$;

CREATE FUNCTION pg_temp.search_unit_contract_control_key(
	input jsonb,
	control_key text
) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
	control jsonb;
	current_key text;
	field_name text;
	target_field text;
	template_id text := input #>> '{template,id}';
BEGIN
	SELECT candidate.value
	INTO control
	FROM jsonb_array_elements(input -> 'controls') AS candidate(value)
	WHERE candidate.value ->> 'key' = control_key
	LIMIT 1;
	IF control IS NULL THEN
		RETURN control_key;
	END IF;
	field_name := control ->> 'field';
	IF field_name NOT IN ('catalog-licensed', 'catalog-release-date') THEN
		RETURN control_key;
	END IF;
	target_field := pg_temp.search_unit_contract_field(field_name, template_id);
	SELECT candidate.value ->> 'key'
	INTO current_key
	FROM jsonb_array_elements(input -> 'controls') AS candidate(value)
	WHERE candidate.value ->> 'field' = target_field
	LIMIT 1;
	IF current_key IS NOT NULL THEN
		RETURN current_key;
	END IF;
	IF control_key = field_name THEN
		RETURN target_field;
	END IF;
	RETURN control_key;
END
$$;

CREATE FUNCTION pg_temp.search_unit_contract_control(
	input jsonb,
	control jsonb
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
	field_name text := control ->> 'field';
	output jsonb;
BEGIN
	output := jsonb_set(
		jsonb_set(
			control,
			'{key}',
			to_jsonb(
				pg_temp.search_unit_contract_control_key(input, control ->> 'key')
			),
			false
		),
		'{field}',
		to_jsonb(
			pg_temp.search_unit_contract_field(
				field_name,
				input #>> '{template,id}'
			)
		),
		false
	);
	IF
		field_name = 'category'
		AND jsonb_typeof(control #> '{optionPolicy,values}') = 'array'
	THEN
		output := jsonb_set(
			output,
			'{optionPolicy,values}',
			pg_temp.search_unit_contract_scalar_array(
				control #> '{optionPolicy,values}'
			),
			false
		);
	END IF;
	RETURN output;
END
$$;

CREATE FUNCTION pg_temp.search_unit_contract_keep_control(
	input jsonb,
	control jsonb
) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
	SELECT
		control ->> 'field' NOT IN ('catalog-licensed', 'catalog-release-date')
		OR NOT EXISTS (
			SELECT 1
			FROM jsonb_array_elements(input -> 'controls') AS candidate(value)
			WHERE candidate.value ->> 'field' =
				pg_temp.search_unit_contract_field(
					control ->> 'field',
					input #>> '{template,id}'
				)
		)
$$;

CREATE FUNCTION pg_temp.search_unit_contract_section_key(
	input jsonb,
	control_key text
) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
	control jsonb;
	target_key text;
	target_referenced boolean;
BEGIN
	SELECT candidate.value
	INTO control
	FROM jsonb_array_elements(input -> 'controls') AS candidate(value)
	WHERE candidate.value ->> 'key' = control_key
	LIMIT 1;
	target_key := pg_temp.search_unit_contract_control_key(input, control_key);
	IF
		control IS NULL
		OR control ->> 'field' NOT IN ('catalog-licensed', 'catalog-release-date')
		OR pg_temp.search_unit_contract_keep_control(input, control)
	THEN
		RETURN target_key;
	END IF;
	SELECT EXISTS (
		SELECT 1
		FROM jsonb_array_elements(input -> 'sections') AS section(value)
		WHERE section.value -> 'controls' @> jsonb_build_array(target_key)
	)
	INTO target_referenced;
	RETURN CASE WHEN target_referenced THEN NULL ELSE target_key END;
END
$$;

CREATE FUNCTION pg_temp.search_unit_contract_document(input jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
	default_count integer;
	default_key_count integer;
	output jsonb := input;
BEGIN
	IF
		jsonb_typeof(input) IS DISTINCT FROM 'object'
		OR input -> 'version' IS DISTINCT FROM '1'::jsonb
		OR jsonb_typeof(input -> 'controls') IS DISTINCT FROM 'array'
		OR jsonb_typeof(input -> 'defaults') IS DISTINCT FROM 'array'
		OR jsonb_typeof(input -> 'sections') IS DISTINCT FROM 'array'
		OR jsonb_typeof(input #> '{results,facets}') IS DISTINCT FROM 'array'
		OR jsonb_typeof(input -> 'categories') IS DISTINCT FROM 'array'
	THEN
		RAISE EXCEPTION 'Search document v1 has an unknown persisted shape';
	END IF;

	SELECT
		count(*),
		count(
			DISTINCT pg_temp.search_unit_contract_control_key(
				input,
				item.value ->> 'controlKey'
			)
		)
	INTO default_count, default_key_count
	FROM jsonb_array_elements(input -> 'defaults') AS item(value);
	IF default_count <> default_key_count THEN
		RAISE EXCEPTION
			'Search document defaults become ambiguous after the Unit contract migration';
	END IF;

	output := jsonb_set(
		output,
		'{categories}',
		coalesce(
			(
				SELECT jsonb_agg(category.value ORDER BY category.first_ordinality)
				FROM (
					SELECT
						pg_temp.search_unit_contract_scalar(element.value) AS value,
						min(element.ordinality) AS first_ordinality
					FROM jsonb_array_elements(input -> 'categories')
						WITH ORDINALITY AS element(value, ordinality)
					GROUP BY pg_temp.search_unit_contract_scalar(element.value)
				) AS category
			),
			'[]'::jsonb
		),
		false
	);

	output := jsonb_set(
		output,
		'{controls}',
		coalesce(
			(
				SELECT jsonb_agg(
					pg_temp.search_unit_contract_control(input, control.value)
					ORDER BY control.ordinality
				)
				FROM jsonb_array_elements(input -> 'controls')
					WITH ORDINALITY AS control(value, ordinality)
				WHERE pg_temp.search_unit_contract_keep_control(input, control.value)
			),
			'[]'::jsonb
		),
		false
	);

	output := jsonb_set(
		output,
		'{defaults}',
		coalesce(
			(
				SELECT jsonb_agg(
					jsonb_set(
						jsonb_set(
							item.value,
							'{controlKey}',
							to_jsonb(
								pg_temp.search_unit_contract_control_key(
									input,
									item.value ->> 'controlKey'
								)
							),
							false
						),
						'{filter}',
						pg_temp.search_unit_contract_filter(
							item.value -> 'filter',
							input #>> '{template,id}'
						),
						false
					)
					ORDER BY item.ordinality
				)
				FROM jsonb_array_elements(input -> 'defaults')
					WITH ORDINALITY AS item(value, ordinality)
			),
			'[]'::jsonb
		),
		false
	);

	output := jsonb_set(
		output,
		'{sections}',
		coalesce(
			(
				SELECT jsonb_agg(section.migrated ORDER BY section.ordinality)
				FROM (
					SELECT
						section.ordinality,
						jsonb_set(
							section.value,
							'{controls}',
							coalesce(
								(
									SELECT jsonb_agg(to_jsonb(mapped.control_key) ORDER BY mapped.ordinality)
									FROM (
										SELECT
											pg_temp.search_unit_contract_section_key(
												input,
												control.value #>> '{}'
											) AS control_key,
											control.ordinality
										FROM jsonb_array_elements(section.value -> 'controls')
											WITH ORDINALITY AS control(value, ordinality)
									) AS mapped
									WHERE mapped.control_key IS NOT NULL
								),
								'[]'::jsonb
							),
							false
						) AS migrated
					FROM jsonb_array_elements(input -> 'sections')
						WITH ORDINALITY AS section(value, ordinality)
				) AS section
				WHERE jsonb_array_length(section.migrated -> 'controls') > 0
			),
			'[]'::jsonb
		),
		false
	);

	output := jsonb_set(
		output,
		'{results,facets}',
		coalesce(
			(
				SELECT jsonb_agg(to_jsonb(facet.control_key) ORDER BY facet.first_ordinality)
				FROM (
					SELECT
						pg_temp.search_unit_contract_control_key(
							input,
							element.value #>> '{}'
						) AS control_key,
						min(element.ordinality) AS first_ordinality
					FROM jsonb_array_elements(input #> '{results,facets}')
						WITH ORDINALITY AS element(value, ordinality)
					GROUP BY pg_temp.search_unit_contract_control_key(
						input,
						element.value #>> '{}'
					)
				) AS facet
			),
			'[]'::jsonb
		),
		false
	);
	RETURN output;
END
$$;

CREATE FUNCTION pg_temp.search_unit_contract_expression(
	input jsonb,
	template_id text
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
	IF input ? 'controlKey' THEN
		RETURN jsonb_set(
			jsonb_set(
				input,
				'{controlKey}',
				to_jsonb(
					CASE input ->> 'controlKey'
						WHEN 'catalog-licensed' THEN 'content-license'
						WHEN 'catalog-release-date' THEN
							pg_temp.search_unit_contract_field(
								'catalog-release-date',
								template_id
							)
						ELSE input ->> 'controlKey'
					END
				),
				false
			),
			'{filter}',
			pg_temp.search_unit_contract_filter(input -> 'filter', template_id),
			false
		);
	END IF;
	IF input ->> 'operator' IN ('all', 'any') THEN
		RETURN jsonb_set(
			input,
			'{clauses}',
			(
				SELECT jsonb_agg(
					pg_temp.search_unit_contract_expression(clause.value, template_id)
					ORDER BY clause.ordinality
				)
				FROM jsonb_array_elements(input -> 'clauses')
					WITH ORDINALITY AS clause(value, ordinality)
			),
			false
		);
	END IF;
	IF input ->> 'operator' = 'not' THEN
		RETURN jsonb_set(
			input,
			'{clause}',
			pg_temp.search_unit_contract_expression(input -> 'clause', template_id),
			false
		);
	END IF;
	RAISE EXCEPTION 'Shared Search query v1 has an unknown expression shape';
END
$$;

CREATE FUNCTION pg_temp.search_unit_contract_shared_document(input jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
	output jsonb := input;
	template_id text := input ->> 'template';
BEGIN
	IF
		jsonb_typeof(input) IS DISTINCT FROM 'object'
		OR input -> 'version' IS DISTINCT FROM '1'::jsonb
		OR jsonb_typeof(input -> 'state') IS DISTINCT FROM 'object'
		OR jsonb_typeof(input -> 'selections') IS DISTINCT FROM 'array'
	THEN
		RAISE EXCEPTION 'Shared Search query v1 has an unknown persisted shape';
	END IF;
	IF input #> '{state,expression}' IS NOT NULL THEN
		output := jsonb_set(
			output,
			'{state,expression}',
			pg_temp.search_unit_contract_expression(
				input #> '{state,expression}',
				template_id
			),
			false
		);
	END IF;
	output := jsonb_set(
		output,
		'{selections}',
		coalesce(
			(
				SELECT jsonb_agg(
					jsonb_set(
						CASE
							WHEN selection.value ->> 'field' = 'category' THEN
								jsonb_set(
									selection.value,
									'{value}',
									to_jsonb(
										CASE selection.value ->> 'value'
											WHEN 'entity' THEN 'entities'
											ELSE selection.value ->> 'value'
										END
									),
									false
								)
							ELSE selection.value
						END,
						'{field}',
						to_jsonb(
							pg_temp.search_unit_contract_field(
								selection.value ->> 'field',
								template_id
							)
						),
						false
					)
					ORDER BY selection.ordinality
				)
				FROM jsonb_array_elements(input -> 'selections')
					WITH ORDINALITY AS selection(value, ordinality)
			),
			'[]'::jsonb
		),
		false
	);
	RETURN output;
END
$$;

CREATE TEMP TABLE search_unit_contract_content_migration (
	previous_content_id uuid PRIMARY KEY,
	payload jsonb NOT NULL,
	sha256 text NOT NULL,
	byte_size integer NOT NULL,
	next_content_id uuid
);

INSERT INTO search_unit_contract_content_migration (
	previous_content_id,
	payload,
	sha256,
	byte_size
)
SELECT
	source.previous_content_id,
	source.payload,
	encode(sha256(convert_to(source.canonical, 'UTF8')), 'hex'),
	octet_length(source.canonical)
FROM (
	SELECT
		content.id AS previous_content_id,
		migrated.payload,
		pg_temp.search_unit_contract_canonical_json(migrated.payload) AS canonical
	FROM revision_content AS content
	CROSS JOIN LATERAL (
		SELECT jsonb_set(
			content.payload,
			'{document}',
			pg_temp.search_unit_contract_document(content.payload -> 'document'),
			false
		) AS payload
	) AS migrated
	WHERE content.model = 'rezics.search-document.v1'
		AND content.encoding = 'full'
		AND migrated.payload IS DISTINCT FROM content.payload
) AS source;

INSERT INTO revision_content (
	id,
	model,
	sha256,
	byte_size,
	encoding,
	base_content_id,
	delta_depth,
	payload
)
SELECT
	uuidv7(),
	'rezics.search-document.v1',
	migration.sha256,
	migration.byte_size,
	'full',
	NULL,
	0,
	migration.payload
FROM search_unit_contract_content_migration AS migration
ON CONFLICT (model, sha256) DO NOTHING;

UPDATE search_unit_contract_content_migration AS migration
SET next_content_id = content.id
FROM revision_content AS content
WHERE content.model = 'rezics.search-document.v1'
	AND content.sha256 = migration.sha256;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM search_unit_contract_content_migration
		WHERE next_content_id IS NULL
	) THEN
		RAISE EXCEPTION
			'Search document Unit contract migration did not resolve transformed content';
	END IF;
END
$$;

UPDATE search_document_revision AS revision
SET content_id = migration.next_content_id
FROM search_unit_contract_content_migration AS migration
WHERE revision.content_id = migration.previous_content_id;

DROP TRIGGER revision_content_immutable ON revision_content;

DELETE FROM revision_content AS content
USING search_unit_contract_content_migration AS migration
WHERE content.id = migration.previous_content_id;

CREATE TRIGGER revision_content_immutable
	BEFORE UPDATE OR DELETE ON revision_content
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();

UPDATE search_document
SET document = pg_temp.search_unit_contract_document(document)
WHERE pg_temp.search_unit_contract_document(document) IS DISTINCT FROM document;

UPDATE shared_search_query
SET document = pg_temp.search_unit_contract_shared_document(document)
WHERE pg_temp.search_unit_contract_shared_document(document) IS DISTINCT FROM document;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM search_document
		CROSS JOIN LATERAL jsonb_array_elements(document -> 'controls') AS control(value)
		WHERE control.value ->> 'field' IN ('catalog-licensed', 'catalog-release-date')
	) OR EXISTS (
		SELECT 1
		FROM search_document
		CROSS JOIN LATERAL jsonb_array_elements(document -> 'categories') AS category(value)
		WHERE category.value = '"entity"'::jsonb
	) THEN
		RAISE EXCEPTION 'Current Search document Unit contract migration is incomplete';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM revision_content
		WHERE model = 'rezics.search-document.v1'
			AND (
				encoding <> 'full'
				OR payload IS DISTINCT FROM jsonb_set(
					payload,
					'{document}',
					pg_temp.search_unit_contract_document(payload -> 'document'),
					false
				)
				OR sha256 <> encode(
					sha256(
						convert_to(
							pg_temp.search_unit_contract_canonical_json(payload),
							'UTF8'
						)
					),
					'hex'
				)
				OR byte_size <> octet_length(
					pg_temp.search_unit_contract_canonical_json(payload)
				)
			)
	) THEN
		RAISE EXCEPTION 'Search document history Unit contract migration is incomplete';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM shared_search_query
		WHERE document IS DISTINCT FROM
			pg_temp.search_unit_contract_shared_document(document)
	) THEN
		RAISE EXCEPTION 'Shared Search query Unit contract migration is incomplete';
	END IF;
END
$$;

DROP TABLE search_unit_contract_content_migration;
DROP FUNCTION pg_temp.search_unit_contract_shared_document(jsonb);
DROP FUNCTION pg_temp.search_unit_contract_expression(jsonb, text);
DROP FUNCTION pg_temp.search_unit_contract_document(jsonb);
DROP FUNCTION pg_temp.search_unit_contract_section_key(jsonb, text);
DROP FUNCTION pg_temp.search_unit_contract_keep_control(jsonb, jsonb);
DROP FUNCTION pg_temp.search_unit_contract_control(jsonb, jsonb);
DROP FUNCTION pg_temp.search_unit_contract_control_key(jsonb, text);
DROP FUNCTION pg_temp.search_unit_contract_filter(jsonb, text);
DROP FUNCTION pg_temp.search_unit_contract_field(text, text);
DROP FUNCTION pg_temp.search_unit_contract_scalar_array(jsonb);
DROP FUNCTION pg_temp.search_unit_contract_scalar(jsonb);
DROP FUNCTION pg_temp.search_unit_contract_release_field(text);
DROP FUNCTION pg_temp.search_unit_contract_canonical_json(jsonb);
