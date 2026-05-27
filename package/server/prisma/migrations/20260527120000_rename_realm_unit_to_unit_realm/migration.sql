ALTER TABLE "RealmUnit" RENAME TO "UnitRealm";

ALTER TABLE "UnitRealm" RENAME CONSTRAINT "RealmUnit_pkey" TO "UnitRealm_pkey";
ALTER TABLE "UnitRealm" RENAME CONSTRAINT "RealmUnit_realmUnitId_fkey" TO "UnitRealm_realmUnitId_fkey";
ALTER TABLE "UnitRealm" RENAME CONSTRAINT "RealmUnit_unitId_fkey" TO "UnitRealm_unitId_fkey";

ALTER INDEX "RealmUnit_unitId_idx" RENAME TO "UnitRealm_unitId_idx";
ALTER INDEX "RealmUnit_realmUnitId_createdAt_idx" RENAME TO "UnitRealm_realmUnitId_createdAt_idx";
