-- AlterTable
ALTER TABLE "Comment" ALTER COLUMN "id" SET DEFAULT uuidv7();

-- RenameIndex
ALTER INDEX "UnitRealm_realmUnitId_moderationState_visibilityState_create_id" RENAME TO "UnitRealm_realmUnitId_moderationState_visibilityState_creat_idx";
