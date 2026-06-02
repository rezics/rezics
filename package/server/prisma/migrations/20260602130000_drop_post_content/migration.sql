-- Fresh dev cutover: Post stores root submission metadata only. Body content
-- now lives on ContentTranslation rows keyed by (unitId, language).
ALTER TABLE "Post" DROP COLUMN "content";
