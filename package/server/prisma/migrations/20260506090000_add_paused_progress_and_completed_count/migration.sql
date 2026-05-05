-- AlterEnum
ALTER TYPE "UserUnitProgressStatus" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "UserUnitProgress" ADD COLUMN "completedCount" INTEGER NOT NULL DEFAULT 0;
