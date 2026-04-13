-- CreateTable
CREATE TABLE "ScoreEntry" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "realm" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "fields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreAggregate" (
    "unitId" UUID NOT NULL,
    "realm" UUID NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "distribution" JSONB NOT NULL,
    "fields" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreAggregate_pkey" PRIMARY KEY ("unitId","realm")
);

-- CreateTable
CREATE TABLE "ScoreRealmField" (
    "realm" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreRealmField_pkey" PRIMARY KEY ("realm","key")
);

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "scoreEntryId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_userId_unitId_realm_key" ON "ScoreEntry"("userId", "unitId", "realm");

-- CreateIndex
CREATE INDEX "ScoreEntry_unitId_realm_idx" ON "ScoreEntry"("unitId", "realm");

-- CreateIndex
CREATE INDEX "ScoreEntry_userId_unitId_idx" ON "ScoreEntry"("userId", "unitId");

-- CreateIndex
CREATE INDEX "ScoreRealmField_realm_sortOrder_idx" ON "ScoreRealmField"("realm", "sortOrder");

-- CreateIndex
CREATE INDEX "Post_scoreEntryId_idx" ON "Post"("scoreEntryId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_scoreEntryId_fkey" FOREIGN KEY ("scoreEntryId") REFERENCES "ScoreEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropTable
DROP TABLE "Rating";
