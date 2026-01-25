/*
  Warnings:

  - You are about to alter the column `textLength` on the `Book` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "anchorId" UUID,
ADD COLUMN     "language" TEXT DEFAULT 'zh-CN',
ALTER COLUMN "textLength" SET DATA TYPE INTEGER;

-- CreateTable
CREATE TABLE "Series" (
    "unitId" UUID NOT NULL DEFAULT uuidv7(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "anchorId" UUID,
    "language" TEXT DEFAULT 'zh-CN',
    "coverUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "SeriesBook" (
    "seriesId" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "volumeLabel" TEXT,

    CONSTRAINT "SeriesBook_pkey" PRIMARY KEY ("seriesId","bookId")
);

-- CreateTable
CREATE TABLE "UnitLocalizations" (
    "unitId" UUID NOT NULL,
    "languageIndex" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitLocalizations_pkey" PRIMARY KEY ("unitId")
);

-- CreateIndex
CREATE INDEX "SeriesBook_seriesId_sortOrder_idx" ON "SeriesBook"("seriesId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesBook" ADD CONSTRAINT "SeriesBook_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesBook" ADD CONSTRAINT "SeriesBook_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;
