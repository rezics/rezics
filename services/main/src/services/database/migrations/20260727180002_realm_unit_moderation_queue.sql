-- Create index "realm_unit_moderation_queue_idx" to table: "realm_unit"
CREATE INDEX "realm_unit_moderation_queue_idx" ON "realm_unit" ("realm_id", "status", "updated_at" DESC NULLS LAST, "unit_id" DESC NULLS LAST);
