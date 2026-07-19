ALTER TYPE "unit_kind" ADD VALUE 'slug_namespace' BEFORE 'profile';--> statement-breakpoint
ALTER TYPE "unit_kind" ADD VALUE 'redirect' BEFORE 'profile';--> statement-breakpoint
CREATE TABLE "unit_redirect" (
	"id" uuid PRIMARY KEY,
	"target_unit_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_redirect_not_self_check" CHECK ("id" <> "target_unit_id")
);
--> statement-breakpoint
ALTER TABLE "unit" ADD COLUMN "slug_scope_id" uuid;--> statement-breakpoint
CREATE INDEX "unit_redirect_target_unit_idx" ON "unit_redirect" ("target_unit_id");--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_slug_scope_id_unit_id_fkey" FOREIGN KEY ("slug_scope_id") REFERENCES "unit"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_redirect" ADD CONSTRAINT "unit_redirect_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_redirect" ADD CONSTRAINT "unit_redirect_target_unit_id_unit_id_fkey" FOREIGN KEY ("target_unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT;