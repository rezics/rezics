-- AlterTable
ALTER TABLE "ReadList" ADD COLUMN     "order" TEXT[] DEFAULT ARRAY[]::TEXT[];
