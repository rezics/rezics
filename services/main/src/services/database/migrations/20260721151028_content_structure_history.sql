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

-- Component roles are open text; runtime schemas prove each registered role family.
ALTER TABLE "unit_revision_slot" ALTER COLUMN "role" TYPE text USING "role"::text;
ALTER TABLE "unit_revision_slot"
  ADD CONSTRAINT "unit_revision_slot_role_check"
  CHECK (btrim(role) <> '' AND char_length(role) <= 200);

CREATE TABLE "content_structure" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_unit_id" uuid NOT NULL,
  "purpose" text NOT NULL,
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
    CHECK ((purpose IN ('realm.navigation', 'zone.navigation')) = (document_key IS NOT NULL)),
  CONSTRAINT "content_structure_purpose_check"
    CHECK (purpose IN (
      'book.contents', 'post.contents', 'realm.taxonomy',
      'realm.navigation', 'zone.navigation'
    ))
);
CREATE INDEX "content_structure_owner_purpose_idx"
  ON "content_structure" ("owner_unit_id", "purpose", "created_at", "id")
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX "content_structure_singleton_purpose_key"
  ON "content_structure" ("owner_unit_id", "purpose")
  WHERE deleted_at IS NULL
    AND purpose IN ('book.contents', 'post.contents', 'realm.taxonomy');

-- Every existing Book and Realm receives its singleton structure, including empty ones.
INSERT INTO "content_structure" (
  "id", "owner_unit_id", "purpose", "created_at", "updated_at"
)
SELECT uuidv7(), owner.id, 'book.contents', owner.created_at, owner.updated_at
FROM "book"
JOIN "unit" AS owner ON owner.id = book.id;

INSERT INTO "content_structure" (
  "id", "owner_unit_id", "purpose", "created_at", "updated_at"
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
  ADD COLUMN "target_url" text NULL;

UPDATE "content_structure_node" AS node
SET "structure_id" = structure.id
FROM "content_structure" AS structure
WHERE structure.owner_unit_id = node.owner_unit_id
  AND structure.purpose = 'book.contents'
  AND structure.deleted_at IS NULL;

ALTER TABLE "content_structure_node" ALTER COLUMN "structure_id" SET NOT NULL;
ALTER TABLE "content_structure_node"
  DROP CONSTRAINT "content_structure_node_owner_unit_id_unit_id_fkey",
  DROP CONSTRAINT "content_structure_node_parent_owner_fkey",
  ADD CONSTRAINT "content_structure_node_document_key_check"
    CHECK (document_key IS NULL OR document_key ~ '^[0-9a-f]{12}$'),
  ADD CONSTRAINT "content_structure_node_target_kind_check"
    CHECK (target_kind IN ('content', 'none', 'unit', 'zone_page', 'external')),
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
  "id", "owner_unit_id", "purpose", "document_key", "created_at", "updated_at"
)
SELECT id, realm_id, 'realm.navigation', document ->> '_key', created_at, updated_at
FROM "realm_navigation";

INSERT INTO "content_structure" (
  "id", "owner_unit_id", "purpose", "document_key", "created_at", "updated_at"
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

CREATE TABLE "unit_revision_component_head" (
  "unit_id" uuid NOT NULL,
  "component_key" text NOT NULL,
  "revision_id" uuid NOT NULL,
  PRIMARY KEY ("unit_id", "component_key"),
  CONSTRAINT "unit_revision_component_head_revision_unit_fkey"
    FOREIGN KEY ("revision_id", "unit_id")
    REFERENCES "unit_revision" ("id", "unit_id") ON DELETE RESTRICT,
  CONSTRAINT "unit_revision_component_head_unit_id_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE,
  CONSTRAINT "unit_revision_component_head_key_check"
    CHECK (btrim(component_key) <> '' AND char_length(component_key) <= 200)
);
CREATE INDEX "unit_revision_component_head_revision_idx"
  ON "unit_revision_component_head" ("revision_id");

-- Attach an immutable full checkpoint to each existing owner's current revision. This makes
-- the migration boundary a real History state: reads, restores, and the first later delta all
-- have a materializable base instead of only a synthetic concurrency token.
CREATE TABLE content_structure_history_checkpoint AS
SELECT
  snapshot.structure_id,
  snapshot.owner_unit_id,
  head.revision_id,
  'content-structure/' || snapshot.structure_id::text AS role,
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
        'purpose', structure.purpose,
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
) AS snapshot
JOIN unit_revision_head AS head ON head.unit_id = snapshot.owner_unit_id;

INSERT INTO revision_content (
  id, model, sha256, byte_size, encoding, base_content_id, delta_depth, payload
)
SELECT
  uuidv7(), 'rezics.content-structure.v1', checkpoint.sha256,
  checkpoint.byte_size, 'full', NULL, 0, checkpoint.payload
FROM content_structure_history_checkpoint AS checkpoint
ON CONFLICT (model, sha256) DO NOTHING;

INSERT INTO unit_revision_slot (
  revision_id, unit_id, role, content_id, origin_revision_id
)
SELECT
  checkpoint.revision_id,
  checkpoint.owner_unit_id,
  checkpoint.role,
  content.id,
  checkpoint.revision_id
FROM content_structure_history_checkpoint AS checkpoint
JOIN revision_content AS content
  ON content.model = 'rezics.content-structure.v1'
  AND content.sha256 = checkpoint.sha256;

-- byte_size is immutable during normal operation. Temporarily suspend only its identity guard
-- while this migration accounts for the newly attached checkpoint slots.
ALTER TABLE unit_revision DISABLE TRIGGER unit_revision_identity_immutable;
UPDATE unit_revision AS revision
SET byte_size = revision.byte_size + checkpoint.byte_size
FROM (
  SELECT revision_id, sum(byte_size)::integer AS byte_size
  FROM content_structure_history_checkpoint
  GROUP BY revision_id
) AS checkpoint
WHERE revision.id = checkpoint.revision_id;
ALTER TABLE unit_revision ENABLE TRIGGER unit_revision_identity_immutable;

INSERT INTO "unit_revision_component_head" ("unit_id", "component_key", "revision_id")
SELECT
  checkpoint.owner_unit_id,
  checkpoint.role,
  checkpoint.revision_id
FROM content_structure_history_checkpoint AS checkpoint
ON CONFLICT ("unit_id", "component_key") DO NOTHING;

DROP TABLE content_structure_history_checkpoint;
DROP TYPE "unit_revision_slot_role";
DROP TABLE "realm_navigation";
DROP TABLE "zone_navigation";
