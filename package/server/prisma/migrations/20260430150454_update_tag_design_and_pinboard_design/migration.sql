-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "RealmTagUnit" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "WorkLinkClaim" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "releaseUnitId" UUID NOT NULL,
    "workUnitId" UUID NOT NULL,
    "claimerUserId" UUID NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" UUID,

    CONSTRAINT "WorkLinkClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkLinkClaim_workUnitId_status_idx" ON "WorkLinkClaim"("workUnitId", "status");

-- CreateIndex
CREATE INDEX "WorkLinkClaim_claimerUserId_status_idx" ON "WorkLinkClaim"("claimerUserId", "status");

-- CreateIndex
CREATE INDEX "WorkLinkClaim_releaseUnitId_status_idx" ON "WorkLinkClaim"("releaseUnitId", "status");

-- AddForeignKey
ALTER TABLE "WorkLinkClaim" ADD CONSTRAINT "WorkLinkClaim_releaseUnitId_fkey" FOREIGN KEY ("releaseUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLinkClaim" ADD CONSTRAINT "WorkLinkClaim_workUnitId_fkey" FOREIGN KEY ("workUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLinkClaim" ADD CONSTRAINT "WorkLinkClaim_claimerUserId_fkey" FOREIGN KEY ("claimerUserId") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLinkClaim" ADD CONSTRAINT "WorkLinkClaim_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;
