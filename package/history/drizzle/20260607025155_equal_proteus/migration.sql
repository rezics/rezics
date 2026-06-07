ALTER TABLE "IngestionCursor" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "OutboxProcessingFailure" ALTER COLUMN "updatedAt" SET DEFAULT now();