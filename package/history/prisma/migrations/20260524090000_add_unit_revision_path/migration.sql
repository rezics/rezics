CREATE TABLE "UnitRevisionPath" (
  "unit_id" uuid NOT NULL,
  "sequence" bigint NOT NULL,
  "path" text NOT NULL,
  "value" jsonb NOT NULL,
  "revision_id" uuid NOT NULL,

  CONSTRAINT "UnitRevisionPath_pkey" PRIMARY KEY ("unit_id", "sequence", "path"),
  CONSTRAINT "UnitRevisionPath_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "UnitRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UnitRevisionPath_unit_id_path_sequence_idx" ON "UnitRevisionPath"("unit_id", "path", "sequence" DESC);
CREATE INDEX "UnitRevisionPath_revision_id_idx" ON "UnitRevisionPath"("revision_id");
