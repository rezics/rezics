SET search_path TO public;

-- Create "access_scope" table
CREATE TABLE "access_scope" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "platform_root" text NULL,
  "auth_user_id" uuid NULL,
  "unit_ref" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "access_scope_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "access_scope_unit_ref_reference_value_id_fkey" FOREIGN KEY ("unit_ref") REFERENCES "reference_value" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "access_scope_platform_check" CHECK ((platform_root IS NULL) OR (platform_root = 'platform'::text)),
  CONSTRAINT "access_scope_target_check" CHECK (num_nonnulls(platform_root, auth_user_id, unit_ref) = 1)
);
-- Create index "access_scope_account_key" to table: "access_scope"
CREATE UNIQUE INDEX "access_scope_account_key" ON "access_scope" ("auth_user_id") WHERE (auth_user_id IS NOT NULL);
-- Create index "access_scope_platform_key" to table: "access_scope"
CREATE UNIQUE INDEX "access_scope_platform_key" ON "access_scope" ("platform_root") WHERE (platform_root IS NOT NULL);
-- Create index "access_scope_resource_key" to table: "access_scope"
CREATE UNIQUE INDEX "access_scope_resource_key" ON "access_scope" ("unit_ref") WHERE (unit_ref IS NOT NULL);
-- Create "access_subject" table
CREATE TABLE "access_subject" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "auth_user_id" uuid NULL,
  "entity_id" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "access_subject_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "access_subject_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "access_subject_target_check" CHECK (num_nonnulls(auth_user_id, entity_id) = 1)
);
-- Create index "access_subject_entity_key" to table: "access_subject"
CREATE UNIQUE INDEX "access_subject_entity_key" ON "access_subject" ("entity_id") WHERE (entity_id IS NOT NULL);
-- Create index "access_subject_principal_key" to table: "access_subject"
CREATE UNIQUE INDEX "access_subject_principal_key" ON "access_subject" ("auth_user_id") WHERE (auth_user_id IS NOT NULL);

DROP TRIGGER IF EXISTS access_subject_immutable ON public.access_subject;
CREATE TRIGGER access_subject_immutable
BEFORE UPDATE OR DELETE ON public.access_subject
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();

DROP TRIGGER IF EXISTS access_scope_immutable ON public.access_scope;
CREATE TRIGGER access_scope_immutable
BEFORE UPDATE OR DELETE ON public.access_scope
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
