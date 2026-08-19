-- Modify enum type "unit_permission"
ALTER TYPE "public"."unit_permission" ADD VALUE 'unit.metadata-only.update' AFTER 'unit.update';

-- Modify "book" table. The default backfills every existing row to metadata-only.
ALTER TABLE "public"."book" ADD COLUMN "metadata_only" boolean NOT NULL DEFAULT true;

-- Modify "media" table. The default backfills every existing row to metadata-only.
ALTER TABLE "public"."media" ADD COLUMN "metadata_only" boolean NOT NULL DEFAULT true;

-- Modify "software" table. The default backfills every existing row to metadata-only.
ALTER TABLE "public"."software" ADD COLUMN "metadata_only" boolean NOT NULL DEFAULT true;

-- Keep the invitation array bound aligned with the delegable permission vocabulary.
ALTER TABLE "public"."unit_access_invitation"
	DROP CONSTRAINT "unit_access_invitation_permissions_check",
	ADD CONSTRAINT "unit_access_invitation_permissions_check"
	CHECK (
		cardinality("permissions") BETWEEN 1 AND 26
		AND array_position("permissions", 'unit.ownership.transfer'::"public"."unit_permission") IS NULL
		AND array_position("permissions", 'unit.delete'::"public"."unit_permission") IS NULL
	);
