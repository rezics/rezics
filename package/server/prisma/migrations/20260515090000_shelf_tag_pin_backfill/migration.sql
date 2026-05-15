-- Backfill: pin existing seed-tag UnitTag rows on user-created shelves.
--
-- Existing user-created shelves were persisted with `pinned = false` because
-- the create path did not set the flag. The mapper now projects only
-- `pinned = true` rows into `shelfDTO.tags`, which is what the
-- `CollectionModal` filter chain consumes. This step lifts those legacy rows
-- into the pinned set so previously-invisible shelves resurface.
--
-- Scope:
--   - `tagUnitId` is one of the five seed-tag Unit ids (resolved by slug from
--     the `Unit` table — slugs match `SEED_TAG_SLUGS` in @rezics/contract).
--   - `unitId` belongs to a SHELF Unit. Non-shelf units with seed-tag rows
--     are not touched.
--   - Only rows currently `pinned = false` are updated. Already-pinned rows
--     (e.g. seed-installed demo shelves) are skipped.
--
-- Idempotency: re-running this migration is a no-op because the `pinned = false`
-- predicate excludes any row already lifted.

UPDATE "UnitTag"
SET "pinned" = true
WHERE "pinned" = false
  AND "tagUnitId" IN (
    SELECT id
    FROM "Unit"
    WHERE type = 'TAG'
      AND slug IN ('book', 'game', 'media', 'post', 'link')
  )
  AND "unitId" IN (
    SELECT id FROM "Unit" WHERE type = 'SHELF'
  );
