-- Rename realm-scoped tag application tables without dropping data.
ALTER TABLE "RealmTagUnit" RENAME TO "RealmTagApplication";
ALTER TABLE "RealmTagVote" RENAME TO "RealmTagApplicationVote";

ALTER TABLE "RealmTagApplication" RENAME CONSTRAINT "RealmTagUnit_pkey" TO "RealmTagApplication_pkey";
ALTER TABLE "RealmTagApplicationVote" RENAME CONSTRAINT "RealmTagVote_pkey" TO "RealmTagApplicationVote_pkey";

ALTER TABLE "RealmTagApplication" RENAME CONSTRAINT "RealmTagUnit_realmUnitId_fkey" TO "RealmTagApplication_realmUnitId_fkey";
ALTER TABLE "RealmTagApplication" RENAME CONSTRAINT "RealmTagUnit_tagUnitId_fkey" TO "RealmTagApplication_tagUnitId_fkey";
ALTER TABLE "RealmTagApplication" RENAME CONSTRAINT "RealmTagUnit_unitId_fkey" TO "RealmTagApplication_unitId_fkey";
ALTER TABLE "RealmTagApplicationVote" RENAME CONSTRAINT "RealmTagVote_realmUnitId_tagUnitId_unitId_fkey" TO "RealmTagApplicationVote_realmUnitId_tagUnitId_unitId_fkey";

ALTER INDEX "RealmTagUnit_realmUnitId_unitId_idx" RENAME TO "RealmTagApplication_realmUnitId_unitId_idx";
ALTER INDEX "RealmTagUnit_unitId_realmUnitId_idx" RENAME TO "RealmTagApplication_unitId_realmUnitId_idx";
ALTER INDEX "RealmTagUnit_tagUnitId_realmUnitId_idx" RENAME TO "RealmTagApplication_tagUnitId_realmUnitId_idx";
ALTER INDEX "RealmTagUnit_realmUnitId_unitId_pinned_position_idx" RENAME TO "RealmTagApplication_realmUnitId_unitId_pinned_position_idx";
ALTER INDEX "RealmTagUnit_score_idx" RENAME TO "RealmTagApplication_score_idx";
ALTER INDEX "RealmTagVote_userId_idx" RENAME TO "RealmTagApplicationVote_userId_idx";
