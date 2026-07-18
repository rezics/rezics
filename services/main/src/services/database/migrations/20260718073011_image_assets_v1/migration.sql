CREATE TYPE "image_asset_access" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TYPE "image_asset_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "image_asset" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"uploader_profile_id" uuid NOT NULL,
	"owner_profile_id" uuid NOT NULL,
	"status" "image_asset_status" DEFAULT 'pending'::"image_asset_status" NOT NULL,
	"access" "image_asset_access" DEFAULT 'private'::"image_asset_access" NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_asset_deleted_at_check" CHECK ("deleted_at" is null or "deleted_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "image_object" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"asset_id" uuid NOT NULL CONSTRAINT "image_object_asset_id_key" UNIQUE,
	"storage_key" text NOT NULL CONSTRAINT "image_object_storage_key_key" UNIQUE,
	"media_type" text,
	"byte_size" bigint,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_object_storage_key_not_blank" CHECK (btrim("storage_key") <> ''),
	CONSTRAINT "image_object_metadata_shape_check" CHECK (("media_type" is null and "byte_size" is null) or ("media_type" is not null and "byte_size" > 0))
);
--> statement-breakpoint
ALTER TABLE "unit" DROP CONSTRAINT "unit_cover_shape_check";--> statement-breakpoint
DROP INDEX "unit_localization_one_default_key";--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "avatar_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "unit_localization" ADD COLUMN "position" text DEFAULT uuidv7() NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_localization" ADD COLUMN "cover_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "entity" ADD COLUMN "avatar_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "avatar";--> statement-breakpoint
ALTER TABLE "unit_localization" DROP COLUMN "is_default";--> statement-breakpoint
ALTER TABLE "entity" DROP COLUMN "avatar";--> statement-breakpoint
ALTER TABLE "unit" DROP COLUMN "cover_key";--> statement-breakpoint
ALTER TABLE "unit" DROP COLUMN "cover_focal_x";--> statement-breakpoint
ALTER TABLE "unit" DROP COLUMN "cover_focal_y";--> statement-breakpoint
ALTER TABLE "unit_localization" ADD CONSTRAINT "unit_localization_unit_position_key" UNIQUE("unit_id","position");--> statement-breakpoint
CREATE INDEX "image_asset_uploader_status_idx" ON "image_asset" ("uploader_profile_id","status","created_at");--> statement-breakpoint
CREATE INDEX "image_asset_owner_status_idx" ON "image_asset" ("owner_profile_id","status","created_at");--> statement-breakpoint
CREATE INDEX "unit_localization_unit_position_idx" ON "unit_localization" ("unit_id","position","language");--> statement-breakpoint
ALTER TABLE "image_asset" ADD CONSTRAINT "image_asset_uploader_profile_id_profile_id_fkey" FOREIGN KEY ("uploader_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "image_asset" ADD CONSTRAINT "image_asset_owner_profile_id_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "profile"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "image_object" ADD CONSTRAINT "image_object_asset_id_image_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "image_asset"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_avatar_asset_id_image_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "image_asset"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "unit_localization" ADD CONSTRAINT "unit_localization_cover_asset_id_image_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "image_asset"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "entity" ADD CONSTRAINT "entity_avatar_asset_id_image_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "image_asset"("id") ON DELETE SET NULL;