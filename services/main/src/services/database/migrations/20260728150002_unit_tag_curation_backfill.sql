-- Normalize legacy rows before enforcing the pin and position invariant.
UPDATE "unit_tag"
SET "pinned" = false
WHERE "pinned" AND "position" IS NULL;

UPDATE "unit_tag"
SET "position" = NULL
WHERE NOT "pinned" AND "position" IS NOT NULL;

WITH "duplicate_positions" AS (
  SELECT
    "unit_id",
    "tag_id",
    row_number() OVER (
      PARTITION BY "unit_id", "position"
      ORDER BY "tag_id"
    ) AS "position_rank"
  FROM "unit_tag"
  WHERE "pinned"
)
UPDATE "unit_tag" AS "application"
SET "pinned" = false, "position" = NULL
FROM "duplicate_positions"
WHERE "application"."unit_id" = "duplicate_positions"."unit_id"
  AND "application"."tag_id" = "duplicate_positions"."tag_id"
  AND "duplicate_positions"."position_rank" > 1;
