SET search_path TO public;

-- Modify "unit" table
ALTER TABLE "unit" DROP CONSTRAINT "unit_kind_check", ADD CONSTRAINT "unit_kind_check" CHECK (kind = ANY (ARRAY['slug_namespace'::text, 'profile'::text, 'book'::text, 'software'::text, 'media'::text, 'video'::text, 'audio'::text, 'release'::text, 'entity'::text, 'label'::text, 'tag'::text, 'tag_path'::text, 'series'::text, 'zone'::text, 'zone_page'::text, 'zone_theme'::text, 'collection'::text, 'post'::text, 'poll'::text, 'realm'::text, 'realm_rule'::text]));

CREATE OR REPLACE FUNCTION public.lock_realm_tag_judgment_keys(
	target_realm_ids uuid[],
	target_unit_ids uuid[],
	target_tag_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
	hot_key record;
BEGIN
	IF target_realm_ids IS NULL OR target_unit_ids IS NULL OR target_tag_ids IS NULL
		OR cardinality(target_realm_ids) > 1024
		OR cardinality(target_realm_ids) <> cardinality(target_unit_ids)
		OR cardinality(target_realm_ids) <> cardinality(target_tag_ids)
		OR EXISTS (
			SELECT 1
			FROM unnest(target_realm_ids, target_unit_ids, target_tag_ids)
				AS key(realm_id, unit_id, tag_id)
			WHERE key.realm_id IS NULL OR key.unit_id IS NULL OR key.tag_id IS NULL
		) THEN
		RAISE EXCEPTION 'Realm Tag judgment hot-key arrays must contain at most 1024 aligned, non-null Realm/Unit/Tag keys'
			USING ERRCODE = '22023', CONSTRAINT = 'realm_tag_judgment_hot_key_batch_invalid';
	END IF;
	FOR hot_key IN
		SELECT DISTINCT key.realm_id, key.unit_id, key.tag_id
		FROM unnest(target_realm_ids, target_unit_ids, target_tag_ids)
			AS key(realm_id, unit_id, tag_id)
		ORDER BY key.realm_id, key.unit_id, key.tag_id
	LOOP
		PERFORM public.lock_vote_hot_key(
			'realm_tag_stat:' || hot_key.realm_id::text || ':' || hot_key.unit_id::text || ':' || hot_key.tag_id::text,
			0
		);
	END LOOP;
END;
$$;
