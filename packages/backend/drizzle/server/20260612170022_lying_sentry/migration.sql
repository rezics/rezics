CREATE TABLE "UnitExternalLink" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unitId" uuid NOT NULL,
	"sourceEntityUnitId" uuid NOT NULL,
	"url" text NOT NULL,
	"normalizedUrl" text,
	"normalizedUrlHash" varchar(64),
	"role" varchar(32) DEFAULT 'related' NOT NULL,
	"labelUnitId" uuid,
	"fallbackText" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "CreditAttributionEvidence" DROP CONSTRAINT "CreditAttributionEvidence_sourceRefId_UnitExternalRef_id_fkey";--> statement-breakpoint
ALTER TABLE "GameSystemRequirement" DROP CONSTRAINT "GameSystemRequirement_sourceRefId_UnitExternalRef_id_fkey";--> statement-breakpoint
ALTER TABLE "UnitExternalRef" DROP CONSTRAINT "UnitExternalRef_5Rjayl5mUUqX_fkey";--> statement-breakpoint
INSERT INTO "UnitExternalLink" (
	"id",
	"unitId",
	"sourceEntityUnitId",
	"url",
	"normalizedUrl",
	"role",
	"sortOrder",
	"createdAt",
	"updatedAt"
)
SELECT
	"id",
	"unitId",
	"sourceSiteEntityUnitId",
	COALESCE("originalUrl", "canonicalUrl"),
	"canonicalUrl",
	'source',
	0,
	"createdAt",
	"updatedAt"
FROM "UnitExternalRef";--> statement-breakpoint
DROP TABLE "SourceSite";--> statement-breakpoint
DROP TABLE "UnitExternalRef";--> statement-breakpoint
ALTER TABLE "CreditAttributionEvidence" RENAME COLUMN "sourceRefId" TO "sourceExternalLinkId";--> statement-breakpoint
ALTER TABLE "GameSystemRequirement" RENAME COLUMN "sourceRefId" TO "sourceExternalLinkId";--> statement-breakpoint
ALTER INDEX "CreditAttributionEvidence_sourceRefId_idx" RENAME TO "CreditAttributionEvidence_sourceExternalLinkId_idx";--> statement-breakpoint
ALTER INDEX "GameSystemRequirement_sourceRefId_idx" RENAME TO "GameSystemRequirement_sourceExternalLinkId_idx";--> statement-breakpoint
CREATE INDEX "UnitExternalLink_unitId_sortOrder_id_idx" ON "UnitExternalLink" ("unitId","sortOrder","id");--> statement-breakpoint
CREATE INDEX "UnitExternalLink_unitId_sourceEntityUnitId_sortOrder_idx" ON "UnitExternalLink" ("unitId","sourceEntityUnitId","sortOrder","id");--> statement-breakpoint
CREATE INDEX "UnitExternalLink_sourceEntityUnitId_unitId_idx" ON "UnitExternalLink" ("sourceEntityUnitId","unitId");--> statement-breakpoint
CREATE INDEX "UnitExternalLink_labelUnitId_idx" ON "UnitExternalLink" ("labelUnitId");--> statement-breakpoint
CREATE UNIQUE INDEX "UnitExternalLink_unit_source_normalized_hash_key" ON "UnitExternalLink" ("unitId","sourceEntityUnitId","normalizedUrlHash");--> statement-breakpoint
ALTER TABLE "CreditAttributionEvidence" ADD CONSTRAINT "CreditAttributionEvidence_JHzUoWUuNrP1_fkey" FOREIGN KEY ("sourceExternalLinkId") REFERENCES "UnitExternalLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitExternalLink" ADD CONSTRAINT "UnitExternalLink_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitExternalLink" ADD CONSTRAINT "UnitExternalLink_sourceEntityUnitId_Entity_unitId_fkey" FOREIGN KEY ("sourceEntityUnitId") REFERENCES "Entity"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitExternalLink" ADD CONSTRAINT "UnitExternalLink_labelUnitId_Unit_id_fkey" FOREIGN KEY ("labelUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "GameSystemRequirement" ADD CONSTRAINT "GameSystemRequirement_yZby2dc9mgKM_fkey" FOREIGN KEY ("sourceExternalLinkId") REFERENCES "UnitExternalLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
