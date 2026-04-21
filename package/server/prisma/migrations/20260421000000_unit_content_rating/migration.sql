-- Replace Unit.nsfw boolean with Unit.rating ContentRating enum.
-- Dev-phase destructive migration: no data is preserved. All rows default to GENERAL.

-- CreateEnum
CREATE TYPE "ContentRating" AS ENUM ('GENERAL', 'R_15', 'R_18', 'R_18G');

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "nsfw";
ALTER TABLE "Unit" ADD COLUMN "rating" "ContentRating" NOT NULL DEFAULT 'GENERAL';
