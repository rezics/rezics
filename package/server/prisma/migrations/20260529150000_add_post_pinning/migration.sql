-- add-post-pinning-and-accepted-answer: generic in-thread promotion overlay.
-- Additive; no backfill. Depends on the ltree redesign having landed.

-- CreateEnum
CREATE TYPE "PinKind" AS ENUM ('ACCEPTED_ANSWER', 'PINNED', 'HIGHLIGHT');

-- CreateTable
CREATE TABLE "PostPin" (
    "scopeUnitId" UUID NOT NULL,
    "postUnitId" UUID NOT NULL,
    "kind" "PinKind" NOT NULL,
    "position" VARCHAR(64) NOT NULL,
    "byUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostPin_pkey" PRIMARY KEY ("scopeUnitId", "postUnitId")
);

-- CreateIndex
CREATE INDEX "PostPin_scopeUnitId_kind_position_idx" ON "PostPin"("scopeUnitId", "kind", "position");

-- CreateIndex
CREATE INDEX "PostPin_postUnitId_idx" ON "PostPin"("postUnitId");

-- AddForeignKey
ALTER TABLE "PostPin" ADD CONSTRAINT "PostPin_scopeUnitId_fkey" FOREIGN KEY ("scopeUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPin" ADD CONSTRAINT "PostPin_postUnitId_fkey" FOREIGN KEY ("postUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
