-- Create enum type "collection_item_role"
CREATE TYPE "collection_item_role" AS ENUM ('item', 'featured', 'favorite');
-- Remove the text default before converting "role" to its closed enum.
ALTER TABLE "collection_item" ALTER COLUMN "role" DROP DEFAULT;
-- Modify "collection_item" table
ALTER TABLE "collection_item" DROP CONSTRAINT "collection_item_role_not_blank", ALTER COLUMN "role" TYPE "collection_item_role" USING "role"::"collection_item_role";
