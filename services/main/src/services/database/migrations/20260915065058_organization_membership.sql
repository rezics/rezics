SET search_path TO public;

-- Remove obsolete account/Self-only owner functions before the generated table replacement.
DROP FUNCTION IF EXISTS public.organization_membership_guard_invitation() CASCADE;
DROP FUNCTION IF EXISTS public.organization_membership_guard_member() CASCADE;
DROP FUNCTION IF EXISTS public.organization_membership_guard_event() CASCADE;
DROP FUNCTION IF EXISTS public.organization_membership_record_event() CASCADE;
DROP FUNCTION IF EXISTS public.organization_membership_assert_invitation_authority(uuid,bigint,uuid,bigint,uuid,bigint) CASCADE;
DROP FUNCTION IF EXISTS public.organization_membership_lock_admission(uuid,uuid) CASCADE;

ALTER TABLE "organization_membership" DROP CONSTRAINT "organization_membership_accepted_invitation_fk";
ALTER TABLE "organization_membership_event" DROP CONSTRAINT "organization_membership_event_XB6qHzSruMoa_fkey";
ALTER TABLE "organization_membership_event" DROP CONSTRAINT "organization_membership_event_member_fk";
DROP TABLE "organization_membership";
DROP TABLE "organization_membership_event";
DROP TABLE "organization_membership_invitation";
CREATE TABLE "organization_enrollment_contact" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"scope_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"secret_digest" text NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"revoked_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_enrollment_contact_digest_check" CHECK ("secret_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "org_enrollment_contact_time_check" CHECK ("expires_at">"created_at" and "expires_at"<="created_at"+interval '30 days'),
	CONSTRAINT "org_enrollment_contact_version_check" CHECK ("version" in (1,2) and (("version"=1 and "revoked_at" is null) or ("version"=2 and "revoked_at" is not null)))
);

CREATE TABLE "organization_enrollment_invitation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_entity_id" uuid NOT NULL,
	"scope_id" uuid NOT NULL,
	"organization_revision" bigint NOT NULL,
	"recipient_subject_id" uuid NOT NULL,
	"contact_id" uuid,
	"invited_by_auth_user_id" uuid NOT NULL,
	"authority_subject_id" uuid NOT NULL,
	"authority" jsonb,
	"state" text DEFAULT 'pending' NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"membership_id" uuid,
	"generation" bigint,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"resolved_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_enrollment_revision_check" CHECK ("revision" between 1 and 9007199254740991 and "organization_revision">0),
	CONSTRAINT "org_enrollment_state_check" CHECK ("state" in ('pending','accepted','declined','revoked','expired','invalidated')),
	CONSTRAINT "org_enrollment_expiry_check" CHECK ("expires_at">"created_at" and "expires_at"<="created_at"+interval '30 days'),
	CONSTRAINT "org_enrollment_resolution_check" CHECK (("state"='pending')=("resolved_at" is null) and (("state"='accepted' and "membership_id" is not null and "generation">0) or ("state"<>'accepted' and "membership_id" is null and "generation" is null))),
	CONSTRAINT "org_enrollment_evidence_budget" CHECK (("state"<>'pending' or "authority" is not null) and octet_length("authority"::text)<=32768)
);

CREATE TABLE "organization_enrollment_operation" (
	"scope_id" uuid,
	"operation_id" uuid,
	"operator_auth_user_id" uuid NOT NULL,
	"authority_subject_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"invitation_id" uuid,
	"recipient_subject_id" uuid NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_enrollment_operation_pkey" PRIMARY KEY("scope_id","operation_id"),
	CONSTRAINT "org_enrollment_operation_digest_check" CHECK ("request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "org_enrollment_operation_result_budget" CHECK (octet_length("result"::text)<=2048)
);

CREATE TABLE "organization_enrollment_review" (
	"invitation_id" uuid PRIMARY KEY,
	"due_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "access_membership_id_scope_subject_key" ON "access_membership" ("id","scope_id","subject_id");
CREATE INDEX "access_membership_active_subject_idx" ON "access_membership" ("subject_id","scope_id") WHERE "active_generation" is not null;
CREATE INDEX "access_representation_recipient_scope_page_idx" ON "access_representation" ("recipient_scope_id","id") WHERE "recipient_scope_id" is not null;
CREATE INDEX "access_role_binding_recipient_scope_page_idx" ON "access_role_binding" ("recipient_scope_id","id") WHERE "recipient_scope_id" is not null;
CREATE UNIQUE INDEX "org_enrollment_contact_secret_key" ON "organization_enrollment_contact" ("secret_digest");
CREATE INDEX "org_enrollment_contact_subject_idx" ON "organization_enrollment_contact" ("subject_id","id");
CREATE INDEX "org_enrollment_contact_active_subject_idx" ON "organization_enrollment_contact" ("subject_id","id") WHERE "revoked_at" is null;
CREATE INDEX "org_enrollment_contact_expiry_idx" ON "organization_enrollment_contact" ("expires_at","id") WHERE "revoked_at" is null;
CREATE UNIQUE INDEX "org_enrollment_pending_pair_key" ON "organization_enrollment_invitation" ("scope_id","recipient_subject_id") WHERE "state"='pending';
CREATE INDEX "org_enrollment_scope_page_idx" ON "organization_enrollment_invitation" ("scope_id","id");
CREATE INDEX "org_enrollment_pending_scope_idx" ON "organization_enrollment_invitation" ("scope_id","id") WHERE "state"='pending';
CREATE INDEX "org_enrollment_subject_page_idx" ON "organization_enrollment_invitation" ("recipient_subject_id","id");
CREATE INDEX "org_enrollment_pending_subject_idx" ON "organization_enrollment_invitation" ("recipient_subject_id","id") WHERE "state"='pending';
CREATE INDEX "org_enrollment_sender_pending_idx" ON "organization_enrollment_invitation" ("invited_by_auth_user_id","id") WHERE "state"='pending';
CREATE INDEX "org_enrollment_expiry_idx" ON "organization_enrollment_invitation" ("expires_at","id") WHERE "state"='pending';
CREATE INDEX "org_enrollment_contact_idx" ON "organization_enrollment_invitation" ("contact_id","id");
CREATE INDEX "org_enrollment_membership_generation_idx" ON "organization_enrollment_invitation" ("membership_id","generation") WHERE "membership_id" is not null;
CREATE INDEX "org_enrollment_operation_subject_idx" ON "organization_enrollment_operation" ("recipient_subject_id","operation_id");
CREATE INDEX "org_enrollment_operation_invitation_idx" ON "organization_enrollment_operation" ("invitation_id");
CREATE INDEX "org_enrollment_review_due_idx" ON "organization_enrollment_review" ("due_at","invitation_id");
ALTER TABLE "organization_enrollment_contact" ADD CONSTRAINT "organization_enrollment_contact_scope_id_access_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_scope"("id");
ALTER TABLE "organization_enrollment_contact" ADD CONSTRAINT "organization_enrollment_contact_k066RMzcXrIQ_fkey" FOREIGN KEY ("subject_id") REFERENCES "access_subject"("id");
ALTER TABLE "organization_enrollment_invitation" ADD CONSTRAINT "organization_enrollment_invitation_jMP0nTJbRvG8_fkey" FOREIGN KEY ("organization_entity_id") REFERENCES "entity_participation"("entity_id");
ALTER TABLE "organization_enrollment_invitation" ADD CONSTRAINT "organization_enrollment_invitation_HHCFnrMY63Yx_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_scope"("id");
ALTER TABLE "organization_enrollment_invitation" ADD CONSTRAINT "organization_enrollment_invitation_5rUnjrjnNRmr_fkey" FOREIGN KEY ("recipient_subject_id") REFERENCES "access_subject"("id");
ALTER TABLE "organization_enrollment_invitation" ADD CONSTRAINT "organization_enrollment_invitation_qe0q8xZjhPuj_fkey" FOREIGN KEY ("contact_id") REFERENCES "organization_enrollment_contact"("id");
ALTER TABLE "organization_enrollment_invitation" ADD CONSTRAINT "organization_enrollment_invitation_wH1L0oKRztyC_fkey" FOREIGN KEY ("invited_by_auth_user_id") REFERENCES "users"("id");
ALTER TABLE "organization_enrollment_invitation" ADD CONSTRAINT "organization_enrollment_invitation_DCWsYfhTJb2N_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject"("id");
ALTER TABLE "organization_enrollment_invitation" ADD CONSTRAINT "org_enrollment_exact_member_fk" FOREIGN KEY ("membership_id","scope_id","recipient_subject_id") REFERENCES "access_membership"("id","scope_id","subject_id");
ALTER TABLE "organization_enrollment_invitation" ADD CONSTRAINT "org_enrollment_admission_fk" FOREIGN KEY ("membership_id","generation") REFERENCES "access_membership_admission"("membership_id","generation");
ALTER TABLE "organization_enrollment_operation" ADD CONSTRAINT "organization_enrollment_operation_scope_id_access_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "access_scope"("id");
ALTER TABLE "organization_enrollment_operation" ADD CONSTRAINT "organization_enrollment_operation_ffdKLJ82EoSR_fkey" FOREIGN KEY ("operator_auth_user_id") REFERENCES "users"("id");
ALTER TABLE "organization_enrollment_operation" ADD CONSTRAINT "organization_enrollment_operation_5HRlExJPnCLD_fkey" FOREIGN KEY ("authority_subject_id") REFERENCES "access_subject"("id");
ALTER TABLE "organization_enrollment_operation" ADD CONSTRAINT "organization_enrollment_operation_6MfefDPsi8sd_fkey" FOREIGN KEY ("invitation_id") REFERENCES "organization_enrollment_invitation"("id");
ALTER TABLE "organization_enrollment_operation" ADD CONSTRAINT "organization_enrollment_operation_rhUON8egQXs7_fkey" FOREIGN KEY ("recipient_subject_id") REFERENCES "access_subject"("id");
ALTER TABLE "organization_enrollment_review" ADD CONSTRAINT "organization_enrollment_review_9Z1spBnFnI8y_fkey" FOREIGN KEY ("invitation_id") REFERENCES "organization_enrollment_invitation"("id") ON DELETE CASCADE;
ALTER TABLE "access_assignment_ceiling" DROP CONSTRAINT "access_assignment_ceiling_count_check", ADD CONSTRAINT "access_assignment_ceiling_count_check" CHECK ("permission_count" between 0 and 100);
ALTER TABLE "access_assignment_ceiling_permission" DROP CONSTRAINT "access_assignment_ceiling_permission_check", ADD CONSTRAINT "access_assignment_ceiling_permission_check" CHECK ((((("family" = 'unit') and ("permission" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family" = 'platform') and ("permission" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family" = 'management') and ("permission" in ('access.identity.select', 'access.membership.read', 'access.membership.recover', 'access.membership.manage', 'access.membership.participate', 'access.representation.manage', 'access.group.read', 'access.group.create', 'access.group.update', 'access.group.reparent', 'access.group.retire', 'access.group.membership.manage', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))));
ALTER TABLE "access_representation_permission" DROP CONSTRAINT "access_representation_permission_known_check", ADD CONSTRAINT "access_representation_permission_known_check" CHECK ((((("family" = 'unit') and ("permission" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family" = 'platform') and ("permission" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family" = 'management') and ("permission" in ('access.identity.select', 'access.membership.read', 'access.membership.recover', 'access.membership.manage', 'access.membership.participate', 'access.representation.manage', 'access.group.read', 'access.group.create', 'access.group.update', 'access.group.reparent', 'access.group.retire', 'access.group.membership.manage', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))));
ALTER TABLE "access_representation_revision" DROP CONSTRAINT "access_representation_revision_count_check", ADD CONSTRAINT "access_representation_revision_count_check" CHECK ("permission_count" between 0 and 100);
ALTER TABLE "access_role_binding_permission" DROP CONSTRAINT "access_role_binding_permission_known_check", ADD CONSTRAINT "access_role_binding_permission_known_check" CHECK ((((("family" = 'unit') and ("permission" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family" = 'platform') and ("permission" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family" = 'management') and ("permission" in ('access.identity.select', 'access.membership.read', 'access.membership.recover', 'access.membership.manage', 'access.membership.participate', 'access.representation.manage', 'access.group.read', 'access.group.create', 'access.group.update', 'access.group.reparent', 'access.group.retire', 'access.group.membership.manage', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))));
ALTER TABLE "access_role_binding_revision" DROP CONSTRAINT "access_role_binding_revision_count_check", ADD CONSTRAINT "access_role_binding_revision_count_check" CHECK ("permission_count" between 0 and 100 and ("permission_policy"<>'local-role' or "permission_count"=0));
ALTER TABLE "access_role_permission" DROP CONSTRAINT "access_role_permission_registered_check", ADD CONSTRAINT "access_role_permission_registered_check" CHECK ((((("family"='unit') and ("permission" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family"='platform') and ("permission" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family"='management') and ("permission" in ('access.identity.select', 'access.membership.read', 'access.membership.recover', 'access.membership.manage', 'access.membership.participate', 'access.representation.manage', 'access.group.read', 'access.group.create', 'access.group.update', 'access.group.reparent', 'access.group.retire', 'access.group.membership.manage', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))));
ALTER TABLE "access_role_revision" DROP CONSTRAINT "access_role_revision_count_check", ADD CONSTRAINT "access_role_revision_count_check" CHECK ("permission_count" between 0 and 100);
ALTER TABLE "connected_app_capability" DROP CONSTRAINT "connected_app_capability_registered_check", ADD CONSTRAINT "connected_app_capability_registered_check" CHECK ((((("family"='api') and ("capability" in ('unit:read', 'unit:create', 'unit:update', 'account:read', 'account:update', 'access:read', 'access:manage', 'app:read', 'app:manage', 'interaction:read', 'interaction:write', 'realm:read', 'realm:manage', 'message:read', 'message:write', 'notification:read', 'notification:write', 'recommendation:read', 'recommendation:write', 'upload:read', 'upload:write', 'report:write')))) or ((("family"='unit') and ("capability" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family"='platform') and ("capability" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family"='management') and ("capability" in ('access.identity.select', 'access.membership.read', 'access.membership.recover', 'access.membership.manage', 'access.membership.participate', 'access.representation.manage', 'access.group.read', 'access.group.create', 'access.group.update', 'access.group.reparent', 'access.group.retire', 'access.group.membership.manage', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))));
ALTER TABLE "connected_app_client_capability" DROP CONSTRAINT "connected_app_client_capability_registered_check", ADD CONSTRAINT "connected_app_client_capability_registered_check" CHECK ((((("family"='api') and ("capability" in ('unit:read', 'unit:create', 'unit:update', 'account:read', 'account:update', 'access:read', 'access:manage', 'app:read', 'app:manage', 'interaction:read', 'interaction:write', 'realm:read', 'realm:manage', 'message:read', 'message:write', 'notification:read', 'notification:write', 'recommendation:read', 'recommendation:write', 'upload:read', 'upload:write', 'report:write')))) or ((("family"='unit') and ("capability" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family"='platform') and ("capability" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family"='management') and ("capability" in ('access.identity.select', 'access.membership.read', 'access.membership.recover', 'access.membership.manage', 'access.membership.participate', 'access.representation.manage', 'access.group.read', 'access.group.create', 'access.group.update', 'access.group.reparent', 'access.group.retire', 'access.group.membership.manage', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))));
ALTER TABLE "connected_app_client_revision" DROP CONSTRAINT "connected_app_client_revision_count_check", ADD CONSTRAINT "connected_app_client_revision_count_check" CHECK ("capability_count" between 0 and 122);
ALTER TABLE "connected_app_revision" DROP CONSTRAINT "connected_app_revision_count_check", ADD CONSTRAINT "connected_app_revision_count_check" CHECK ("capability_count" between 0 and 122);
ALTER TABLE "connected_installation_capability" DROP CONSTRAINT "connected_installation_capability_registered_check", ADD CONSTRAINT "connected_installation_capability_registered_check" CHECK ((((("family"='api') and ("capability" in ('unit:read', 'unit:create', 'unit:update', 'account:read', 'account:update', 'access:read', 'access:manage', 'app:read', 'app:manage', 'interaction:read', 'interaction:write', 'realm:read', 'realm:manage', 'message:read', 'message:write', 'notification:read', 'notification:write', 'recommendation:read', 'recommendation:write', 'upload:read', 'upload:write', 'report:write')))) or ((("family"='unit') and ("capability" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family"='platform') and ("capability" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family"='management') and ("capability" in ('access.identity.select', 'access.membership.read', 'access.membership.recover', 'access.membership.manage', 'access.membership.participate', 'access.representation.manage', 'access.group.read', 'access.group.create', 'access.group.update', 'access.group.reparent', 'access.group.retire', 'access.group.membership.manage', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))));
ALTER TABLE "connected_installation_revision" DROP CONSTRAINT "connected_installation_revision_counts_check", ADD CONSTRAINT "connected_installation_revision_counts_check" CHECK ("capability_count" between 0 and 122 and "binding_count" between 0 and 64 and
		(("attribution_entity_id" is null and "attribution_count"=0) or ("attribution_entity_id" is not null and "attribution_count" between 1 and 8)));
ALTER TABLE "connected_user_consent_capability" DROP CONSTRAINT "connected_user_consent_capability_registered_check", ADD CONSTRAINT "connected_user_consent_capability_registered_check" CHECK ((((("family"='api') and ("capability" in ('unit:read', 'unit:create', 'unit:update', 'account:read', 'account:update', 'access:read', 'access:manage', 'app:read', 'app:manage', 'interaction:read', 'interaction:write', 'realm:read', 'realm:manage', 'message:read', 'message:write', 'notification:read', 'notification:write', 'recommendation:read', 'recommendation:write', 'upload:read', 'upload:write', 'report:write')))) or ((("family"='unit') and ("capability" in ('unit.read', 'unit.update', 'unit.metadata-only.update', 'unit.status.update', 'unit.history.restore', 'unit.access.manage', 'unit.ownership.transfer', 'unit.association.manage', 'unit.tag-curation.manage', 'unit.reference-curation.manage', 'unit.realm-publication.manage', 'zone.pages.manage', 'zone.theme.manage', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate', 'entity.association.credit.request', 'entity.association.credit.direct', 'entity.association.subject.request', 'entity.association.subject.direct')))) or ((("family"='platform') and ("capability" in ('platform.access.read', 'platform.access.manage', 'platform.audit.read', 'platform.user.read', 'platform.user.status.update', 'platform.session.read', 'platform.session.revoke', 'entity.associations.override', 'catalog.definition.manage', 'unit.edit', 'platform.development_preview.access', 'platform.custom_theme.external_live.access', 'platform.custom_theme.external_live.access.manage', 'platform.custom_theme.review', 'platform.custom_theme.kill', 'unit.governance.read', 'unit.merge.propose', 'unit.merge.review', 'unit.merge', 'unit.ownership.override', 'unit.license.manage', 'unit.delete', 'unit.restore', 'unit.slug.manage', 'unit.slug.namespace.manage', 'unit.slug.redirect.release', 'platform.api_quota_policy.read', 'platform.api_quota_policy.update', 'platform.user.api_quota.read', 'platform.user.api_quota.update', 'platform.user.api_token.api_quota.read', 'platform.user.api_token.api_quota.update', 'platform.moderate', 'platform.suppress', 'realm.contribute', 'realm.units.create', 'realm.post.replies.create', 'realm.settings.update', 'realm.members.read', 'realm.members.manage', 'realm.rules.update', 'realm.pins.manage', 'realm.tags.manage', 'realm.tag-voting.update', 'realm.tag-contexts.manage', 'realm.units.moderate')))) or ((("family"='management') and ("capability" in ('access.identity.select', 'access.membership.read', 'access.membership.recover', 'access.membership.manage', 'access.membership.participate', 'access.representation.manage', 'access.group.read', 'access.group.create', 'access.group.update', 'access.group.reparent', 'access.group.retire', 'access.group.membership.manage', 'access.role.read', 'access.role.create', 'access.role.update', 'access.role.activate', 'access.role.retire', 'access.role-binding.manage', 'access.assignment-ceiling.manage', 'app.read', 'app.create', 'app.update', 'app.disable', 'app.retire', 'app.trust.manage'))))));
ALTER TABLE "connected_user_consent_revision" DROP CONSTRAINT "connected_user_consent_revision_counts_check", ADD CONSTRAINT "connected_user_consent_revision_counts_check" CHECK ("capability_count" between 0 and 122 and "representation_count" between 0 and 8 and
		(("resource_selection"='all-scopes' and "resource_count"=0) or ("resource_selection"='selected' and "resource_count" between 1 and 64)));

CREATE OR REPLACE FUNCTION public.access_principal_account_is_eligible(p_principal uuid,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH evaluated AS MATERIALIZED(SELECT clock_timestamp() AS now)
 SELECT CASE WHEN p_action IS NULL OR p_action NOT IN ('read','write','contribute') THEN NULL
  ELSE EXISTS(
   SELECT 1 FROM public.users u CROSS JOIN evaluated WHERE u.id=p_principal AND u.erased_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM public.user_account_state a WHERE a.user_id=u.id AND
     (a.state='closed' OR (a.state='suspended' AND (a.expires_at IS NULL OR NOT isfinite(a.expires_at) OR a.expires_at>evaluated.now))))
    AND (p_action='read' OR NOT EXISTS(SELECT 1 FROM public.account_enforcement e WHERE e.auth_user_id=u.id AND e.revocation_action_id IS NULL
     AND (e.kind IN ('ban','suspension') OR (p_action='contribute' AND e.kind='silence'))
     AND (NOT isfinite(e.starts_at) OR (e.expires_at IS NOT NULL AND NOT isfinite(e.expires_at)) OR
      (e.starts_at<=evaluated.now AND (e.expires_at IS NULL OR e.expires_at>evaluated.now)))))
  ) END
$$;

CREATE OR REPLACE FUNCTION public.connected_app_is_eligible(p_app uuid)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.connected_app app JOIN public.access_scope s ON s.id=app.scope_id
  LEFT JOIN public.users a ON a.id=s.auth_user_id LEFT JOIN public.workload_principal w ON w.auth_user_id=a.id
  LEFT JOIN public.access_scope ws ON ws.id=w.owner_scope_id
  LEFT JOIN public.reference_value r ON r.id=s.unit_ref LEFT JOIN public.entity_identity e ON e.id=r.target_entity_id
  LEFT JOIN public.entity_participation ep ON ep.entity_id=e.id
  WHERE app.id=p_app AND app.state='active' AND app.trust<>'blocked' AND (
   (a.principal_kind='human' AND public.access_principal_account_is_eligible(a.id,'read') IS TRUE) OR
   (a.principal_kind='service' AND w.purpose='system' AND w.state='active' AND ws.platform_root='platform'
    AND public.access_principal_account_is_eligible(a.id,'read') IS TRUE) OR
   (e.id IS NOT NULL AND e.deleted_at IS NULL AND ep.state='active')))
$$;

CREATE OR REPLACE FUNCTION public.connected_installation_is_eligible(p_installation uuid)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH evaluated AS MATERIALIZED(SELECT clock_timestamp() AS now)
 SELECT EXISTS(SELECT 1 FROM public.connected_installation i JOIN public.connected_installation_revision r
  ON r.installation_id=i.id AND r.revision=i.approved_revision CROSS JOIN evaluated
  WHERE i.id=p_installation AND i.state='active' AND r.sealed AND r.valid_from<=evaluated.now
   AND (r.valid_until IS NULL OR r.valid_until>evaluated.now) AND public.connected_app_is_eligible(i.app_id) IS TRUE)
$$;

CREATE OR REPLACE FUNCTION public.workload_principal_is_eligible(p_principal uuid,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN p_action IS NULL OR p_action NOT IN ('read','write','contribute') THEN NULL ELSE EXISTS(
  SELECT 1 FROM public.workload_principal w JOIN public.access_scope s ON s.id=w.owner_scope_id
   LEFT JOIN public.reference_value r ON r.id=s.unit_ref LEFT JOIN public.users a ON a.id=s.auth_user_id
   LEFT JOIN public.entity_identity e ON e.id=r.target_entity_id LEFT JOIN public.entity_participation ep ON ep.entity_id=e.id
   LEFT JOIN public.realm realm ON realm.id=r.target_realm_id
  WHERE w.auth_user_id=p_principal AND w.state='active' AND w.version>0 AND (
   (w.purpose='system' AND s.platform_root='platform') OR (w.purpose='installation' AND EXISTS(
    SELECT 1 FROM public.connected_installation i WHERE i.workload_principal_id=w.auth_user_id AND i.owner_scope_id=w.owner_scope_id
     AND public.connected_installation_is_eligible(i.id) IS TRUE) AND (
    (a.principal_kind='human' AND public.access_principal_account_is_eligible(a.id,p_action) IS TRUE) OR
    (e.shape='organization' AND e.deleted_at IS NULL AND ep.state='active') OR
    (realm.id IS NOT NULL AND realm.deleted_at IS NULL)
   )))) END
$$;

CREATE OR REPLACE FUNCTION public.access_subject_is_eligible(p_subject uuid,p_action text)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN p_action IS NULL OR p_action NOT IN ('read','write','contribute') THEN NULL
  WHEN s.auth_user_id IS NOT NULL THEN EXISTS(SELECT 1 FROM public.users u WHERE u.id=s.auth_user_id
   AND public.access_principal_account_is_eligible(u.id,p_action) IS TRUE
   AND (u.principal_kind='human' OR (u.principal_kind='service' AND public.workload_principal_is_eligible(u.id,p_action) IS TRUE)))
  ELSE EXISTS(SELECT 1 FROM public.entity_identity e JOIN public.entity_participation p ON p.entity_id=e.id
   WHERE e.id=s.entity_id AND e.deleted_at IS NULL AND p.state='active') END
 FROM public.access_subject s WHERE s.id=p_subject
$$;

-- Org admission remains institutional, but a disabled/recovery-required scope supplies no live member-set authority.
CREATE OR REPLACE FUNCTION public.access_membership_scope_is_eligible(p_scope uuid)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN e.shape='organization' THEN e.deleted_at IS NULL AND coalesce(p.state='active',false) ELSE true END
 FROM public.access_scope s LEFT JOIN public.reference_value r ON r.id=s.unit_ref
 LEFT JOIN public.entity_identity e ON e.id=r.target_entity_id LEFT JOIN public.entity_participation p ON p.entity_id=e.id
 WHERE s.id=p_scope
$$;

CREATE OR REPLACE FUNCTION public.access_subject_matches_recipient(p_subject uuid,p_kind text,p_recipient uuid,p_scope uuid,p_group uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE member public.access_membership%ROWTYPE; selected_count integer; matched boolean; broken boolean;
BEGIN
 IF p_subject IS NULL OR p_kind IS NULL THEN RETURN NULL; END IF;
 IF p_kind='subject' THEN RETURN p_subject=p_recipient; END IF;
 IF p_kind NOT IN ('group','all-members') OR p_scope IS NULL THEN RETURN NULL; END IF;
 IF public.access_membership_scope_is_eligible(p_scope) IS NULL THEN RETURN NULL; END IF;
 IF NOT public.access_membership_scope_is_eligible(p_scope) THEN RETURN false; END IF;
 SELECT * INTO member FROM public.access_membership WHERE subject_id=p_subject AND scope_id=p_scope;
 IF NOT FOUND OR member.active_generation IS NULL THEN RETURN false; END IF;
 IF p_kind='all-members' THEN RETURN true; END IF;
 IF p_group IS NULL OR NOT EXISTS(SELECT 1 FROM public.access_group_membership_set WHERE membership_id=member.id AND generation=member.active_generation) THEN RETURN NULL; END IF;
 SELECT count(*) INTO selected_count FROM (SELECT 1 FROM public.access_group_membership WHERE membership_id=member.id AND generation=member.active_generation AND selected LIMIT 65) selected;
 IF selected_count>64 THEN RETURN NULL; END IF;
 WITH RECURSIVE path(direct_id,id,parent_id,state,version,depth) AS (
  SELECT g.id,g.id,g.parent_id,g.state,g.version,1 FROM public.access_group_membership selected
   JOIN public.access_group g ON g.id=selected.group_id AND g.scope_id=selected.scope_id
   WHERE selected.membership_id=member.id AND selected.generation=member.active_generation AND selected.selected
  UNION ALL SELECT p.direct_id,g.id,g.parent_id,g.state,g.version,p.depth+1 FROM path p
   JOIN public.access_group g ON g.id=p.parent_id AND g.scope_id=p_scope WHERE p.state='active' AND p.depth<8
 ) SELECT coalesce(bool_or(id=p_group AND state='active' AND version>0),false),
  coalesce(bool_or(version=0 OR (state='active' AND depth=8 AND parent_id IS NOT NULL)),false) INTO matched,broken FROM path;
 IF broken THEN RETURN NULL; END IF;
 RETURN matched;
END $$;

CREATE OR REPLACE FUNCTION public.access_representation_path_is_current(p_grants uuid[],p_revisions bigint[],p_principal uuid,p_entity uuid,p_action text)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE step integer; head public.access_representation%ROWTYPE; terms public.access_representation_revision%ROWTYPE; next_subject uuid; owner_subject uuid; next_entity uuid; visited uuid[]:=array[]::uuid[];
BEGIN
 IF p_grants IS NULL OR p_revisions IS NULL OR cardinality(p_grants) NOT BETWEEN 1 AND 8 OR cardinality(p_grants)<>cardinality(p_revisions)
  OR coalesce(array_ndims(p_grants),1)<>1 OR coalesce(array_ndims(p_revisions),1)<>1 OR array_lower(p_grants,1)<>1 OR array_lower(p_revisions,1)<>1
  OR array_position(p_grants,NULL) IS NOT NULL OR array_position(p_revisions,NULL) IS NOT NULL THEN RETURN NULL; END IF;
 IF cardinality(p_grants)<>(SELECT count(DISTINCT value) FROM unnest(p_grants) value) THEN RETURN false; END IF;
 IF public.access_subject_is_eligible(p_principal,p_action) IS DISTINCT FROM true THEN RETURN false; END IF;
 next_entity:=p_entity;
 FOR step IN 1..cardinality(p_grants) LOOP
  SELECT * INTO head FROM public.access_representation WHERE id=p_grants[step];
  IF NOT FOUND OR head.entity_id IS DISTINCT FROM next_entity OR public.access_representation_is_current(head.id,p_revisions[step]) IS DISTINCT FROM true THEN RETURN false; END IF;
  IF head.entity_id=ANY(visited) THEN RETURN false; END IF;
  visited:=array_append(visited,head.entity_id);
  SELECT * INTO terms FROM public.access_representation_revision WHERE grant_id=head.id AND revision=p_revisions[step] AND sealed;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT id INTO owner_subject FROM public.access_subject WHERE entity_id=head.entity_id;
  IF public.access_subject_is_eligible(owner_subject,p_action) IS DISTINCT FROM true THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.access_representation_lineage(head.id,p_revisions[step]) l
   JOIN public.access_representation g ON g.id=l.grant_id WHERE g.parent_subject_id IS NOT NULL
    AND public.access_subject_is_eligible(g.parent_subject_id,p_action) IS DISTINCT FROM true) THEN RETURN false; END IF;
  IF step=cardinality(p_grants) THEN next_subject:=p_principal;
  ELSE
   IF NOT terms.can_redelegate THEN RETURN false; END IF;
   SELECT entity_id INTO next_entity FROM public.access_representation WHERE id=p_grants[step+1];
   SELECT id INTO next_subject FROM public.access_subject WHERE entity_id=next_entity;
   IF next_subject IS NULL THEN RETURN false; END IF;
  END IF;
  IF public.access_subject_matches_recipient(next_subject,head.recipient_kind,head.recipient_subject_id,head.recipient_scope_id,head.recipient_group_id) IS DISTINCT FROM true THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;


-- Exact admission/selection dependencies never follow a later rejoin or reassignment.
CREATE OR REPLACE FUNCTION public.access_role_binding_recipient_is_current(p_binding uuid,p_revision bigint)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE
  WHEN terms.membership_id IS NULL THEN true
  ELSE head.recipient_kind='subject' AND EXISTS(
   SELECT 1 FROM public.access_membership m
   WHERE m.id=terms.membership_id AND m.subject_id=head.recipient_subject_id
    AND m.active_generation=terms.membership_generation AND public.access_membership_scope_is_eligible(m.scope_id) IS TRUE
    AND (terms.selection_group_id IS NULL OR EXISTS(
     SELECT 1 FROM public.access_group_membership selected
     JOIN public.access_group g ON g.id=selected.group_id AND g.scope_id=selected.scope_id
     WHERE selected.membership_id=m.id AND selected.generation=terms.membership_generation
      AND selected.group_id=terms.selection_group_id AND selected.version=terms.selection_version
      AND selected.selected AND g.state='active')))
 END
 FROM public.access_role_binding head
 JOIN public.access_role_binding_revision terms ON terms.binding_id=head.id
 WHERE head.id=p_binding AND terms.revision=p_revision AND terms.sealed
$$;

CREATE OR REPLACE FUNCTION public.lock_access_role_binding_eligibility(p_membership uuid,p_generation bigint,p_group uuid)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE owner_scope uuid;
BEGIN
 IF p_membership IS NULL THEN RETURN; END IF;
 SELECT scope_id INTO owner_scope FROM public.access_membership WHERE id=p_membership;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recipient membership is missing' USING ERRCODE='23503'; END IF;
 PERFORM scope_id FROM public.access_group_tree WHERE scope_id=owner_scope FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recipient membership tree fence is missing' USING ERRCODE='23503'; END IF;
 PERFORM id FROM public.access_membership WHERE id=p_membership FOR SHARE;
 IF p_group IS NOT NULL THEN
  PERFORM membership_id FROM public.access_group_membership_set WHERE membership_id=p_membership AND generation=p_generation FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient selection fence is missing' USING ERRCODE='23503'; END IF;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.initialize_access_role_binding_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 INSERT INTO public.access_role_binding_scope(scope_id) VALUES(NEW.id);
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Binding scope fence is retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 THEN RAISE EXCEPTION 'Binding scope starts at version zero' USING ERRCODE='23514'; END IF;
 ELSIF NEW.scope_id<>OLD.scope_id OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Binding scope identity is fixed and version advances by one' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE receipt public.access_role_binding_event%ROWTYPE; terms public.access_role_binding_revision%ROWTYPE; role_state text; role_scope uuid; expected_terms bigint;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Binding identity and history are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.state<>'draft' OR NEW.terms_revision IS NOT NULL THEN RAISE EXCEPTION 'Binding starts without effective terms' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.target_scope_id,NEW.role_id,NEW.recipient_kind,NEW.recipient_subject_id,NEW.recipient_group_id,NEW.recipient_scope_id) IS DISTINCT FROM ROW(OLD.id,OLD.target_scope_id,OLD.role_id,OLD.recipient_kind,OLD.recipient_subject_id,OLD.recipient_group_id,OLD.recipient_scope_id) THEN RAISE EXCEPTION 'Binding identity cannot be retargeted' USING ERRCODE='55000'; END IF;
 IF OLD.state='revoked' OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Binding transition is stale or revoked' USING ERRCODE='23514'; END IF;
 SELECT * INTO receipt FROM public.access_role_binding_event WHERE binding_id=NEW.id AND version=NEW.version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding transition requires an exact receipt' USING ERRCODE='23514'; END IF;
 expected_terms:=CASE WHEN receipt.operation='revoke' THEN receipt.retained_terms_revision ELSE receipt.version END;
 IF NEW.terms_revision IS DISTINCT FROM expected_terms OR NEW.state IS DISTINCT FROM (CASE WHEN receipt.operation='revoke' THEN 'revoked' ELSE 'active' END) THEN RAISE EXCEPTION 'Binding head does not match its receipt' USING ERRCODE='23514'; END IF;
 SELECT * INTO terms FROM public.access_role_binding_revision WHERE binding_id=NEW.id AND revision=NEW.terms_revision AND sealed;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding requires its exact sealed terms' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' THEN
  PERFORM public.lock_access_role_binding_eligibility(terms.membership_id,terms.membership_generation,terms.selection_group_id);
  IF public.access_role_binding_recipient_is_current(NEW.id,NEW.terms_revision) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Recipient admission or exact Group selection is no longer current' USING ERRCODE='23514'; END IF;
  SELECT state,scope_id INTO role_state,role_scope FROM public.access_role WHERE id=NEW.role_id FOR SHARE;
  IF role_state IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Binding requires an active role at its effect' USING ERRCODE='23514'; END IF;
  IF terms.permission_policy='local-role' AND (role_scope<>NEW.target_scope_id OR (NEW.recipient_scope_id IS NOT NULL AND NEW.recipient_scope_id<>NEW.target_scope_id)) THEN RAISE EXCEPTION 'Cross-authority role use requires explicit approved permissions' USING ERRCODE='23514'; END IF;
  IF NEW.recipient_kind='group' AND NOT EXISTS(SELECT 1 FROM public.access_group WHERE id=NEW.recipient_group_id AND scope_id=NEW.recipient_scope_id AND state='active') THEN RAISE EXCEPTION 'Binding Group must be active at its effect' USING ERRCODE='23514'; END IF;
 END IF;
 UPDATE public.access_role_binding_scope SET version=version+1 WHERE scope_id=NEW.target_scope_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding scope fence is missing' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.access_role_binding%ROWTYPE; declared_actor uuid;
BEGIN
 SELECT * INTO head FROM public.access_role_binding WHERE id=NEW.binding_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding identity is missing' USING ERRCODE='23503'; END IF;
 PERFORM scope_id FROM public.access_role_binding_scope WHERE scope_id=head.target_scope_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding scope fence is missing' USING ERRCODE='23503'; END IF;
 IF head.recipient_kind='group' THEN
  PERFORM scope_id FROM public.access_group_tree WHERE scope_id=head.recipient_scope_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient Group tree fence is missing' USING ERRCODE='23503'; END IF;
 END IF;
 PERFORM id FROM public.access_role WHERE id=head.role_id FOR SHARE;
 SELECT * INTO head FROM public.access_role_binding WHERE id=NEW.binding_id FOR UPDATE;
 SELECT auth_user_id INTO declared_actor FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Authority subject is missing' USING ERRCODE='23503'; END IF;
 IF declared_actor IS NOT NULL AND declared_actor<>NEW.operator_auth_user_id THEN RAISE EXCEPTION 'Direct authority cannot name another operator' USING ERRCODE='23514'; END IF;
 IF head.state='revoked' OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Binding receipt is stale or revoked' USING ERRCODE='23514'; END IF;
 IF NEW.operation='create' THEN
  IF head.version<>0 THEN RAISE EXCEPTION 'Binding already exists' USING ERRCODE='23514'; END IF;
 ELSIF head.version=0 THEN RAISE EXCEPTION 'Binding must be created first' USING ERRCODE='23514';
 END IF;
 IF NEW.operation='revoke' AND NEW.retained_terms_revision IS DISTINCT FROM head.terms_revision THEN RAISE EXCEPTION 'Revocation retains the current terms' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event_kind text; actual_count integer; actual_digest text; recipient public.access_role_binding%ROWTYPE; member public.access_membership%ROWTYPE; selection_operation text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Binding terms are immutable' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT operation INTO event_kind FROM public.access_role_binding_event WHERE binding_id=NEW.binding_id AND version=NEW.revision;
  IF event_kind IS NULL THEN RAISE EXCEPTION 'Terms receipt is missing' USING ERRCODE='23503'; END IF;
  IF event_kind NOT IN('create','amend') OR NEW.sealed THEN RAISE EXCEPTION 'Terms require their creating receipt before sealing' USING ERRCODE='23514'; END IF;
  IF cardinality(NEW.target_path)>0 AND array_lower(NEW.target_path,1)<>1 THEN RAISE EXCEPTION 'Binding target paths use canonical array bounds' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(NEW.target_path) segment WHERE segment !~ '^[a-z0-9][a-z0-9-]{0,255}$') THEN RAISE EXCEPTION 'Invalid binding target path' USING ERRCODE='23514'; END IF;
  IF NEW.membership_id IS NOT NULL THEN
   SELECT * INTO recipient FROM public.access_role_binding WHERE id=NEW.binding_id;
   SELECT * INTO member FROM public.access_membership WHERE id=NEW.membership_id;
   IF recipient.recipient_kind IS DISTINCT FROM 'subject' OR member.subject_id IS DISTINCT FROM recipient.recipient_subject_id THEN RAISE EXCEPTION 'Admission dependency must belong to the exact subject recipient' USING ERRCODE='23514'; END IF;
   IF NEW.selection_group_id IS NOT NULL THEN
    SELECT operation INTO selection_operation FROM public.access_group_membership_event WHERE membership_id=NEW.membership_id AND generation=NEW.membership_generation AND group_id=NEW.selection_group_id AND version=NEW.selection_version;
    IF selection_operation IS DISTINCT FROM 'assign' THEN RAISE EXCEPTION 'Group dependency requires its exact assignment receipt' USING ERRCODE='23514'; END IF;
   END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.sealed OR NOT NEW.sealed OR (to_jsonb(NEW)-'sealed') IS DISTINCT FROM (to_jsonb(OLD)-'sealed') THEN RAISE EXCEPTION 'Only sealing can change binding terms' USING ERRCODE='55000'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(family||':'||permission,E'\n' ORDER BY family COLLATE "C",permission COLLATE "C"),''),'UTF8')),'hex') INTO actual_count,actual_digest FROM public.access_role_binding_permission WHERE binding_id=NEW.binding_id AND revision=NEW.revision;
 IF actual_count<>NEW.permission_count OR actual_digest<>NEW.permission_digest THEN RAISE EXCEPTION 'Binding approval snapshot is incomplete or inconsistent' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_role_binding_permission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE terms public.access_role_binding_revision%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Binding approval history is immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO terms FROM public.access_role_binding_revision WHERE binding_id=NEW.binding_id AND revision=NEW.revision FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Binding terms are missing' USING ERRCODE='23503'; END IF;
 IF terms.sealed THEN RAISE EXCEPTION 'Sealed terms cannot gain approved permissions' USING ERRCODE='55000'; END IF;
 IF terms.permission_policy<>'frozen-ceiling' THEN RAISE EXCEPTION 'Local role following has no frozen permission rows' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_access_role_binding_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE final_version bigint; receipt public.access_role_binding_event%ROWTYPE; expected_terms bigint;
BEGIN
 IF TG_TABLE_NAME='access_role_binding' THEN
  SELECT version INTO final_version FROM public.access_role_binding WHERE id=NEW.id;
  IF final_version=0 THEN RAISE EXCEPTION 'Binding creation must complete sealed terms' USING ERRCODE='23514'; END IF;
  IF NEW.version>0 THEN
   SELECT * INTO receipt FROM public.access_role_binding_event WHERE binding_id=NEW.id AND version=NEW.version;
   IF NOT FOUND THEN RAISE EXCEPTION 'Binding head requires its exact receipt' USING ERRCODE='23514'; END IF;
   expected_terms:=CASE WHEN receipt.operation='revoke' THEN receipt.retained_terms_revision ELSE receipt.version END;
   IF NEW.terms_revision IS DISTINCT FROM expected_terms OR NEW.state IS DISTINCT FROM (CASE WHEN receipt.operation='revoke' THEN 'revoked' ELSE 'active' END) THEN RAISE EXCEPTION 'Binding transition snapshot is inconsistent' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='access_role_binding_event' THEN
  SELECT version INTO final_version FROM public.access_role_binding WHERE id=NEW.binding_id;
  IF final_version<NEW.version THEN RAISE EXCEPTION 'Binding receipt must advance the head' USING ERRCODE='23514'; END IF;
  IF NEW.operation<>'revoke' AND NOT EXISTS(SELECT 1 FROM public.access_role_binding_revision WHERE binding_id=NEW.binding_id AND revision=NEW.version AND sealed) THEN RAISE EXCEPTION 'Binding receipt must complete its terms' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.access_role_binding_revision WHERE binding_id=NEW.binding_id AND revision=NEW.revision AND sealed) THEN RAISE EXCEPTION 'Binding terms must be sealed before commit' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS access_role_binding_scope_initialize ON public.access_scope;
CREATE TRIGGER access_role_binding_scope_initialize AFTER INSERT ON public.access_scope FOR EACH ROW EXECUTE FUNCTION public.initialize_access_role_binding_scope();
DROP TRIGGER IF EXISTS access_role_binding_scope_guard ON public.access_role_binding_scope;
CREATE TRIGGER access_role_binding_scope_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_binding_scope FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_scope();
DROP TRIGGER IF EXISTS access_role_binding_head_guard ON public.access_role_binding;
CREATE TRIGGER access_role_binding_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_binding FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_head();
DROP TRIGGER IF EXISTS access_role_binding_event_guard ON public.access_role_binding_event;
CREATE TRIGGER access_role_binding_event_guard BEFORE INSERT ON public.access_role_binding_event FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_event();
DROP TRIGGER IF EXISTS access_role_binding_event_immutable ON public.access_role_binding_event;
CREATE TRIGGER access_role_binding_event_immutable BEFORE UPDATE OR DELETE ON public.access_role_binding_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_role_binding_revision_guard ON public.access_role_binding_revision;
CREATE TRIGGER access_role_binding_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_binding_revision FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_revision();
DROP TRIGGER IF EXISTS access_role_binding_permission_guard ON public.access_role_binding_permission;
CREATE TRIGGER access_role_binding_permission_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_role_binding_permission FOR EACH ROW EXECUTE FUNCTION public.guard_access_role_binding_permission();
DROP TRIGGER IF EXISTS access_role_binding_head_complete ON public.access_role_binding;
CREATE CONSTRAINT TRIGGER access_role_binding_head_complete AFTER INSERT OR UPDATE ON public.access_role_binding DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_role_binding_history();
DROP TRIGGER IF EXISTS access_role_binding_event_complete ON public.access_role_binding_event;
CREATE CONSTRAINT TRIGGER access_role_binding_event_complete AFTER INSERT ON public.access_role_binding_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_role_binding_history();
DROP TRIGGER IF EXISTS access_role_binding_revision_complete ON public.access_role_binding_revision;
CREATE CONSTRAINT TRIGGER access_role_binding_revision_complete AFTER INSERT OR UPDATE ON public.access_role_binding_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_role_binding_history();


-- Exact admission/selection dependencies never follow a later rejoin or reassignment.
CREATE OR REPLACE FUNCTION public.access_representation_recipient_is_current(p_grant uuid,p_revision bigint)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT CASE
  WHEN terms.membership_id IS NULL THEN true
  ELSE head.recipient_kind='subject' AND EXISTS(
   SELECT 1 FROM public.access_membership m
   WHERE m.id=terms.membership_id AND m.subject_id=head.recipient_subject_id
    AND m.active_generation=terms.membership_generation AND public.access_membership_scope_is_eligible(m.scope_id) IS TRUE
    AND (terms.selection_group_id IS NULL OR EXISTS(
     SELECT 1 FROM public.access_group_membership selected
     JOIN public.access_group g ON g.id=selected.group_id AND g.scope_id=selected.scope_id
     WHERE selected.membership_id=m.id AND selected.generation=terms.membership_generation
      AND selected.group_id=terms.selection_group_id AND selected.version=terms.selection_version
      AND selected.selected AND g.state='active')))
 END
 FROM public.access_representation head
 JOIN public.access_representation_revision terms ON terms.grant_id=head.id
 WHERE head.id=p_grant AND terms.revision=p_revision AND terms.sealed
$$;

CREATE OR REPLACE FUNCTION public.access_representation_parent_basis_is_current(p_grant uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE child public.access_representation%ROWTYPE; parent public.access_representation%ROWTYPE; member public.access_membership%ROWTYPE;
BEGIN
 SELECT * INTO child FROM public.access_representation WHERE id=p_grant;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF child.parent_grant_id IS NULL THEN RETURN true; END IF;
 SELECT * INTO parent FROM public.access_representation WHERE id=child.parent_grant_id;
 IF NOT FOUND OR child.parent_subject_id IS NULL THEN RETURN false; END IF;
 IF parent.recipient_kind='subject' THEN
  IF parent.recipient_subject_id<>child.parent_subject_id THEN RETURN false; END IF;
 ELSIF child.parent_membership_id IS NULL THEN RETURN false;
 END IF;
 IF child.parent_membership_id IS NOT NULL THEN
  SELECT * INTO member FROM public.access_membership WHERE id=child.parent_membership_id;
  IF NOT FOUND OR public.access_membership_scope_is_eligible(member.scope_id) IS DISTINCT FROM true OR member.subject_id<>child.parent_subject_id OR member.active_generation IS DISTINCT FROM child.parent_membership_generation OR (parent.recipient_kind<>'subject' AND member.scope_id<>parent.recipient_scope_id) THEN RETURN false; END IF;
 END IF;
 IF child.parent_selection_group_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.access_group_membership selected JOIN public.access_group g ON g.id=selected.group_id AND g.scope_id=selected.scope_id
   WHERE selected.membership_id=child.parent_membership_id AND selected.generation=child.parent_membership_generation
    AND selected.group_id=child.parent_selection_group_id AND selected.version=child.parent_selection_version AND selected.selected AND g.state='active') THEN RETURN false; END IF;
 END IF;
 IF parent.recipient_kind='group' THEN
  IF child.parent_selection_group_id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS(WITH RECURSIVE path(id,parent_id,state,depth) AS (
   SELECT g.id,g.parent_id,g.state,1 FROM public.access_group g WHERE g.id=child.parent_selection_group_id AND g.scope_id=parent.recipient_scope_id
   UNION ALL SELECT g.id,g.parent_id,g.state,p.depth+1 FROM path p JOIN public.access_group g ON g.id=p.parent_id AND g.scope_id=parent.recipient_scope_id WHERE p.state='active' AND p.depth<8
  ) SELECT 1 FROM path WHERE id=parent.recipient_group_id AND state='active');
 END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.access_representation_terms_narrower(p_child uuid,p_child_revision bigint,p_parent uuid,p_parent_revision bigint,p_keep_eligibility boolean)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 SELECT child.sealed AND parent.sealed
  AND (parent.target_kind='all-scopes' OR (child.target_kind='scope' AND child.target_scope_id=parent.target_scope_id
   AND cardinality(child.target_path)>=cardinality(parent.target_path)
   AND (cardinality(parent.target_path)=0 OR child.target_path[1:cardinality(parent.target_path)]=parent.target_path)))
  AND child.valid_from>=parent.valid_from
  AND (parent.valid_until IS NULL OR (child.valid_until IS NOT NULL AND child.valid_until<=parent.valid_until))
  AND (NOT child.can_redelegate OR parent.can_redelegate)
  AND (NOT parent.require_fresh_session OR child.require_fresh_session)
  AND (NOT p_keep_eligibility OR parent.membership_id IS NULL OR
   (child.membership_id IS NOT DISTINCT FROM parent.membership_id AND child.membership_generation IS NOT DISTINCT FROM parent.membership_generation
    AND (parent.selection_group_id IS NULL OR (child.selection_group_id IS NOT DISTINCT FROM parent.selection_group_id AND child.selection_version IS NOT DISTINCT FROM parent.selection_version))))
  AND NOT EXISTS(SELECT 1 FROM public.access_representation_permission requested
   WHERE requested.grant_id=p_child AND requested.revision=p_child_revision
    AND NOT EXISTS(SELECT 1 FROM public.access_representation_permission approved WHERE approved.grant_id=p_parent AND approved.revision=p_parent_revision AND approved.family=requested.family AND approved.permission=requested.permission))
 FROM public.access_representation_revision child,public.access_representation_revision parent
 WHERE child.grant_id=p_child AND child.revision=p_child_revision AND parent.grant_id=p_parent AND parent.revision=p_parent_revision
$$;

CREATE OR REPLACE FUNCTION public.access_representation_lineage(p_grant uuid,p_revision bigint)
RETURNS TABLE(grant_id uuid,revision bigint,depth integer) LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH RECURSIVE lineage(id,terms_revision,parent_id,parent_revision,depth) AS (
  SELECT g.id,p_revision,g.parent_grant_id,g.parent_revision,1 FROM public.access_representation g WHERE g.id=p_grant
  UNION ALL
  SELECT g.id,l.parent_revision,g.parent_grant_id,g.parent_revision,l.depth+1
  FROM lineage l JOIN public.access_representation g ON g.id=l.parent_id WHERE l.depth<9
 ) SELECT id,terms_revision,depth FROM lineage
$$;

CREATE OR REPLACE FUNCTION public.lock_access_representation_lineage(p_grant uuid,p_revision bigint)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE represented uuid;
BEGIN
 SELECT entity_id INTO represented FROM public.access_representation WHERE id=p_grant;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation parent is missing' USING ERRCODE='23503'; END IF;
 PERFORM entity_id FROM public.access_representation_entity WHERE entity_id=represented FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation Entity fence is missing' USING ERRCODE='23503'; END IF;
 IF (SELECT count(*) FROM public.access_representation_lineage(p_grant,p_revision))>8 THEN RAISE EXCEPTION 'Representation lineage exceeds depth budget' USING ERRCODE='54000'; END IF;
 PERFORM tree.scope_id FROM public.access_group_tree tree WHERE tree.scope_id IN (
  SELECT m.scope_id FROM public.access_representation_lineage(p_grant,p_revision) l
   JOIN public.access_representation_revision r ON r.grant_id=l.grant_id AND r.revision=l.revision
   JOIN public.access_membership m ON m.id=r.membership_id
  UNION SELECT g.recipient_scope_id FROM public.access_representation_lineage(p_grant,p_revision) l
   JOIN public.access_representation g ON g.id=l.grant_id WHERE g.recipient_kind='group'
  UNION SELECT m.scope_id FROM public.access_representation_lineage(p_grant,p_revision) l JOIN public.access_representation g ON g.id=l.grant_id JOIN public.access_membership m ON m.id=g.parent_membership_id
 ) ORDER BY tree.scope_id FOR SHARE;
 PERFORM m.id FROM public.access_membership m WHERE m.id IN (
  SELECT r.membership_id FROM public.access_representation_lineage(p_grant,p_revision) l
   JOIN public.access_representation_revision r ON r.grant_id=l.grant_id AND r.revision=l.revision
  UNION SELECT g.parent_membership_id FROM public.access_representation_lineage(p_grant,p_revision) l JOIN public.access_representation g ON g.id=l.grant_id
 ) ORDER BY m.id FOR SHARE;
 PERFORM selection.membership_id FROM public.access_group_membership_set selection WHERE (selection.membership_id,selection.generation) IN (
  SELECT r.membership_id,r.membership_generation FROM public.access_representation_lineage(p_grant,p_revision) l
   JOIN public.access_representation_revision r ON r.grant_id=l.grant_id AND r.revision=l.revision WHERE r.selection_group_id IS NOT NULL
  UNION SELECT g.parent_membership_id,g.parent_membership_generation FROM public.access_representation_lineage(p_grant,p_revision) l JOIN public.access_representation g ON g.id=l.grant_id WHERE g.parent_selection_group_id IS NOT NULL
 ) ORDER BY selection.membership_id,selection.generation FOR SHARE;
END $$;

CREATE OR REPLACE FUNCTION public.access_representation_is_current(p_grant uuid,p_revision bigint)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path=pg_catalog,public AS $$
 WITH evaluated AS MATERIALIZED(SELECT clock_timestamp() AS now), lineage AS MATERIALIZED(SELECT * FROM public.access_representation_lineage(p_grant,p_revision))
 SELECT count(*) BETWEEN 1 AND 8 AND count(*)=count(DISTINCT l.grant_id)
  AND bool_or(g.parent_grant_id IS NULL)
  AND bool_and(g.state='active' AND g.terms_revision=l.revision AND r.sealed
   AND r.valid_from<=evaluated.now AND (r.valid_until IS NULL OR r.valid_until>evaluated.now)
   AND public.access_representation_recipient_is_current(g.id,l.revision) IS TRUE
   AND public.access_representation_parent_basis_is_current(g.id) IS TRUE
   AND (g.recipient_kind<>'group' OR EXISTS(SELECT 1 FROM public.access_group recipient WHERE recipient.id=g.recipient_group_id AND recipient.scope_id=g.recipient_scope_id AND recipient.state='active')))
 FROM lineage l JOIN public.access_representation g ON g.id=l.grant_id
 JOIN public.access_representation_revision r ON r.grant_id=g.id AND r.revision=l.revision CROSS JOIN evaluated
 HAVING count(*)=(SELECT count(*) FROM lineage)
$$;

CREATE OR REPLACE FUNCTION public.initialize_access_representation_entity()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.entity_id IS NOT NULL THEN
  INSERT INTO public.access_representation_entity(entity_id) VALUES(NEW.entity_id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_representation_entity()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Representation scope fence is retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 THEN RAISE EXCEPTION 'Representation scope starts at version zero' USING ERRCODE='23514'; END IF;
 ELSIF NEW.entity_id<>OLD.entity_id OR NEW.version<>OLD.version+1 THEN
  RAISE EXCEPTION 'Representation scope identity is fixed and version advances by one' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_representation_head()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE receipt public.access_representation_event%ROWTYPE; terms public.access_representation_revision%ROWTYPE; expected_terms bigint; parent public.access_representation%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Representation identity and history are retained' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>0 OR NEW.state<>'draft' OR NEW.terms_revision IS NOT NULL THEN RAISE EXCEPTION 'Representation starts without effective terms' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.entity_id,NEW.parent_grant_id,NEW.parent_revision,NEW.parent_subject_id,NEW.parent_membership_id,NEW.parent_membership_generation,NEW.parent_selection_group_id,NEW.parent_selection_version,NEW.recipient_kind,NEW.recipient_subject_id,NEW.recipient_group_id,NEW.recipient_scope_id) IS DISTINCT FROM ROW(OLD.id,OLD.entity_id,OLD.parent_grant_id,OLD.parent_revision,OLD.parent_subject_id,OLD.parent_membership_id,OLD.parent_membership_generation,OLD.parent_selection_group_id,OLD.parent_selection_version,OLD.recipient_kind,OLD.recipient_subject_id,OLD.recipient_group_id,OLD.recipient_scope_id) THEN RAISE EXCEPTION 'Representation identity cannot be retargeted' USING ERRCODE='55000'; END IF;
 IF OLD.state='revoked' OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Representation transition is stale or revoked' USING ERRCODE='23514'; END IF;
 SELECT * INTO receipt FROM public.access_representation_event WHERE grant_id=NEW.id AND version=NEW.version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation transition requires an exact receipt' USING ERRCODE='23514'; END IF;
 expected_terms:=CASE WHEN receipt.operation='revoke' THEN receipt.retained_terms_revision ELSE receipt.version END;
 IF NEW.terms_revision IS DISTINCT FROM expected_terms OR NEW.state IS DISTINCT FROM (CASE WHEN receipt.operation='revoke' THEN 'revoked' ELSE 'active' END) THEN RAISE EXCEPTION 'Representation head does not match its receipt' USING ERRCODE='23514'; END IF;
 SELECT * INTO terms FROM public.access_representation_revision WHERE grant_id=NEW.id AND revision=NEW.terms_revision AND sealed;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation requires its exact sealed terms' USING ERRCODE='23514'; END IF;
 IF ROW(NEW.target_kind,NEW.target_scope_id) IS DISTINCT FROM ROW(terms.target_kind,terms.target_scope_id) THEN RAISE EXCEPTION 'Representation target must mirror its selected sealed terms' USING ERRCODE='23514'; END IF;
 IF NEW.state='active' THEN
  PERFORM public.lock_access_role_binding_eligibility(terms.membership_id,terms.membership_generation,terms.selection_group_id);
  IF public.access_representation_recipient_is_current(NEW.id,NEW.terms_revision) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Recipient admission or exact Group selection is no longer current' USING ERRCODE='23514'; END IF;
  IF receipt.operation='narrow' AND public.access_representation_terms_narrower(NEW.id,NEW.terms_revision,OLD.id,OLD.terms_revision,true) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Representation amendment may only narrow its exact previous terms' USING ERRCODE='23514'; END IF;
  IF NEW.parent_grant_id IS NOT NULL THEN
   PERFORM public.lock_access_role_binding_eligibility(NEW.parent_membership_id,NEW.parent_membership_generation,NEW.parent_selection_group_id);
   IF public.access_representation_parent_basis_is_current(NEW.id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Dependent issuer admission or Group assignment is no longer current' USING ERRCODE='23514'; END IF;
   SELECT * INTO parent FROM public.access_representation WHERE id=NEW.parent_grant_id;
   IF parent.entity_id IS DISTINCT FROM NEW.entity_id THEN RAISE EXCEPTION 'Dependent representation preserves its Entity authority' USING ERRCODE='23514'; END IF;
   PERFORM public.lock_access_representation_lineage(NEW.parent_grant_id,NEW.parent_revision);
   IF public.access_representation_is_current(NEW.parent_grant_id,NEW.parent_revision) IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM public.access_representation_revision WHERE grant_id=NEW.parent_grant_id AND revision=NEW.parent_revision AND can_redelegate) OR public.access_representation_terms_narrower(NEW.id,NEW.terms_revision,NEW.parent_grant_id,NEW.parent_revision,false) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Dependent representation exceeds or outlives current redelegation authority' USING ERRCODE='23514'; END IF;
   IF (SELECT count(*) FROM public.access_representation_lineage(NEW.parent_grant_id,NEW.parent_revision))>=8 THEN RAISE EXCEPTION 'Representation lineage depth exhausted' USING ERRCODE='54000'; END IF;
  END IF;
  IF NEW.recipient_kind='group' AND NOT EXISTS(SELECT 1 FROM public.access_group WHERE id=NEW.recipient_group_id AND scope_id=NEW.recipient_scope_id AND state='active') THEN RAISE EXCEPTION 'Representation Group must be active at its effect' USING ERRCODE='23514'; END IF;
 END IF;
 UPDATE public.access_representation_entity SET version=version+1 WHERE entity_id=NEW.entity_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation scope fence is missing' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_representation_event()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE head public.access_representation%ROWTYPE; declared_actor uuid;
BEGIN
 SELECT * INTO head FROM public.access_representation WHERE id=NEW.grant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation identity is missing' USING ERRCODE='23503'; END IF;
 PERFORM entity_id FROM public.access_representation_entity WHERE entity_id=head.entity_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation scope fence is missing' USING ERRCODE='23503'; END IF;
 IF head.recipient_kind='group' THEN
  PERFORM scope_id FROM public.access_group_tree WHERE scope_id=head.recipient_scope_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient Group tree fence is missing' USING ERRCODE='23503'; END IF;
 END IF;
 SELECT * INTO head FROM public.access_representation WHERE id=NEW.grant_id FOR UPDATE;
 SELECT auth_user_id INTO declared_actor FROM public.access_subject WHERE id=NEW.authority_subject_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Authority subject is missing' USING ERRCODE='23503'; END IF;
 IF declared_actor IS NOT NULL AND declared_actor<>NEW.operator_auth_user_id THEN RAISE EXCEPTION 'Direct authority cannot name another operator' USING ERRCODE='23514'; END IF;
 IF head.state='revoked' OR NEW.version<>head.version+1 THEN RAISE EXCEPTION 'Representation receipt is stale or revoked' USING ERRCODE='23514'; END IF;
 IF NEW.operation='create' THEN
  IF head.parent_grant_id IS NOT NULL AND NEW.authority_subject_id IS DISTINCT FROM head.parent_subject_id THEN RAISE EXCEPTION 'Dependent creation must exercise its exact parent authority subject' USING ERRCODE='23514'; END IF;
  IF head.version<>0 THEN RAISE EXCEPTION 'Representation already exists' USING ERRCODE='23514'; END IF;
 ELSIF head.version=0 THEN RAISE EXCEPTION 'Representation must be created first' USING ERRCODE='23514';
 END IF;
 IF NEW.operation='revoke' AND NEW.retained_terms_revision IS DISTINCT FROM head.terms_revision THEN RAISE EXCEPTION 'Revocation retains the current terms' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_representation_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE event_kind text; actual_count integer; actual_digest text; recipient public.access_representation%ROWTYPE; member public.access_membership%ROWTYPE; selection_operation text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Representation terms are immutable' USING ERRCODE='55000'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT operation INTO event_kind FROM public.access_representation_event WHERE grant_id=NEW.grant_id AND version=NEW.revision;
  IF event_kind IS NULL THEN RAISE EXCEPTION 'Terms receipt is missing' USING ERRCODE='23503'; END IF;
  IF event_kind NOT IN('create','narrow') OR NEW.sealed THEN RAISE EXCEPTION 'Terms require their creating receipt before sealing' USING ERRCODE='23514'; END IF;
  IF cardinality(NEW.target_path)>0 AND array_lower(NEW.target_path,1)<>1 THEN RAISE EXCEPTION 'Representation target paths use canonical array bounds' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(NEW.target_path) segment WHERE segment !~ '^[a-z0-9][a-z0-9-]{0,255}$') THEN RAISE EXCEPTION 'Invalid representation target path' USING ERRCODE='23514'; END IF;
  IF NEW.membership_id IS NOT NULL THEN
   SELECT * INTO recipient FROM public.access_representation WHERE id=NEW.grant_id;
   SELECT * INTO member FROM public.access_membership WHERE id=NEW.membership_id;
   IF recipient.recipient_kind IS DISTINCT FROM 'subject' OR member.subject_id IS DISTINCT FROM recipient.recipient_subject_id THEN RAISE EXCEPTION 'Admission dependency must belong to the exact subject recipient' USING ERRCODE='23514'; END IF;
   IF NEW.selection_group_id IS NOT NULL THEN
    SELECT operation INTO selection_operation FROM public.access_group_membership_event WHERE membership_id=NEW.membership_id AND generation=NEW.membership_generation AND group_id=NEW.selection_group_id AND version=NEW.selection_version;
    IF selection_operation IS DISTINCT FROM 'assign' THEN RAISE EXCEPTION 'Group dependency requires its exact assignment receipt' USING ERRCODE='23514'; END IF;
   END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.sealed OR NOT NEW.sealed OR (to_jsonb(NEW)-'sealed') IS DISTINCT FROM (to_jsonb(OLD)-'sealed') THEN RAISE EXCEPTION 'Only sealing can change representation terms' USING ERRCODE='55000'; END IF;
 SELECT count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(family||':'||permission,E'\n' ORDER BY family COLLATE "C",permission COLLATE "C"),''),'UTF8')),'hex') INTO actual_count,actual_digest FROM public.access_representation_permission WHERE grant_id=NEW.grant_id AND revision=NEW.revision;
 IF actual_count<>NEW.permission_count OR actual_digest<>NEW.permission_digest THEN RAISE EXCEPTION 'Representation approval snapshot is incomplete or inconsistent' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_access_representation_permission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE terms public.access_representation_revision%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Representation approval history is immutable' USING ERRCODE='55000'; END IF;
 SELECT * INTO terms FROM public.access_representation_revision WHERE grant_id=NEW.grant_id AND revision=NEW.revision FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Representation terms are missing' USING ERRCODE='23503'; END IF;
 IF terms.sealed THEN RAISE EXCEPTION 'Sealed terms cannot gain approved permissions' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_access_representation_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE final_version bigint; receipt public.access_representation_event%ROWTYPE; expected_terms bigint;
BEGIN
 IF TG_TABLE_NAME='access_representation' THEN
  SELECT version INTO final_version FROM public.access_representation WHERE id=NEW.id;
  IF final_version=0 THEN RAISE EXCEPTION 'Representation creation must complete sealed terms' USING ERRCODE='23514'; END IF;
  IF NEW.version>0 THEN
   SELECT * INTO receipt FROM public.access_representation_event WHERE grant_id=NEW.id AND version=NEW.version;
   IF NOT FOUND THEN RAISE EXCEPTION 'Representation head requires its exact receipt' USING ERRCODE='23514'; END IF;
   expected_terms:=CASE WHEN receipt.operation='revoke' THEN receipt.retained_terms_revision ELSE receipt.version END;
   IF NEW.terms_revision IS DISTINCT FROM expected_terms OR NEW.state IS DISTINCT FROM (CASE WHEN receipt.operation='revoke' THEN 'revoked' ELSE 'active' END) THEN RAISE EXCEPTION 'Representation transition snapshot is inconsistent' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='access_representation_event' THEN
  SELECT version INTO final_version FROM public.access_representation WHERE id=NEW.grant_id;
  IF final_version<NEW.version THEN RAISE EXCEPTION 'Representation receipt must advance the head' USING ERRCODE='23514'; END IF;
  IF NEW.operation<>'revoke' AND NOT EXISTS(SELECT 1 FROM public.access_representation_revision WHERE grant_id=NEW.grant_id AND revision=NEW.version AND sealed) THEN RAISE EXCEPTION 'Representation receipt must complete its terms' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.access_representation_revision WHERE grant_id=NEW.grant_id AND revision=NEW.revision AND sealed) THEN RAISE EXCEPTION 'Representation terms must be sealed before commit' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS access_representation_entity_initialize ON public.access_subject;
CREATE TRIGGER access_representation_entity_initialize AFTER INSERT ON public.access_subject FOR EACH ROW EXECUTE FUNCTION public.initialize_access_representation_entity();
DROP TRIGGER IF EXISTS access_representation_entity_guard ON public.access_representation_entity;
CREATE TRIGGER access_representation_entity_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_representation_entity FOR EACH ROW EXECUTE FUNCTION public.guard_access_representation_entity();
DROP TRIGGER IF EXISTS access_representation_head_guard ON public.access_representation;
CREATE TRIGGER access_representation_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_representation FOR EACH ROW EXECUTE FUNCTION public.guard_access_representation_head();
DROP TRIGGER IF EXISTS access_representation_event_guard ON public.access_representation_event;
CREATE TRIGGER access_representation_event_guard BEFORE INSERT ON public.access_representation_event FOR EACH ROW EXECUTE FUNCTION public.guard_access_representation_event();
DROP TRIGGER IF EXISTS access_representation_event_immutable ON public.access_representation_event;
CREATE TRIGGER access_representation_event_immutable BEFORE UPDATE OR DELETE ON public.access_representation_event FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();
DROP TRIGGER IF EXISTS access_representation_revision_guard ON public.access_representation_revision;
CREATE TRIGGER access_representation_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_representation_revision FOR EACH ROW EXECUTE FUNCTION public.guard_access_representation_revision();
DROP TRIGGER IF EXISTS access_representation_permission_guard ON public.access_representation_permission;
CREATE TRIGGER access_representation_permission_guard BEFORE INSERT OR UPDATE OR DELETE ON public.access_representation_permission FOR EACH ROW EXECUTE FUNCTION public.guard_access_representation_permission();
DROP TRIGGER IF EXISTS access_representation_head_complete ON public.access_representation;
CREATE CONSTRAINT TRIGGER access_representation_head_complete AFTER INSERT OR UPDATE ON public.access_representation DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_representation_history();
DROP TRIGGER IF EXISTS access_representation_event_complete ON public.access_representation_event;
CREATE CONSTRAINT TRIGGER access_representation_event_complete AFTER INSERT ON public.access_representation_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_representation_history();
DROP TRIGGER IF EXISTS access_representation_revision_complete ON public.access_representation_revision;
CREATE CONSTRAINT TRIGGER access_representation_revision_complete AFTER INSERT OR UPDATE ON public.access_representation_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_access_representation_history();


-- Org policy is a native owner over shared scope/subject admission generations.
CREATE OR REPLACE FUNCTION public.organization_enrollment_lock_admission(p_scope uuid,p_subject uuid)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('org-enrollment-scope:'||p_scope::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('org-enrollment-subject:'||p_subject::text,0));
END $$;

CREATE OR REPLACE FUNCTION public.guard_organization_enrollment_contact()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
 IF TG_OP='DELETE' THEN
  IF NOT EXISTS(SELECT 1 FROM public.access_subject s JOIN public.users u ON u.id=s.auth_user_id WHERE s.id=OLD.subject_id AND u.erased_at IS NOT NULL) THEN RAISE EXCEPTION 'Contact deletion requires recipient erasure' USING ERRCODE='55000'; END IF;
  RETURN OLD;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('org-enrollment-contact:'||NEW.subject_id::text,0));
 IF TG_OP='INSERT' THEN
  SELECT count(*) INTO n FROM(SELECT id FROM public.organization_enrollment_contact WHERE subject_id=NEW.subject_id AND revoked_at IS NULL LIMIT 65) candidates;
  IF n>=64 THEN RAISE EXCEPTION 'Recipient contact budget exceeded' USING ERRCODE='54000'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.access_subject s JOIN public.users u ON u.id=s.auth_user_id WHERE s.id=NEW.subject_id AND u.principal_kind='human' AND u.erased_at IS NULL) THEN RAISE EXCEPTION 'Private contact requires an eligible human principal' USING ERRCODE='23514'; END IF;
  IF NEW.version<>1 OR NEW.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Contact must start active' USING ERRCODE='23514'; END IF;
 ELSE
  IF ROW(NEW.id,NEW.scope_id,NEW.subject_id,NEW.secret_digest,NEW.expires_at,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.scope_id,OLD.subject_id,OLD.secret_digest,OLD.expires_at,OLD.created_at) OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Contact identity is immutable and revocation is terminal' USING ERRCODE='55000'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_organization_enrollment_invitation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE n integer; principal uuid; member public.access_membership%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN
  IF NOT EXISTS(SELECT 1 FROM public.access_subject s JOIN public.users u ON u.id=s.auth_user_id WHERE s.id=OLD.recipient_subject_id AND u.erased_at IS NOT NULL) THEN RAISE EXCEPTION 'Invitation deletion requires recipient erasure' USING ERRCODE='55000'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW.organization_entity_id,NEW.scope_id,NEW.organization_revision,NEW.recipient_subject_id,NEW.contact_id,NEW.invited_by_auth_user_id,NEW.authority_subject_id,NEW.expires_at,NEW.created_at)
   IS DISTINCT FROM ROW(OLD.id,OLD.organization_entity_id,OLD.scope_id,OLD.organization_revision,OLD.recipient_subject_id,OLD.contact_id,OLD.invited_by_auth_user_id,OLD.authority_subject_id,OLD.expires_at,OLD.created_at)
   OR OLD.state<>'pending' OR NEW.state='pending' OR NEW.revision<>OLD.revision+1 OR NEW.authority IS NOT NULL THEN RAISE EXCEPTION 'Invitation resolution is an immutable terminal transition' USING ERRCODE='55000'; END IF;
 ELSE
  IF NEW.state<>'pending' OR NEW.revision<>1 THEN RAISE EXCEPTION 'Invitation starts pending at revision one' USING ERRCODE='23514'; END IF;
  PERFORM public.organization_enrollment_lock_admission(NEW.scope_id,NEW.recipient_subject_id);
  IF NOT EXISTS(SELECT 1 FROM public.access_scope s JOIN public.reference_value r ON r.id=s.unit_ref JOIN public.entity_identity e ON e.id=r.target_entity_id JOIN public.entity_participation p ON p.entity_id=e.id
   WHERE s.id=NEW.scope_id AND e.id=NEW.organization_entity_id AND e.shape='organization' AND e.deleted_at IS NULL AND p.state='active' AND p.revision=NEW.organization_revision) THEN RAISE EXCEPTION 'Invitation requires its exact active Org scope' USING ERRCODE='23514'; END IF;
  SELECT auth_user_id INTO principal FROM public.access_subject WHERE id=NEW.recipient_subject_id;
  IF principal IS NOT NULL THEN
   IF NEW.contact_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.organization_enrollment_contact c WHERE c.id=NEW.contact_id AND c.scope_id=NEW.scope_id AND c.subject_id=NEW.recipient_subject_id AND c.revoked_at IS NULL AND c.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'Private invitation requires recipient contact consent' USING ERRCODE='23514'; END IF;
  ELSIF NEW.contact_id IS NOT NULL THEN RAISE EXCEPTION 'Entity admission does not use private account contact' USING ERRCODE='23514'; END IF;
  IF public.access_subject_is_eligible(NEW.recipient_subject_id,'write') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Recipient is not currently eligible' USING ERRCODE='23514'; END IF;
  IF (NEW.authority->>'principalId')::uuid IS DISTINCT FROM NEW.invited_by_auth_user_id OR NEW.authority->>'sourceDigest' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invitation authority evidence is incomplete' USING ERRCODE='23514'; END IF;
  SELECT count(*) INTO n FROM(SELECT id FROM public.organization_enrollment_invitation WHERE scope_id=NEW.scope_id AND state='pending' LIMIT 1000) candidates;
  IF n>=1000 THEN RAISE EXCEPTION 'Org pending invitation budget exceeded' USING ERRCODE='54000'; END IF;
  SELECT count(*) INTO n FROM(SELECT id FROM public.organization_enrollment_invitation WHERE recipient_subject_id=NEW.recipient_subject_id AND state='pending' LIMIT 1000) candidates;
  IF n>=1000 THEN RAISE EXCEPTION 'Recipient pending invitation budget exceeded' USING ERRCODE='54000'; END IF;
 END IF;
 IF NEW.state='accepted' THEN
  SELECT * INTO member FROM public.access_membership WHERE id=NEW.membership_id;
  IF NOT FOUND OR member.scope_id<>NEW.scope_id OR member.subject_id<>NEW.recipient_subject_id OR member.active_generation IS DISTINCT FROM NEW.generation THEN RAISE EXCEPTION 'Accepted invitation requires its exact active shared admission' USING ERRCODE='23514'; END IF;
  IF NEW.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Expired invitation cannot be accepted' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_organization_enrollment_operation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' AND EXISTS(SELECT 1 FROM public.access_subject s JOIN public.users u ON u.id=s.auth_user_id WHERE s.id=OLD.recipient_subject_id AND u.erased_at IS NOT NULL) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Enrollment operation receipts are immutable outside recipient erasure' USING ERRCODE='55000';
END $$;

CREATE OR REPLACE FUNCTION public.require_organization_enrollment_admission()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE member public.access_membership%ROWTYPE;
BEGIN
 IF NEW.operation<>'admit' THEN RETURN NULL; END IF;
 SELECT * INTO member FROM public.access_membership WHERE id=NEW.membership_id;
 IF EXISTS(SELECT 1 FROM public.access_scope s JOIN public.reference_value r ON r.id=s.unit_ref JOIN public.entity_identity e ON e.id=r.target_entity_id WHERE s.id=member.scope_id AND e.shape='organization') THEN
  IF NOT EXISTS(SELECT 1 FROM public.organization_enrollment_invitation i JOIN public.organization_enrollment_operation o ON o.scope_id=i.scope_id AND o.operation_id=NEW.operation_id
   WHERE i.membership_id=NEW.membership_id AND i.generation=NEW.active_generation AND i.state='accepted' AND i.recipient_subject_id=member.subject_id AND o.invitation_id=i.id AND o.operator_auth_user_id=NEW.operator_auth_user_id AND o.authority_subject_id=member.subject_id) THEN RAISE EXCEPTION 'Org admission requires exact accepted consent and receipt' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS organization_enrollment_contact_guard ON public.organization_enrollment_contact;
CREATE TRIGGER organization_enrollment_contact_guard BEFORE INSERT OR UPDATE OR DELETE ON public.organization_enrollment_contact FOR EACH ROW EXECUTE FUNCTION public.guard_organization_enrollment_contact();
DROP TRIGGER IF EXISTS organization_enrollment_invitation_guard ON public.organization_enrollment_invitation;
CREATE TRIGGER organization_enrollment_invitation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.organization_enrollment_invitation FOR EACH ROW EXECUTE FUNCTION public.guard_organization_enrollment_invitation();
DROP TRIGGER IF EXISTS organization_enrollment_operation_guard ON public.organization_enrollment_operation;
CREATE TRIGGER organization_enrollment_operation_guard BEFORE UPDATE OR DELETE ON public.organization_enrollment_operation FOR EACH ROW EXECUTE FUNCTION public.guard_organization_enrollment_operation();
DROP TRIGGER IF EXISTS organization_enrollment_admission_required ON public.access_membership_event;
CREATE CONSTRAINT TRIGGER organization_enrollment_admission_required AFTER INSERT ON public.access_membership_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.require_organization_enrollment_admission();

CREATE OR REPLACE FUNCTION public.schedule_organization_enrollment_review()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.state='pending' THEN
  INSERT INTO public.organization_enrollment_review(invitation_id,due_at) VALUES(NEW.id,clock_timestamp()+interval '5 minutes');
 ELSE DELETE FROM public.organization_enrollment_review WHERE invitation_id=NEW.id;
 END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS organization_enrollment_review_schedule ON public.organization_enrollment_invitation;
CREATE TRIGGER organization_enrollment_review_schedule AFTER INSERT OR UPDATE ON public.organization_enrollment_invitation FOR EACH ROW EXECUTE FUNCTION public.schedule_organization_enrollment_review();
