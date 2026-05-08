/*
  Warnings:

  - You are about to drop the column `emailVerificationSource` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerifiedAt` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserAccountStatus" AS ENUM ('PROFILE_SETUP_REQUIRED', 'MEMBER_READY');

-- CreateEnum
CREATE TYPE "EmailVerificationContractStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerificationSource",
DROP COLUMN "emailVerifiedAt",
ADD COLUMN     "accountStatus" "UserAccountStatus" NOT NULL DEFAULT 'MEMBER_READY',
ALTER COLUMN "slug" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;

-- CreateTable
CREATE TABLE "EmailVerificationContract" (
    "id" UUID NOT NULL,
    "contractName" VARCHAR(96) NOT NULL,
    "ownerId" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "status" "EmailVerificationContractStatus" NOT NULL DEFAULT 'PENDING',
    "codeHash" TEXT,
    "deliveryStatus" VARCHAR(64),
    "source" VARCHAR(64),
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailVerificationContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailVerificationContract_contractName_ownerId_status_idx" ON "EmailVerificationContract"("contractName", "ownerId", "status");

-- CreateIndex
CREATE INDEX "EmailVerificationContract_email_idx" ON "EmailVerificationContract"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationContract_contractName_ownerId_email_key" ON "EmailVerificationContract"("contractName", "ownerId", "email");

-- CreateIndex
CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");
