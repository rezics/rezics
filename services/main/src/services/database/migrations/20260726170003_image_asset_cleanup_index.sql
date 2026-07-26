-- Create index "image_asset_cleanup_idx" to table: "image_asset"
CREATE INDEX "image_asset_cleanup_idx" ON "image_asset" ("status", "created_at", "id") WHERE (deleted_at IS NULL);
