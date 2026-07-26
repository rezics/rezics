CREATE FUNCTION search_v1_migration_is_sort_option(input jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
	SELECT jsonb_typeof(input) = 'string'
		AND input #>> '{}' IN (
			'best',
			'relevance',
			'createdAt:asc',
			'createdAt:desc',
			'updatedAt:asc',
			'updatedAt:desc',
			'publishedAt:asc',
			'publishedAt:desc',
			'followerCount:asc',
			'followerCount:desc',
			'replyCount:asc',
			'replyCount:desc',
			'closesAt:asc',
			'closesAt:desc'
		)
$$;

CREATE FUNCTION search_v1_migration_is_legacy_sort(input jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
	SELECT jsonb_typeof(input) = 'object'
		AND input ?& ARRAY['default', 'options']
		AND (
			SELECT count(*) = 2
			FROM jsonb_object_keys(input)
		)
		AND jsonb_typeof(input -> 'default') = 'string'
		AND jsonb_typeof(input -> 'options') = 'array'
		AND jsonb_array_length(input -> 'options') BETWEEN 1 AND 13
		AND NOT EXISTS (
			SELECT 1
			FROM jsonb_array_elements(input -> 'options') AS option(value)
			WHERE NOT search_v1_migration_is_sort_option(option.value)
		)
		AND (
			SELECT count(*) = count(DISTINCT option.value)
			FROM jsonb_array_elements(input -> 'options') AS option(value)
		)
		AND EXISTS (
			SELECT 1
			FROM jsonb_array_elements(input -> 'options') AS option(value)
			WHERE option.value = input -> 'default'
		)
$$;

CREATE FUNCTION search_v1_migration_is_current_sort_configuration(
	input jsonb,
	allow_relevance boolean
) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
	SELECT jsonb_typeof(input) = 'object'
		AND input ?& ARRAY['defaults', 'options']
		AND (
			SELECT count(*) = 2
			FROM jsonb_object_keys(input)
		)
		AND jsonb_typeof(input -> 'defaults') = 'object'
		AND (input -> 'defaults') ?& ARRAY['emptyQuery', 'textQuery']
		AND (
			SELECT count(*) = 2
			FROM jsonb_object_keys(input -> 'defaults')
		)
		AND jsonb_typeof(input #> '{defaults,emptyQuery}') = 'string'
		AND jsonb_typeof(input #> '{defaults,textQuery}') = 'string'
		AND jsonb_typeof(input -> 'options') = 'array'
		AND jsonb_array_length(input -> 'options') BETWEEN 1 AND 14
		AND NOT EXISTS (
			SELECT 1
			FROM jsonb_array_elements(input -> 'options') AS option(value)
			WHERE NOT search_v1_migration_is_sort_option(option.value)
		)
		AND (
			SELECT count(*) = count(DISTINCT option.value)
			FROM jsonb_array_elements(input -> 'options') AS option(value)
		)
		AND EXISTS (
			SELECT 1
			FROM jsonb_array_elements(input -> 'options') AS option(value)
			WHERE option.value = input #> '{defaults,emptyQuery}'
		)
		AND EXISTS (
			SELECT 1
			FROM jsonb_array_elements(input -> 'options') AS option(value)
			WHERE option.value = input #> '{defaults,textQuery}'
		)
		AND input #>> '{defaults,emptyQuery}' <> 'relevance'
		AND (
			allow_relevance
			OR NOT (input -> 'options') @> '["relevance"]'::jsonb
		)
$$;

CREATE FUNCTION search_v1_migration_is_current_sort(input jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
	SELECT jsonb_typeof(input) = 'object'
		AND input ?& ARRAY['search', 'feed']
		AND (
			SELECT count(*) = 2
			FROM jsonb_object_keys(input)
		)
		AND search_v1_migration_is_current_sort_configuration(input -> 'search', true)
		AND search_v1_migration_is_current_sort_configuration(input -> 'feed', false)
$$;

CREATE FUNCTION search_v1_migration_surface_sort(input jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT AS $$
	SELECT jsonb_build_object(
		'search',
		jsonb_build_object(
			'defaults',
			jsonb_build_object(
				'emptyQuery',
				'best',
				'textQuery',
				input -> 'default'
			),
			'options',
			options.search
		),
		'feed',
		jsonb_build_object(
			'defaults',
			jsonb_build_object(
				'emptyQuery',
				'best',
				'textQuery',
				'best'
			),
			'options',
			options.feed
		)
	)
	FROM (
		SELECT
			jsonb_build_array('best') || coalesce(
				jsonb_agg(option.value ORDER BY option.ordinality)
					FILTER (WHERE option.value <> '"best"'::jsonb),
				'[]'::jsonb
			) AS search,
			jsonb_build_array('best') || coalesce(
				jsonb_agg(option.value ORDER BY option.ordinality)
					FILTER (WHERE option.value NOT IN ('"best"'::jsonb, '"relevance"'::jsonb)),
				'[]'::jsonb
			) AS feed
		FROM jsonb_array_elements(input -> 'options') WITH ORDINALITY AS option(value, ordinality)
	) AS options
$$;

CREATE FUNCTION search_v1_migration_canonical_jsonb(value jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
	canonical text;
BEGIN
	CASE jsonb_typeof(value)
		WHEN 'array' THEN
			SELECT '[' || coalesce(
				string_agg(
					search_v1_migration_canonical_jsonb(element.value),
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
						search_v1_migration_canonical_jsonb(entry.value),
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

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM search_document
		WHERE document -> 'version' IS DISTINCT FROM '1'::jsonb
			OR (
				search_v1_migration_is_legacy_sort(document -> 'sort')
				OR search_v1_migration_is_current_sort(document -> 'sort')
			) IS NOT TRUE
	) THEN
		RAISE EXCEPTION 'Search document v1 contains an unknown sort contract';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM revision_content
		WHERE model = 'rezics.search-document.v1'
			AND (
				encoding <> 'full'
				OR payload -> 'version' IS DISTINCT FROM '1'::jsonb
				OR payload -> 'document' -> 'version' IS DISTINCT FROM '1'::jsonb
				OR (
					search_v1_migration_is_legacy_sort(payload #> '{document,sort}')
					OR search_v1_migration_is_current_sort(payload #> '{document,sort}')
				) IS NOT TRUE
			)
	) THEN
		RAISE EXCEPTION 'Search document history v1 contains an unknown checkpoint contract';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM shared_search_query
		WHERE jsonb_typeof(document -> 'state') IS DISTINCT FROM 'object'
			OR (
				(document -> 'state') ? 'query'
				AND (
					jsonb_typeof(document #> '{state,query}') <> 'string'
					OR (document -> 'state') ? 'filter'
				)
			)
	) THEN
		RAISE EXCEPTION 'Shared Search query v1 contains an unknown state contract';
	END IF;
END
$$;

CREATE TEMP TABLE search_document_v1_content_migration (
	previous_content_id uuid PRIMARY KEY,
	payload jsonb NOT NULL,
	sha256 text NOT NULL,
	byte_size integer NOT NULL,
	next_content_id uuid
);

INSERT INTO search_document_v1_content_migration (
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
		search_v1_migration_canonical_jsonb(migrated.payload) AS canonical
	FROM revision_content AS content
	CROSS JOIN LATERAL (
		SELECT jsonb_set(
			content.payload,
			'{document,sort}',
			search_v1_migration_surface_sort(content.payload #> '{document,sort}'),
			false
		) AS payload
	) AS migrated
	WHERE content.model = 'rezics.search-document.v1'
		AND search_v1_migration_is_legacy_sort(content.payload #> '{document,sort}')
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
FROM search_document_v1_content_migration AS migration
ON CONFLICT (model, sha256) DO NOTHING;

UPDATE search_document_v1_content_migration AS migration
SET next_content_id = content.id
FROM revision_content AS content
WHERE content.model = 'rezics.search-document.v1'
	AND content.sha256 = migration.sha256;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM search_document_v1_content_migration
		WHERE next_content_id IS NULL
	) THEN
		RAISE EXCEPTION 'Search document history migration did not resolve transformed content';
	END IF;
END
$$;

UPDATE search_document_revision AS revision
SET content_id = migration.next_content_id
FROM search_document_v1_content_migration AS migration
WHERE revision.content_id = migration.previous_content_id;

DROP TRIGGER revision_content_immutable ON revision_content;

DELETE FROM revision_content AS content
USING search_document_v1_content_migration AS migration
WHERE content.id = migration.previous_content_id;

CREATE TRIGGER revision_content_immutable
	BEFORE UPDATE OR DELETE ON revision_content
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();

UPDATE search_document
SET document = jsonb_set(
	document,
	'{sort}',
	search_v1_migration_surface_sort(document -> 'sort'),
	false
)
WHERE search_v1_migration_is_legacy_sort(document -> 'sort');

UPDATE shared_search_query
SET document = CASE
	WHEN btrim(document #>> '{state,query}') = '' THEN
		document #- '{state,query}'
	ELSE
		jsonb_set(
			document #- '{state,query}',
			'{state,filter}',
			jsonb_build_object(
				'search',
				jsonb_build_object('query', document #> '{state,query}')
			),
			true
		)
END
WHERE (document -> 'state') ? 'query';

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM search_document
		WHERE search_v1_migration_is_current_sort(document -> 'sort') IS NOT TRUE
	) THEN
		RAISE EXCEPTION 'Search document v1 sort migration is incomplete';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM revision_content
		WHERE model = 'rezics.search-document.v1'
			AND (
				search_v1_migration_is_current_sort(payload #> '{document,sort}') IS NOT TRUE
				OR sha256 <> encode(
					sha256(convert_to(search_v1_migration_canonical_jsonb(payload), 'UTF8')),
					'hex'
				)
				OR byte_size <> octet_length(search_v1_migration_canonical_jsonb(payload))
			)
	) THEN
		RAISE EXCEPTION 'Search document history v1 migration is incomplete';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM shared_search_query
		WHERE (document -> 'state') ? 'query'
	) THEN
		RAISE EXCEPTION 'Shared Search query v1 migration is incomplete';
	END IF;
END
$$;

DROP TABLE search_document_v1_content_migration;
DROP FUNCTION search_v1_migration_canonical_jsonb(jsonb);
DROP FUNCTION search_v1_migration_surface_sort(jsonb);
DROP FUNCTION search_v1_migration_is_current_sort(jsonb);
DROP FUNCTION search_v1_migration_is_current_sort_configuration(jsonb, boolean);
DROP FUNCTION search_v1_migration_is_legacy_sort(jsonb);
DROP FUNCTION search_v1_migration_is_sort_option(jsonb);
