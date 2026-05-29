-- add-poll: poll/voting primitive — third instance of the scored-junction +
-- per-user-vote pattern. Only the act of polling is a Unit(type=POLL); options
-- and votes are plain rows. Additive; no backfill.

-- AlterEnum
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'POLL';

-- CreateEnum
CREATE TYPE "PollVoteMode" AS ENUM ('SINGLE', 'MULTI');

-- CreateEnum
CREATE TYPE "PollResultVisibility" AS ENUM ('LIVE', 'AFTER_CLOSE');

-- CreateTable
CREATE TABLE "Poll" (
    "unitId" UUID NOT NULL,
    "voteMode" "PollVoteMode" NOT NULL DEFAULT 'SINGLE',
    "resultVisibility" "PollResultVisibility" NOT NULL DEFAULT 'LIVE',
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "pollUnitId" UUID NOT NULL,
    "optionId" UUID NOT NULL DEFAULT uuidv7(),
    "position" VARCHAR(64) NOT NULL,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "unitId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("pollUnitId", "optionId")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "pollUnitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "voteMode" "PollVoteMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("pollUnitId", "userId", "optionId")
);

-- CreateIndex
CREATE INDEX "PollOption_pollUnitId_position_idx" ON "PollOption"("pollUnitId", "position");

-- CreateIndex
CREATE INDEX "PollOption_unitId_idx" ON "PollOption"("unitId");

-- CreateIndex
CREATE INDEX "PollVote_pollUnitId_optionId_idx" ON "PollVote"("pollUnitId", "optionId");

-- CreateIndex
CREATE INDEX "PollVote_userId_idx" ON "PollVote"("userId");

-- CreateIndex
-- Single-choice exclusivity enforced at the database layer: at most one vote
-- row per (poll, user) when the poll is SINGLE. Prisma cannot express a partial
-- unique index, so it is owned by this migration (cf. the post ltree GiST
-- index). MULTI polls are unconstrained beyond the composite primary key.
CREATE UNIQUE INDEX "PollVote_single_choice_uniq" ON "PollVote"("pollUnitId", "userId") WHERE "voteMode" = 'SINGLE';

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollUnitId_fkey" FOREIGN KEY ("pollUnitId") REFERENCES "Poll"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollUnitId_fkey" FOREIGN KEY ("pollUnitId") REFERENCES "Poll"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollUnitId_optionId_fkey" FOREIGN KEY ("pollUnitId", "optionId") REFERENCES "PollOption"("pollUnitId", "optionId") ON DELETE CASCADE ON UPDATE CASCADE;
