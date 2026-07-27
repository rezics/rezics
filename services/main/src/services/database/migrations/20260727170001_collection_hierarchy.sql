-- Create enum type "collection_item_role"
CREATE TYPE "collection_item_role" AS ENUM ('item', 'featured', 'favorite');
-- Remove the text default before converting "role" to its closed enum.
ALTER TABLE "collection_item" ALTER COLUMN "role" DROP DEFAULT;
-- Modify "collection_item" table
ALTER TABLE "collection_item" DROP CONSTRAINT "collection_item_role_not_blank", ALTER COLUMN "role" TYPE "collection_item_role" USING "role"::"collection_item_role", ADD COLUMN "parent_unit_id" uuid NULL;
-- Add hierarchy invariants after the parent column exists.
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_parent_not_self_check" CHECK ((parent_unit_id IS NULL) OR (parent_unit_id <> unit_id)), ADD CONSTRAINT "collection_item_parent_membership_fk" FOREIGN KEY ("collection_id", "parent_unit_id") REFERENCES "collection_item" ("collection_id", "unit_id") ON UPDATE NO ACTION ON DELETE NO ACTION, ADD CONSTRAINT "collection_item_parent_unit_id_unit_id_fkey" FOREIGN KEY ("parent_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "collection_item_parent_idx" to table: "collection_item"
CREATE INDEX "collection_item_parent_idx" ON "collection_item" ("collection_id", "parent_unit_id");
