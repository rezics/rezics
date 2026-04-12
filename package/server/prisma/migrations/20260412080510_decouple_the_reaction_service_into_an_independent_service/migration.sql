/*
  Warnings:

  - You are about to drop the `Reaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReactionSummary` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_targetId_fkey";

-- DropForeignKey
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "ReactionSummary" DROP CONSTRAINT "ReactionSummary_targetId_fkey";

-- DropTable
DROP TABLE "Reaction";

-- DropTable
DROP TABLE "ReactionSummary";
