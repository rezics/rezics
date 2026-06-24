ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "referenceCount" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "PostUnitReference" (
  "sourcePostUnitId" uuid NOT NULL,
  "targetUnitId" uuid NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "PostUnitReference_pkey" PRIMARY KEY ("sourcePostUnitId", "targetUnitId"),
  CONSTRAINT "PostUnitReference_sourcePostUnitId_fkey"
    FOREIGN KEY ("sourcePostUnitId")
    REFERENCES "Post" ("unitId")
    ON UPDATE cascade
    ON DELETE cascade,
  CONSTRAINT "PostUnitReference_targetUnitId_fkey"
    FOREIGN KEY ("targetUnitId")
    REFERENCES "Unit" ("id")
    ON UPDATE cascade
    ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "PostUnitReference_sourcePostUnitId_idx"
  ON "PostUnitReference" USING btree ("sourcePostUnitId");
CREATE INDEX IF NOT EXISTS "PostUnitReference_targetUnitId_idx"
  ON "PostUnitReference" USING btree ("targetUnitId");

UPDATE "Unit" target
SET "referenceCount" = counts.reference_count
FROM (
  SELECT
    "targetUnitId",
    count(*)::integer AS reference_count
  FROM "PostUnitReference"
  GROUP BY "targetUnitId"
) counts
WHERE target."id" = counts."targetUnitId";
