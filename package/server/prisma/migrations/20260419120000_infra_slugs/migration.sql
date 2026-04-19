-- Backfill Unit.slug for existing infra content (seed tags + default realm).
-- Idempotent: WHERE slug IS NULL clauses skip rows that already have a slug.

-- Default realm: match the official realm by Realm.isOfficial = true.
UPDATE "Unit" u
SET slug = 'rezics'
FROM "Realm" r
WHERE u.id = r."unitId"
  AND r."isOfficial" = TRUE
  AND u.type = 'REALM'
  AND u.slug IS NULL;

-- Content-type tags: match by English translation title. Keep list in sync with
-- `SEED_TAG_SLUGS` in @rezics/contract.
UPDATE "Unit" u
SET slug = 'book'
FROM "UnitTranslation" t
WHERE u.id = t."unitId"
  AND u.type = 'TAG'
  AND t.language = 'en'
  AND t.title = 'Book'
  AND u.slug IS NULL;

UPDATE "Unit" u
SET slug = 'game'
FROM "UnitTranslation" t
WHERE u.id = t."unitId"
  AND u.type = 'TAG'
  AND t.language = 'en'
  AND t.title = 'Game'
  AND u.slug IS NULL;

UPDATE "Unit" u
SET slug = 'media'
FROM "UnitTranslation" t
WHERE u.id = t."unitId"
  AND u.type = 'TAG'
  AND t.language = 'en'
  AND t.title = 'Media'
  AND u.slug IS NULL;

UPDATE "Unit" u
SET slug = 'post'
FROM "UnitTranslation" t
WHERE u.id = t."unitId"
  AND u.type = 'TAG'
  AND t.language = 'en'
  AND t.title = 'Post'
  AND u.slug IS NULL;

UPDATE "Unit" u
SET slug = 'link'
FROM "UnitTranslation" t
WHERE u.id = t."unitId"
  AND u.type = 'TAG'
  AND t.language = 'en'
  AND t.title = 'Link'
  AND u.slug IS NULL;
