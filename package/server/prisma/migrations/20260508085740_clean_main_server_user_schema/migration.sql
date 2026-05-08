/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `accountStatus` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `unitId` on the `User` table. All the data in the column will be lost.
  - Added the required column `userId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ApiToken" DROP CONSTRAINT "ApiToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followerId_fkey";

-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followingId_fkey";

-- DropForeignKey
ALTER TABLE "Unit" DROP CONSTRAINT "Unit_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserUnitProgress" DROP CONSTRAINT "UserUnitProgress_userId_fkey";

-- DropForeignKey
ALTER TABLE "WorkLinkClaim" DROP CONSTRAINT "WorkLinkClaim_claimerUserId_fkey";

-- DropForeignKey
ALTER TABLE "WorkLinkClaim" DROP CONSTRAINT "WorkLinkClaim_resolvedBy_fkey";

-- DropIndex
DROP INDEX "User_accountStatus_idx";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "accountStatus",
DROP COLUMN "unitId",
ADD COLUMN     "userId" UUID NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("userId");

-- DropEnum
DROP TYPE "UserAccountStatus";

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLinkClaim" ADD CONSTRAINT "WorkLinkClaim_claimerUserId_fkey" FOREIGN KEY ("claimerUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLinkClaim" ADD CONSTRAINT "WorkLinkClaim_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUnitProgress" ADD CONSTRAINT "UserUnitProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
