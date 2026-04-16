-- AlterTable
ALTER TABLE "Unit" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Unit_slug_key" ON "Unit"("slug");
