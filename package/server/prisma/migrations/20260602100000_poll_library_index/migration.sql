-- Poll library index support: weak post↔poll references, denormalized usage
-- count, and vote rows ready for optional realm context metadata.

ALTER TABLE "Poll" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PostPollReference" (
    "postUnitId" UUID NOT NULL,
    "pollUnitId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostPollReference_pkey" PRIMARY KEY ("postUnitId", "pollUnitId")
);

CREATE INDEX "PostPollReference_postUnitId_idx" ON "PostPollReference"("postUnitId");
CREATE INDEX "PostPollReference_pollUnitId_idx" ON "PostPollReference"("pollUnitId");

ALTER TABLE "PollVote" ADD COLUMN "id" UUID NOT NULL DEFAULT uuidv7();
ALTER TABLE "PollVote" ADD COLUMN "realmUnitId" UUID;
ALTER TABLE "PollVote" DROP CONSTRAINT "PollVote_pkey";
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "PollVote_pollUnitId_userId_optionId_key"
ON "PollVote"("pollUnitId", "userId", "optionId");

CREATE INDEX "PollVote_pollUnitId_userId_idx" ON "PollVote"("pollUnitId", "userId");
CREATE INDEX "PollVote_pollUnitId_realmUnitId_optionId_idx"
ON "PollVote"("pollUnitId", "realmUnitId", "optionId");
