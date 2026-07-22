ALTER TABLE "unit_localization" DROP CONSTRAINT "unit_localization_avatar_asset_id_image_asset_id_fkey";
ALTER TABLE "unit_localization" DROP CONSTRAINT "unit_localization_value_check";

ALTER TABLE "unit_localization" ADD COLUMN "avatar_type" text;
ALTER TABLE "unit_localization" ADD COLUMN "avatar_emoji" text;
ALTER TABLE "unit_localization" ADD COLUMN "avatar_icon_prefix" text;
ALTER TABLE "unit_localization" ADD COLUMN "avatar_icon_name" text;

UPDATE "unit_localization"
SET "avatar_type" = 'image'
WHERE "avatar_asset_id" IS NOT NULL;

ALTER TABLE "unit_localization"
ADD CONSTRAINT "unit_localization_avatar_asset_id_image_asset_id_fkey"
FOREIGN KEY ("avatar_asset_id") REFERENCES "image_asset" ("id") ON DELETE RESTRICT;

ALTER TABLE "unit_localization"
ADD CONSTRAINT "unit_localization_avatar_type_check"
CHECK ("avatar_type" IN ('image', 'emoji', 'icon'));

ALTER TABLE "unit_localization"
ADD CONSTRAINT "unit_localization_avatar_value_check"
CHECK (
    (
        "avatar_type" IS NULL
        AND "avatar_asset_id" IS NULL
        AND "avatar_emoji" IS NULL
        AND "avatar_icon_prefix" IS NULL
        AND "avatar_icon_name" IS NULL
    ) OR (
        "avatar_type" = 'image'
        AND "avatar_asset_id" IS NOT NULL
        AND "avatar_emoji" IS NULL
        AND "avatar_icon_prefix" IS NULL
        AND "avatar_icon_name" IS NULL
    ) OR (
        "avatar_type" = 'emoji'
        AND "avatar_asset_id" IS NULL
        AND "avatar_emoji" IS NOT NULL
        AND char_length("avatar_emoji") <= 64
        AND "avatar_icon_prefix" IS NULL
        AND "avatar_icon_name" IS NULL
    ) OR (
        "avatar_type" = 'icon'
        AND "avatar_asset_id" IS NULL
        AND "avatar_emoji" IS NULL
        AND "avatar_icon_prefix" IN ('fas', 'fab')
        AND "avatar_icon_name" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        AND char_length("avatar_icon_name") <= 128
    )
);

ALTER TABLE "unit_localization"
ADD CONSTRAINT "unit_localization_value_check"
CHECK (
    "avatar_type" IS NOT NULL
    OR "banner_asset_id" IS NOT NULL
    OR "cover_asset_id" IS NOT NULL
    OR "title" IS NOT NULL
    OR "summary" IS NOT NULL
    OR "description" IS NOT NULL
    OR "content" IS NOT NULL
);
