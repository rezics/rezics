/*
  Warnings:

  - A unique constraint covering the columns `[authUserId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authUserId" UUID,
ADD COLUMN     "email" VARCHAR(320),
ADD COLUMN     "emailVerificationSource" VARCHAR(64),
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
