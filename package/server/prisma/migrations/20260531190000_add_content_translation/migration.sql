CREATE TYPE "ContentTranslationStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
);

CREATE TABLE "ContentTranslation" (
    "unitId" UUID NOT NULL,
    "language" VARCHAR(16) NOT NULL,
    "content" JSONB NOT NULL,
    "status" "ContentTranslationStatus" NOT NULL DEFAULT 'PUBLISHED',
    "sourceUnitId" UUID,
    "authorUserId" UUID,
    "provenance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentTranslation_pkey" PRIMARY KEY ("unitId","language")
);

CREATE INDEX "ContentTranslation_language_status_idx"
    ON "ContentTranslation"("language", "status");

CREATE INDEX "ContentTranslation_status_updatedAt_idx"
    ON "ContentTranslation"("status", "updatedAt");

CREATE INDEX "ContentTranslation_sourceUnitId_idx"
    ON "ContentTranslation"("sourceUnitId");

CREATE INDEX "ContentTranslation_authorUserId_idx"
    ON "ContentTranslation"("authorUserId");

ALTER TABLE "ContentTranslation"
    ADD CONSTRAINT "ContentTranslation_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
