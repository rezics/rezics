-- Modify "platform_capability_grant" table
ALTER TABLE "platform_capability_grant" ADD CONSTRAINT "platform_capability_grant_current_capability_check" CHECK (capability <> 'unit.ownership.transfer'::platform_capability);
-- Modify "unit" table
ALTER TABLE "unit" ADD CONSTRAINT "unit_catalog_mode_check" CHECK (catalog_mode = ANY (ARRAY['owned_work'::text, 'public_entry'::text])), ADD COLUMN "catalog_mode" text NOT NULL DEFAULT 'owned_work';
-- Modify "unit_access_grant" table
ALTER TABLE "unit_access_grant" ADD CONSTRAINT "unit_access_grant_permission_delegable_check" CHECK (permission <> ALL (ARRAY['unit.ownership.transfer'::unit_permission, 'unit.delete'::unit_permission]));
-- Create index "unit_access_grant_unit_transfer_candidate_idx" to table: "unit_access_grant"
CREATE INDEX "unit_access_grant_unit_transfer_candidate_idx" ON "unit_access_grant" ("unit_id", "permission", "profile_id") WHERE ((revoked_at IS NULL) AND (expires_at IS NULL) AND (subject_kind = 'profile'::unit_access_subject_kind) AND (cardinality(scope) = 0));
-- Modify "unit_access_invitation" table
ALTER TABLE "unit_access_invitation" DROP CONSTRAINT "unit_access_invitation_permissions_check", ADD CONSTRAINT "unit_access_invitation_permissions_check" CHECK (((cardinality(permissions) >= 1) AND (cardinality(permissions) <= 21)) AND (array_position(permissions, 'unit.ownership.transfer'::unit_permission) IS NULL) AND (array_position(permissions, 'unit.delete'::unit_permission) IS NULL));
-- Create index "unit_access_invitation_unit_transfer_candidate_idx" to table: "unit_access_invitation"
CREATE INDEX "unit_access_invitation_unit_transfer_candidate_idx" ON "unit_access_invitation" ("unit_id", "invited_profile_id") WHERE ((resolution = 'accepted'::unit_access_invitation_resolution) AND (access_expires_at IS NULL) AND (cardinality(scope) = 0));
-- Modify "unit_access_restriction" table
ALTER TABLE "unit_access_restriction" ADD CONSTRAINT "unit_access_restriction_permission_delegable_check" CHECK (permission <> ALL (ARRAY['unit.ownership.transfer'::unit_permission, 'unit.delete'::unit_permission]));
