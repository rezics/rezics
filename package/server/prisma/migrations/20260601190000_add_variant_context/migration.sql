-- Weak VARIANT context for interactions. These columns are indexed lookup
-- hints only: no foreign keys, no VARIANT-kind validation, and no target
-- resolution check.
ALTER TABLE "Post" ADD COLUMN "variantUnitId" UUID;
ALTER TABLE "ShelfUnit" ADD COLUMN "variantUnitId" UUID;

CREATE INDEX "Post_variantUnitId_idx" ON "Post"("variantUnitId");
CREATE INDEX "ShelfUnit_variantUnitId_idx" ON "ShelfUnit"("variantUnitId");
