-- CreateTable
CREATE TABLE "BookContentStructureNode" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "bookUnitId" UUID NOT NULL,
    "parentId" UUID,
    "sortKey" TEXT NOT NULL,
    "chapterUnitId" UUID,
    "title" TEXT NOT NULL,
    "noContent" BOOLEAN NOT NULL DEFAULT false,
    "rating" "ContentRating",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookContentStructureNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookContentStructureNode_bookUnitId_parentId_sortKey_idx" ON "BookContentStructureNode"("bookUnitId", "parentId", "sortKey");

-- CreateIndex
CREATE INDEX "BookContentStructureNode_chapterUnitId_idx" ON "BookContentStructureNode"("chapterUnitId");

-- CreateIndex
CREATE INDEX "BookContentStructureNode_bookUnitId_updatedAt_idx" ON "BookContentStructureNode"("bookUnitId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "BookContentStructureNode" ADD CONSTRAINT "BookContentStructureNode_bookUnitId_fkey" FOREIGN KEY ("bookUnitId") REFERENCES "BookContentStructure"("bookUnitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookContentStructureNode" ADD CONSTRAINT "BookContentStructureNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BookContentStructureNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookContentStructureNode" ADD CONSTRAINT "BookContentStructureNode_chapterUnitId_fkey" FOREIGN KEY ("chapterUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
