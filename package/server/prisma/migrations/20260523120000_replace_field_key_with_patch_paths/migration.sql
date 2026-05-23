ALTER TABLE "UnitFieldLock" DROP CONSTRAINT "UnitFieldLock_pkey";

ALTER TABLE "UnitFieldLock" RENAME COLUMN "fieldKey" TO "path";
ALTER TABLE "UnitFieldLock" ALTER COLUMN "path" TYPE VARCHAR(256);

CREATE TEMP TABLE "_UnitFieldLockPathMap" (
  "oldPath" TEXT PRIMARY KEY,
  "newPath" TEXT,
  "dropReason" TEXT
);

INSERT INTO "_UnitFieldLockPathMap" ("oldPath", "newPath", "dropReason") VALUES
  ('unit.status', 'unit.status', NULL),
  ('unit.visibility', 'unit.visibility', NULL),
  ('unit.rating', 'unit.rating', NULL),
  ('unit.license', 'unit.license', NULL),
  ('unit.defaultLanguage', 'unit.defaultLanguage', NULL),
  ('unit.isLanguageNeutral', 'unit.isLanguageNeutral', NULL),
  ('unit.work', 'unit.work', NULL),
  ('unit.extra', 'unit.extra', NULL),
  ('unit.publishedAt', 'unit.publishedAt', NULL),
  ('identity.title', 'translations', NULL),
  ('identity.subtitle', 'translations', NULL),
  ('identity.summary', 'translations', NULL),
  ('identity.description', 'translations', NULL),
  ('identity.cover', 'translations', NULL),
  ('bibliographic.isbn13', 'extension.isbn13', NULL),
  ('bibliographic.publicationDate', 'extension.publicationDate', NULL),
  ('bibliographic.pageCount', 'extension.pageCount', NULL),
  ('bibliographic.textLength', 'extension.textLength', NULL),
  ('bibliographic.format', 'extension.formatKey', NULL),
  ('bibliographic.isLicensed', 'extension.isLicensed', NULL),
  ('book.contentStructure', 'book.contentStructure', NULL),
  ('entity.kind', 'entity.kind', NULL),
  ('entity.avatar', 'entity.avatar', NULL),
  ('entity.verified', 'entity.verified', NULL),
  ('entity.slug', 'entity.slug', NULL),
  ('entity.eligibleCreditRoles', 'entity.eligibleCreditRoles', NULL),
  ('entity.eligibleSubjectRoles', 'entity.eligibleSubjectRoles', NULL),
  ('game.platform', 'game.platform', NULL),
  ('game.releaseDate', 'game.releaseDate', NULL),
  ('game.developer', 'game.developer', NULL),
  ('game.publisher', 'game.publisher', NULL),
  ('media.kind', 'media.kind', NULL),
  ('media.releaseDate', 'media.releaseDate', NULL),
  ('media.duration', 'media.duration', NULL),
  ('media.studio', 'media.studio', NULL),
  ('credits.authors', 'credits.authors', NULL),
  ('credits.publishers', 'credits.publishers', NULL),
  ('credits.translators', 'credits.translators', NULL),
  ('credits.illustrators', 'credits.illustrators', NULL),
  ('post.body', 'post.body', NULL),
  ('subjects', NULL, 'subjects locks are dropped because subject attributions move into role-keyed editorial paths'),
  ('tags', NULL, 'tags locks are dropped because tags are externally governed');

CREATE TEMP TABLE "_UnitFieldLockMapped" AS
SELECT DISTINCT ON (l."unitId", COALESCE(m."newPath", l."path"))
  l."unitId",
  COALESCE(m."newPath", l."path") AS "path",
  l."lockedById",
  l."reason",
  l."createdAt"
FROM "UnitFieldLock" l
LEFT JOIN "_UnitFieldLockPathMap" m ON m."oldPath" = l."path"
WHERE m."dropReason" IS NULL
ORDER BY l."unitId", COALESCE(m."newPath", l."path"), l."createdAt";

DO $$
DECLARE
  dropped_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO dropped_count
  FROM "UnitFieldLock" l
  JOIN "_UnitFieldLockPathMap" m ON m."oldPath" = l."path"
  WHERE m."dropReason" IS NOT NULL;

  IF dropped_count > 0 THEN
    RAISE WARNING 'Dropped % UnitFieldLock rows whose paths are now externally governed or moved to role-keyed sub-trees', dropped_count;
  END IF;
END $$;

TRUNCATE TABLE "UnitFieldLock";

INSERT INTO "UnitFieldLock" ("unitId", "path", "lockedById", "reason", "createdAt")
SELECT "unitId", "path", "lockedById", "reason", "createdAt"
FROM "_UnitFieldLockMapped";

ALTER TABLE "UnitFieldLock" ADD CONSTRAINT "UnitFieldLock_pkey" PRIMARY KEY ("unitId", "path");
