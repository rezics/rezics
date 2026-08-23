-- Metadata-first judgment cutover. The affected API write paths must be paused before this stage.
-- The preceding index-only stage leaves legacy contracts live; this stage is transactional.

CREATE TEMP TABLE vndb_v11_prebuilt_index_guard (
	index_name text PRIMARY KEY,
	exact_and_valid boolean NOT NULL,
	CONSTRAINT vndb_v11_prebuilt_index_exact_and_valid CHECK (exact_and_valid)
) ON COMMIT DROP;

INSERT INTO vndb_v11_prebuilt_index_guard (index_name, exact_and_valid)
SELECT
	required.index_name,
	index_relation.oid IS NOT NULL
		AND table_schema.nspname IS NOT DISTINCT FROM 'public'
		AND table_relation.relname IS NOT DISTINCT FROM required.table_name
		AND access_method.amname IS NOT DISTINCT FROM 'btree'
		AND index_state.indisunique IS NOT DISTINCT FROM false
		AND index_state.indisexclusion IS NOT DISTINCT FROM false
		AND index_state.indnkeyatts IS NOT DISTINCT FROM cardinality(required.key_columns)
		AND index_state.indnatts IS NOT DISTINCT FROM cardinality(required.key_columns)
		AND index_state.indexprs IS NULL
		AND pg_catalog.pg_get_expr(index_state.indpred, index_state.indrelid)
			IS NOT DISTINCT FROM required.predicate
		AND actual.key_columns IS NOT DISTINCT FROM required.key_columns
		AND NOT EXISTS (
			SELECT 1
			FROM unnest(index_state.indoption::smallint[]) AS option(value)
			WHERE option.value <> 0
		)
		AND index_state.indisvalid IS NOT DISTINCT FROM true
		AND index_state.indisready IS NOT DISTINCT FROM true
		AND index_state.indislive IS NOT DISTINCT FROM true
FROM (VALUES
	(
		'unit_tag_judgment_tag_unit_idx',
		'unit_tag_vote',
		ARRAY['tag_id', 'unit_id']::text[],
		NULL::text
	),
	(
		'unit_tag_judgment_profile_unit_tag_idx',
		'unit_tag_vote',
		ARRAY['profile_id', 'unit_id', 'tag_id']::text[],
		NULL::text
	),
	(
		'unit_structure_application_judgment_profile_idx',
		'unit_structure_application_vote',
		ARRAY['profile_id', 'unit_id', 'structure_id']::text[],
		NULL::text
	),
	(
		'unit_structure_application_judgment_structure_idx',
		'unit_structure_application_vote',
		ARRAY['structure_id', 'unit_id', 'profile_id']::text[],
		NULL::text
	),
	(
		'unit_structure_application_judgment_positive_structure_idx',
		'unit_structure_application_vote',
		ARRAY['structure_id', 'unit_id', 'profile_id']::text[],
		'(value = 1)'
	),
	(
		'realm_tag_judgment_profile_route_idx',
		'realm_tag_vote',
		ARRAY['profile_id', 'realm_id', 'unit_id', 'tag_id']::text[],
		NULL::text
	),
	(
		'realm_tag_judgment_tag_route_idx',
		'realm_tag_vote',
		ARRAY['tag_id', 'realm_id', 'unit_id', 'profile_id']::text[],
		NULL::text
	),
	(
		'realm_tag_judgment_stat_unit_realm_tag_idx',
		'realm_tag_vote_stat',
		ARRAY['unit_id', 'realm_id', 'tag_id']::text[],
		NULL::text
	),
	(
		'realm_tag_judgment_stat_tag_realm_unit_idx',
		'realm_tag_vote_stat',
		ARRAY['tag_id', 'realm_id', 'unit_id']::text[],
		NULL::text
	),
	(
		'realm_unit_tag_tag_route_idx',
		'realm_unit_tag',
		ARRAY['tag_id', 'realm_id', 'unit_id']::text[],
		NULL::text
	)
) AS required(index_name, table_name, key_columns, predicate)
LEFT JOIN pg_catalog.pg_namespace AS index_schema
	ON index_schema.nspname = 'public'
LEFT JOIN pg_catalog.pg_class AS index_relation
	ON index_relation.relnamespace = index_schema.oid
	AND index_relation.relname = required.index_name
	AND index_relation.relkind = 'i'
LEFT JOIN pg_catalog.pg_index AS index_state
	ON index_state.indexrelid = index_relation.oid
LEFT JOIN pg_catalog.pg_class AS table_relation
	ON table_relation.oid = index_state.indrelid
LEFT JOIN pg_catalog.pg_namespace AS table_schema
	ON table_schema.oid = table_relation.relnamespace
LEFT JOIN pg_catalog.pg_am AS access_method
	ON access_method.oid = index_relation.relam
LEFT JOIN LATERAL (
	SELECT array_agg(attribute.attname::text ORDER BY key_column.ordinality) AS key_columns
	FROM unnest(index_state.indkey::smallint[]) WITH ORDINALITY
		AS key_column(attribute_number, ordinality)
	JOIN pg_catalog.pg_attribute AS attribute
		ON attribute.attrelid = table_relation.oid
		AND attribute.attnum = key_column.attribute_number
	WHERE key_column.ordinality <= index_state.indnkeyatts
) AS actual ON true;

DROP TABLE pg_temp.vndb_v11_prebuilt_index_guard;

CREATE TEMP TABLE vndb_v11_path_prebuilt_index_guard (
	index_name text PRIMARY KEY,
	exact_and_valid boolean NOT NULL,
	CONSTRAINT vndb_v11_path_prebuilt_index_exact_and_valid CHECK (exact_and_valid)
) ON COMMIT DROP;

INSERT INTO vndb_v11_path_prebuilt_index_guard (index_name, exact_and_valid)
SELECT
	required.index_name,
	index_relation.oid IS NOT NULL
		AND table_schema.nspname IS NOT DISTINCT FROM 'public'
		AND table_relation.relname IS NOT DISTINCT FROM required.table_name
		AND access_method.amname IS NOT DISTINCT FROM 'btree'
		AND index_state.indisunique IS NOT DISTINCT FROM required.is_unique
		AND index_state.indisexclusion IS NOT DISTINCT FROM false
		AND index_state.indnkeyatts IS NOT DISTINCT FROM cardinality(required.key_shape)
		AND index_state.indnatts IS NOT DISTINCT FROM cardinality(required.key_shape)
		AND actual.key_shape IS NOT DISTINCT FROM required.key_shape
		AND (
			(required.has_shard_expression AND coalesce(
				pg_catalog.regexp_replace(
					pg_catalog.replace(
						pg_catalog.pg_get_expr(index_state.indexprs, index_state.indrelid),
						'pg_catalog.',
						''
					),
					'\s+',
					'',
					'g'
				),
				''
			) = 'get_byte(uuid_send(unit_id),15)')
			OR (NOT required.has_shard_expression AND index_state.indexprs IS NULL)
		)
		AND pg_catalog.regexp_replace(
			coalesce(pg_catalog.pg_get_expr(index_state.indpred, index_state.indrelid), ''),
			'\s+',
			'',
			'g'
		) IS NOT DISTINCT FROM coalesce(required.predicate, '')
		AND NOT EXISTS (
			SELECT 1
			FROM unnest(index_state.indoption::smallint[]) AS option(value)
			WHERE option.value <> 0
		)
		AND index_state.indisvalid IS NOT DISTINCT FROM true
		AND index_state.indisready IS NOT DISTINCT FROM true
		AND index_state.indislive IS NOT DISTINCT FROM true
FROM (VALUES
	(
		'unit_structure_application_correction_shard_idx',
		'unit_structure_application',
		false,
		ARRAY['structure_id', '<shard-expression>', 'unit_id']::text[],
		true,
		NULL::text
	),
	(
		'unit_structure_application_judgment_positive_correction_shard_idx',
		'unit_structure_application_vote',
		false,
		ARRAY['structure_id', '<shard-expression>', 'unit_id', 'profile_id']::text[],
		true,
		'(value=1)'
	),
	(
		'unit_tag_structure_support_member_idx',
		'unit_tag_structure_support',
		false,
		ARRAY['structure_id', 'projection_version', 'tag_id', 'unit_id', 'profile_id']::text[],
		false,
		NULL::text
	),
	(
		'unit_tag_structure_support_application_judgment_idx',
		'unit_tag_structure_support',
		false,
		ARRAY['unit_id', 'structure_id', 'profile_id', 'projection_version', 'tag_id']::text[],
		false,
		NULL::text
	),
	(
		'unit_structure_member_projection_pkey_ccnew',
		'unit_structure_member',
		true,
		ARRAY['structure_id', 'projection_version', 'ordinal']::text[],
		false,
		NULL::text
	),
	(
		'unit_structure_member_projection_member_key_ccnew',
		'unit_structure_member',
		true,
		ARRAY['structure_id', 'projection_version', 'member_unit_id']::text[],
		false,
		NULL::text
	),
	(
		'unit_structure_edge_projection_pkey_ccnew',
		'unit_structure_edge',
		true,
		ARRAY['structure_id', 'projection_version', 'ordinal']::text[],
		false,
		NULL::text
	),
	(
		'unit_tag_structure_support_projection_pkey_ccnew',
		'unit_tag_structure_support',
		true,
		ARRAY['unit_id', 'tag_id', 'profile_id', 'structure_id', 'projection_version']::text[],
		false,
		NULL::text
	)
) AS required(index_name, table_name, is_unique, key_shape, has_shard_expression, predicate)
LEFT JOIN pg_catalog.pg_namespace AS index_schema
	ON index_schema.nspname = 'public'
LEFT JOIN pg_catalog.pg_class AS index_relation
	ON index_relation.relnamespace = index_schema.oid
	AND index_relation.relname = required.index_name
	AND index_relation.relkind = 'i'
LEFT JOIN pg_catalog.pg_index AS index_state
	ON index_state.indexrelid = index_relation.oid
LEFT JOIN pg_catalog.pg_class AS table_relation
	ON table_relation.oid = index_state.indrelid
LEFT JOIN pg_catalog.pg_namespace AS table_schema
	ON table_schema.oid = table_relation.relnamespace
LEFT JOIN pg_catalog.pg_am AS access_method
	ON access_method.oid = index_relation.relam
LEFT JOIN LATERAL (
	SELECT array_agg(
		CASE
			WHEN key_column.attribute_number = 0 THEN '<shard-expression>'
			ELSE attribute.attname::text
		END
		ORDER BY key_column.ordinality
	) AS key_shape
	FROM unnest(index_state.indkey::smallint[]) WITH ORDINALITY
		AS key_column(attribute_number, ordinality)
	LEFT JOIN pg_catalog.pg_attribute AS attribute
		ON attribute.attrelid = table_relation.oid
		AND attribute.attnum = key_column.attribute_number
	WHERE key_column.ordinality <= index_state.indnkeyatts
) AS actual ON true;

DROP TABLE pg_temp.vndb_v11_path_prebuilt_index_guard;

CREATE TEMP TABLE vndb_v11_projection_check_guard (
	constraint_name text PRIMARY KEY,
	validated boolean NOT NULL,
	CONSTRAINT vndb_v11_projection_check_validated CHECK (validated)
) ON COMMIT DROP;
INSERT INTO vndb_v11_projection_check_guard (constraint_name, validated)
SELECT
	required.constraint_name,
	coalesce(constraint_state.convalidated, false)
		AND constraint_state.contype = 'c'
		AND table_schema.nspname = 'public'
		AND table_relation.relname = required.table_name
FROM (VALUES
	('unit_structure_active_projection_version_check', 'unit_structure'),
	('unit_structure_member_projection_version_check', 'unit_structure_member'),
	('unit_structure_edge_projection_version_check', 'unit_structure_edge'),
	(
		'unit_tag_structure_support_projection_version_check',
		'unit_tag_structure_support'
	)
) AS required(constraint_name, table_name)
LEFT JOIN pg_catalog.pg_namespace AS table_schema
	ON table_schema.nspname = 'public'
LEFT JOIN pg_catalog.pg_class AS table_relation
	ON table_relation.relnamespace = table_schema.oid
	AND table_relation.relname = required.table_name
	AND table_relation.relkind IN ('r', 'p')
LEFT JOIN pg_catalog.pg_constraint AS constraint_state
	ON constraint_state.conrelid = table_relation.oid
	AND constraint_state.conname = required.constraint_name;
DROP TABLE pg_temp.vndb_v11_projection_check_guard;

-- Nonempty cutovers require this exact session setting after writers are paused and drained:
-- SET rezics.vndb_v11_writers = 'paused-and-drained';
CREATE TEMP TABLE vndb_v11_writer_pause_guard (
	confirmed boolean NOT NULL,
	CONSTRAINT vndb_v11_writers_paused_and_drained CHECK (confirmed)
) ON COMMIT DROP;
INSERT INTO vndb_v11_writer_pause_guard (confirmed)
VALUES (
	EXISTS (
		SELECT 1
		FROM public.vndb_v11_cutover_control AS control
		WHERE control.id = 1
			AND (
				(
					NOT EXISTS (SELECT 1 FROM public.unit LIMIT 1)
					AND control.state IN ('precontract_open', 'paused')
				)
				OR (
					EXISTS (SELECT 1 FROM public.unit LIMIT 1)
					AND control.state = 'paused'
					AND coalesce(current_setting('rezics.vndb_v11_writers', true)
						= 'paused-and-drained', false)
				)
			)
	)
);
DROP TABLE pg_temp.vndb_v11_writer_pause_guard;

CREATE TEMP TABLE vndb_v11_unit_merge_drain_guard (
	confirmed boolean NOT NULL,
	CONSTRAINT vndb_v11_unit_merge_operations_drained CHECK (confirmed)
) ON COMMIT DROP;
INSERT INTO vndb_v11_unit_merge_drain_guard (confirmed)
VALUES (
	NOT EXISTS (
		SELECT 1
		FROM public.unit_merge_operation
		WHERE state IN (
			'pending'::public.unit_merge_operation_state,
			'processing'::public.unit_merge_operation_state,
			'retry_wait'::public.unit_merge_operation_state
		)
		LIMIT 1
	)
);
DROP TABLE pg_temp.vndb_v11_unit_merge_drain_guard;

-- Hold the exclusive fence through the generated schema body and post overlay.
-- This also prevents a fresh empty install from admitting its first legacy write.
SELECT pg_catalog.pg_advisory_xact_lock(71011001::bigint);

-- The online scan and dirty-key drain are sealed before this point. Disable
-- only prepare-phase delta capture under the exclusive fence; the generated
-- Atlas diff removes these prepare-only objects from the final contract.
ALTER TABLE public.unit_structure
	DISABLE TRIGGER vndb_v11_primary_path_structure_maintain;
ALTER TABLE public.unit_structure_vote_stat
	DISABLE TRIGGER unit_structure_vote_stat_primary_path_dirty;
ALTER TABLE public.unit_structure_end
	DISABLE TRIGGER unit_structure_end_primary_path_dirty;

-- Replace version-sensitive arbiters with already-built unique indexes. These
-- are metadata-only operations after every admission/drain guard has passed.
ALTER TABLE public.unit_tag_structure_support
	DROP CONSTRAINT unit_tag_structure_support_application_vote_fkey,
	DROP CONSTRAINT unit_tag_structure_support_member_fkey,
	DROP CONSTRAINT unit_tag_structure_support_pkey;
ALTER TABLE public.unit_structure_member
	DROP CONSTRAINT unit_structure_member_structure_member_key,
	DROP CONSTRAINT unit_structure_member_pkey;
ALTER TABLE public.unit_structure_edge
	DROP CONSTRAINT unit_structure_edge_pkey;

ALTER TABLE public.unit_structure_member
	ADD CONSTRAINT unit_structure_member_pkey PRIMARY KEY
		USING INDEX unit_structure_member_projection_pkey_ccnew,
	ADD CONSTRAINT unit_structure_member_structure_projection_member_key UNIQUE
		USING INDEX unit_structure_member_projection_member_key_ccnew;
ALTER TABLE public.unit_structure_edge
	ADD CONSTRAINT unit_structure_edge_pkey PRIMARY KEY
		USING INDEX unit_structure_edge_projection_pkey_ccnew;
ALTER TABLE public.unit_tag_structure_support
	ADD CONSTRAINT unit_tag_structure_support_pkey PRIMARY KEY
		USING INDEX unit_tag_structure_support_projection_pkey_ccnew,
	ADD CONSTRAINT unit_tag_structure_support_application_judgment_fkey
		FOREIGN KEY (unit_id, structure_id, profile_id)
		REFERENCES public.unit_structure_application_vote (unit_id, structure_id, profile_id)
		ON DELETE CASCADE NOT VALID,
	ADD CONSTRAINT unit_tag_structure_support_member_fkey
		FOREIGN KEY (structure_id, projection_version, tag_id)
		REFERENCES public.unit_structure_member
			(structure_id, projection_version, member_unit_id)
		ON DELETE CASCADE NOT VALID;

ALTER TABLE public.tag ADD COLUMN default_spoiler_level smallint;
ALTER TABLE public.tag
	ADD CONSTRAINT tag_default_spoiler_level_check CHECK (
		default_spoiler_level IS NULL OR default_spoiler_level BETWEEN 0 AND 2
	) NOT VALID;

ALTER TYPE public.unit_merge_operation_phase RENAME VALUE 'realm_tag_votes' TO 'realm_tag_judgments';

DROP TRIGGER IF EXISTS realm_tag_vote_realm_tag_voting_enabled ON public.realm_tag_vote;
DROP TRIGGER IF EXISTS realm_tag_vote_stat_maintain ON public.realm_tag_vote;
DROP TRIGGER IF EXISTS unit_structure_application_vote_stat_maintain ON public.unit_structure_application_vote;
DROP TRIGGER IF EXISTS unit_structure_application_vote_support_maintain ON public.unit_structure_application_vote;
DROP TRIGGER IF EXISTS unit_structure_application_vote_tag_conflict ON public.unit_structure_application_vote;
DROP TRIGGER IF EXISTS unit_tag_vote_effective_maintain ON public.unit_tag_vote;
DROP TRIGGER IF EXISTS unit_tag_vote_structure_conflict ON public.unit_tag_vote;
DROP TRIGGER IF EXISTS unit_tag_vote_stat_maintain ON public.unit_effective_tag_vote;
DROP TRIGGER IF EXISTS unit_structure_definition_validate ON public.unit_structure;
DROP TRIGGER IF EXISTS unit_structure_definition_project ON public.unit_structure;

DROP FUNCTION IF EXISTS public.enforce_realm_tag_voting_enabled();
DROP FUNCTION IF EXISTS public.maintain_realm_tag_vote_stat();
DROP FUNCTION IF EXISTS public.maintain_unit_structure_application_vote_stat();
DROP FUNCTION IF EXISTS public.maintain_unit_tag_vote_stat();
DROP FUNCTION IF EXISTS public.maintain_effective_tag_from_direct_vote();
DROP FUNCTION IF EXISTS public.maintain_structure_application_support();
DROP FUNCTION IF EXISTS public.reject_conflicting_direct_tag_vote();
DROP FUNCTION IF EXISTS public.reject_conflicting_structure_application_vote();
DROP FUNCTION IF EXISTS public.refresh_unit_structure_application_vote_stat(uuid, uuid);
DROP FUNCTION IF EXISTS public.refresh_unit_effective_tag_vote(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.prepare_unit_structure_definition();
DROP FUNCTION IF EXISTS public.project_unit_structure_definition();

ALTER TABLE public.unit_tag_vote RENAME TO unit_tag_judgment;
ALTER TABLE public.unit_tag_judgment RENAME COLUMN value TO fit_vote;
ALTER TABLE public.unit_tag_judgment ALTER COLUMN fit_vote DROP NOT NULL;
ALTER TABLE public.unit_tag_judgment
	ADD COLUMN spoiler_level smallint,
	ADD COLUMN fit_updated_at timestamp(3) with time zone,
	ADD COLUMN spoiler_updated_at timestamp(3) with time zone;
ALTER TABLE public.unit_tag_judgment DROP CONSTRAINT unit_tag_vote_value_check;
ALTER TABLE public.unit_tag_judgment RENAME CONSTRAINT unit_tag_vote_pkey TO unit_tag_judgment_pkey;
ALTER TABLE public.unit_tag_judgment RENAME CONSTRAINT unit_tag_vote_profile_id_profile_id_fkey TO unit_tag_judgment_profile_id_profile_id_fkey;
ALTER TABLE public.unit_tag_judgment RENAME CONSTRAINT unit_tag_vote_tag_id_tag_id_fkey TO unit_tag_judgment_tag_id_tag_id_fkey;
ALTER TABLE public.unit_tag_judgment RENAME CONSTRAINT unit_tag_vote_unit_id_unit_id_fkey TO unit_tag_judgment_unit_id_unit_id_fkey;
ALTER TABLE public.unit_tag_judgment RENAME CONSTRAINT unit_tag_vote_unit_tag_fkey TO unit_tag_judgment_unit_tag_fkey;
ALTER TABLE public.unit_tag_judgment RENAME CONSTRAINT unit_tag_vote_not_self_check TO unit_tag_judgment_not_self_check;
ALTER TABLE public.unit_tag_judgment
	ADD CONSTRAINT unit_tag_judgment_fit_vote_check CHECK (fit_vote IS NULL OR fit_vote IN (-1, 1)) NOT VALID,
	ADD CONSTRAINT unit_tag_judgment_spoiler_level_check CHECK (spoiler_level IS NULL OR spoiler_level BETWEEN 0 AND 2) NOT VALID,
	ADD CONSTRAINT unit_tag_judgment_sparse_check CHECK (fit_vote IS NOT NULL OR spoiler_level IS NOT NULL) NOT VALID,
	ADD CONSTRAINT unit_tag_judgment_fit_timestamp_check CHECK ((fit_vote IS NULL) = (fit_updated_at IS NULL)) NOT VALID,
	ADD CONSTRAINT unit_tag_judgment_spoiler_timestamp_check CHECK ((spoiler_level IS NULL) = (spoiler_updated_at IS NULL)) NOT VALID;

ALTER TABLE public.unit_tag_vote_stat RENAME TO unit_tag_judgment_stat;
ALTER TABLE public.unit_tag_judgment_stat
	ADD COLUMN spoiler_vote_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_none_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_minor_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_major_count bigint DEFAULT 0 NOT NULL;
ALTER TABLE public.unit_tag_judgment_stat RENAME CONSTRAINT unit_tag_vote_stat_pkey TO unit_tag_judgment_stat_pkey;
ALTER TABLE public.unit_tag_judgment_stat RENAME CONSTRAINT unit_tag_vote_stat_effective_tag_fkey TO unit_tag_judgment_stat_effective_tag_fkey;
ALTER TABLE public.unit_tag_judgment_stat RENAME CONSTRAINT unit_tag_vote_stat_count_check TO unit_tag_judgment_stat_count_check;
ALTER TABLE public.unit_tag_judgment_stat RENAME CONSTRAINT unit_tag_vote_stat_score_check TO unit_tag_judgment_stat_score_check;
ALTER TABLE public.unit_tag_judgment_stat RENAME CONSTRAINT unit_tag_vote_stat_parity_check TO unit_tag_judgment_stat_parity_check;
ALTER TABLE public.unit_tag_judgment_stat
	ADD CONSTRAINT unit_tag_judgment_stat_spoiler_count_check CHECK (
		spoiler_vote_count = spoiler_none_count + spoiler_minor_count + spoiler_major_count
	) NOT VALID,
	ADD CONSTRAINT unit_tag_judgment_stat_spoiler_nonnegative_check CHECK (
		spoiler_vote_count >= 0 AND spoiler_none_count >= 0
		AND spoiler_minor_count >= 0 AND spoiler_major_count >= 0
	) NOT VALID;

ALTER TABLE public.unit_structure_application_vote RENAME TO unit_structure_application_judgment;
ALTER TABLE public.unit_structure_application_judgment RENAME COLUMN value TO fit_vote;
ALTER TABLE public.unit_structure_application_judgment ALTER COLUMN fit_vote DROP NOT NULL;
ALTER TABLE public.unit_structure_application_judgment
	ADD COLUMN spoiler_level smallint,
	ADD COLUMN fit_updated_at timestamp(3) with time zone,
	ADD COLUMN spoiler_updated_at timestamp(3) with time zone;
ALTER TABLE public.unit_structure_application_judgment DROP CONSTRAINT unit_structure_application_vote_value_check;
ALTER TABLE public.unit_structure_application_judgment RENAME CONSTRAINT unit_structure_application_vote_pkey TO unit_structure_application_judgment_pkey;
ALTER TABLE public.unit_structure_application_judgment RENAME CONSTRAINT unit_structure_application_vote_application_fkey TO unit_structure_application_judgment_application_fkey;
ALTER TABLE public.unit_structure_application_judgment RENAME CONSTRAINT unit_structure_application_vote_profile_id_profile_id_fkey TO unit_structure_application_judgment_profile_id_profile_id_fkey;
ALTER TABLE public.unit_structure_application_judgment
	ADD CONSTRAINT unit_structure_application_judgment_fit_vote_check CHECK (fit_vote IS NULL OR fit_vote IN (-1, 1)) NOT VALID,
	ADD CONSTRAINT unit_structure_application_judgment_spoiler_level_check CHECK (spoiler_level IS NULL OR spoiler_level BETWEEN 0 AND 2) NOT VALID,
	ADD CONSTRAINT unit_structure_application_judgment_sparse_check CHECK (fit_vote IS NOT NULL OR spoiler_level IS NOT NULL) NOT VALID,
	ADD CONSTRAINT unit_structure_application_judgment_fit_timestamp_check CHECK ((fit_vote IS NULL) = (fit_updated_at IS NULL)) NOT VALID,
	ADD CONSTRAINT unit_structure_application_judgment_spoiler_timestamp_check CHECK ((spoiler_level IS NULL) = (spoiler_updated_at IS NULL)) NOT VALID;
ALTER TRIGGER reject_merged_unit_unit_structure_application_vote_unit_id ON public.unit_structure_application_judgment RENAME TO reject_merged_unit_unit_structure_application_judgment_unit_id;

ALTER TABLE public.unit_structure_application_vote_stat RENAME TO unit_structure_application_judgment_stat;
ALTER TABLE public.unit_structure_application_judgment_stat
	ADD COLUMN spoiler_vote_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_none_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_minor_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_major_count bigint DEFAULT 0 NOT NULL;
ALTER TABLE public.unit_structure_application_judgment_stat RENAME CONSTRAINT unit_structure_application_vote_stat_pkey TO unit_structure_application_judgment_stat_pkey;
ALTER TABLE public.unit_structure_application_judgment_stat RENAME CONSTRAINT unit_structure_application_vote_stat_application_fkey TO unit_structure_application_judgment_stat_application_fkey;
ALTER TABLE public.unit_structure_application_judgment_stat RENAME CONSTRAINT unit_structure_application_vote_stat_count_check TO unit_structure_application_judgment_stat_count_check;
ALTER TABLE public.unit_structure_application_judgment_stat RENAME CONSTRAINT unit_structure_application_vote_stat_score_check TO unit_structure_application_judgment_stat_score_check;
ALTER TABLE public.unit_structure_application_judgment_stat RENAME CONSTRAINT unit_structure_application_vote_stat_parity_check TO unit_structure_application_judgment_stat_parity_check;
ALTER TABLE public.unit_structure_application_judgment_stat
	ADD CONSTRAINT unit_structure_application_judgment_stat_spoiler_count_check CHECK (
		spoiler_vote_count = spoiler_none_count + spoiler_minor_count + spoiler_major_count
	) NOT VALID,
	ADD CONSTRAINT unit_structure_application_judgment_stat_spoiler_nonnegative_check CHECK (
		spoiler_vote_count >= 0 AND spoiler_none_count >= 0
		AND spoiler_minor_count >= 0 AND spoiler_major_count >= 0
	) NOT VALID;

ALTER TABLE public.realm_tag_vote RENAME TO realm_tag_judgment;
ALTER TABLE public.realm_tag_judgment RENAME COLUMN value TO fit_vote;
ALTER TABLE public.realm_tag_judgment ALTER COLUMN fit_vote DROP NOT NULL;
ALTER TABLE public.realm_tag_judgment
	ADD COLUMN spoiler_level smallint,
	ADD COLUMN fit_updated_at timestamp(3) with time zone,
	ADD COLUMN spoiler_updated_at timestamp(3) with time zone;
ALTER TABLE public.realm_tag_judgment DROP CONSTRAINT realm_tag_vote_value_check;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_pkey TO realm_tag_judgment_pkey;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_profile_id_profile_id_fkey TO realm_tag_judgment_profile_id_profile_id_fkey;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_realm_fkey TO realm_tag_judgment_realm_fkey;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_unit_fkey TO realm_tag_judgment_unit_fkey;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_tag_fkey TO realm_tag_judgment_tag_fkey;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_context_fkey TO realm_tag_judgment_context_fkey;
ALTER TABLE public.realm_tag_judgment RENAME CONSTRAINT realm_tag_vote_not_self_check TO realm_tag_judgment_not_self_check;
ALTER TABLE public.realm_tag_judgment
	ADD CONSTRAINT realm_tag_judgment_fit_vote_check CHECK (fit_vote IS NULL OR fit_vote IN (-1, 1)) NOT VALID,
	ADD CONSTRAINT realm_tag_judgment_spoiler_level_check CHECK (spoiler_level IS NULL OR spoiler_level BETWEEN 0 AND 2) NOT VALID,
	ADD CONSTRAINT realm_tag_judgment_sparse_check CHECK (fit_vote IS NOT NULL OR spoiler_level IS NOT NULL) NOT VALID,
	ADD CONSTRAINT realm_tag_judgment_fit_timestamp_check CHECK ((fit_vote IS NULL) = (fit_updated_at IS NULL)) NOT VALID,
	ADD CONSTRAINT realm_tag_judgment_spoiler_timestamp_check CHECK ((spoiler_level IS NULL) = (spoiler_updated_at IS NULL)) NOT VALID;
ALTER INDEX public.realm_tag_vote_realm_tag_unit_idx RENAME TO realm_tag_judgment_realm_tag_unit_idx;
ALTER INDEX public.realm_tag_vote_unit_merge_idx RENAME TO realm_tag_judgment_unit_merge_idx;
ALTER TRIGGER reject_merged_unit_realm_tag_vote_unit_id ON public.realm_tag_judgment RENAME TO reject_merged_unit_realm_tag_judgment_unit_id;

ALTER TABLE public.realm_tag_vote_stat RENAME TO realm_tag_judgment_stat;
ALTER TABLE public.realm_tag_judgment_stat
	ADD COLUMN spoiler_vote_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_none_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_minor_count bigint DEFAULT 0 NOT NULL,
	ADD COLUMN spoiler_major_count bigint DEFAULT 0 NOT NULL;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_pkey TO realm_tag_judgment_stat_pkey;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_realm_fkey TO realm_tag_judgment_stat_realm_fkey;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_unit_fkey TO realm_tag_judgment_stat_unit_fkey;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_tag_fkey TO realm_tag_judgment_stat_tag_fkey;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_context_fkey TO realm_tag_judgment_stat_context_fkey;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_count_check TO realm_tag_judgment_stat_count_check;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_score_check TO realm_tag_judgment_stat_score_check;
ALTER TABLE public.realm_tag_judgment_stat RENAME CONSTRAINT realm_tag_vote_stat_parity_check TO realm_tag_judgment_stat_parity_check;
ALTER INDEX public.realm_tag_vote_stat_realm_tag_unit_idx RENAME TO realm_tag_judgment_stat_realm_tag_unit_idx;
ALTER TABLE public.realm_tag_judgment_stat
	ADD CONSTRAINT realm_tag_judgment_stat_spoiler_nonnegative_check CHECK (
		spoiler_vote_count >= 0 AND spoiler_none_count >= 0
		AND spoiler_minor_count >= 0 AND spoiler_major_count >= 0
	) NOT VALID;
ALTER TABLE public.realm_tag_judgment_stat
	ADD CONSTRAINT realm_tag_judgment_stat_spoiler_count_check CHECK (
		spoiler_vote_count = spoiler_none_count + spoiler_minor_count + spoiler_major_count
	) NOT VALID;
