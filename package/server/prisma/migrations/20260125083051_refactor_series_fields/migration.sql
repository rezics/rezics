/*
  Warnings:

  - You are about to drop the `Series` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Series" DROP CONSTRAINT "Series_unitId_fkey";

-- DropForeignKey
ALTER TABLE "SeriesBook" DROP CONSTRAINT "SeriesBook_seriesId_fkey";

-- DropTable
DROP TABLE "Series";

-- AddForeignKey
ALTER TABLE "SeriesBook" ADD CONSTRAINT "SeriesBook_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;
