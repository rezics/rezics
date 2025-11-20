/*
  Warnings:

  - You are about to drop the column `targetType` on the `Reaction` table. All the data in the column will be lost.
  - The primary key for the `ReactionSummary` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `targetType` on the `ReactionSummary` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,targetId,reaction]` on the table `Reaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Reaction_targetType_targetId_idx";

-- DropIndex
DROP INDEX "public"."Reaction_userId_targetType_targetId_reaction_key";

-- AlterTable
ALTER TABLE "Reaction" DROP COLUMN "targetType";

-- AlterTable
ALTER TABLE "ReactionSummary" DROP CONSTRAINT "ReactionSummary_pkey",
DROP COLUMN "targetType",
ADD CONSTRAINT "ReactionSummary_pkey" PRIMARY KEY ("targetId", "reaction");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_targetId_reaction_key" ON "Reaction"("userId", "targetId", "reaction");
