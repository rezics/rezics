CREATE TYPE "unit_access_restriction_subject_kind" AS ENUM('profile', 'realm');--> statement-breakpoint
DROP INDEX "unit_access_restriction_active_subject_scope_key";--> statement-breakpoint
ALTER TABLE "unit_access_restriction" ADD COLUMN "subject_kind" "unit_access_restriction_subject_kind" NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_access_restriction" ADD COLUMN "realm_id" uuid;--> statement-breakpoint
ALTER TABLE "unit_access_restriction" ALTER COLUMN "profile_id" DROP NOT NULL;--> statement-breakpoint
DROP INDEX "unit_access_restriction_profile_active_idx";--> statement-breakpoint
CREATE INDEX "unit_access_restriction_profile_active_idx" ON "unit_access_restriction" ("profile_id","unit_id","permission") WHERE "revoked_at" is null and "subject_kind" = 'profile';--> statement-breakpoint
CREATE UNIQUE INDEX "unit_access_restriction_active_profile_scope_key" ON "unit_access_restriction" ("unit_id","profile_id","permission","scope") WHERE "revoked_at" is null and "subject_kind" = 'profile';--> statement-breakpoint
CREATE UNIQUE INDEX "unit_access_restriction_active_realm_scope_key" ON "unit_access_restriction" ("unit_id","realm_id","permission","scope") WHERE "revoked_at" is null and "subject_kind" = 'realm';--> statement-breakpoint
CREATE INDEX "unit_access_restriction_realm_active_idx" ON "unit_access_restriction" ("realm_id","unit_id","permission") WHERE "revoked_at" is null and "subject_kind" = 'realm';--> statement-breakpoint
ALTER TABLE "unit_access_restriction" ADD CONSTRAINT "unit_access_restriction_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_access_binding" ADD CONSTRAINT "unit_access_binding_subject_role_check" CHECK ((
				"subject_kind" = 'profile' or "role" <> 'owner'
			) and (
				"subject_kind" <> 'authenticated' or "role" in ('viewer', 'editor')
			));--> statement-breakpoint
ALTER TABLE "unit_access_restriction" ADD CONSTRAINT "unit_access_restriction_subject_shape_check" CHECK ((
				"subject_kind" = 'profile' and "profile_id" is not null and "realm_id" is null
			) or (
				"subject_kind" = 'realm' and "profile_id" is null and "realm_id" is not null
			));
