ALTER TABLE "PostPin" RENAME TO "CommentPromotion";

ALTER TABLE "CommentPromotion" RENAME COLUMN "postUnitId" TO "commentUnitId";

ALTER TABLE "CommentPromotion" RENAME CONSTRAINT "PostPin_pkey" TO "CommentPromotion_pkey";
ALTER TABLE "CommentPromotion" RENAME CONSTRAINT "PostPin_scopeUnitId_fkey" TO "CommentPromotion_scopeUnitId_fkey";
ALTER TABLE "CommentPromotion" RENAME CONSTRAINT "PostPin_postUnitId_fkey" TO "CommentPromotion_commentUnitId_fkey";

ALTER INDEX "PostPin_scopeUnitId_kind_position_idx" RENAME TO "CommentPromotion_scopeUnitId_kind_position_idx";
ALTER INDEX "PostPin_postUnitId_idx" RENAME TO "CommentPromotion_commentUnitId_idx";
