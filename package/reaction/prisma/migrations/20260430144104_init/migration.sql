-- CreateTable
CREATE TABLE "Reaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "reaction" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionSummary" (
    "targetId" UUID NOT NULL,
    "reaction" VARCHAR(32) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReactionSummary_pkey" PRIMARY KEY ("targetId","reaction")
);

-- CreateIndex
CREATE INDEX "Reaction_targetId_idx" ON "Reaction"("targetId");

-- CreateIndex
CREATE INDEX "Reaction_targetId_reaction_idx" ON "Reaction"("targetId", "reaction");

-- CreateIndex
CREATE INDEX "Reaction_userId_reaction_idx" ON "Reaction"("userId", "reaction");

-- CreateIndex
CREATE INDEX "Reaction_userId_createdAt_idx" ON "Reaction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_targetId_reaction_key" ON "Reaction"("userId", "targetId", "reaction");

-- CreateIndex
CREATE INDEX "ReactionSummary_targetId_idx" ON "ReactionSummary"("targetId");
