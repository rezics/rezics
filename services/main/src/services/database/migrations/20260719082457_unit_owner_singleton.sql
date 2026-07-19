-- Create index "unit_access_binding_active_owner_key" to table: "unit_access_binding"
CREATE UNIQUE INDEX "unit_access_binding_active_owner_key" ON "unit_access_binding" ("unit_id") WHERE ((revoked_at IS NULL) AND (role = 'owner'::unit_access_role));
