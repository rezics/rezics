/*
  Warnings:

  - You are about to drop the `Follow` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followerId_fkey";

-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followingId_fkey";

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "subscriberCount" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "Follow";

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "subscriberUnitId" UUID NOT NULL,
    "targetUnitId" UUID NOT NULL,
    "channels" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_targetUnitId_idx" ON "Subscription"("targetUnitId");

-- CreateIndex
CREATE INDEX "Subscription_subscriberUnitId_idx" ON "Subscription"("subscriberUnitId");

-- CreateIndex
CREATE INDEX "subscription_channels_gin" ON "Subscription" USING GIN ("channels");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_subscriberUnitId_targetUnitId_key" ON "Subscription"("subscriberUnitId", "targetUnitId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriberUnitId_fkey" FOREIGN KEY ("subscriberUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_targetUnitId_fkey" FOREIGN KEY ("targetUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
