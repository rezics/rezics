/*
  Warnings:

  - The primary key for the `Book` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `postId` on the `Book` table. All the data in the column will be lost.
  - The primary key for the `CommentIndex` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `postId` on the `CommentIndex` table. All the data in the column will be lost.
  - You are about to drop the column `rootPostId` on the `CommentIndex` table. All the data in the column will be lost.
  - The primary key for the `Rating` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `postId` on the `Rating` table. All the data in the column will be lost.
  - The primary key for the `Tag` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `postId` on the `Tag` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PostReactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PostStats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_PostDomains` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_PostTags` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[unitId,name,type]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `unitId` to the `Book` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rootUnitId` to the `CommentIndex` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitId` to the `CommentIndex` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitId` to the `Rating` table without a default value. This is not possible if the table is not empty.
  - The required column `unitId` was added to the `Tag` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `unitId` was added to the `User` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('BOOK', 'COMMENT', 'NOTE', 'REVIEW', 'QUOTE', 'READLIST', 'IMAGE', 'VIDEO', 'CHAPTER');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DELETED', 'FROZEN');

-- DropForeignKey
ALTER TABLE "public"."Book" DROP CONSTRAINT "Book_postId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CommentIndex" DROP CONSTRAINT "CommentIndex_parentCommentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CommentIndex" DROP CONSTRAINT "CommentIndex_postId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CommentIndex" DROP CONSTRAINT "CommentIndex_rootPostId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Post" DROP CONSTRAINT "Post_targetPostId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Post" DROP CONSTRAINT "Post_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PostReactions" DROP CONSTRAINT "PostReactions_postId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PostStats" DROP CONSTRAINT "PostStats_postId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Tag" DROP CONSTRAINT "Tag_postId_fkey";

-- DropForeignKey
ALTER TABLE "public"."_BookToUser" DROP CONSTRAINT "_BookToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_BookToUser" DROP CONSTRAINT "_BookToUser_B_fkey";

-- DropForeignKey
ALTER TABLE "public"."_PostDomains" DROP CONSTRAINT "_PostDomains_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_PostDomains" DROP CONSTRAINT "_PostDomains_B_fkey";

-- DropForeignKey
ALTER TABLE "public"."_PostTags" DROP CONSTRAINT "_PostTags_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_PostTags" DROP CONSTRAINT "_PostTags_B_fkey";

-- DropIndex
DROP INDEX "public"."CommentIndex_rootPostId_depth_idx";

-- DropIndex
DROP INDEX "public"."Tag_postId_name_type_key";

-- AlterTable
ALTER TABLE "Book" DROP CONSTRAINT "Book_pkey",
DROP COLUMN "postId",
ADD COLUMN     "unitId" UUID NOT NULL,
ADD CONSTRAINT "Book_pkey" PRIMARY KEY ("unitId");

-- AlterTable
ALTER TABLE "CommentIndex" DROP CONSTRAINT "CommentIndex_pkey",
DROP COLUMN "postId",
DROP COLUMN "rootPostId",
ADD COLUMN     "rootUnitId" UUID NOT NULL,
ADD COLUMN     "unitId" UUID NOT NULL,
ADD CONSTRAINT "CommentIndex_pkey" PRIMARY KEY ("unitId");

-- AlterTable
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_pkey",
DROP COLUMN "postId",
ADD COLUMN     "unitId" UUID NOT NULL,
ADD CONSTRAINT "Rating_pkey" PRIMARY KEY ("unitId", "userId");

-- AlterTable
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_pkey",
DROP COLUMN "postId",
ADD COLUMN     "unitId" UUID NOT NULL,
ADD CONSTRAINT "Tag_pkey" PRIMARY KEY ("unitId");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "id",
ADD COLUMN     "unitId" UUID NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("unitId");

-- DropTable
DROP TABLE "public"."Post";

-- DropTable
DROP TABLE "public"."PostReactions";

-- DropTable
DROP TABLE "public"."PostStats";

-- DropTable
DROP TABLE "public"."_PostDomains";

-- DropTable
DROP TABLE "public"."_PostTags";

-- DropEnum
DROP TYPE "public"."PostStatus";

-- DropEnum
DROP TYPE "public"."PostType";

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "UnitType" NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "content" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "targetUnitId" UUID,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitStats" (
    "unitId" UUID NOT NULL,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitStats_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "UnitReactions" (
    "unitId" UUID NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "dislikeCount" INTEGER NOT NULL DEFAULT 0,
    "loveCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitReactions_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "_UnitDomains" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_UnitDomains_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_UnitTags" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_UnitTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Unit_type_status_createdAt_idx" ON "Unit"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Unit_userId_createdAt_idx" ON "Unit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Unit_targetUnitId_idx" ON "Unit"("targetUnitId");

-- CreateIndex
CREATE INDEX "_UnitDomains_B_index" ON "_UnitDomains"("B");

-- CreateIndex
CREATE INDEX "_UnitTags_B_index" ON "_UnitTags"("B");

-- CreateIndex
CREATE INDEX "CommentIndex_rootUnitId_depth_idx" ON "CommentIndex"("rootUnitId", "depth");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_unitId_name_type_key" ON "Tag"("unitId", "name", "type");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_targetUnitId_fkey" FOREIGN KEY ("targetUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentIndex" ADD CONSTRAINT "CommentIndex_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentIndex" ADD CONSTRAINT "CommentIndex_rootUnitId_fkey" FOREIGN KEY ("rootUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentIndex" ADD CONSTRAINT "CommentIndex_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitStats" ADD CONSTRAINT "UnitStats_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitReactions" ADD CONSTRAINT "UnitReactions_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnitDomains" ADD CONSTRAINT "_UnitDomains_A_fkey" FOREIGN KEY ("A") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnitDomains" ADD CONSTRAINT "_UnitDomains_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookToUser" ADD CONSTRAINT "_BookToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookToUser" ADD CONSTRAINT "_BookToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnitTags" ADD CONSTRAINT "_UnitTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Tag"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnitTags" ADD CONSTRAINT "_UnitTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
