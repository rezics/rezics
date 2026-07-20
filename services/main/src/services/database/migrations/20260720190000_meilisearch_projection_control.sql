CREATE TYPE "search_projection_kind" AS ENUM ('current', 'history');
CREATE TYPE "search_index_generation_state" AS ENUM ('declared', 'building', 'catching_up', 'verified', 'active', 'retired', 'failed');

CREATE TABLE "search_unit_projection_source" (
	"unit_id" uuid PRIMARY KEY,
	"revision" bigint DEFAULT 1 NOT NULL,
	"touched_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_unit_projection_source_revision_check" CHECK ("revision" > 0)
);
CREATE INDEX "search_unit_projection_source_touched_at_idx" ON "search_unit_projection_source" ("touched_at", "unit_id");

CREATE TABLE "search_revision_projection_source" (
	"revision_id" uuid PRIMARY KEY,
	"revision" bigint DEFAULT 1 NOT NULL,
	"touched_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_revision_projection_source_revision_check" CHECK ("revision" > 0)
);
CREATE INDEX "search_revision_projection_source_touched_at_idx" ON "search_revision_projection_source" ("touched_at", "revision_id");

CREATE TABLE "search_index_generation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"projection_kind" "search_projection_kind" NOT NULL,
	"index_uid" text NOT NULL,
	"projection_version" integer NOT NULL,
	"settings_fingerprint" text NOT NULL,
	"sequin_sink_name" text NOT NULL,
	"state" "search_index_generation_state" DEFAULT 'declared' NOT NULL,
	"source_watermark_lsn" pg_lsn,
	"source_watermark_at" timestamp (3) with time zone,
	"last_verified_lsn" pg_lsn,
	"verified_at" timestamp (3) with time zone,
	"activated_at" timestamp (3) with time zone,
	"failure" text,
	CONSTRAINT "search_index_generation_projection_version_check" CHECK ("projection_version" > 0),
	CONSTRAINT "search_index_generation_index_uid_check" CHECK ("index_uid" ~ '^rezics_(units|revisions)_v[1-9][0-9]*_[0-9]{8}$'),
	CONSTRAINT "search_index_generation_settings_fingerprint_check" CHECK ("settings_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "search_index_generation_state_metadata_check" CHECK (("state" not in ('verified', 'active') or ("verified_at" is not null and "last_verified_lsn" is not null)) and ("state" <> 'active' or "activated_at" is not null) and ("state" <> 'failed' or "failure" is not null))
);
CREATE UNIQUE INDEX "search_index_generation_index_uid_key" ON "search_index_generation" ("index_uid");
CREATE UNIQUE INDEX "search_index_generation_sequin_sink_name_key" ON "search_index_generation" ("sequin_sink_name");
CREATE UNIQUE INDEX "search_index_generation_active_projection_key" ON "search_index_generation" ("projection_kind") WHERE "state" = 'active';
CREATE INDEX "search_index_generation_projection_state_idx" ON "search_index_generation" ("projection_kind", "state");

CREATE FUNCTION touch_search_unit_projection(unit_ids uuid[]) RETURNS void
LANGUAGE sql AS $$
	INSERT INTO public.search_unit_projection_source (unit_id, revision, touched_at)
	SELECT DISTINCT unit_id, 1, clock_timestamp()
	FROM unnest(unit_ids) AS source(unit_id)
	WHERE unit_id IS NOT NULL
	ON CONFLICT (unit_id) DO UPDATE
	SET revision = search_unit_projection_source.revision + 1,
		touched_at = excluded.touched_at
$$;

CREATE FUNCTION touch_search_revision_projection(revision_ids uuid[]) RETURNS void
LANGUAGE sql AS $$
	INSERT INTO public.search_revision_projection_source (revision_id, revision, touched_at)
	SELECT DISTINCT revision_id, 1, clock_timestamp()
	FROM unnest(revision_ids) AS source(revision_id)
	WHERE revision_id IS NOT NULL
	ON CONFLICT (revision_id) DO UPDATE
	SET revision = search_revision_projection_source.revision + 1,
		touched_at = excluded.touched_at
$$;

CREATE FUNCTION search_transition_keys(changed_rows jsonb[], key_names text[]) RETURNS uuid[]
LANGUAGE plpgsql AS $$
DECLARE
	keys uuid[];
BEGIN
	EXECUTE $query$
		SELECT coalesce(array_agg(DISTINCT (row_data ->> key_name)::uuid), ARRAY[]::uuid[])
		FROM unnest($1) AS changed_row(row_data)
		CROSS JOIN unnest($2) AS requested_key(key_name)
		WHERE nullif(row_data ->> key_name, '') IS NOT NULL
	$query$ INTO keys USING changed_rows, key_names;
	RETURN keys;
END
$$;

CREATE FUNCTION search_touch_current_statement() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	keys uuid[];
	changed_rows jsonb[];
BEGIN
	IF TG_OP = 'INSERT' THEN
		SELECT array_agg(to_jsonb(row_value)) INTO changed_rows FROM new_rows AS row_value;
	ELSIF TG_OP = 'DELETE' THEN
		SELECT array_agg(to_jsonb(row_value)) INTO changed_rows FROM old_rows AS row_value;
	ELSE
		SELECT array_agg(row_data) INTO changed_rows FROM (
			SELECT to_jsonb(row_value) AS row_data FROM old_rows AS row_value
			UNION ALL SELECT to_jsonb(row_value) AS row_data FROM new_rows AS row_value
		) AS combined;
	END IF;
	keys := search_transition_keys(coalesce(changed_rows, ARRAY[]::jsonb[]), TG_ARGV);
	PERFORM touch_search_unit_projection(keys);
	RETURN NULL;
END
$$;

CREATE FUNCTION search_touch_revision_statement() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	keys uuid[];
	changed_rows jsonb[];
BEGIN
	IF TG_OP = 'INSERT' THEN
		SELECT array_agg(to_jsonb(row_value)) INTO changed_rows FROM new_rows AS row_value;
	ELSIF TG_OP = 'DELETE' THEN
		SELECT array_agg(to_jsonb(row_value)) INTO changed_rows FROM old_rows AS row_value;
	ELSE
		SELECT array_agg(row_data) INTO changed_rows FROM (
			SELECT to_jsonb(row_value) AS row_data FROM old_rows AS row_value
			UNION ALL SELECT to_jsonb(row_value) AS row_data FROM new_rows AS row_value
		) AS combined;
	END IF;
	keys := search_transition_keys(coalesce(changed_rows, ARRAY[]::jsonb[]), TG_ARGV);
	PERFORM touch_search_revision_projection(keys);
	RETURN NULL;
END
$$;

CREATE FUNCTION search_touch_alias_owner_statement() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	alias_ids uuid[];
	unit_ids uuid[];
BEGIN
	IF TG_OP = 'INSERT' THEN
		SELECT array_agg(alias_id) INTO alias_ids FROM new_rows;
	ELSIF TG_OP = 'DELETE' THEN
		SELECT array_agg(alias_id) INTO alias_ids FROM old_rows;
	ELSE
		SELECT array_agg(alias_id) INTO alias_ids FROM (
			SELECT alias_id FROM old_rows UNION SELECT alias_id FROM new_rows
		) AS changed_aliases;
	END IF;
	SELECT array_agg(DISTINCT unit_id) INTO unit_ids
	FROM public.unit_alias WHERE id = ANY(coalesce(alias_ids, ARRAY[]::uuid[]));
	PERFORM touch_search_unit_projection(coalesce(unit_ids, ARRAY[]::uuid[]));
	RETURN NULL;
END
$$;

CREATE FUNCTION search_document_text_v1(document jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
	SELECT btrim(regexp_replace(coalesce(string_agg(child ->> 'text', ' ' ORDER BY block.ordinality, child_row.ordinality), ''), '\s+', ' ', 'g'))
	FROM jsonb_array_elements(
		CASE
			WHEN jsonb_typeof(document) = 'object' AND document ->> '_type' = 'portable-text'
				THEN coalesce(document -> 'content', '[]'::jsonb)
			WHEN jsonb_typeof(document) = 'array' THEN document
			ELSE '[]'::jsonb
		END
	) WITH ORDINALITY AS block(value, ordinality)
	CROSS JOIN LATERAL jsonb_array_elements(
		CASE WHEN block.value ->> '_type' = 'block' THEN coalesce(block.value -> 'children', '[]'::jsonb) ELSE '[]'::jsonb END
	) WITH ORDINALITY AS child_row(child, ordinality)
	WHERE child ->> '_type' = 'span' AND jsonb_typeof(child -> 'text') = 'string'
$$;

DO $$
DECLARE
	source record;
BEGIN
	FOR source IN SELECT * FROM (VALUES
		('unit', ARRAY['id']),
		('unit_localization', ARRAY['unit_id']),
		('unit_alias', ARRAY['unit_id']),
		('unit_tag', ARRAY['unit_id']),
		('realm_unit', ARRAY['unit_id']),
		('unit_status_event', ARRAY['unit_id']),
		('content_structure_node', ARRAY['owner_unit_id', 'content_unit_id']),
		('unit_variant', ARRAY['variant_unit_id', 'main_unit_id']),
		('profile', ARRAY['id']),
		('entity', ARRAY['id']),
		('post', ARRAY['id']),
		('post_reply', ARRAY['post_id']),
		('post_reply_stat', ARRAY['post_id']),
		('realm', ARRAY['id']),
		('collection', ARRAY['id']),
		('poll', ARRAY['id']),
		('unit_follow_stat', ARRAY['unit_id']),
		('book', ARRAY['id']),
		('media', ARRAY['id']),
		('software', ARRAY['id']),
		('software_requirement', ARRAY['software_id']),
		('release', ARRAY['id']),
		('series', ARRAY['id']),
		('series_release', ARRAY['series_id', 'release_unit_id']),
		('unit_access_binding', ARRAY['unit_id']),
		('unit_access_restriction', ARRAY['unit_id'])
	) AS registry(table_name, key_columns)
	LOOP
		EXECUTE format(
			'CREATE TRIGGER %I AFTER INSERT ON public.%I REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_current_statement(%s)',
			'search_projection_touch_' || source.table_name || '_insert',
			source.table_name,
			(SELECT string_agg(quote_literal(column_name), ', ') FROM unnest(source.key_columns) AS columns(column_name))
		);
		EXECUTE format(
			'CREATE TRIGGER %I AFTER UPDATE ON public.%I REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_current_statement(%s)',
			'search_projection_touch_' || source.table_name || '_update', source.table_name,
			(SELECT string_agg(quote_literal(column_name), ', ') FROM unnest(source.key_columns) AS columns(column_name))
		);
		EXECUTE format(
			'CREATE TRIGGER %I AFTER DELETE ON public.%I REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_current_statement(%s)',
			'search_projection_touch_' || source.table_name || '_delete', source.table_name,
			(SELECT string_agg(quote_literal(column_name), ', ') FROM unnest(source.key_columns) AS columns(column_name))
		);
	END LOOP;
END
$$;

DO $$
DECLARE
	source record;
BEGIN
	FOR source IN SELECT * FROM (VALUES
		('unit_alias_vote'), ('unit_alias_vote_stat')
	) AS registry(table_name)
	LOOP
		EXECUTE format('CREATE TRIGGER %I AFTER INSERT ON public.%I REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_alias_owner_statement()', 'search_projection_touch_' || source.table_name || '_insert', source.table_name);
		EXECUTE format('CREATE TRIGGER %I AFTER UPDATE ON public.%I REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_alias_owner_statement()', 'search_projection_touch_' || source.table_name || '_update', source.table_name);
		EXECUTE format('CREATE TRIGGER %I AFTER DELETE ON public.%I REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_alias_owner_statement()', 'search_projection_touch_' || source.table_name || '_delete', source.table_name);
	END LOOP;

	FOR source IN SELECT * FROM (VALUES
		('unit_revision', ARRAY['id']),
		('unit_revision_slot', ARRAY['revision_id']),
		('unit_revision_tag', ARRAY['revision_id'])
	) AS registry(table_name, key_columns)
	LOOP
		EXECUTE format('CREATE TRIGGER %I AFTER INSERT ON public.%I REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_revision_statement(%s)', 'search_revision_projection_touch_' || source.table_name || '_insert', source.table_name, (SELECT string_agg(quote_literal(column_name), ', ') FROM unnest(source.key_columns) AS columns(column_name)));
		EXECUTE format('CREATE TRIGGER %I AFTER UPDATE ON public.%I REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_revision_statement(%s)', 'search_revision_projection_touch_' || source.table_name || '_update', source.table_name, (SELECT string_agg(quote_literal(column_name), ', ') FROM unnest(source.key_columns) AS columns(column_name)));
		EXECUTE format('CREATE TRIGGER %I AFTER DELETE ON public.%I REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION search_touch_revision_statement(%s)', 'search_revision_projection_touch_' || source.table_name || '_delete', source.table_name, (SELECT string_agg(quote_literal(column_name), ', ') FROM unnest(source.key_columns) AS columns(column_name)));
	END LOOP;
END
$$;

INSERT INTO search_unit_projection_source (unit_id)
SELECT id FROM unit
ON CONFLICT (unit_id) DO NOTHING;
INSERT INTO search_revision_projection_source (revision_id)
SELECT id FROM unit_revision
ON CONFLICT (revision_id) DO NOTHING;

CREATE PUBLICATION rezics_search_projection_publication
	FOR TABLE search_unit_projection_source, search_revision_projection_source;
