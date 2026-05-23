UPDATE "RevisionContent" c
SET "payload" = c."payload" || jsonb_build_object('legacyChangedKeys', r."changedFieldKeys")
FROM "UnitRevision" r
WHERE r."contentHash" = c."hash"
  AND NOT (c."payload" ? 'legacyChangedKeys');

ALTER TABLE "UnitRevision" DROP COLUMN "changedFieldKeys";
