INSERT INTO "unit" (
	"id",
	"kind",
	"slug_scope_id",
	"slug",
	"status",
	"visibility",
	"published_at"
) VALUES
	('00000000-0000-7000-8000-000000000000', 'slug_namespace', NULL, NULL, 'published', 'public', now()),
	('00000000-0000-7000-8000-000000000001', 'slug_namespace', '00000000-0000-7000-8000-000000000000', 'users', 'published', 'public', now()),
	('00000000-0000-7000-8000-000000000002', 'slug_namespace', '00000000-0000-7000-8000-000000000000', 'realms', 'published', 'public', now()),
	('00000000-0000-7000-8000-000000000003', 'slug_namespace', '00000000-0000-7000-8000-000000000000', 'tags', 'published', 'public', now()),
	('00000000-0000-7000-8000-000000000004', 'slug_namespace', '00000000-0000-7000-8000-000000000000', 'zones', 'published', 'public', now()),
	('00000000-0000-7000-8000-000000000005', 'slug_namespace', '00000000-0000-7000-8000-000000000000', 'entities', 'published', 'public', now());
--> statement-breakpoint

UPDATE "unit"
SET "slug_scope_id" = CASE "kind"
	WHEN 'profile' THEN '00000000-0000-7000-8000-000000000001'::uuid
	WHEN 'realm' THEN '00000000-0000-7000-8000-000000000002'::uuid
	WHEN 'tag' THEN '00000000-0000-7000-8000-000000000003'::uuid
	WHEN 'zone' THEN '00000000-0000-7000-8000-000000000004'::uuid
	WHEN 'entity' THEN '00000000-0000-7000-8000-000000000005'::uuid
	ELSE "slug_scope_id"
END
WHERE "slug_scope_id" IS NULL
	AND "id" <> '00000000-0000-7000-8000-000000000000';
--> statement-breakpoint

UPDATE "unit" AS target
SET "slug_scope_id" = collection."owner_profile_id"
FROM "collection"
WHERE collection."id" = target."id"
	AND target."slug_scope_id" IS NULL;
--> statement-breakpoint

UPDATE "unit" AS target
SET "slug_scope_id" = (
	SELECT node."owner_unit_id"
	FROM "content_structure_node" AS node
	WHERE node."content_unit_id" = target."id"
	ORDER BY node."created_at", node."id"
	LIMIT 1
)
WHERE target."slug_scope_id" IS NULL
	AND EXISTS (
		SELECT 1
		FROM "content_structure_node" AS node
		WHERE node."content_unit_id" = target."id"
	);
--> statement-breakpoint

UPDATE "unit" AS target
SET "slug_scope_id" = reply."root_post_id"
FROM "post_reply" AS reply
WHERE reply."post_id" = target."id"
	AND target."slug_scope_id" IS NULL;
--> statement-breakpoint

UPDATE "unit" AS target
SET "slug_scope_id" = post."author_profile_id"
FROM "post"
WHERE post."id" = target."id"
	AND target."slug_scope_id" IS NULL;
--> statement-breakpoint

UPDATE "unit" AS target
SET "slug_scope_id" = revision."realm_id"
FROM "realm_rule"
INNER JOIN "realm_rule_revision" AS revision
	ON revision."id" = "realm_rule"."revision_id"
WHERE "realm_rule"."id" = target."id"
	AND target."slug_scope_id" IS NULL;
--> statement-breakpoint

UPDATE "unit" AS target
SET "slug_scope_id" = release."parent_unit_id"
FROM "release"
WHERE release."id" = target."id"
	AND target."slug_scope_id" IS NULL;
--> statement-breakpoint

-- This is a one-time migration of legacy owned Units. The selected address
-- parent is persisted and is never recalculated from mutable access bindings.
UPDATE "unit" AS target
SET "slug_scope_id" = (
	SELECT binding."profile_id"
	FROM "unit_access_binding" AS binding
	WHERE binding."unit_id" = target."id"
		AND binding."subject_kind" = 'profile'
		AND binding."role" = 'owner'
		AND binding."profile_id" IS NOT NULL
	ORDER BY binding."created_at", binding."id"
	LIMIT 1
)
WHERE target."slug_scope_id" IS NULL
	AND target."id" <> '00000000-0000-7000-8000-000000000000'
	AND EXISTS (
		SELECT 1
		FROM "unit_access_binding" AS binding
		WHERE binding."unit_id" = target."id"
			AND binding."subject_kind" = 'profile'
			AND binding."role" = 'owner'
			AND binding."profile_id" IS NOT NULL
	);
--> statement-breakpoint

UPDATE "unit"
SET "slug" = regexp_replace(
	trim(BOTH '-' FROM regexp_replace(lower(coalesce("slug", '')), '[^a-z0-9]+', '-', 'g')),
	'^$',
	replace("kind"::text, '_', '-') || '-' || replace("id"::text, '-', '')
)
WHERE "id" <> '00000000-0000-7000-8000-000000000000';
--> statement-breakpoint

UPDATE "unit"
SET "slug" = left("slug", 30) || '-' || replace("id"::text, '-', '')
WHERE char_length("slug") > 63;
--> statement-breakpoint

DO $$
DECLARE
	duplicate_row record;
	candidate text;
	suffix integer;
BEGIN
	FOR duplicate_row IN
		SELECT "id", "slug_scope_id"
		FROM (
			SELECT
				"id",
				"slug_scope_id",
				row_number() OVER (
					PARTITION BY "slug_scope_id", "slug"
					ORDER BY "created_at", "id"
				) AS position
			FROM "unit"
			WHERE "slug_scope_id" IS NOT NULL
		) AS ranked
		WHERE ranked.position > 1
	LOOP
		candidate := 'migrated-' || replace(duplicate_row."id"::text, '-', '');
		suffix := 0;
		WHILE EXISTS (
			SELECT 1
			FROM "unit"
			WHERE "slug_scope_id" = duplicate_row."slug_scope_id"
				AND "slug" = candidate
				AND "id" <> duplicate_row."id"
		) LOOP
			suffix := suffix + 1;
			candidate := left(
				'migrated-' || replace(duplicate_row."id"::text, '-', ''),
				62 - char_length(suffix::text)
			) || '-' || suffix::text;
		END LOOP;

		UPDATE "unit"
		SET "slug" = candidate
		WHERE "id" = duplicate_row."id";
	END LOOP;
END
$$;
--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "unit"
		WHERE "id" <> '00000000-0000-7000-8000-000000000000'
			AND ("slug_scope_id" IS NULL OR "slug" IS NULL)
	) THEN
		RAISE EXCEPTION 'Every non-root Unit must have a migrated slug address';
	END IF;
END
$$;
