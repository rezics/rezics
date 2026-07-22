-- Revision Content supports bounded semantic delta chains as well as full checkpoints.
ALTER TABLE "revision_content"
  ADD COLUMN "encoding" text NOT NULL DEFAULT 'full',
  ADD COLUMN "base_content_id" uuid NULL,
  ADD COLUMN "delta_depth" integer NOT NULL DEFAULT 0;
ALTER TABLE "revision_content"
  ADD CONSTRAINT "revision_content_delta_shape_check" CHECK (
    (encoding = 'full' AND base_content_id IS NULL AND delta_depth = 0)
    OR (encoding = 'delta' AND base_content_id IS NOT NULL AND delta_depth > 0)
  ),
  ADD CONSTRAINT "revision_content_encoding_check" CHECK (encoding IN ('full', 'delta')),
  ADD CONSTRAINT "revision_content_base_fkey"
    FOREIGN KEY ("base_content_id") REFERENCES "revision_content" ("id") ON DELETE RESTRICT;

-- Label is a lightweight localized-title Unit kind.
ALTER TABLE "unit"
  DROP CONSTRAINT "unit_kind_check",
  ADD CONSTRAINT "unit_kind_check" CHECK (kind IN (
    'slug_namespace', 'profile', 'book', 'software', 'media', 'release', 'entity',
    'label', 'tag', 'series', 'zone', 'collection', 'post', 'poll', 'realm', 'realm_rule'
  ));

CREATE TABLE "content_structure" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_unit_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "document_key" text NULL,
  "deleted_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "content_structure_id_owner_key" UNIQUE ("id", "owner_unit_id"),
  CONSTRAINT "content_structure_owner_unit_id_unit_id_fkey"
    FOREIGN KEY ("owner_unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE,
  CONSTRAINT "content_structure_deleted_at_check"
    CHECK (deleted_at IS NULL OR deleted_at >= created_at),
  CONSTRAINT "content_structure_document_key_check"
    CHECK (document_key IS NULL OR document_key ~ '^[0-9a-f]{12}$'),
  CONSTRAINT "content_structure_navigation_document_key_check"
    CHECK ((kind IN ('realm.navigation', 'zone.navigation')) = (document_key IS NOT NULL)),
  CONSTRAINT "content_structure_kind_check"
    CHECK (kind IN (
      'book.contents', 'post.contents', 'realm.taxonomy',
      'realm.navigation', 'zone.navigation'
    ))
);
CREATE INDEX "content_structure_owner_kind_idx"
  ON "content_structure" ("owner_unit_id", "kind", "created_at", "id")
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX "content_structure_singleton_kind_key"
  ON "content_structure" ("owner_unit_id", "kind")
  WHERE deleted_at IS NULL
    AND kind IN ('book.contents', 'post.contents', 'realm.taxonomy');

-- Every existing Book and Realm receives its singleton structure, including empty ones.
INSERT INTO "content_structure" (
  "id", "owner_unit_id", "kind", "created_at", "updated_at"
)
SELECT uuidv7(), owner.id, 'book.contents', owner.created_at, owner.updated_at
FROM "book"
JOIN "unit" AS owner ON owner.id = book.id;

INSERT INTO "content_structure" (
  "id", "owner_unit_id", "kind", "created_at", "updated_at"
)
SELECT uuidv7(), owner.id, 'realm.taxonomy', owner.created_at, owner.updated_at
FROM "realm"
JOIN "unit" AS owner ON owner.id = realm.id;

-- Extend the existing Book-only node table in a data-safe nullable/backfill/not-null sequence.
DROP INDEX "content_structure_node_content_unit_idx";
DROP INDEX "content_structure_node_owner_parent_position_idx";
ALTER TABLE "content_structure_node"
  ADD COLUMN "structure_id" uuid NULL,
  ADD COLUMN "document_key" text NULL,
  ADD COLUMN "target_kind" text NOT NULL DEFAULT 'content',
  ADD COLUMN "target_unit_id" uuid NULL,
  ADD COLUMN "target_zone_page_id" uuid NULL,
  ADD COLUMN "target_url" text NULL,
  ADD COLUMN "search_configuration" jsonb NULL;

UPDATE "content_structure_node" AS node
SET "structure_id" = structure.id
FROM "content_structure" AS structure
WHERE structure.owner_unit_id = node.owner_unit_id
  AND structure.kind = 'book.contents'
  AND structure.deleted_at IS NULL;

ALTER TABLE "content_structure_node" ALTER COLUMN "structure_id" SET NOT NULL;
ALTER TABLE "content_structure_node"
  DROP CONSTRAINT "content_structure_node_owner_unit_id_unit_id_fkey",
  DROP CONSTRAINT "content_structure_node_parent_owner_fkey",
  ADD CONSTRAINT "content_structure_node_document_key_check"
    CHECK (document_key IS NULL OR document_key ~ '^[0-9a-f]{12}$'),
  ADD CONSTRAINT "content_structure_node_target_kind_check"
    CHECK (target_kind IN ('content', 'none', 'unit', 'zone_page', 'external')),
  ADD CONSTRAINT "content_structure_node_search_configuration_check"
    CHECK (search_configuration IS NULL OR jsonb_typeof(search_configuration) = 'object'),
  ADD CONSTRAINT "content_structure_node_target_shape_check" CHECK (
    (target_kind IN ('content', 'none')
      AND target_unit_id IS NULL AND target_zone_page_id IS NULL AND target_url IS NULL)
    OR (target_kind = 'unit'
      AND target_unit_id IS NOT NULL AND target_zone_page_id IS NULL AND target_url IS NULL)
    OR (target_kind = 'zone_page'
      AND target_unit_id IS NULL AND target_zone_page_id IS NOT NULL AND target_url IS NULL)
    OR (target_kind = 'external'
      AND target_unit_id IS NULL AND target_zone_page_id IS NULL
      AND target_url ~ '^https://[^[:space:]]+$'
      AND char_length(target_url) <= 2000)
  ),
  ADD CONSTRAINT "content_structure_node_id_structure_key" UNIQUE ("id", "structure_id"),
  ADD CONSTRAINT "content_structure_node_parent_structure_fkey"
    FOREIGN KEY ("parent_id", "structure_id")
    REFERENCES "content_structure_node" ("id", "structure_id") ON DELETE RESTRICT,
  ADD CONSTRAINT "content_structure_node_structure_owner_fkey"
    FOREIGN KEY ("structure_id", "owner_unit_id")
    REFERENCES "content_structure" ("id", "owner_unit_id") ON DELETE CASCADE,
  ADD CONSTRAINT "content_structure_node_target_unit_id_unit_id_fkey"
    FOREIGN KEY ("target_unit_id") REFERENCES "unit" ("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "content_structure_node_target_zone_page_id_zone_page_id_fkey"
    FOREIGN KEY ("target_zone_page_id") REFERENCES "zone_page" ("id") ON DELETE RESTRICT;

CREATE INDEX "content_structure_node_content_unit_structure_idx"
  ON "content_structure_node" ("content_unit_id", "structure_id")
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX "content_structure_node_document_key"
  ON "content_structure_node" ("structure_id", "document_key")
  WHERE document_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX "content_structure_node_owner_idx"
  ON "content_structure_node" ("owner_unit_id", "structure_id")
  WHERE deleted_at IS NULL;
CREATE INDEX "content_structure_node_structure_parent_position_idx"
  ON "content_structure_node" ("structure_id", "parent_id", "position", "id")
  WHERE deleted_at IS NULL;
CREATE INDEX "content_structure_node_target_unit_idx"
  ON "content_structure_node" ("target_unit_id");
CREATE INDEX "content_structure_node_target_zone_page_idx"
  ON "content_structure_node" ("target_zone_page_id");

-- Preserve Realm and Zone NavigationDocument resources as typed Content Structures.
INSERT INTO "content_structure" (
  "id", "owner_unit_id", "kind", "document_key", "created_at", "updated_at"
)
SELECT id, realm_id, 'realm.navigation', document ->> '_key', created_at, updated_at
FROM "realm_navigation";

INSERT INTO "content_structure" (
  "id", "owner_unit_id", "kind", "document_key", "created_at", "updated_at"
)
SELECT id, zone_id, 'zone.navigation', document ->> '_key', created_at, updated_at
FROM "zone_navigation";

WITH RECURSIVE navigation_source AS (
  SELECT id AS structure_id, realm_id AS owner_unit_id, document, created_at, updated_at
  FROM realm_navigation
  UNION ALL
  SELECT id, zone_id, document, created_at, updated_at
  FROM zone_navigation
), navigation_tree AS (
  SELECT
    source.structure_id,
    source.owner_unit_id,
    item.value AS item,
    ARRAY[item.ordinality::integer] AS path,
    NULL::integer[] AS parent_path,
    item.ordinality::integer AS sibling_ordinal,
    source.created_at,
    source.updated_at
  FROM navigation_source AS source
  CROSS JOIN LATERAL jsonb_array_elements(source.document -> 'items')
    WITH ORDINALITY AS item(value, ordinality)
  UNION ALL
  SELECT
    parent.structure_id,
    parent.owner_unit_id,
    child.value,
    parent.path || child.ordinality::integer,
    parent.path,
    child.ordinality::integer,
    parent.created_at,
    parent.updated_at
  FROM navigation_tree AS parent
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(parent.item -> 'children') = 'array' THEN parent.item -> 'children'
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS child(value, ordinality)
), navigation_node AS MATERIALIZED (
  SELECT uuidv7() AS id, * FROM navigation_tree
)
INSERT INTO "content_structure_node" (
  "id", "structure_id", "owner_unit_id", "parent_id", "content_unit_id",
  "document_key", "target_kind", "target_unit_id", "target_zone_page_id",
  "target_url", "position", "created_at", "updated_at"
)
SELECT
  node.id,
  node.structure_id,
  node.owner_unit_id,
  parent.id,
  (node.item ->> 'labelUnitId')::uuid,
  node.item ->> '_key',
  CASE
    WHEN node.item ? 'children' THEN 'none'
    WHEN node.item #>> '{target,kind}' = 'unit' THEN 'unit'
    WHEN node.item #>> '{target,kind}' = 'zone-page' THEN 'zone_page'
    WHEN node.item #>> '{target,kind}' = 'external' THEN 'external'
  END,
  CASE WHEN node.item #>> '{target,kind}' = 'unit'
    THEN (node.item #>> '{target,unitId}')::uuid END,
  page.id,
  CASE WHEN node.item #>> '{target,kind}' = 'external'
    THEN node.item #>> '{target,url}' END,
  'a' || lpad((node.sibling_ordinal - 1)::text, 11, '0') || '1',
  node.created_at,
  node.updated_at
FROM navigation_node AS node
LEFT JOIN navigation_node AS parent
  ON parent.structure_id = node.structure_id AND parent.path = node.parent_path
LEFT JOIN zone_page AS page
  ON node.item #>> '{target,kind}' = 'zone-page'
  AND page.zone_id = node.owner_unit_id
  AND page.slug = node.item #>> '{target,slug}';

-- Prevent cycles even for non-HTTP writers; the service performs the same check for good errors.
CREATE FUNCTION content_structure_node_reject_cycle() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT node.id, node.parent_id
      FROM content_structure_node AS node
      WHERE node.id = NEW.parent_id AND node.structure_id = NEW.structure_id
      UNION ALL
      SELECT parent.id, parent.parent_id
      FROM content_structure_node AS parent
      JOIN ancestors AS child ON child.parent_id = parent.id
      WHERE parent.structure_id = NEW.structure_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'content_structure_node cycle detected'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;
CREATE CONSTRAINT TRIGGER content_structure_node_acyclic
AFTER INSERT OR UPDATE ON content_structure_node
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION content_structure_node_reject_cycle();

CREATE TABLE "label" (
  "id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "label_id_unit_id_fkey"
    FOREIGN KEY ("id") REFERENCES "unit" ("id") ON DELETE CASCADE
);

-- Content Structures are independently versioned aggregates. Their immutable revisions share
-- revision_content storage but never occupy Unit revision slots or use Unit revision heads.
CREATE TABLE "content_structure_revision" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "structure_id" uuid NOT NULL,
  "parent_revision_id" uuid NULL,
  "source_revision_id" uuid NULL,
  "content_id" uuid NOT NULL,
  "actor_profile_id" uuid NULL,
  "edit_summary" text NULL,
  "kind" text NOT NULL,
  "minor" boolean NOT NULL DEFAULT false,
  "replay_byte_size" integer NOT NULL,
  "checkpoint_byte_size" integer NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "content_structure_revision_id_structure_key"
    UNIQUE ("id", "structure_id"),
  CONSTRAINT "content_structure_revision_structure_fkey"
    FOREIGN KEY ("structure_id") REFERENCES "content_structure" ("id") ON DELETE RESTRICT,
  CONSTRAINT "content_structure_revision_parent_structure_fkey"
    FOREIGN KEY ("parent_revision_id", "structure_id")
    REFERENCES "content_structure_revision" ("id", "structure_id") ON DELETE RESTRICT,
  CONSTRAINT "content_structure_revision_source_structure_fkey"
    FOREIGN KEY ("source_revision_id", "structure_id")
    REFERENCES "content_structure_revision" ("id", "structure_id") ON DELETE RESTRICT,
  CONSTRAINT "content_structure_revision_content_id_revision_content_id_fkey"
    FOREIGN KEY ("content_id") REFERENCES "revision_content" ("id") ON DELETE RESTRICT,
  CONSTRAINT "content_structure_revision_actor_profile_id_profile_id_fkey"
    FOREIGN KEY ("actor_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT,
  CONSTRAINT "content_structure_revision_kind_check"
    CHECK (kind IN ('create', 'update', 'delete', 'restore')),
  CONSTRAINT "content_structure_revision_replay_byte_size_check"
    CHECK (replay_byte_size >= 0),
  CONSTRAINT "content_structure_revision_checkpoint_byte_size_check"
    CHECK (checkpoint_byte_size >= 0),
  CONSTRAINT "content_structure_revision_source_shape_check"
    CHECK ((kind = 'restore') = (source_revision_id IS NOT NULL))
);
CREATE INDEX "content_structure_revision_structure_created_at_idx"
  ON "content_structure_revision" ("structure_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
CREATE INDEX "content_structure_revision_parent_idx"
  ON "content_structure_revision" ("parent_revision_id");
CREATE INDEX "content_structure_revision_source_idx"
  ON "content_structure_revision" ("source_revision_id");
CREATE INDEX "content_structure_revision_content_idx"
  ON "content_structure_revision" ("content_id");
CREATE INDEX "content_structure_revision_actor_created_at_idx"
  ON "content_structure_revision" ("actor_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);

CREATE TABLE "content_structure_revision_head" (
  "structure_id" uuid NOT NULL,
  "revision_id" uuid NOT NULL,
  PRIMARY KEY ("structure_id"),
  CONSTRAINT "content_structure_revision_head_revision_key" UNIQUE ("revision_id"),
  CONSTRAINT "content_structure_revision_head_structure_fkey"
    FOREIGN KEY ("structure_id") REFERENCES "content_structure" ("id") ON DELETE CASCADE,
  CONSTRAINT "content_structure_revision_head_revision_structure_fkey"
    FOREIGN KEY ("revision_id", "structure_id")
    REFERENCES "content_structure_revision" ("id", "structure_id") ON DELETE RESTRICT
);

-- Attach an immutable full checkpoint to each existing Content Structure.
CREATE TABLE content_structure_history_checkpoint AS
SELECT
  snapshot.structure_id,
  uuidv7() AS revision_id,
  snapshot.payload,
  encode(sha256(convert_to(snapshot.payload::text, 'UTF8')), 'hex') AS sha256,
  octet_length(snapshot.payload::text) AS byte_size
FROM (
  SELECT
    structure.id AS structure_id,
    structure.owner_unit_id,
    jsonb_build_object(
      'version', 1,
      'structure', jsonb_build_object(
        'id', structure.id,
        'ownerUnitId', structure.owner_unit_id,
        'kind', structure.kind,
        'documentKey', structure.document_key,
        'deletedAt', structure.deleted_at,
        'createdAt', structure.created_at,
        'updatedAt', structure.updated_at
      ),
      'nodes', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', node.id,
            'structureId', node.structure_id,
            'ownerUnitId', node.owner_unit_id,
            'parentId', node.parent_id,
            'contentUnitId', node.content_unit_id,
            'documentKey', node.document_key,
            'targetKind', node.target_kind,
            'targetUnitId', node.target_unit_id,
            'targetZonePageId', node.target_zone_page_id,
            'targetUrl', node.target_url,
            'searchConfiguration', node.search_configuration,
            'position', node.position,
            'contentRating', node.content_rating,
            'deletedAt', node.deleted_at,
            'createdAt', node.created_at,
            'updatedAt', node.updated_at
          ) ORDER BY node.position, node.id
        ) FILTER (WHERE node.id IS NOT NULL),
        '[]'::jsonb
      )
    ) AS payload
  FROM content_structure AS structure
  LEFT JOIN content_structure_node AS node
    ON node.structure_id = structure.id AND node.deleted_at IS NULL
  WHERE structure.deleted_at IS NULL
  GROUP BY structure.id
) AS snapshot;

INSERT INTO revision_content (
  id, model, sha256, byte_size, encoding, base_content_id, delta_depth, payload
)
SELECT
  uuidv7(), 'rezics.content-structure.v1', checkpoint.sha256,
  checkpoint.byte_size, 'full', NULL, 0, checkpoint.payload
FROM content_structure_history_checkpoint AS checkpoint
ON CONFLICT (model, sha256) DO NOTHING;

INSERT INTO content_structure_revision (
  id, structure_id, parent_revision_id, source_revision_id, content_id,
  kind, minor, replay_byte_size, checkpoint_byte_size
)
SELECT
  checkpoint.revision_id,
  checkpoint.structure_id,
  NULL,
  NULL,
  content.id,
  'create',
  false,
  0,
  checkpoint.byte_size
FROM content_structure_history_checkpoint AS checkpoint
JOIN revision_content AS content
  ON content.model = 'rezics.content-structure.v1'
  AND content.sha256 = checkpoint.sha256;

INSERT INTO "content_structure_revision_head" ("structure_id", "revision_id")
SELECT
  checkpoint.structure_id,
  checkpoint.revision_id
FROM content_structure_history_checkpoint AS checkpoint;

DROP TABLE content_structure_history_checkpoint;

CREATE TABLE "dock_revision" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "dock_id" uuid NOT NULL,
  "parent_revision_id" uuid NULL,
  "source_revision_id" uuid NULL,
  "content_id" uuid NOT NULL,
  "actor_profile_id" uuid NULL,
  "edit_summary" text NULL,
  "kind" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "dock_revision_id_dock_key" UNIQUE ("id", "dock_id"),
  CONSTRAINT "dock_revision_dock_id_unit_dock_id_fkey"
    FOREIGN KEY ("dock_id") REFERENCES "unit_dock" ("id") ON DELETE RESTRICT,
  CONSTRAINT "dock_revision_parent_dock_fkey"
    FOREIGN KEY ("parent_revision_id", "dock_id")
    REFERENCES "dock_revision" ("id", "dock_id") ON DELETE RESTRICT,
  CONSTRAINT "dock_revision_source_dock_fkey"
    FOREIGN KEY ("source_revision_id", "dock_id")
    REFERENCES "dock_revision" ("id", "dock_id") ON DELETE RESTRICT,
  CONSTRAINT "dock_revision_content_id_revision_content_id_fkey"
    FOREIGN KEY ("content_id") REFERENCES "revision_content" ("id") ON DELETE RESTRICT,
  CONSTRAINT "dock_revision_actor_profile_id_profile_id_fkey"
    FOREIGN KEY ("actor_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT,
  CONSTRAINT "dock_revision_kind_check"
    CHECK (kind IN ('create', 'update', 'delete', 'restore')),
  CONSTRAINT "dock_revision_source_shape_check"
    CHECK ((kind = 'restore') = (source_revision_id IS NOT NULL))
);
CREATE INDEX "dock_revision_dock_created_at_idx"
  ON "dock_revision" ("dock_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
CREATE INDEX "dock_revision_content_idx" ON "dock_revision" ("content_id");

CREATE TABLE "dock_revision_head" (
  "dock_id" uuid NOT NULL,
  "revision_id" uuid NOT NULL,
  PRIMARY KEY ("dock_id"),
  CONSTRAINT "dock_revision_head_revision_key" UNIQUE ("revision_id"),
  CONSTRAINT "dock_revision_head_dock_id_unit_dock_id_fkey"
    FOREIGN KEY ("dock_id") REFERENCES "unit_dock" ("id") ON DELETE CASCADE,
  CONSTRAINT "dock_revision_head_revision_dock_fkey"
    FOREIGN KEY ("revision_id", "dock_id")
    REFERENCES "dock_revision" ("id", "dock_id") ON DELETE RESTRICT
);

CREATE TABLE dock_history_checkpoint AS
SELECT
  dock.id AS dock_id,
  uuidv7() AS revision_id,
  jsonb_build_object(
    'version', 1,
    'dock', jsonb_build_object(
      'id', dock.id,
      'unitId', dock.unit_id,
      'kind', dock.kind,
      'document', dock.document,
      'deletedAt', dock.deleted_at,
      'createdAt', dock.created_at,
      'updatedAt', dock.updated_at
    )
  ) AS payload
FROM unit_dock AS dock
WHERE dock.deleted_at IS NULL;

ALTER TABLE dock_history_checkpoint
  ADD COLUMN sha256 text,
  ADD COLUMN byte_size integer;
UPDATE dock_history_checkpoint
SET sha256 = encode(sha256(convert_to(payload::text, 'UTF8')), 'hex'),
    byte_size = octet_length(payload::text);
ALTER TABLE dock_history_checkpoint
  ALTER COLUMN sha256 SET NOT NULL,
  ALTER COLUMN byte_size SET NOT NULL;

INSERT INTO revision_content (
  id, model, sha256, byte_size, encoding, base_content_id, delta_depth, payload
)
SELECT uuidv7(), 'rezics.dock.v1', sha256, byte_size, 'full', NULL, 0, payload
FROM dock_history_checkpoint
ON CONFLICT (model, sha256) DO NOTHING;

INSERT INTO dock_revision (
  id, dock_id, parent_revision_id, source_revision_id, content_id, kind
)
SELECT checkpoint.revision_id, checkpoint.dock_id, NULL, NULL, content.id, 'create'
FROM dock_history_checkpoint AS checkpoint
JOIN revision_content AS content
  ON content.model = 'rezics.dock.v1' AND content.sha256 = checkpoint.sha256;

INSERT INTO dock_revision_head (dock_id, revision_id)
SELECT dock_id, revision_id FROM dock_history_checkpoint;

DROP TABLE dock_history_checkpoint;
DROP TABLE "realm_navigation";
DROP TABLE "zone_navigation";
