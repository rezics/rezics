/*
  Warnings:

  - You are about to drop the column `chaptersIndex` on the `Book` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Book" DROP COLUMN "chaptersIndex",
ALTER COLUMN "unitId" SET DEFAULT uuidv7();

-- AlterTable
ALTER TABLE "CommentIndex" ALTER COLUMN "unitId" SET DEFAULT uuidv7();

-- CreateTable
CREATE TABLE "BookIndex" (
    "bookUnitId" UUID NOT NULL,
    "index" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookIndex_pkey" PRIMARY KEY ("bookUnitId")
);

-- AddForeignKey
ALTER TABLE "BookIndex" ADD CONSTRAINT "BookIndex_bookUnitId_fkey" FOREIGN KEY ("bookUnitId") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;
