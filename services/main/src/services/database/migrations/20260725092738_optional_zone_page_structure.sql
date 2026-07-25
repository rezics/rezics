-- Drop index "content_structure_singleton_kind_key" from table: "content_structure"
DROP INDEX "content_structure_singleton_kind_key";
-- Modify "content_structure" table
ALTER TABLE "content_structure" DROP CONSTRAINT "content_structure_kind_check";
UPDATE "content_structure" SET "kind" = 'page-structure' WHERE "kind" = 'zone.pages';
ALTER TABLE "content_structure" ADD CONSTRAINT "content_structure_kind_check" CHECK (kind = ANY (ARRAY['book.contents'::text, 'post.contents'::text, 'realm.taxonomy'::text, 'realm.navigation'::text, 'zone.navigation'::text, 'page-structure'::text]));
-- Create index "content_structure_singleton_kind_key" to table: "content_structure"
CREATE UNIQUE INDEX "content_structure_singleton_kind_key" ON "content_structure" ("owner_unit_id", "kind") WHERE ((deleted_at IS NULL) AND (kind = ANY (ARRAY['book.contents'::text, 'post.contents'::text, 'realm.taxonomy'::text, 'page-structure'::text])));
-- Create "zone_page" table
CREATE TABLE "zone_page" (
  "id" uuid NOT NULL,
  "zone_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "zone_page_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "zone_page_zone_id_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "zone_page_zone_created_idx" to table: "zone_page"
CREATE INDEX "zone_page_zone_created_idx" ON "zone_page" ("zone_id", "created_at", "id");

-- Existing Zone Page Units were owned through the former mandatory tree.
-- Prefer an active placement, while retaining a Page whose former structure
-- was soft-deleted so the migration does not silently discard its ownership.
WITH ranked_zone_page_owner AS (
  SELECT
    page.id,
    structure.owner_unit_id AS zone_id,
    page.created_at,
    page.updated_at,
    row_number() OVER (
      PARTITION BY page.id
      ORDER BY
        (structure.deleted_at IS NULL AND node.deleted_at IS NULL) DESC,
        structure.updated_at DESC,
        node.updated_at DESC,
        structure.id DESC
    ) AS ownership_rank
  FROM "content_structure" AS structure
  JOIN "content_structure_node" AS node
    ON node.structure_id = structure.id
  JOIN "unit" AS page
    ON page.id = node.content_unit_id
   AND page.kind = 'zone_page'
   AND page.deleted_at IS NULL
  WHERE structure.kind = 'page-structure'
)
INSERT INTO "zone_page" ("id", "zone_id", "created_at", "updated_at")
SELECT id, zone_id, created_at, updated_at
FROM ranked_zone_page_owner
WHERE ownership_rank = 1;

-- Static application routes cannot be Page addresses. Existing conflicting
-- labels become ID-only Pages rather than remaining unreachable slug routes.
DELETE FROM "unit_slug_address" AS address
USING "zone_page" AS page
WHERE address.target_unit_id = page.id
  AND address.scope_unit_id = page.zone_id
  AND address.slug = ANY (ARRAY['manage'::text, 'page'::text, 'search'::text]);

-- page-structure is now only an optional visual index. Root nodes have no
-- homepage or ownership meaning, so the old cross-table root invariants end.
DROP TRIGGER IF EXISTS "zone_pages_structure_owner" ON "content_structure";
DROP FUNCTION IF EXISTS "zone_pages_validate_structure"();
DROP TRIGGER IF EXISTS "zone_pages_node_invariants" ON "content_structure_node";
DROP FUNCTION IF EXISTS "zone_pages_validate_node"();
