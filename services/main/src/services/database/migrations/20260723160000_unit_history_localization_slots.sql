DROP TRIGGER unit_revision_slot_immutable ON unit_revision_slot;
DROP TRIGGER revision_content_immutable ON revision_content;
DROP TRIGGER unit_revision_identity_immutable ON unit_revision;

ALTER TABLE unit_revision_slot ADD COLUMN slot_key text;
UPDATE unit_revision_slot SET slot_key = '' WHERE role <> 'localizations';

CREATE FUNCTION unit_history_migration_canonical_jsonb(value jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
	canonical text;
BEGIN
	CASE jsonb_typeof(value)
		WHEN 'array' THEN
			SELECT '[' || coalesce(
				string_agg(
					unit_history_migration_canonical_jsonb(element.value),
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
						unit_history_migration_canonical_jsonb(entry.value),
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

CREATE TEMP TABLE unit_history_localization_slot_migration (
	revision_id uuid NOT NULL,
	unit_id uuid NOT NULL,
	language text NOT NULL,
	parent_revision_id uuid,
	source_revision_id uuid,
	revision_created_at timestamptz(3) NOT NULL,
	payload jsonb NOT NULL,
	sha256 text NOT NULL,
	byte_size integer NOT NULL,
	content_id uuid,
	origin_revision_id uuid,
	PRIMARY KEY (revision_id, language)
);

INSERT INTO unit_history_localization_slot_migration (
	revision_id,
	unit_id,
	language,
	parent_revision_id,
	source_revision_id,
	revision_created_at,
	payload,
	sha256,
	byte_size
)
SELECT
	source.revision_id,
	source.unit_id,
	source.localization ->> 'language',
	source.parent_revision_id,
	source.source_revision_id,
	source.revision_created_at,
	source.payload,
	encode(sha256(convert_to(source.canonical, 'UTF8')), 'hex'),
	octet_length(source.canonical)
FROM (
	SELECT
		slot.revision_id,
		slot.unit_id,
		revision.parent_revision_id,
		source_revision.source_revision_id,
		revision.created_at AS revision_created_at,
		item.localization,
		jsonb_build_object(
			'version', 1,
			'localization', item.localization
		) AS payload,
		unit_history_migration_canonical_jsonb(
			jsonb_build_object(
				'version', 1,
				'localization', item.localization
			)
		) AS canonical
	FROM unit_revision_slot AS slot
	JOIN unit_revision AS revision ON revision.id = slot.revision_id
	JOIN revision_content AS content ON content.id = slot.content_id
	CROSS JOIN LATERAL jsonb_array_elements(content.payload -> 'items')
		AS item(localization)
	LEFT JOIN LATERAL (
		SELECT (tag.metadata ->> 'sourceRevisionId')::uuid AS source_revision_id
		FROM unit_revision_tag AS tag
		WHERE tag.revision_id = slot.revision_id
			AND tag.metadata ? 'sourceRevisionId'
		ORDER BY tag.tag
		LIMIT 1
	) AS source_revision ON true
	WHERE slot.role = 'localizations'
) AS source;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM unit_history_localization_slot_migration
		WHERE language NOT IN ('zh', 'en')
	) THEN
		RAISE EXCEPTION 'Unit History contains an unsupported localization language';
	END IF;
END
$$;

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
	'rezics.unit.localization.v1',
	migration.sha256,
	migration.byte_size,
	'full',
	NULL,
	0,
	migration.payload
FROM unit_history_localization_slot_migration AS migration
ON CONFLICT (model, sha256) DO NOTHING;

UPDATE unit_history_localization_slot_migration AS migration
SET content_id = content.id
FROM revision_content AS content
WHERE content.model = 'rezics.unit.localization.v1'
	AND content.sha256 = migration.sha256;

DO $$
DECLARE
	item record;
	parent_content_id uuid;
	parent_origin_revision_id uuid;
	source_content_id uuid;
	source_origin_revision_id uuid;
BEGIN
	FOR item IN
		SELECT *
		FROM unit_history_localization_slot_migration
		ORDER BY unit_id, revision_created_at, revision_id, language
	LOOP
		parent_content_id := NULL;
		parent_origin_revision_id := NULL;
		source_content_id := NULL;
		source_origin_revision_id := NULL;

		SELECT content_id, origin_revision_id
		INTO parent_content_id, parent_origin_revision_id
		FROM unit_history_localization_slot_migration
		WHERE revision_id = item.parent_revision_id
			AND language = item.language;

		SELECT content_id, origin_revision_id
		INTO source_content_id, source_origin_revision_id
		FROM unit_history_localization_slot_migration
		WHERE revision_id = item.source_revision_id
			AND language = item.language;

		UPDATE unit_history_localization_slot_migration
		SET origin_revision_id = CASE
			WHEN parent_content_id = item.content_id
				AND parent_origin_revision_id IS NOT NULL
				THEN parent_origin_revision_id
			WHEN source_content_id = item.content_id
				AND source_origin_revision_id IS NOT NULL
				THEN source_origin_revision_id
			ELSE item.revision_id
		END
		WHERE revision_id = item.revision_id
			AND language = item.language;
	END LOOP;

	IF EXISTS (
		SELECT 1
		FROM unit_history_localization_slot_migration
		WHERE content_id IS NULL OR origin_revision_id IS NULL
	) THEN
		RAISE EXCEPTION 'Unit History localization migration did not resolve content provenance';
	END IF;
END
$$;

DELETE FROM unit_revision_slot WHERE role = 'localizations';
DELETE FROM revision_content WHERE model = 'rezics.unit.localizations.v1';

ALTER TABLE unit_revision_slot DROP CONSTRAINT unit_revision_slot_pkey;
ALTER TYPE unit_revision_slot_role RENAME TO unit_revision_slot_role_old;
CREATE TYPE unit_revision_slot_role AS ENUM (
	'main',
	'localization',
	'relations',
	'structure',
	'rules'
);
ALTER TABLE unit_revision_slot
	ALTER COLUMN role TYPE unit_revision_slot_role
	USING role::text::unit_revision_slot_role;
DROP TYPE unit_revision_slot_role_old;

INSERT INTO unit_revision_slot (
	revision_id,
	unit_id,
	role,
	slot_key,
	content_id,
	origin_revision_id
)
SELECT
	revision_id,
	unit_id,
	'localization',
	language,
	content_id,
	origin_revision_id
FROM unit_history_localization_slot_migration;

ALTER TABLE unit_revision_slot ALTER COLUMN slot_key SET NOT NULL;
ALTER TABLE unit_revision_slot
	ADD CONSTRAINT unit_revision_slot_pkey
	PRIMARY KEY (revision_id, role, slot_key);
ALTER TABLE unit_revision_slot
	ADD CONSTRAINT unit_revision_slot_key_shape_check CHECK (
		(
			role = 'localization'
			AND slot_key IN ('zh', 'en')
		) OR (
			role <> 'localization'
			AND slot_key = ''
		)
	);

UPDATE unit_revision AS revision
SET byte_size = content_size.byte_size
FROM (
	SELECT slot.revision_id, sum(content.byte_size)::integer AS byte_size
	FROM unit_revision_slot AS slot
	JOIN revision_content AS content ON content.id = slot.content_id
	GROUP BY slot.revision_id
) AS content_size
WHERE revision.id = content_size.revision_id;

CREATE TRIGGER revision_content_immutable
	BEFORE UPDATE OR DELETE ON revision_content
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();
CREATE TRIGGER unit_revision_slot_immutable
	BEFORE UPDATE OR DELETE ON unit_revision_slot
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();
CREATE TRIGGER unit_revision_identity_immutable
	BEFORE UPDATE ON unit_revision
	FOR EACH ROW EXECUTE FUNCTION protect_unit_revision_identity();

DROP TABLE unit_history_localization_slot_migration;
DROP FUNCTION unit_history_migration_canonical_jsonb(jsonb);
