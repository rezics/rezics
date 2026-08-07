import { getTableName, type SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import {
	PlatformCapabilityValues,
	RealmAccessSubjectRelationValues,
	UnitPermissionValues,
} from "@rezics/access";
import { describe, expect, it } from "vitest";

import {
	auditEvent,
	apiAccountQuotaBinding,
	apiQuotaPolicy,
	book,
	apiTokenQuotaBinding,
	CanonicalPgroongaIndexes,
	unitContentLicense,
	contentStructure,
	contentStructureNode,
	unitLocalizationContentMetric,
	unitProgress,
	creditAttribution,
	unitAssociationProposal,
	subjectAssociation,
	platformUnitReport,
	realmUnitReport,
	unit,
	unitAlias,
	unitDock,
	conversationParticipantStat,
	realmTagVoteStat,
	realmTagContext,
	realmTagVote,
	realm,
	realmScoreContext,
	realmRuleAcceptance,
	realmRuleRevision,
	recommendationMetricDaily,
	recommendationSignalKind,
	recommendationUnitStat,
	governancePostBinding,
	governanceReasonCode,
	GovernanceNoteRoleValues,
	GovernanceReasonCodeValues,
	CommunityOwnedUnitKindValues,
	CreditAttributionRoleValues,
	isCreditAttributionRoleForUnitKind,
	isCreditAttributionUnitKind,
	DockKindValues,
	DockKindsByUnitKind,
	moderationAction,
	moderationCase,
	ModerationActionKindValues,
	NonRealmUnitKindValues,
	PostKindValues,
	RealmScoreContextPostKindValues,
	SubjectAssociationRoleValues,
	profileRealmTagSubscription,
	realmUnitStatus,
	realmUnitStatusEvent,
	realmUnitPublicationEvent,
	realmUnitPublicationState,
	realmUnit,
	RealmUnitMutationCommandValues,
	RealmRuleAcknowledgementModeValues,
	scoreStat,
	score,
	post,
	postScore,
	platformCapabilityGrant,
	profilePreference,
	unitAccessGrant,
	realmAccessSubjectRelation,
	unitAccessInvitation,
	unitAccessRestriction,
	unitFollow,
	unitFollowNotificationPreference,
	unitExternalLink,
	unitExternalLinkVote,
	unitExternalLinkVoteStat,
	unitReferenceCurationHead,
	unitOwnership,
	unitOwnershipClaim,
	unitOwnershipClaimResolution,
	unitAliasVoteStat,
	unitLocalization,
	unitReactionStat,
	unitTagVoteStat,
	unitEffectiveTag,
	unitEffectiveTagVote,
	unitStructure,
	unitStructureApplication,
	unitStructureApplicationVote,
	unitStructureEdge,
	unitStructureMember,
	unitStructureVote,
	UnitStructureKindValues,
	sharedSearchQuery,
	unitSearchDocument,
	unitSlugAddress,
	unitRevisionSlot,
	unitStatusEvent,
	unitVariant,
	imageAssetPresentation,
	imageObject,
	media,
	ImageAssetPresentationFitValues,
	ImageAssetPresentationRoleValues,
	UnitRevisionSlotRoleValues,
	UnitStatusActorKindValues,
	WorkReleaseStatusValues,
	UnitKindValues,
	UnitOwnershipClaimResolutionValues,
	VariantCapableUnitKindValues,
} from "./schema";

const dialect = new PgDialect();

describe("database schema contracts", () => {
	it("owns every canonical PGroonga index in the Drizzle Unit schema", () => {
		const indexes = [unitLocalization, unitAlias, unitSearchDocument]
			.flatMap((table) => getTableConfig(table).indexes)
			.filter((index) => index.config.method === "pgroonga");

		expect(indexes.map((index) => index.config.name)).toEqual(CanonicalPgroongaIndexes);
		for (const index of indexes.slice(0, 2)) {
			const expression = index.config.columns[0];
			expect(expression && dialect.sqlToQuery(expression as SQL).sql).toContain(
				"public.pgroonga_text_full_text_search_ops_v2",
			);
			expect(index.config.with).toEqual({
				lexicon_flags_mapping: expect.stringMatching(/^'.*"LARGE".*'$/),
				index_flags_mapping: expect.stringMatching(/^'.*"LARGE".*'$/),
			});
		}
		expect(indexes[2]?.config.where).toBeUndefined();
		expect(indexes[3]?.config.with).toEqual({
			lexicon_flags_mapping: expect.stringMatching(/^'.*"LARGE".*'$/),
			index_flags_mapping: expect.stringMatching(/^'.*"LARGE".*'$/),
		});
	});

	it("keeps Book and Media release statuses required and database constrained", () => {
		expect(WorkReleaseStatusValues).toEqual(["ongoing", "hiatus", "completed", "cancelled"]);
		for (const [table, constraintName] of [
			[book, "book_release_status_check"],
			[media, "media_release_status_check"],
		] as const) {
			const config = getTableConfig(table);
			const releaseStatus = config.columns.find((column) => column.name === "release_status");
			expect(releaseStatus?.notNull).toBe(true);
			expect(config.checks.map((constraint) => constraint.name)).toContain(constraintName);
		}
	});

	it("enforces matching subject kinds for account and token quota assignments", () => {
		const policy = getTableConfig(apiQuotaPolicy);
		const accountBinding = getTableConfig(apiAccountQuotaBinding);
		const tokenBinding = getTableConfig(apiTokenQuotaBinding);

		expect(policy.columns.map((column) => column.name)).toContain("subject_kind");
		expect(policy.indexes.map((index) => index.config.name)).toContain(
			"api_quota_policy_id_subject_kind_key",
		);
		expect(accountBinding.foreignKeys.map((key) => key.getName())).toContain(
			"api_account_quota_binding_policy_kind_fkey",
		);
		expect(tokenBinding.foreignKeys.map((key) => key.getName())).toContain(
			"api_token_quota_binding_policy_kind_fkey",
		);
		expect(tokenBinding.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"api_token_quota_binding_policy_kind_check",
				"api_token_quota_binding_validity_check",
				"api_token_quota_binding_reason_check",
			]),
		);
	});

	it("uses PostgreSQL uuidv7 for generated identifiers", () => {
		expect(dialect.sqlToQuery(unit.id.default as SQL).sql).toBe("uuidv7()");
		expect(dialect.sqlToQuery(sharedSearchQuery.id.default as SQL).sql).toBe("uuidv7()");
	});

	it("stores provider-neutral ImageAsset presentations with bounded crop contracts", () => {
		expect(imageAssetPresentation.role.enumValues).toEqual(ImageAssetPresentationRoleValues);
		expect(imageAssetPresentation.fit.enumValues).toEqual(ImageAssetPresentationFitValues);
		const presentation = getTableConfig(imageAssetPresentation);
		expect(presentation.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"asset_id",
			"role",
		]);
		expect(presentation.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"image_asset_presentation_shape_check",
				"image_asset_presentation_crop_bounds_check",
				"image_asset_presentation_revision_check",
			]),
		);
		const object = getTableConfig(imageObject);
		expect(object.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining(["width", "height"]),
		);
	});

	it("keeps Follow generic across Units while preventing self-follow", () => {
		const follow = getTableConfig(unitFollow);

		expect(follow.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"follower_profile_id",
			"unit_id",
		]);
		expect(follow.foreignKeys.map((key) => key.getName())).toEqual(
			expect.arrayContaining([
				"unit_follow_follower_profile_id_profile_id_fk",
				"unit_follow_unit_id_unit_id_fk",
			]),
		);
		expect(follow.checks.map((constraint) => constraint.name)).toContain(
			"unit_follow_not_self_check",
		);
	});

	it("stores immutable shared Search queries behind a UUIDv7 primary key", () => {
		const table = getTableConfig(sharedSearchQuery);
		expect(table.name).toBe("shared_search_query");
		expect(table.checks.map((constraint) => constraint.name)).toContain(
			"shared_search_query_document_check",
		);
		expect(table.foreignKeys.map((key) => key.getName())).toContain(
			"shared_search_query_created_by_profile_id_profile_id_fk",
		);
	});

	it("keeps immutable Unit content License facts with one active grant per Unit", () => {
		const grant = getTableConfig(unitContentLicense);
		expect(getTableName(unitContentLicense)).toBe("unit_content_license");
		expect(grant.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				"id",
				"unit_id",
				"granted_by_profile_id",
				"reference_license_slug",
				"granted_at",
				"status",
			]),
		);
		expect(grant.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"unit_content_license_active_unit_key",
				"unit_content_license_unit_granted_at_idx",
			]),
		);
		expect(
			grant.indexes.find(
				(index) => index.config.name === "unit_content_license_active_unit_key",
			)?.config.where,
		).toBeDefined();
		expect(unitContentLicense.status.enumValues).toEqual(["active", "invalidated"]);
		expect(unitContentLicense.status.hasDefault).toBe(true);
		expect(
			grant.foreignKeys.find(
				(key) => key.getName() === "unit_content_license_unit_id_unit_id_fk",
			)?.onDelete,
		).toBe("restrict");
		expect(grant.columns.map((column) => column.name)).not.toContain("revoked_at");
		expect(grant.checks.map((constraint) => constraint.name)).toContain(
			"unit_content_license_reference_slug_check",
		);
	});

	it("enforces Unit access subject invariants at the database boundary", () => {
		const grant = getTableConfig(unitAccessGrant);
		const ownership = getTableConfig(unitOwnership);
		const restriction = getTableConfig(unitAccessRestriction);

		expect(grant.checks.map((constraint) => constraint.name)).toContain(
			"unit_access_grant_subject_shape_check",
		);
		expect(grant.checks.map((constraint) => constraint.name)).toContain(
			"unit_access_grant_permission_delegable_check",
		);
		expect(restriction.checks.map((constraint) => constraint.name)).toContain(
			"unit_access_restriction_subject_shape_check",
		);
		expect(restriction.checks.map((constraint) => constraint.name)).toContain(
			"unit_access_restriction_permission_delegable_check",
		);
		expect(restriction.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"unit_access_restriction_active_profile_scope_key",
				"unit_access_restriction_active_realm_scope_key",
			]),
		);
		expect(unitAccessRestriction.subjectKind.enumValues).toEqual(["profile", "realm"]);
		expect(realmAccessSubjectRelation.enumValues).toEqual(RealmAccessSubjectRelationValues);
		expect(grant.columns.map((column) => column.name)).toContain("realm_relation");
		expect(restriction.columns.map((column) => column.name)).toContain("realm_relation");
		expect(unitAccessGrant.subjectKind.enumValues).toEqual([
			"profile",
			"realm",
			"authenticated",
		]);
		expect(grant.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"unit_access_grant_active_profile_scope_key",
				"unit_access_grant_active_realm_scope_key",
				"unit_access_grant_active_authenticated_scope_key",
				"unit_access_grant_unit_transfer_candidate_idx",
			]),
		);
		expect(ownership.indexes.map((index) => index.config.name)).toContain(
			"unit_ownership_active_unit_key",
		);
	});

	it("keeps Unit ownership claims as an independent historical workflow", () => {
		const claim = getTableConfig(unitOwnershipClaim);
		expect(getTableName(unitOwnershipClaim)).toBe("unit_ownership_claim");
		expect(unitOwnershipClaimResolution.enumValues).toEqual(UnitOwnershipClaimResolutionValues);
		expect(claim.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"unit_ownership_claim_pending_profile_unit_key",
				"unit_ownership_claim_resulting_ownership_key",
				"unit_ownership_claim_pending_created_at_idx",
			]),
		);
		expect(claim.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"unit_ownership_claim_details_not_blank",
				"unit_ownership_claim_resolution_shape_check",
				"unit_ownership_claim_distinct_ownership_check",
			]),
		);
	});

	it("keeps pending Unit access invitations out of effective access bindings", () => {
		const invitation = getTableConfig(unitAccessInvitation);
		expect(getTableName(unitAccessInvitation)).toBe("unit_access_invitation");
		expect(invitation.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"unit_access_invitation_permissions_check",
				"unit_access_invitation_resolution_shape_check",
			]),
		);
		expect(invitation.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"unit_access_invitation_unit_unresolved_idx",
				"unit_access_invitation_profile_unresolved_idx",
				"unit_access_invitation_unit_transfer_candidate_idx",
			]),
		);
		expect(UnitPermissionValues).toContain("unit.association.manage");
		expect(UnitPermissionValues).toContain("unit.tag-curation.manage");
		expect(UnitPermissionValues).toContain("unit.reference-curation.manage");
		expect(UnitPermissionValues).toEqual(
			expect.arrayContaining([
				"unit.status.update",
				"realm.units.create",
				"realm.post.replies.create",
				"realm.rules.update",
				"realm.tag-voting.update",
				"realm.tag-contexts.manage",
			]),
		);
	});

	it("stores the rule acknowledgement policy on each immutable Realm revision", () => {
		expect(realmRuleRevision.acknowledgementMode.enumValues).toEqual(
			RealmRuleAcknowledgementModeValues,
		);
		const revision = getTableConfig(realmRuleRevision);
		expect(revision.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining(["require_on_join", "require_on_post"]),
		);
		expect(revision.columns.map((column) => column.name)).not.toContain("require_on_update");

		const acceptance = getTableConfig(realmRuleAcceptance);
		expect(acceptance.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"revision_id",
			"profile_id",
		]);
	});

	it("records typed generic Unit status provenance", () => {
		expect(unitStatusEvent.actorKind.enumValues).toEqual(UnitStatusActorKindValues);
		const event = getTableConfig(unitStatusEvent);
		expect(event.foreignKeys.map((key) => key.getName())).toContain(
			"unit_status_event_revision_unit_fkey",
		);
		expect(event.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"unit_status_event_transition_check",
				"unit_status_event_actor_shape_check",
			]),
		);
		expect(event.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"unit_status_event_unit_created_at_idx",
				"unit_status_event_publication_idx",
				"unit_status_event_actor_created_at_idx",
			]),
		);
	});

	it("keys Unit History localizations by language within each revision manifest", () => {
		expect(unitRevisionSlot.role.enumValues).toEqual(UnitRevisionSlotRoleValues);
		const slot = getTableConfig(unitRevisionSlot);
		expect(slot.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"revision_id",
			"role",
			"slot_key",
		]);
		expect(slot.checks.map((constraint) => constraint.name)).toContain(
			"unit_revision_slot_key_shape_check",
		);
	});

	it("keeps localized content metrics as a rebuildable projection", () => {
		const metric = getTableConfig(unitLocalizationContentMetric);
		expect(getTableName(unitLocalizationContentMetric)).toBe(
			"unit_localization_content_metric",
		);
		expect(metric.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"unit_id",
			"language",
		]);
		expect(metric.foreignKeys.map((key) => key.getName())).toContain(
			"unit_localization_content_metric_localization_fkey",
		);
		expect(metric.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"unit_localization_content_metric_word_count_check",
				"unit_localization_content_metric_character_count_check",
				"unit_localization_content_metric_algorithm_version_check",
				"unit_localization_content_metric_source_sha256_check",
			]),
		);
	});

	it("stores Entity association consent in Unit access permissions", () => {
		expect(UnitPermissionValues).toEqual(
			expect.arrayContaining([
				"entity.association.credit.request",
				"entity.association.credit.direct",
				"entity.association.subject.request",
				"entity.association.subject.direct",
			]),
		);
		expect(getTableName(subjectAssociation)).toBe("subject_association");
		expect(getTableConfig(subjectAssociation).columns.map((column) => column.name)).toEqual(
			expect.arrayContaining(["unit_id", "entity_id", "role"]),
		);
		expect(
			getTableConfig(subjectAssociation).columns.map((column) => column.name),
		).not.toContain("subject_entity_id");
		const proposal = getTableConfig(unitAssociationProposal);
		expect(getTableName(unitAssociationProposal)).toBe("unit_association_proposal");
		expect(proposal.columns.map((column) => column.name)).toContain("target_unit_id");
		expect(proposal.columns.map((column) => column.name)).not.toContain("target_entity_id");
		expect(proposal.foreignKeys.map((key) => key.getName())).toContain(
			"unit_association_proposal_target_unit_id_unit_id_fk",
		);
		expect(proposal.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"unit_association_proposal_not_self_check",
				"unit_association_proposal_role_check",
				"unit_association_proposal_resolution_shape_check",
			]),
		);
		expect(CreditAttributionRoleValues).toContain("author");
		expect(CreditAttributionRoleValues).toContain("translator");
		expect(isCreditAttributionRoleForUnitKind("book", "author")).toBe(true);
		expect(isCreditAttributionRoleForUnitKind("media", "author")).toBe(false);
		expect(isCreditAttributionRoleForUnitKind("entity", "publisher")).toBe(true);
		expect(isCreditAttributionUnitKind("entity")).toBe(true);
		expect(isCreditAttributionUnitKind("profile")).toBe(false);
		expect(SubjectAssociationRoleValues).toContain("primary_character");
		expect(SubjectAssociationRoleValues).toContain("source_work");
		expect(getTableConfig(subjectAssociation).checks.map(({ name }) => name)).toContain(
			"subject_association_role_check",
		);
		expect(proposal.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"unit_association_proposal_source_unresolved_idx",
				"unit_association_proposal_target_unresolved_idx",
			]),
		);
	});

	it("stores public credit relationships as Unit-to-Unit attribution", () => {
		const attribution = getTableConfig(creditAttribution);
		expect(attribution.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining(["source_unit_id", "credited_unit_id", "role", "position"]),
		);
		expect(attribution.columns.map((column) => column.name)).not.toEqual(
			expect.arrayContaining(["unit_id", "entity_id", "kind"]),
		);
		expect(attribution.foreignKeys.map((key) => key.getName())).toEqual(
			expect.arrayContaining([
				"credit_attribution_source_unit_id_unit_id_fk",
				"credit_attribution_credited_unit_id_unit_id_fk",
			]),
		);
		expect(attribution.uniqueConstraints.map((constraint) => constraint.name)).toContain(
			"credit_attribution_source_credited_role_key",
		);
		expect(attribution.checks.map(({ name }) => name)).toContain(
			"credit_attribution_role_check",
		);
	});

	it("stores immutable, curated Alias voting candidates", () => {
		const alias = getTableConfig(unitAlias);
		expect(alias.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining(["created_by_profile_id", "pinned", "position"]),
		);
		expect(alias.columns.map((column) => column.name)).not.toContain("deleted_at");
		expect(alias.uniqueConstraints.map((constraint) => constraint.name)).toContain(
			"unit_alias_unit_language_normalized_key",
		);
		expect(alias.checks.map(({ name }) => name)).toContain("unit_alias_pinned_position_check");
	});

	it("stores immutable, curated external-link voting candidates", () => {
		const link = getTableConfig(unitExternalLink);
		expect(link.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				"unit_id",
				"source_entity_id",
				"url",
				"normalized_url",
				"normalized_url_hash",
				"created_by_profile_id",
				"pinned",
				"position",
			]),
		);
		expect(link.columns.map((column) => column.name)).not.toContain("role");
		expect(link.columns.map((column) => column.name)).not.toContain("label");
		expect(link.columns.map((column) => column.name)).not.toContain("deleted_at");
		expect(link.checks.map(({ name }) => name)).not.toContain("unit_link_role_not_blank");
		expect(link.checks.map(({ name }) => name)).toContain(
			"unit_external_link_pinned_position_check",
		);
		expect(getTableConfig(unitExternalLinkVote).primaryKeys[0]?.columns).toHaveLength(2);
		expect(getTableConfig(unitReferenceCurationHead).primaryKeys[0]?.columns).toHaveLength(2);
	});

	it("centralizes governance contracts and Post-identity note bindings", () => {
		expect(realmUnitStatus.enumValues).toEqual(["pending", "visible", "hidden", "removed"]);
		expect(realmUnitPublicationState.enumValues).toEqual(["active", "withdrawn"]);
		expect(RealmUnitMutationCommandValues).toEqual([
			"approve",
			"hide",
			"remove",
			"restore",
			"lock_post_targeting",
			"unlock_post_targeting",
		]);
		expect(PostKindValues).toContain("governance_note");
		expect(ModerationActionKindValues).toEqual(
			expect.arrayContaining(["hide", "note", "warning", "revoke_enforcement"]),
		);
		expect(GovernanceReasonCodeValues).toEqual(
			expect.arrayContaining(["content_policy", "realm_rules", "administrative"]),
		);
		expect(GovernanceNoteRoleValues).toEqual(["evidence", "internal_note", "public_notice"]);

		const binding = getTableConfig(governancePostBinding);
		expect(binding.columns.map((column) => column.name)).not.toContain("revision_id");
		expect(binding.uniqueConstraints.map((constraint) => constraint.name)).not.toContain(
			"governance_post_binding_subject_role_key",
		);
		expect(binding.indexes.map((index) => index.config.name)).toContain(
			"governance_post_binding_subject_role_idx",
		);

		const event = getTableConfig(realmUnitStatusEvent);
		expect(event.foreignKeys.map((key) => key.getName())).not.toContain(
			"realm_unit_status_event_realm_unit_fkey",
		);
		expect(event.uniqueConstraints.map((constraint) => constraint.name)).toContain(
			"realm_unit_status_event_action_key",
		);
		expect(event.columns.map((column) => column.name)).not.toContain("annotation_document");

		const publication = getTableConfig(realmUnit);
		expect(publication.columns.map((column) => column.name)).toContain("publication_state");
		expect(publication.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"realm_unit_moderation_queue_idx",
				"realm_unit_unit_publication_status_updated_idx",
			]),
		);

		const publicationEvent = getTableConfig(realmUnitPublicationEvent);
		expect(publicationEvent.foreignKeys.map((key) => key.getName())).toContain(
			"realm_unit_publication_event_relation_fkey",
		);
		expect(publicationEvent.checks.map((constraint) => constraint.name)).toContain(
			"realm_unit_publication_event_transition_check",
		);

		const action = getTableConfig(moderationAction);
		expect(governanceReasonCode.enumValues).toEqual(GovernanceReasonCodeValues);
		expect(moderationAction.reasonCode.enumValues).toEqual(GovernanceReasonCodeValues);
		expect(unitAccessRestriction.reasonCode.enumValues).toEqual(GovernanceReasonCodeValues);
		expect(action.indexes.map((index) => index.config.name)).toContain(
			"moderation_action_actor_case_idempotency_key",
		);
		expect(action.indexes.map((index) => index.config.name)).toContain(
			"moderation_action_content_license_created_at_idx",
		);
		expect(action.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				"content_license_id",
				"previous_content_license_status",
				"resulting_content_license_status",
			]),
		);
		expect(action.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"moderation_action_state_outcome_check",
				"moderation_action_post_targeting_lock_outcome_check",
				"moderation_action_single_outcome_check",
				"moderation_action_content_license_transition_check",
				"moderation_action_request_fingerprint_check",
			]),
		);
		const realmReportConfig = getTableConfig(realmUnitReport);
		expect(realmReportConfig.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				"case_id",
				"reporter_profile_id",
				"realm_id",
				"unit_id",
				"rule_revision_id",
				"rule_id",
				"details",
				"reported_revision_id",
			]),
		);
		expect(realmReportConfig.uniqueConstraints.map((constraint) => constraint.name)).toContain(
			"realm_unit_report_case_reporter_key",
		);
		expect(realmReportConfig.foreignKeys.map((key) => key.getName())).toEqual(
			expect.arrayContaining([
				"realm_unit_report_revision_unit_fkey",
				"realm_unit_report_realm_unit_fkey",
				"realm_unit_report_rule_revision_realm_fkey",
				"realm_unit_report_rule_revision_fkey",
			]),
		);
		const platformReportConfig = getTableConfig(platformUnitReport);
		expect(platformReportConfig.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				"case_id",
				"reporter_profile_id",
				"unit_id",
				"rule_source_realm_id",
				"rule_revision_id",
				"rule_id",
				"details",
				"reported_revision_id",
			]),
		);
		expect(
			platformReportConfig.uniqueConstraints.map((constraint) => constraint.name),
		).toContain("platform_unit_report_case_reporter_key");
		expect(platformReportConfig.foreignKeys.map((key) => key.getName())).toEqual(
			expect.arrayContaining([
				"platform_unit_report_revision_unit_fkey",
				"platform_unit_report_rule_revision_realm_fkey",
				"platform_unit_report_rule_revision_fkey",
			]),
		);
		expect(platformReportConfig.checks.map((constraint) => constraint.name)).toContain(
			"platform_unit_report_rule_source_check",
		);
		expect(getTableConfig(moderationCase).columns.map((column) => column.name)).not.toEqual(
			expect.arrayContaining(["reason", "safe_summary"]),
		);
		expect(action.columns.map((column) => column.name)).not.toEqual(
			expect.arrayContaining(["reason", "public_message"]),
		);
		expect(getTableConfig(auditEvent).columns.map((column) => column.name)).not.toContain(
			"reason",
		);
	});

	it("requires Excerpt Posts to identify their source Unit", () => {
		expect(PostKindValues).toContain("excerpt");
		expect(getTableConfig(post).checks.map(({ name }) => name)).toContain(
			"post_excerpt_subject_check",
		);
	});

	it("models Realm-scoped Score identity and ordered Post display", () => {
		const scoreConfig = getTableConfig(score);
		expect(scoreConfig.primaryKeys).toHaveLength(0);
		expect(score.id.primary).toBe(true);
		expect(scoreConfig.uniqueConstraints.map((constraint) => constraint.name)).toContain(
			"score_profile_unit_realm_key",
		);
		expect(score.visibility.enumValues).toEqual(["public", "unlisted", "private"]);
		expect(score.visibility.hasDefault).toBe(true);

		const display = getTableConfig(postScore);
		expect(display.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"post_id",
			"score_id",
		]);
		expect(display.uniqueConstraints.map((constraint) => constraint.name)).toContain(
			"post_score_post_position_key",
		);
		expect(display.checks).toHaveLength(0);

		expect(getTableConfig(realmScoreContext).foreignKeys.map((key) => key.getName())).toContain(
			"realm_score_context_post_realm_fkey",
		);
		expect(RealmScoreContextPostKindValues).toEqual(["post", "wiki"]);
		expect("createdByProfileId" in realmScoreContext).toBe(false);
	});

	it("stores a Profile default Score Realm with referential integrity", () => {
		const preference = getTableConfig(profilePreference);
		expect(preference.foreignKeys.map((key) => key.getName())).toContain(
			"profile_preference_default_score_realm_id_realm_id_fk",
		);
		expect(preference.indexes.map((index) => index.config.name)).toContain(
			"profile_preference_default_score_realm_idx",
		);
		expect(preference.checks.map((constraint) => constraint.name)).toContain(
			"profile_preference_content_ratings_check",
		);
		expect(profilePreference.scoreVisibility.enumValues).toEqual([
			"public",
			"unlisted",
			"private",
		]);
		expect(profilePreference.progressVisibility.enumValues).toEqual([
			"public",
			"unlisted",
			"private",
		]);
		expect(profilePreference.scoreVisibility.default).toBe("public");
		expect(profilePreference.progressVisibility.default).toBe("public");
		expect(score.visibility.default).toBe("public");
		expect(unitProgress.visibility.default).toBe("public");
		expect(unitProgress.visibility.enumValues).toEqual(["public", "unlisted", "private"]);
	});

	it("separates optional Unit slug addresses from ID-addressed Units", () => {
		const coreUnit = getTableConfig(unit);
		const address = getTableConfig(unitSlugAddress);
		expect(unit.kind.getSQLType()).toBe("text");
		expect(coreUnit.columns.map((column) => column.name)).not.toEqual(
			expect.arrayContaining(["slug", "slug_scope_id"]),
		);
		expect(address.uniqueConstraints.map((constraint) => constraint.name)).toContain(
			"unit_slug_address_scope_slug_key",
		);
		expect(address.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"unit_slug_address_target_canonical_key",
				"unit_slug_address_target_unit_idx",
			]),
		);
		expect(address.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"unit_slug_address_kind_check",
				"unit_slug_address_label_check",
				"unit_slug_address_scope_not_target_check",
			]),
		);
		expect(address.foreignKeys.map((key) => key.getName())).toEqual(
			expect.arrayContaining([
				"unit_slug_address_scope_unit_id_unit_id_fk",
				"unit_slug_address_target_unit_id_unit_id_fk",
			]),
		);
	});

	it("enforces same-kind star-shaped Main-Variant edges", () => {
		const coreUnit = getTableConfig(unit);
		const variant = getTableConfig(unitVariant);
		expect(coreUnit.uniqueConstraints.map((constraint) => constraint.name)).toContain(
			"unit_id_kind_key",
		);
		expect(variant.columns.map((column) => column.name)).toEqual([
			"variant_unit_id",
			"main_unit_id",
			"unit_kind",
			"created_at",
			"updated_at",
		]);
		expect(variant.foreignKeys.map((key) => key.getName())).toEqual(
			expect.arrayContaining([
				"unit_variant_variant_kind_fkey",
				"unit_variant_main_kind_fkey",
			]),
		);
		expect(variant.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining(["unit_variant_kind_check", "unit_variant_not_self_check"]),
		);
		expect(variant.indexes.map((index) => index.config.name)).toContain(
			"unit_variant_main_created_at_idx",
		);
		expect(VariantCapableUnitKindValues).toEqual(["book", "software", "media"]);
	});

	it("keeps structural, Redirect, and platform capability meanings explicit", () => {
		expect(UnitKindValues).toContain("slug_namespace");
		expect(UnitKindValues).not.toContain("redirect");
		expect(NonRealmUnitKindValues).toEqual(UnitKindValues.filter((kind) => kind !== "realm"));
		expect(CommunityOwnedUnitKindValues).toEqual([
			"book",
			"software",
			"media",
			"series",
			"tag",
			"structure",
		]);
		expect(PlatformCapabilityValues).toEqual(
			expect.arrayContaining([
				"unit.slug.manage",
				"unit.slug.namespace.manage",
				"unit.slug.redirect.release",
				"entity.associations.override",
				"unit.governance.read",
				"unit.ownership.override",
				"unit.content_license.manage",
				"unit.delete",
				"unit.restore",
				"platform.development_preview.access",
				"platform.api_quota_policy.read",
				"platform.api_quota_policy.update",
				"platform.user.api_quota.read",
				"platform.user.api_quota.update",
				"platform.user.api_token.api_quota.read",
				"platform.user.api_token.api_quota.update",
			]),
		);
		expect(PlatformCapabilityValues).not.toContain("unit.ownership.transfer");
		expect(
			getTableConfig(platformCapabilityGrant).checks.map((constraint) => constraint.name),
		).toContain("platform_capability_grant_current_capability_check");
		expect(unitSlugAddress.kind.getSQLType()).toBe("text");
	});

	it("models immutable generic Unit structures and rebuildable effective Tags separately", () => {
		expect(UnitStructureKindValues).toEqual(["tag.hierarchy_path"]);
		expect(getTableConfig(unitStructure).name).toBe("unit_structure");
		expect(
			getTableConfig(unitStructure).uniqueConstraints.map((constraint) => constraint.name),
		).toContain("unit_structure_definition_key");
		expect(getTableConfig(unitStructureMember).name).toBe("unit_structure_member");
		expect(getTableConfig(unitStructureEdge).name).toBe("unit_structure_edge");
		expect(getTableConfig(unitStructureVote).name).toBe("unit_structure_vote");
		expect(getTableConfig(unitStructureApplication).name).toBe("unit_structure_application");
		expect(getTableConfig(unitStructureApplicationVote).name).toBe(
			"unit_structure_application_vote",
		);
		expect(getTableConfig(unitEffectiveTag).name).toBe("unit_effective_tag");
		expect(getTableConfig(unitEffectiveTagVote).name).toBe("unit_effective_tag_vote");
	});

	it("keeps Dock kinds closed and gives each Dock a stable identity", () => {
		expect(DockKindValues).toEqual(["main", "wiki"]);
		expect(DockKindsByUnitKind).toEqual({
			book: ["main"],
			software: ["main"],
			media: ["main"],
			zone: ["main"],
			realm: ["main", "wiki"],
		});
		expect(unitDock.id.primary).toBe(true);
		expect(contentStructure.kind.getSQLType()).toBe("text");
		expect(contentStructureNode.targetKind.getSQLType()).toBe("text");
		expect(
			getTableConfig(contentStructureNode).foreignKeys.map((key) => key.reference().name),
		).toContain("content_structure_node_parent_structure_fkey");
	});

	it("models global and Realm aggregate meanings separately", () => {
		const globalTag = getTableConfig(unitTagVoteStat);
		const realmTag = getTableConfig(realmTagVoteStat);
		expect(globalTag.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"unit_id",
			"tag_id",
		]);
		expect(realmTag.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"realm_id",
			"unit_id",
			"tag_id",
		]);
		expect(realmTag.foreignKeys.map((key) => key.getName())).toEqual(
			expect.arrayContaining([
				"realm_tag_vote_stat_realm_fkey",
				"realm_tag_vote_stat_unit_fkey",
				"realm_tag_vote_stat_tag_fkey",
				"realm_tag_vote_stat_context_fkey",
			]),
		);
		expect(getTableConfig(realmTagVote).foreignKeys.map((key) => key.getName())).toContain(
			"realm_tag_vote_context_fkey",
		);
		const context = getTableConfig(realmTagContext);
		expect(context.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"realm_id",
			"tag_id",
		]);
		expect(
			context.indexes.find((index) => index.config.name === "realm_tag_context_post_unique")
				?.config.unique,
		).toBe(true);
		expect(context.indexes.map((index) => index.config.name)).toContain(
			"realm_tag_context_tag_realm_idx",
		);
	});

	it("stores enabled Realm Pages as one constrained ordered value", () => {
		const config = getTableConfig(realm);
		expect(realm.realmTagVotingEnabled.notNull).toBe(true);
		expect(realm.realmTagVotingEnabled.hasDefault).toBe(true);
		expect(realm.enabledPages.enumValues).toEqual(["main", "tags", "wiki"]);
		expect(config.checks.map((check) => check.name)).toEqual(
			expect.arrayContaining([
				"realm_enabled_pages_cardinality_check",
				"realm_enabled_pages_main_check",
				"realm_enabled_pages_no_null_check",
				"realm_enabled_pages_tags_unique_check",
				"realm_enabled_pages_wiki_unique_check",
			]),
		);
	});

	it("keeps ordered Realm Tag sources separate from following and membership", () => {
		const subscription = getTableConfig(profileRealmTagSubscription);
		expect(subscription.name).toBe("profile_realm_tag_subscription");
		expect(subscription.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"profile_id",
			"realm_id",
		]);
		expect(subscription.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"profile_realm_tag_subscription_profile_position_idx",
				"profile_realm_tag_subscription_realm_idx",
			]),
		);
	});

	it("scopes in-app notification delivery to an existing follow relation", () => {
		const preference = getTableConfig(unitFollowNotificationPreference);
		expect(preference.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"follower_profile_id",
			"unit_id",
		]);
		expect(preference.foreignKeys.map((key) => key.getName())).toContain(
			"unit_follow_notification_preference_follow_fkey",
		);
		expect(preference.indexes.map((index) => index.config.name)).toContain(
			"unit_follow_notification_preference_enabled_unit_idx",
		);
	});

	it("keeps aggregate counters and read-model identities constrained", () => {
		for (const table of [
			scoreStat,
			unitAliasVoteStat,
			unitExternalLinkVoteStat,
			unitTagVoteStat,
			realmTagVoteStat,
			unitReactionStat,
			conversationParticipantStat,
		]) {
			expect(getTableConfig(table).checks.length).toBeGreaterThan(0);
		}
		expect(scoreStat.totalCount.getSQLType()).toBe("bigint");
		expect(unitAliasVoteStat.voteCount.getSQLType()).toBe("bigint");
		expect(unitExternalLinkVoteStat.voteCount.getSQLType()).toBe("bigint");
		expect(recommendationUnitStat.impressions.getSQLType()).toBe("bigint");
		expect(recommendationMetricDaily.impressions.getSQLType()).toBe("bigint");
		expect(recommendationSignalKind.enumValues).toEqual(
			expect.arrayContaining(["score_high", "score_medium", "score_low"]),
		);
	});
});
