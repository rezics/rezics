-- Create enum type "image_asset_presentation_fit"
CREATE TYPE "image_asset_presentation_fit" AS ENUM ('crop', 'contain');
-- Create enum type "image_asset_presentation_role"
CREATE TYPE "image_asset_presentation_role" AS ENUM ('avatar', 'banner', 'cover');
-- Modify "image_object" table
ALTER TABLE "image_object" DROP CONSTRAINT "image_object_metadata_shape_check", ADD CONSTRAINT "image_object_metadata_shape_check" CHECK (((media_type IS NULL) AND (byte_size IS NULL) AND (width IS NULL) AND (height IS NULL)) OR ((media_type IS NOT NULL) AND (byte_size > 0) AND (width > 0) AND (height > 0))), ADD COLUMN "width" integer NULL, ADD COLUMN "height" integer NULL;
-- Create "image_asset_presentation" table
CREATE TABLE "image_asset_presentation" (
  "asset_id" uuid NOT NULL,
  "role" "image_asset_presentation_role" NOT NULL,
  "fit" "image_asset_presentation_fit" NOT NULL,
  "crop_x" double precision NULL,
  "crop_y" double precision NULL,
  "crop_width" double precision NULL,
  "crop_height" double precision NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("asset_id", "role"),
  CONSTRAINT "image_asset_presentation_asset_id_image_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "image_asset" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "image_asset_presentation_crop_bounds_check" CHECK ((fit <> 'crop'::image_asset_presentation_fit) OR ((crop_x >= (0)::double precision) AND (crop_y >= (0)::double precision) AND (crop_width > (0)::double precision) AND (crop_height > (0)::double precision) AND ((crop_x + crop_width) <= (1)::double precision) AND ((crop_y + crop_height) <= (1)::double precision))),
  CONSTRAINT "image_asset_presentation_revision_check" CHECK (revision > 0),
  CONSTRAINT "image_asset_presentation_shape_check" CHECK (((role = 'cover'::image_asset_presentation_role) AND (fit = 'contain'::image_asset_presentation_fit) AND (crop_x IS NULL) AND (crop_y IS NULL) AND (crop_width IS NULL) AND (crop_height IS NULL)) OR ((fit = 'crop'::image_asset_presentation_fit) AND (crop_x IS NOT NULL) AND (crop_y IS NOT NULL) AND (crop_width IS NOT NULL) AND (crop_height IS NOT NULL)))
);
