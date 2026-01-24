-- DropForeignKey
ALTER TABLE "public"."Reaction" DROP CONSTRAINT "Reaction_userId_fkey";

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "nsfw" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Reaction_targetId_idx" ON "Reaction"("targetId");

-- CreateIndex
CREATE INDEX "Reaction_userId_reaction_idx" ON "Reaction"("userId", "reaction");

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactionSummary" ADD CONSTRAINT "ReactionSummary_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
