-- AlterEnum
ALTER TYPE "UnitType" ADD VALUE 'ZONE';

-- CreateTable
CREATE TABLE "Zone" (
    "unitId" UUID NOT NULL,
    "filters" JSONB NOT NULL,
    "template" VARCHAR(64) NOT NULL,
    "styling" JSONB,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("unitId")
);

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
