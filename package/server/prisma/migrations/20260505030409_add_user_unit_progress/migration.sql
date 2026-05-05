-- CreateEnum
CREATE TYPE "UserUnitProgressStatus" AS ENUM ('BACKLOG', 'ACTIVE', 'COMPLETED', 'DROPPED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "extra" JSONB;

-- CreateTable
CREATE TABLE "UserUnitProgress" (
    "userId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "UserUnitProgressStatus" NOT NULL DEFAULT 'BACKLOG',
    "totalTimeMs" BIGINT NOT NULL DEFAULT 0,
    "lastPosition" TEXT,
    "extra" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserUnitProgress_pkey" PRIMARY KEY ("userId","unitId")
);

-- CreateIndex
CREATE INDEX "UserUnitProgress_userId_lastSeenAt_idx" ON "UserUnitProgress"("userId", "lastSeenAt" DESC);

-- CreateIndex
CREATE INDEX "UserUnitProgress_unitId_status_idx" ON "UserUnitProgress"("unitId", "status");

-- AddForeignKey
ALTER TABLE "UserUnitProgress" ADD CONSTRAINT "UserUnitProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUnitProgress" ADD CONSTRAINT "UserUnitProgress_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
