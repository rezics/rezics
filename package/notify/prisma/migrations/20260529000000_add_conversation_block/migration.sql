-- CreateTable
CREATE TABLE "ConversationBlock" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationBlock_blockerId_idx" ON "ConversationBlock"("blockerId");

-- CreateIndex
CREATE INDEX "ConversationBlock_blockedId_idx" ON "ConversationBlock"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationBlock_blockerId_blockedId_key" ON "ConversationBlock"("blockerId", "blockedId");
