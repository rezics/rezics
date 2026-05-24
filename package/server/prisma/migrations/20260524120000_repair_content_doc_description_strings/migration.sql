-- Repair development rows seeded after the ContentDoc cutover where JSONB
-- description columns contain JSON strings instead of ContentDoc objects.
-- After applying this migration to a seeded local database, refresh search
-- projections with:
--   bun --filter=@rezics/server run seed:init-meili-search
-- To rerun the same repair after a local reseed:
--   bun --filter=@rezics/server run repair:content-doc-descriptions

UPDATE "User"
SET "description" = CASE
  WHEN btrim("description" #>> '{}') = '' THEN NULL
  ELSE jsonb_build_object(
    'schema', 'rezics.content',
    'version', 1,
    'main', jsonb_build_object(
      'type', 'markdown',
      'source', "description" #>> '{}'
    )
  )
END
WHERE jsonb_typeof("description") = 'string';

UPDATE "UnitTranslation"
SET "description" = CASE
  WHEN btrim("description" #>> '{}') = '' THEN NULL
  ELSE jsonb_build_object(
    'schema', 'rezics.content',
    'version', 1,
    'main', jsonb_build_object(
      'type', 'markdown',
      'source', "description" #>> '{}'
    )
  )
END
WHERE jsonb_typeof("description") = 'string';
