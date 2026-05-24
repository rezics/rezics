-- CreateEnum
CREATE TYPE "UnitAliasKind" AS ENUM ('COMMON', 'ABBREVIATION', 'TRANSLITERATION', 'ALTERNATE_TITLE', 'LEGACY_TITLE', 'MISSPELLING', 'OTHER');

-- CreateEnum
CREATE TYPE "UnitAliasStatus" AS ENUM ('ACTIVE', 'HIDDEN');

-- CreateTable
CREATE TABLE "UnitAlias" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "unitId" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "language" VARCHAR(16),
    "kind" "UnitAliasKind" NOT NULL DEFAULT 'COMMON',
    "status" "UnitAliasStatus" NOT NULL DEFAULT 'ACTIVE',
    "score" INTEGER NOT NULL DEFAULT 0,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "position" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitAliasVote" (
    "aliasId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitAliasVote_pkey" PRIMARY KEY ("aliasId","userId")
);

-- CreateIndex
CREATE INDEX "UnitAlias_normalizedValue_idx" ON "UnitAlias"("normalizedValue");

-- CreateIndex
CREATE INDEX "UnitAlias_unitId_pinned_position_idx" ON "UnitAlias"("unitId", "pinned", "position");

-- CreateIndex
CREATE INDEX "UnitAlias_unitId_status_score_idx" ON "UnitAlias"("unitId", "status", "score");

-- CreateIndex
CREATE INDEX "UnitAlias_status_score_idx" ON "UnitAlias"("status", "score");

-- CreateIndex
CREATE INDEX "UnitAlias_createdById_createdAt_idx" ON "UnitAlias"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UnitAlias_unitId_normalizedValue_key" ON "UnitAlias"("unitId", "normalizedValue");

-- CreateIndex
CREATE INDEX "UnitAliasVote_userId_idx" ON "UnitAliasVote"("userId");

-- AddForeignKey
ALTER TABLE "UnitAlias" ADD CONSTRAINT "UnitAlias_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitAlias" ADD CONSTRAINT "UnitAlias_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitAlias" ADD CONSTRAINT "UnitAlias_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitAliasVote" ADD CONSTRAINT "UnitAliasVote_aliasId_fkey" FOREIGN KEY ("aliasId") REFERENCES "UnitAlias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitAliasVote" ADD CONSTRAINT "UnitAliasVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;
