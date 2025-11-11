-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ReadList" (
    "unitId" UUID NOT NULL DEFAULT uuidv7(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadList_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "_ReadListForBook" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ReadListForBook_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ReviewForReadList" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ReviewForReadList_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ReadListForBook_B_index" ON "_ReadListForBook"("B");

-- CreateIndex
CREATE INDEX "_ReviewForReadList_B_index" ON "_ReviewForReadList"("B");

-- AddForeignKey
ALTER TABLE "ReadList" ADD CONSTRAINT "ReadList_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReadListForBook" ADD CONSTRAINT "_ReadListForBook_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReadListForBook" ADD CONSTRAINT "_ReadListForBook_B_fkey" FOREIGN KEY ("B") REFERENCES "ReadList"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReviewForReadList" ADD CONSTRAINT "_ReviewForReadList_A_fkey" FOREIGN KEY ("A") REFERENCES "ReadList"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReviewForReadList" ADD CONSTRAINT "_ReviewForReadList_B_fkey" FOREIGN KEY ("B") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
