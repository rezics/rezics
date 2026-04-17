-- CreateTable
CREATE TABLE "TranslationGroup" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "supportedLanguages" VARCHAR(16)[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranslationGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN "translationGroupId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Unit_translationGroupId_defaultLanguage_key" ON "Unit"("translationGroupId", "defaultLanguage");

-- CreateIndex
-- Partial index: only the small slice of Units that participate in a wiki
-- translation group is indexed. The Unit table is projected at 10M+ rows,
-- the vast majority of which have translationGroupId = NULL; a full index on
-- a mostly-NULL column is wasted space. Filtering NULLs out keeps the index
-- bounded by the (much smaller) population of multilingual posts.
-- (Replaces the default `@@index([translationGroupId])` Prisma would emit.)
CREATE INDEX "Unit_translationGroupId_idx" ON "Unit"("translationGroupId") WHERE "translationGroupId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_translationGroupId_fkey" FOREIGN KEY ("translationGroupId") REFERENCES "TranslationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
