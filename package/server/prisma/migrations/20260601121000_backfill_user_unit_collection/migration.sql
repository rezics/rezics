-- Backfill per-user collection metadata from existing shelf containment.
--
-- ShelfUnit remains the containment source of truth; this only initializes the
-- shared per-user/per-unit metadata row. No shelf-item tag table ever landed, so
-- there is no legacy per-shelf tag state to migrate into UserTagApplication.

INSERT INTO "UserUnitCollection" (
  "userId",
  "unitId",
  "searchText",
  "createdAt",
  "updatedAt"
)
SELECT DISTINCT
  shelf_unit."userId",
  shelf_item."unitId",
  NULL,
  now(),
  now()
FROM "ShelfUnit" shelf_item
JOIN "Shelf" shelf ON shelf."unitId" = shelf_item."shelfId"
JOIN "Unit" shelf_unit ON shelf_unit."id" = shelf."unitId"
WHERE shelf_unit."userId" IS NOT NULL
ON CONFLICT ("userId", "unitId") DO NOTHING;
