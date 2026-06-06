CREATE TABLE "IngestionCursor" (
	"source" varchar(64) PRIMARY KEY,
	"outboxId" uuid,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "OutboxProcessingFailure" (
	"outboxId" uuid PRIMARY KEY,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"retryAfter" timestamp(3),
	"createdAt" timestamp(3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RevisionContent" (
	"hash" varchar(64) PRIMARY KEY,
	"payload" jsonb NOT NULL,
	"createdAt" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StructureEvent" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unitId" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"eventType" varchar(96) NOT NULL,
	"actorUserId" uuid NOT NULL,
	"changedFieldKeys" text[] NOT NULL,
	"payload" jsonb NOT NULL,
	"message" text,
	"createdAt" timestamp(3) NOT NULL,
	"ingestedAt" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UnitRevisionPath" (
	"unit_id" uuid,
	"sequence" bigint,
	"path" text,
	"value" jsonb NOT NULL,
	"revision_id" uuid NOT NULL,
	CONSTRAINT "UnitRevisionPath_pkey" PRIMARY KEY("unit_id","sequence","path")
);
--> statement-breakpoint
CREATE TABLE "UnitRevision" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unitId" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"contentHash" varchar(64) NOT NULL,
	"actorUserId" uuid NOT NULL,
	"message" text,
	"restoreSource" jsonb,
	"createdAt" timestamp(3) NOT NULL,
	"ingestedAt" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "StructureEvent_unitId_sequence_eventType_key" ON "StructureEvent" ("unitId","sequence","eventType");--> statement-breakpoint
CREATE INDEX "StructureEvent_unitId_createdAt_idx" ON "StructureEvent" ("unitId","createdAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "StructureEvent_eventType_createdAt_idx" ON "StructureEvent" ("eventType","createdAt");--> statement-breakpoint
CREATE INDEX "UnitRevisionPath_unit_id_path_sequence_idx" ON "UnitRevisionPath" ("unit_id","path","sequence" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "UnitRevisionPath_revision_id_idx" ON "UnitRevisionPath" ("revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UnitRevision_unitId_sequence_key" ON "UnitRevision" ("unitId","sequence");--> statement-breakpoint
CREATE INDEX "UnitRevision_unitId_createdAt_idx" ON "UnitRevision" ("unitId","createdAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "UnitRevision_actorUserId_createdAt_idx" ON "UnitRevision" ("actorUserId","createdAt");--> statement-breakpoint
CREATE INDEX "UnitRevision_contentHash_idx" ON "UnitRevision" ("contentHash");--> statement-breakpoint
ALTER TABLE "UnitRevisionPath" ADD CONSTRAINT "UnitRevisionPath_revision_id_UnitRevision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "UnitRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitRevision" ADD CONSTRAINT "UnitRevision_contentHash_RevisionContent_hash_fkey" FOREIGN KEY ("contentHash") REFERENCES "RevisionContent"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;