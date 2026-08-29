SET search_path TO public;

-- Create index "book_release_status_id_idx" to table: "book"
CREATE INDEX "book_release_status_id_idx" ON "book" ("release_status", "id");
-- Modify "platform_capability_grant" table
ALTER TABLE "platform_capability_grant" ADD CONSTRAINT "platform_capability_grant_custom_theme_external_live_expiry_che" CHECK ((capability <> 'platform.custom_theme.external_live.access'::platform_capability) OR ((expires_at IS NOT NULL) AND (expires_at <= (created_at + '90 days'::interval)))), ADD CONSTRAINT "platform_capability_grant_custom_theme_external_live_non_self_c" CHECK ((capability <> 'platform.custom_theme.external_live.access'::platform_capability) OR (profile_id <> granted_by_profile_id));
-- Create index "platform_capability_grant_active_capability_expiry_idx" to table: "platform_capability_grant"
CREATE INDEX "platform_capability_grant_active_capability_expiry_idx" ON "platform_capability_grant" ("capability", "expires_at", "profile_id") WHERE (revoked_at IS NULL);
-- Modify "profile_preference" table
ALTER TABLE "profile_preference" ADD COLUMN "custom_themes_enabled" boolean NOT NULL DEFAULT true;
-- Modify "unit_access_invitation" table
ALTER TABLE "unit_access_invitation" DROP CONSTRAINT "unit_access_invitation_permissions_check", ADD CONSTRAINT "unit_access_invitation_permissions_check" CHECK (((cardinality(permissions) >= 1) AND (cardinality(permissions) <= 28)) AND (array_position(permissions, 'unit.ownership.transfer'::unit_permission) IS NULL) AND (array_position(permissions, 'unit.delete'::unit_permission) IS NULL));
-- Modify "zone" table
ALTER TABLE "zone" DROP COLUMN "theme_document", ADD COLUMN "appearance_document" jsonb NOT NULL;
-- Create "custom_theme" table
CREATE TABLE "custom_theme" (
  "id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "custom_theme_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create "custom_theme_execution_control" table
CREATE TABLE "custom_theme_execution_control" (
  "id" boolean NOT NULL DEFAULT true,
  "enabled" boolean NOT NULL DEFAULT true,
  "updated_by_profile_id" uuid NULL,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "custom_theme_execution_control_3FOcvNRbsJce_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "custom_theme_execution_control_singleton_check" CHECK (id = true)
);
-- Create "custom_theme_revision" table
CREATE TABLE "custom_theme_revision" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "custom_theme_unit_id" uuid NOT NULL,
  "target_contract" text NOT NULL,
  "execution_mode" text NOT NULL,
  "resource_mode" text NOT NULL,
  "manifest_document" jsonb NOT NULL,
  "manifest_sha256" text NOT NULL,
  "source_archive_sha256" text NOT NULL,
  "review_state" text NOT NULL DEFAULT 'pending_automated',
  "approval_scope" text NOT NULL DEFAULT 'host_unit',
  "approved_host_unit_id" uuid NULL,
  "review_evidence" jsonb NULL,
  "review_evidence_sha256" text NULL,
  "automated_review_lease_until" timestamptz(3) NULL,
  "automated_review_attempts" integer NOT NULL DEFAULT 0,
  "next_automated_review_at" timestamptz(3) NOT NULL DEFAULT now(),
  "submitted_by_profile_id" uuid NOT NULL,
  "reviewed_by_profile_id" uuid NULL,
  "reviewed_at" timestamptz(3) NULL,
  "decision_reason" text NULL,
  "killed_by_profile_id" uuid NULL,
  "killed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "custom_theme_revision_id_target_key" UNIQUE ("id", "target_contract"),
  CONSTRAINT "custom_theme_revision_approved_host_unit_id_unit_id_fkey" FOREIGN KEY ("approved_host_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "custom_theme_revision_custom_theme_unit_id_custom_theme_id_fkey" FOREIGN KEY ("custom_theme_unit_id") REFERENCES "custom_theme" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "custom_theme_revision_killed_by_profile_id_profile_id_fkey" FOREIGN KEY ("killed_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "custom_theme_revision_reviewed_by_profile_id_profile_id_fkey" FOREIGN KEY ("reviewed_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "custom_theme_revision_submitted_by_profile_id_profile_id_fkey" FOREIGN KEY ("submitted_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "custom_theme_revision_approval_scope_check" CHECK (approval_scope = 'host_unit'::text),
  CONSTRAINT "custom_theme_revision_automated_review_attempts_check" CHECK (automated_review_attempts >= 0),
  CONSTRAINT "custom_theme_revision_execution_mode_check" CHECK (execution_mode = 'host_full_trust'::text),
  CONSTRAINT "custom_theme_revision_kill_shape_check" CHECK ((review_state = 'killed'::text) = ((killed_at IS NOT NULL) AND (killed_by_profile_id IS NOT NULL))),
  CONSTRAINT "custom_theme_revision_manifest_sha256_check" CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "custom_theme_revision_resource_mode_check" CHECK (resource_mode = 'external_live'::text),
  CONSTRAINT "custom_theme_revision_review_evidence_json_object_check" CHECK ((review_evidence IS NULL) OR (jsonb_typeof(review_evidence) = 'object'::text)),
  CONSTRAINT "custom_theme_revision_review_evidence_sha256_check" CHECK ((review_evidence_sha256 IS NULL) OR (review_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)),
  CONSTRAINT "custom_theme_revision_review_shape_check" CHECK (((review_state = ANY (ARRAY['pending_automated'::text, 'pending_human'::text])) AND (reviewed_by_profile_id IS NULL) AND (reviewed_at IS NULL) AND (approved_host_unit_id IS NULL) AND (decision_reason IS NULL)) OR ((review_state = 'rejected'::text) AND (reviewed_by_profile_id IS NOT NULL) AND (reviewed_at IS NOT NULL) AND (approved_host_unit_id IS NULL) AND (decision_reason IS NOT NULL)) OR ((review_state = ANY (ARRAY['approved'::text, 'killed'::text, 'revalidation_required'::text])) AND (reviewed_by_profile_id IS NOT NULL) AND (reviewed_at IS NOT NULL) AND (approved_host_unit_id IS NOT NULL) AND (review_evidence IS NOT NULL) AND (review_evidence_sha256 IS NOT NULL))),
  CONSTRAINT "custom_theme_revision_review_state_check" CHECK (review_state = ANY (ARRAY['pending_automated'::text, 'pending_human'::text, 'approved'::text, 'rejected'::text, 'killed'::text, 'revalidation_required'::text])),
  CONSTRAINT "custom_theme_revision_reviewer_separation_check" CHECK ((reviewed_by_profile_id IS NULL) OR (reviewed_by_profile_id <> submitted_by_profile_id)),
  CONSTRAINT "custom_theme_revision_source_archive_sha256_check" CHECK (source_archive_sha256 ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "custom_theme_revision_target_contract_check" CHECK (target_contract = 'rezics.unit.presentation@0'::text)
);
-- Create index "custom_theme_revision_host_approval_idx" to table: "custom_theme_revision"
CREATE INDEX "custom_theme_revision_host_approval_idx" ON "custom_theme_revision" ("approved_host_unit_id", "target_contract", "id") WHERE (review_state = 'approved'::text);
-- Create index "custom_theme_revision_automated_queue_idx" to table: "custom_theme_revision"
CREATE INDEX "custom_theme_revision_automated_queue_idx" ON "custom_theme_revision" ("next_automated_review_at", "id") WHERE (review_state = ANY (ARRAY['pending_automated'::text, 'revalidation_required'::text]));
-- Create index "custom_theme_revision_active_idx" to table: "custom_theme_revision"
CREATE INDEX "custom_theme_revision_active_idx" ON "custom_theme_revision" ("id") WHERE (review_state = ANY (ARRAY['pending_automated'::text, 'pending_human'::text, 'approved'::text, 'revalidation_required'::text]));
-- Create index "custom_theme_revision_review_queue_idx" to table: "custom_theme_revision"
CREATE INDEX "custom_theme_revision_review_queue_idx" ON "custom_theme_revision" ("id") WHERE (review_state = ANY (ARRAY['pending_automated'::text, 'pending_human'::text, 'revalidation_required'::text]));
-- Create index "custom_theme_revision_theme_id_idx" to table: "custom_theme_revision"
CREATE INDEX "custom_theme_revision_theme_id_idx" ON "custom_theme_revision" ("custom_theme_unit_id", "id");
-- Create "custom_theme_revision_external_resource" table
CREATE TABLE "custom_theme_revision_external_resource" (
  "revision_id" uuid NOT NULL,
  "resource_key" text NOT NULL,
  "role" text NOT NULL,
  "requested_url" text NOT NULL,
  "final_url" text NOT NULL,
  "origin" text NOT NULL,
  "observed_sha256" text NOT NULL,
  "observed_byte_length" integer NOT NULL,
  "observed_content_type" text NOT NULL,
  "integrity_metadata" text NULL,
  "integrity_waiver_reason" text NULL,
  "cors_allows_anonymous" boolean NOT NULL,
  "observed_at" timestamptz(3) NOT NULL,
  "current_health_state" text NOT NULL DEFAULT 'unchecked',
  "last_checked_at" timestamptz(3) NULL,
  "next_check_at" timestamptz(3) NOT NULL DEFAULT now(),
  "monitor_lease_until" timestamptz(3) NULL,
  "monitor_failure_count" integer NOT NULL DEFAULT 0,
  "review_evidence" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("revision_id", "resource_key"),
  CONSTRAINT "custom_theme_revision_external_resource_0wI39jpn6Nka_fkey" FOREIGN KEY ("revision_id") REFERENCES "custom_theme_revision" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "custom_theme_external_resource_byte_length_check" CHECK ((observed_byte_length >= 0) AND (observed_byte_length <= 5242880)),
  CONSTRAINT "custom_theme_external_resource_health_check" CHECK (current_health_state = ANY (ARRAY['current'::text, 'drifted'::text, 'unavailable'::text, 'unchecked'::text])),
  CONSTRAINT "custom_theme_external_resource_integrity_check" CHECK (((integrity_metadata IS NOT NULL) AND (btrim(integrity_metadata) <> ''::text) AND (integrity_waiver_reason IS NULL)) OR ((integrity_metadata IS NULL) AND (integrity_waiver_reason IS NOT NULL) AND (btrim(integrity_waiver_reason) <> ''::text))),
  CONSTRAINT "custom_theme_external_resource_key_check" CHECK ((length(resource_key) >= 1) AND (length(resource_key) <= 200)),
  CONSTRAINT "custom_theme_external_resource_monitor_failure_count_check" CHECK (monitor_failure_count >= 0),
  CONSTRAINT "custom_theme_external_resource_review_evidence_json_object_chec" CHECK ((review_evidence IS NULL) OR (jsonb_typeof(review_evidence) = 'object'::text)),
  CONSTRAINT "custom_theme_external_resource_sha256_check" CHECK (observed_sha256 ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "custom_theme_external_resource_urls_check" CHECK ((requested_url ~~ 'https://%'::text) AND (final_url ~~ 'https://%'::text) AND (origin ~~ 'https://%'::text))
);
-- Create index "custom_theme_external_resource_monitor_idx" to table: "custom_theme_revision_external_resource"
CREATE INDEX "custom_theme_external_resource_monitor_idx" ON "custom_theme_revision_external_resource" ("next_check_at", "revision_id", "resource_key");
-- Create index "custom_theme_external_resource_origin_idx" to table: "custom_theme_revision_external_resource"
CREATE INDEX "custom_theme_external_resource_origin_idx" ON "custom_theme_revision_external_resource" ("origin", "revision_id", "resource_key");
-- Create index "custom_theme_external_resource_unpinned_idx" to table: "custom_theme_revision_external_resource"
CREATE INDEX "custom_theme_external_resource_unpinned_idx" ON "custom_theme_revision_external_resource" ("revision_id", "resource_key") WHERE (integrity_metadata IS NULL);
-- Create "custom_theme_revision_file" table
CREATE TABLE "custom_theme_revision_file" (
  "revision_id" uuid NOT NULL,
  "path" text NOT NULL,
  "role" text NOT NULL,
  "content_type" text NOT NULL,
  "sha256" text NOT NULL,
  "byte_length" integer NOT NULL,
  "storage_key" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("revision_id", "path"),
  CONSTRAINT "custom_theme_revision_file_storage_key_key" UNIQUE ("storage_key"),
  CONSTRAINT "custom_theme_revision_file_8drZKAj6raNu_fkey" FOREIGN KEY ("revision_id") REFERENCES "custom_theme_revision" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "custom_theme_revision_file_byte_length_check" CHECK ((byte_length >= 0) AND (byte_length <= CASE WHEN (role = 'source_archive'::text) THEN 20971520 ELSE 5242880 END)),
  CONSTRAINT "custom_theme_revision_file_content_type_check" CHECK (btrim(content_type) <> ''::text),
  CONSTRAINT "custom_theme_revision_file_path_check" CHECK (((length(path) >= 1) AND (length(path) <= 512)) AND (path !~ '(^|/)\.\.?(/|$)'::text) AND (path !~ '[\\]'::text) AND ("left"(path, 1) <> '/'::text)),
  CONSTRAINT "custom_theme_revision_file_role_check" CHECK (role = ANY (ARRAY['manifest'::text, 'source_archive'::text, 'html'::text, 'css'::text, 'js'::text, 'worker'::text, 'wasm'::text, 'font'::text, 'svg'::text, 'asset'::text])),
  CONSTRAINT "custom_theme_revision_file_sha256_check" CHECK (sha256 ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "custom_theme_revision_file_storage_key_check" CHECK (btrim(storage_key) <> ''::text)
);
-- Create index "custom_theme_revision_file_sha256_idx" to table: "custom_theme_revision_file"
CREATE INDEX "custom_theme_revision_file_sha256_idx" ON "custom_theme_revision_file" ("revision_id", "sha256");
-- Create "custom_theme_revision_review_event" table
CREATE TABLE "custom_theme_revision_review_event" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "actor_profile_id" uuid NULL,
  "evidence" jsonb NOT NULL,
  "evidence_sha256" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "custom_theme_revision_review_event_uSbItDwsirR9_fkey" FOREIGN KEY ("revision_id") REFERENCES "custom_theme_revision" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "custom_theme_revision_review_event_xV1geV2KbhfR_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "custom_theme_review_event_evidence_json_object_check" CHECK ((evidence IS NULL) OR (jsonb_typeof(evidence) = 'object'::text)),
  CONSTRAINT "custom_theme_review_event_evidence_sha256_check" CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "custom_theme_review_event_kind_check" CHECK (kind = ANY (ARRAY['automated'::text, 'approve'::text, 'reject'::text, 'revalidation'::text, 'kill'::text]))
);
-- Create index "custom_theme_review_event_actor_idx" to table: "custom_theme_revision_review_event"
CREATE INDEX "custom_theme_review_event_actor_idx" ON "custom_theme_revision_review_event" ("actor_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "custom_theme_review_event_revision_idx" to table: "custom_theme_revision_review_event"
CREATE INDEX "custom_theme_review_event_revision_idx" ON "custom_theme_revision_review_event" ("revision_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create "unit_custom_theme_installation" table
CREATE TABLE "unit_custom_theme_installation" (
  "host_unit_id" uuid NOT NULL,
  "target_contract" text NOT NULL,
  "revision_id" uuid NOT NULL,
  "installed_by_profile_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("host_unit_id", "target_contract"),
  CONSTRAINT "unit_custom_theme_installation_host_unit_id_unit_id_fkey" FOREIGN KEY ("host_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_custom_theme_installation_revision_target_fkey" FOREIGN KEY ("revision_id", "target_contract") REFERENCES "custom_theme_revision" ("id", "target_contract") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_custom_theme_installation_vl1o62kbqKVu_fkey" FOREIGN KEY ("installed_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_custom_theme_installation_target_check" CHECK (target_contract = 'rezics.unit.presentation@0'::text)
);
-- Create index "unit_custom_theme_installation_installed_by_idx" to table: "unit_custom_theme_installation"
CREATE INDEX "unit_custom_theme_installation_installed_by_idx" ON "unit_custom_theme_installation" ("installed_by_profile_id");
-- Create index "unit_custom_theme_installation_revision_idx" to table: "unit_custom_theme_installation"
CREATE INDEX "unit_custom_theme_installation_revision_idx" ON "unit_custom_theme_installation" ("revision_id", "host_unit_id");
-- Create "unit_presentation_document" table
CREATE TABLE "unit_presentation_document" (
  "host_unit_id" uuid NOT NULL,
  "target_contract" text NOT NULL,
  "document" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("host_unit_id", "target_contract"),
  CONSTRAINT "unit_presentation_document_host_unit_id_unit_id_fkey" FOREIGN KEY ("host_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_presentation_document_target_check" CHECK (target_contract = 'rezics.unit.presentation@0'::text)
);
-- Create "unit_presentation_revision" table
CREATE TABLE "unit_presentation_revision" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "host_unit_id" uuid NOT NULL,
  "target_contract" text NOT NULL,
  "parent_revision_id" uuid NULL,
  "source_revision_id" uuid NULL,
  "content_id" uuid NOT NULL,
  "actor_profile_id" uuid NULL,
  "kind" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "unit_presentation_revision_id_host_target_key" UNIQUE ("id", "host_unit_id", "target_contract"),
  CONSTRAINT "unit_presentation_revision_actor_profile_id_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_presentation_revision_content_id_revision_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "revision_content" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_presentation_revision_document_fkey" FOREIGN KEY ("host_unit_id", "target_contract") REFERENCES "unit_presentation_document" ("host_unit_id", "target_contract") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_presentation_revision_parent_fkey" FOREIGN KEY ("parent_revision_id", "host_unit_id", "target_contract") REFERENCES "unit_presentation_revision" ("id", "host_unit_id", "target_contract") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_presentation_revision_source_fkey" FOREIGN KEY ("source_revision_id", "host_unit_id", "target_contract") REFERENCES "unit_presentation_revision" ("id", "host_unit_id", "target_contract") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_presentation_revision_kind_check" CHECK (kind = ANY (ARRAY['create'::text, 'update'::text, 'restore'::text])),
  CONSTRAINT "unit_presentation_revision_source_shape_check" CHECK ((kind = 'restore'::text) = (source_revision_id IS NOT NULL))
);
-- Create index "unit_presentation_revision_actor_idx" to table: "unit_presentation_revision"
CREATE INDEX "unit_presentation_revision_actor_idx" ON "unit_presentation_revision" ("actor_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "unit_presentation_revision_content_idx" to table: "unit_presentation_revision"
CREATE INDEX "unit_presentation_revision_content_idx" ON "unit_presentation_revision" ("content_id");
-- Create index "unit_presentation_revision_host_created_idx" to table: "unit_presentation_revision"
CREATE INDEX "unit_presentation_revision_host_created_idx" ON "unit_presentation_revision" ("host_unit_id", "target_contract", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create "unit_presentation_revision_head" table
CREATE TABLE "unit_presentation_revision_head" (
  "host_unit_id" uuid NOT NULL,
  "target_contract" text NOT NULL,
  "revision_id" uuid NOT NULL,
  PRIMARY KEY ("host_unit_id", "target_contract"),
  CONSTRAINT "unit_presentation_revision_head_revision_fkey" FOREIGN KEY ("revision_id", "host_unit_id", "target_contract") REFERENCES "unit_presentation_revision" ("id", "host_unit_id", "target_contract") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "unit_presentation_revision_head_revision_key" to table: "unit_presentation_revision_head"
CREATE UNIQUE INDEX "unit_presentation_revision_head_revision_key" ON "unit_presentation_revision_head" ("revision_id");

-- Custom Theme package, review, presentation, and access-grant history invariants.
CREATE OR REPLACE FUNCTION public.protect_custom_theme_revision_package()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Custom Theme revisions cannot be deleted'
			USING ERRCODE = '23514', CONSTRAINT = 'custom_theme_revision_immutable';
	END IF;
	IF (
		OLD.id,
		OLD.custom_theme_unit_id,
		OLD.target_contract,
		OLD.execution_mode,
		OLD.resource_mode,
		OLD.manifest_document,
		OLD.manifest_sha256,
		OLD.source_archive_sha256,
		OLD.approval_scope,
		OLD.submitted_by_profile_id,
		OLD.created_at
	) IS DISTINCT FROM (
		NEW.id,
		NEW.custom_theme_unit_id,
		NEW.target_contract,
		NEW.execution_mode,
		NEW.resource_mode,
		NEW.manifest_document,
		NEW.manifest_sha256,
		NEW.source_archive_sha256,
		NEW.approval_scope,
		NEW.submitted_by_profile_id,
		NEW.created_at
	) THEN
		RAISE EXCEPTION 'Custom Theme revision package identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'custom_theme_revision_package_immutable';
	END IF;
	IF OLD.review_state <> NEW.review_state AND NOT (
		(OLD.review_state = 'pending_automated' AND NEW.review_state = 'pending_human')
		OR (OLD.review_state = 'pending_human' AND NEW.review_state IN ('approved', 'rejected'))
		OR (OLD.review_state = 'approved' AND NEW.review_state IN ('killed', 'revalidation_required'))
		OR (
			OLD.review_state = 'revalidation_required'
			AND NEW.review_state IN ('approved', 'rejected', 'killed')
		)
	) THEN
		RAISE EXCEPTION 'Custom Theme revision review-state transition is invalid'
			USING ERRCODE = '23514', CONSTRAINT = 'custom_theme_revision_state_transition';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_custom_theme_immutable_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME
		USING ERRCODE = '23514', CONSTRAINT = TG_TABLE_NAME || '_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_custom_theme_external_live_grant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF OLD.capability <> 'platform.custom_theme.external_live.access'::public.platform_capability
		AND (TG_OP = 'DELETE' OR NEW.capability <> 'platform.custom_theme.external_live.access'::public.platform_capability)
	THEN
		IF TG_OP = 'DELETE' THEN
			RETURN OLD;
		END IF;
		RETURN NEW;
	END IF;
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'External-live access grant history cannot be deleted'
			USING ERRCODE = '23514', CONSTRAINT = 'platform_capability_grant_custom_theme_history_immutable';
	END IF;
	IF (
		OLD.id,
		OLD.profile_id,
		OLD.capability,
		OLD.granted_by_profile_id,
		OLD.expires_at,
		OLD.created_at
	) IS DISTINCT FROM (
		NEW.id,
		NEW.profile_id,
		NEW.capability,
		NEW.granted_by_profile_id,
		NEW.expires_at,
		NEW.created_at
	) OR OLD.revoked_at IS NOT NULL
		OR NEW.revoked_at IS NULL
		OR NEW.revoked_by_profile_id IS NULL
	THEN
		RAISE EXCEPTION 'External-live access grants permit only one revocation transition'
			USING ERRCODE = '23514', CONSTRAINT = 'platform_capability_grant_custom_theme_lifecycle_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE TRIGGER custom_theme_revision_package_immutable
BEFORE UPDATE OR DELETE ON public.custom_theme_revision
FOR EACH ROW EXECUTE FUNCTION public.protect_custom_theme_revision_package();

CREATE TRIGGER custom_theme_revision_file_immutable
BEFORE UPDATE OR DELETE ON public.custom_theme_revision_file
FOR EACH ROW EXECUTE FUNCTION public.reject_custom_theme_immutable_history_mutation();

CREATE TRIGGER custom_theme_revision_review_event_immutable
BEFORE UPDATE OR DELETE ON public.custom_theme_revision_review_event
FOR EACH ROW EXECUTE FUNCTION public.reject_custom_theme_immutable_history_mutation();

CREATE TRIGGER unit_presentation_revision_immutable
BEFORE UPDATE OR DELETE ON public.unit_presentation_revision
FOR EACH ROW EXECUTE FUNCTION public.reject_custom_theme_immutable_history_mutation();

CREATE TRIGGER platform_capability_grant_custom_theme_lifecycle_guard
BEFORE UPDATE OR DELETE ON public.platform_capability_grant
FOR EACH ROW EXECUTE FUNCTION public.protect_custom_theme_external_live_grant();
