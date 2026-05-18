-- CreateTable
CREATE TABLE "SubjectAttribution" (
    "unitId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "role" VARCHAR(64) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION,

    CONSTRAINT "SubjectAttribution_pkey" PRIMARY KEY ("unitId","entityId","role")
);

-- CreateIndex
CREATE INDEX "SubjectAttribution_entityId_role_sortOrder_idx" ON "SubjectAttribution"("entityId", "role", "sortOrder");

-- CreateIndex
CREATE INDEX "SubjectAttribution_entityId_sortOrder_idx" ON "SubjectAttribution"("entityId", "sortOrder");

-- CreateIndex
CREATE INDEX "SubjectAttribution_unitId_role_sortOrder_idx" ON "SubjectAttribution"("unitId", "role", "sortOrder");

-- AddForeignKey
ALTER TABLE "SubjectAttribution" ADD CONSTRAINT "SubjectAttribution_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectAttribution" ADD CONSTRAINT "SubjectAttribution_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
