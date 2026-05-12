ALTER TABLE "ShelfUnit" RENAME TO "ShelfItemUnit";

ALTER INDEX "ShelfUnit_pkey" RENAME TO "ShelfItemUnit_pkey";
ALTER INDEX "ShelfUnit_unitId_idx" RENAME TO "ShelfItemUnit_unitId_idx";
ALTER INDEX "ShelfUnit_unitId_role_idx" RENAME TO "ShelfItemUnit_unitId_role_idx";
ALTER INDEX "ShelfUnit_shelfUnitId_role_idx" RENAME TO "ShelfItemUnit_shelfUnitId_role_idx";

ALTER TABLE "ShelfItemUnit" RENAME CONSTRAINT "ShelfUnit_shelfUnitId_fkey" TO "ShelfItemUnit_shelfUnitId_fkey";
ALTER TABLE "ShelfItemUnit" RENAME CONSTRAINT "ShelfUnit_shelfUnitId_itemRef_fkey" TO "ShelfItemUnit_shelfUnitId_itemRef_fkey";
ALTER TABLE "ShelfItemUnit" RENAME CONSTRAINT "ShelfUnit_unitId_fkey" TO "ShelfItemUnit_unitId_fkey";
