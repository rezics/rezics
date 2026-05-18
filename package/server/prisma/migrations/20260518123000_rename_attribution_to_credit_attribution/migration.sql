-- Rename the creator/production credit relation now that subject indexing has
-- its own SubjectAttribution table.
ALTER TABLE "Attribution" RENAME TO "CreditAttribution";

ALTER TABLE "CreditAttribution" RENAME CONSTRAINT "Attribution_pkey" TO "CreditAttribution_pkey";
ALTER TABLE "CreditAttribution" RENAME CONSTRAINT "Attribution_unitId_fkey" TO "CreditAttribution_unitId_fkey";
ALTER TABLE "CreditAttribution" RENAME CONSTRAINT "Attribution_entityId_fkey" TO "CreditAttribution_entityId_fkey";

ALTER INDEX "Attribution_entityId_role_idx" RENAME TO "CreditAttribution_entityId_role_idx";
ALTER INDEX "Attribution_unitId_role_sortOrder_idx" RENAME TO "CreditAttribution_unitId_role_sortOrder_idx";
