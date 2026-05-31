ALTER TABLE "Unit" DROP CONSTRAINT IF EXISTS "Unit_translationGroupId_fkey";

DROP INDEX IF EXISTS "Unit_translationGroupId_defaultLanguage_key";
DROP INDEX IF EXISTS "Unit_translationGroupId_idx";

ALTER TABLE "Unit" DROP COLUMN IF EXISTS "translationGroupId";

DROP TABLE IF EXISTS "TranslationGroup";
