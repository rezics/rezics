-- Modify "entity" table
ALTER TABLE "entity" DROP COLUMN "avatar_asset_id";
-- Modify "profile" table
ALTER TABLE "profile" DROP COLUMN "avatar_asset_id";
-- Modify "unit_localization" table
ALTER TABLE "unit_localization" DROP CONSTRAINT "unit_localization_value_check", ADD CONSTRAINT "unit_localization_value_check" CHECK ((avatar_asset_id IS NOT NULL) OR (banner_asset_id IS NOT NULL) OR (cover_asset_id IS NOT NULL) OR (title IS NOT NULL) OR (summary IS NOT NULL) OR (description IS NOT NULL) OR (content IS NOT NULL)), ADD COLUMN "avatar_asset_id" uuid NULL, ADD COLUMN "banner_asset_id" uuid NULL, ADD CONSTRAINT "unit_localization_avatar_asset_id_image_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "image_asset" ("id") ON UPDATE NO ACTION ON DELETE SET NULL, ADD CONSTRAINT "unit_localization_banner_asset_id_image_asset_id_fkey" FOREIGN KEY ("banner_asset_id") REFERENCES "image_asset" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
