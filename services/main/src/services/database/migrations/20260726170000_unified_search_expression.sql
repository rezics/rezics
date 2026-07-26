-- Migrate persisted Search v1 data to the single expression contract.
-- Basic and advanced remain frontend editing affordances and are not stored.

CREATE FUNCTION unified_search_migration_canonical_jsonb(value jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
	canonical text;
BEGIN
	CASE jsonb_typeof(value)
		WHEN 'array' THEN
			SELECT '[' || coalesce(
				string_agg(
					unified_search_migration_canonical_jsonb(element.value),
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
						unified_search_migration_canonical_jsonb(entry.value),
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

CREATE FUNCTION unified_search_migration_document_is_legacy(input jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
	SELECT input ? 'modes'
		OR EXISTS (
			SELECT 1
			FROM jsonb_array_elements(input -> 'controls') AS control(value)
			WHERE control.value ? 'modes'
		)
$$;

CREATE FUNCTION unified_search_migration_document(input jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT AS $$
	SELECT jsonb_set(
		input - 'modes',
		'{controls}',
		coalesce(
			(
				SELECT jsonb_agg(control.value - 'modes' ORDER BY control.ordinality)
				FROM jsonb_array_elements(input -> 'controls')
					WITH ORDINALITY AS control(value, ordinality)
			),
			'[]'::jsonb
		),
		false
	)
$$;

CREATE FUNCTION unified_search_migration_state(input jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT AS $$
	SELECT CASE
		WHEN NOT input ? 'mode' THEN input
		WHEN input ->> 'mode' = 'advanced' THEN input - 'mode'
		WHEN jsonb_array_length(input -> 'values') = 0 THEN
			input - ARRAY['mode', 'values']
		WHEN jsonb_array_length(input -> 'values') = 1 THEN
			jsonb_set(
				input - ARRAY['mode', 'values'],
				'{expression}',
				input #> '{values,0}',
				true
			)
		ELSE
			jsonb_set(
				input - ARRAY['mode', 'values'],
				'{expression}',
				jsonb_build_object(
					'operator',
					'all',
					'clauses',
					input -> 'values'
				),
				true
			)
	END
$$;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM search_document
		WHERE jsonb_typeof(document) IS DISTINCT FROM 'object'
			OR document -> 'version' IS DISTINCT FROM '1'::jsonb
			OR jsonb_typeof(document -> 'controls') IS DISTINCT FROM 'array'
			OR (
				document ? 'modes'
				AND (
					jsonb_typeof(document -> 'modes') IS DISTINCT FROM 'object'
					OR jsonb_typeof(document #> '{modes,available}') IS DISTINCT FROM 'array'
					OR jsonb_typeof(document #> '{modes,default}') IS DISTINCT FROM 'string'
					OR document #>> '{modes,default}' NOT IN ('basic', 'advanced')
					OR EXISTS (
						SELECT 1
						FROM jsonb_array_elements(document #> '{modes,available}') AS mode(value)
						WHERE jsonb_typeof(mode.value) IS DISTINCT FROM 'string'
							OR mode.value #>> '{}' NOT IN ('basic', 'advanced')
					)
				)
			)
			OR EXISTS (
				SELECT 1
				FROM jsonb_array_elements(document -> 'controls') AS control(value)
				WHERE jsonb_typeof(control.value) IS DISTINCT FROM 'object'
					OR (
						control.value ? 'modes'
						AND (
							jsonb_typeof(control.value -> 'modes') IS DISTINCT FROM 'array'
							OR EXISTS (
								SELECT 1
								FROM jsonb_array_elements(control.value -> 'modes') AS mode(value)
								WHERE jsonb_typeof(mode.value) IS DISTINCT FROM 'string'
									OR mode.value #>> '{}' NOT IN ('basic', 'advanced')
							)
						)
					)
			)
	) THEN
		RAISE EXCEPTION 'Search document v1 contains an unknown editor-mode contract';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM revision_content
		WHERE model = 'rezics.search-document.v1'
			AND (
				encoding <> 'full'
				OR jsonb_typeof(payload) IS DISTINCT FROM 'object'
				OR payload -> 'version' IS DISTINCT FROM '1'::jsonb
				OR jsonb_typeof(payload -> 'document') IS DISTINCT FROM 'object'
				OR payload -> 'document' -> 'version' IS DISTINCT FROM '1'::jsonb
				OR jsonb_typeof(payload #> '{document,controls}') IS DISTINCT FROM 'array'
				OR (
					payload -> 'document' ? 'modes'
					AND (
						jsonb_typeof(payload #> '{document,modes}') IS DISTINCT FROM 'object'
						OR jsonb_typeof(payload #> '{document,modes,available}')
							IS DISTINCT FROM 'array'
						OR jsonb_typeof(payload #> '{document,modes,default}')
							IS DISTINCT FROM 'string'
						OR payload #>> '{document,modes,default}' NOT IN ('basic', 'advanced')
						OR EXISTS (
							SELECT 1
							FROM jsonb_array_elements(
								payload #> '{document,modes,available}'
							) AS mode(value)
							WHERE jsonb_typeof(mode.value) IS DISTINCT FROM 'string'
								OR mode.value #>> '{}' NOT IN ('basic', 'advanced')
						)
					)
				)
				OR EXISTS (
					SELECT 1
					FROM jsonb_array_elements(payload #> '{document,controls}') AS control(value)
					WHERE jsonb_typeof(control.value) IS DISTINCT FROM 'object'
						OR (
							control.value ? 'modes'
							AND (
								jsonb_typeof(control.value -> 'modes') IS DISTINCT FROM 'array'
								OR EXISTS (
									SELECT 1
									FROM jsonb_array_elements(control.value -> 'modes') AS mode(value)
									WHERE jsonb_typeof(mode.value) IS DISTINCT FROM 'string'
										OR mode.value #>> '{}' NOT IN ('basic', 'advanced')
								)
							)
						)
				)
			)
	) THEN
		RAISE EXCEPTION 'Search document history v1 contains an unknown editor-mode contract';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM shared_search_query
		WHERE jsonb_typeof(document) IS DISTINCT FROM 'object'
			OR document -> 'version' IS DISTINCT FROM '1'::jsonb
			OR jsonb_typeof(document -> 'state') IS DISTINCT FROM 'object'
			OR (
				document -> 'state' ? 'mode'
				AND (
					jsonb_typeof(document #> '{state,mode}') IS DISTINCT FROM 'string'
					OR document #>> '{state,mode}' NOT IN ('basic', 'advanced')
					OR (
						document #>> '{state,mode}' = 'basic'
						AND (
							jsonb_typeof(document #> '{state,values}') IS DISTINCT FROM 'array'
							OR document -> 'state' ? 'expression'
						)
					)
					OR (
						document #>> '{state,mode}' = 'advanced'
						AND document -> 'state' ? 'values'
					)
				)
			)
			OR (
				NOT document -> 'state' ? 'mode'
				AND document -> 'state' ? 'values'
			)
	) THEN
		RAISE EXCEPTION 'Shared Search query v1 contains an unknown editor-mode contract';
	END IF;
END
$$;

CREATE TEMP TABLE unified_search_content_migration (
	previous_content_id uuid PRIMARY KEY,
	payload jsonb NOT NULL,
	sha256 text NOT NULL,
	byte_size integer NOT NULL,
	next_content_id uuid
);

INSERT INTO unified_search_content_migration (
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
		unified_search_migration_canonical_jsonb(migrated.payload) AS canonical
	FROM revision_content AS content
	CROSS JOIN LATERAL (
		SELECT jsonb_set(
			content.payload,
			'{document}',
			unified_search_migration_document(content.payload -> 'document'),
			false
		) AS payload
	) AS migrated
	WHERE content.model = 'rezics.search-document.v1'
		AND unified_search_migration_document_is_legacy(content.payload -> 'document')
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
FROM unified_search_content_migration AS migration
ON CONFLICT (model, sha256) DO NOTHING;

UPDATE unified_search_content_migration AS migration
SET next_content_id = content.id
FROM revision_content AS content
WHERE content.model = 'rezics.search-document.v1'
	AND content.sha256 = migration.sha256;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM unified_search_content_migration
		WHERE next_content_id IS NULL
	) THEN
		RAISE EXCEPTION 'Search document history migration did not resolve transformed content';
	END IF;
END
$$;

UPDATE search_document_revision AS revision
SET content_id = migration.next_content_id
FROM unified_search_content_migration AS migration
WHERE revision.content_id = migration.previous_content_id;

DROP TRIGGER revision_content_immutable ON revision_content;

DELETE FROM revision_content AS content
USING unified_search_content_migration AS migration
WHERE content.id = migration.previous_content_id;

CREATE TRIGGER revision_content_immutable
	BEFORE UPDATE OR DELETE ON revision_content
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();

UPDATE search_document
SET document = unified_search_migration_document(document)
WHERE unified_search_migration_document_is_legacy(document);

UPDATE shared_search_query
SET document = jsonb_set(
	document,
	'{state}',
	unified_search_migration_state(document -> 'state'),
	false
)
WHERE document -> 'state' ? 'mode';

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM search_document
		WHERE unified_search_migration_document_is_legacy(document)
	) THEN
		RAISE EXCEPTION 'Search document v1 editor-mode migration is incomplete';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM revision_content
		WHERE model = 'rezics.search-document.v1'
			AND (
				unified_search_migration_document_is_legacy(payload -> 'document')
				OR sha256 <> encode(
					sha256(
						convert_to(
							unified_search_migration_canonical_jsonb(payload),
							'UTF8'
						)
					),
					'hex'
				)
				OR byte_size <> octet_length(
					unified_search_migration_canonical_jsonb(payload)
				)
			)
	) THEN
		RAISE EXCEPTION 'Search document history v1 editor-mode migration is incomplete';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM shared_search_query
		WHERE document -> 'state' ?| ARRAY['mode', 'values']
	) THEN
		RAISE EXCEPTION 'Shared Search query v1 editor-mode migration is incomplete';
	END IF;
END
$$;

DROP TABLE unified_search_content_migration;
DROP FUNCTION unified_search_migration_state(jsonb);
DROP FUNCTION unified_search_migration_document(jsonb);
DROP FUNCTION unified_search_migration_document_is_legacy(jsonb);
DROP FUNCTION unified_search_migration_canonical_jsonb(jsonb);
