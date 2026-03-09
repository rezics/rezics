/*
  Warnings:

  - You are about to drop the column `slug` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_slug_idx";

-- DropIndex
DROP INDEX "User_slug_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "slug";

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "bio" TEXT,
    "avatar" TEXT,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_slug_key" ON "UserProfile"("slug");

-- CreateIndex
CREATE INDEX "UserProfile_slug_idx" ON "UserProfile"("slug");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
