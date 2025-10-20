/*
  Warnings:

  - You are about to drop the `_BookToUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserType" ADD VALUE 'PRESS';
ALTER TYPE "UserType" ADD VALUE 'PRODUCER';

-- DropForeignKey
ALTER TABLE "public"."_BookToUser" DROP CONSTRAINT "_BookToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_BookToUser" DROP CONSTRAINT "_BookToUser_B_fkey";

-- DropTable
DROP TABLE "public"."_BookToUser";

-- CreateTable
CREATE TABLE "_BookAuthor" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_BookAuthor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BookPress" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_BookPress_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BookProducer" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_BookProducer_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_BookAuthor_B_index" ON "_BookAuthor"("B");

-- CreateIndex
CREATE INDEX "_BookPress_B_index" ON "_BookPress"("B");

-- CreateIndex
CREATE INDEX "_BookProducer_B_index" ON "_BookProducer"("B");

-- AddForeignKey
ALTER TABLE "_BookAuthor" ADD CONSTRAINT "_BookAuthor_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookAuthor" ADD CONSTRAINT "_BookAuthor_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookPress" ADD CONSTRAINT "_BookPress_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookPress" ADD CONSTRAINT "_BookPress_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookProducer" ADD CONSTRAINT "_BookProducer_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookProducer" ADD CONSTRAINT "_BookProducer_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;
