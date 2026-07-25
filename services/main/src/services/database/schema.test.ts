import { getTableName, type SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	auditEvent,
	catalogUnitContentLicense,
	contentStructure,
	contentStructureNode,
	unitLocalizationContentMetric,
	creditAttribution,
	unitAssociationProposal,
	entityAssociationPolicy,
	subjectAssociation,
	feedback,
	unit,
	unitDock,
	conversationParticipantStat,
	realmTagVoteStat,
	realmScoreContext,
	recommendationMetricDaily,
	recommendationSignalKind,
	recommendationUnitStat,
	governancePostBinding,
	governanceReasonCode,
	GovernanceNoteRoleValues,
	GovernanceReasonCodeValues,
	CommunityCatalogUnitKindValues,
	CreditAttributionRoleValues,
	isCreditAttributionRoleForUnitKind,
	DockKindValues,
	DockKindsByUnitKind,
	AssociationKindValues,
	EntityAssociationPolicyModeValues,
	moderationAction,
	moderationCase,
	ModerationActionKindValues,
	PostKindValues,
	SubjectAssociationRoleValues,
	profileRealmTagSubscription,
	realmUnitStatus,
	realmUnitStatusEvent,
	RealmUnitMutationCommandValues,
	scoreStat,
	score,
	post,
	postScore,
	profilePreference,
	unitAccessBinding,
	unitAccessInvitation,
	unitAccessRestriction,
	unitFollow,
	unitProtection,
	unitAliasVoteStat,
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
	searchIndexGeneration,
	sharedSearchQuery,
	searchRevisionProjectionSource,
	searchUnitProjectionSource,
	unitSlugAddress,
	unitRevisionSlot,
	unitStatusEvent,
	unitVariant,
	UnitRevisionSlotRoleValues,
	UnitStatusActorKindValues,
	PlatformCapabilityValues,
	UnitKindValues,
	UnitPermissionValues,
	VariantCapableUnitKindValues,
} from "./schema";

const dialect = new PgDialect();

describe("database schema contracts", () => {
	it("uses PostgreSQL uuidv7 for generated identifiers", () => {
		expect(dialect.sqlToQuery(unit.id.default as SQL).sql).toBe("uuidv7()");
		expect(dialect.sqlToQuery(sharedSearchQuery.id.default as SQL).sql).toBe("uuidv7()");
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

	it("owns independent current/history projection ledgers and generation pointers", () => {
		expect(getTableConfig(searchUnitProjectionSource).name).toBe(
			"search_unit_projection_source",
		);
		expect(getTableConfig(searchRevisionProjectionSource).name).toBe(
			"search_revision_projection_source",
		);
		const generation = getTableConfig(searchIndexGeneration);
		expect(generation.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"search_index_generation_active_projection_key",
				"search_index_generation_index_uid_key",
			]),
		);
	});

	it("limits Catalog content License markers to supported Catalog Unit kinds", () => {
		const marker = getTableConfig(catalogUnitContentLicense);
		expect(getTableName(catalogUnitContentLicense)).toBe("catalog_unit_content_license");
		expect(marker.foreignKeys.map((key) => key.getName())).toContain(
			"catalog_unit_content_license_unit_kind_fkey",
		);
		expect(marker.checks.map((constraint) => constraint.name)).toContain(
			"catalog_unit_content_license_kind_check",
		);
	});

	it("enforces Unit access subject invariants at the database boundary", () => {
		const binding = getTableConfig(unitAccessBinding);
		const restriction = getTableConfig(unitAccessRestriction);

		expect(binding.checks.map((constraint) => constraint.name)).toContain(
			"unit_access_binding_subject_role_check",
		);
		expect(restriction.checks.map((constraint) => constraint.name)).toContain(
			"unit_access_restriction_subject_shape_check",
		);
		expect(restriction.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"unit_access_restriction_active_profile_scope_key",
				"unit_access_restriction_active_realm_scope_key",
			]),
		);
		expect(unitAccessRestriction.subjectKind.enumValues).toEqual(["profile", "realm"]);
		expect(unitAccessBinding.subjectKind.enumValues).toEqual([
			"profile",
			"realm",
			"authenticated",
		]);
		expect(binding.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining(["unit_access_binding_active_owner_key"]),
		);
		expect(binding.checks.map((constraint) => constraint.name)).toContain(
			"unit_access_binding_owner_scope_check",
		);
	});

	it("keeps pending Unit access invitations out of effective access bindings", () => {
		const invitation = getTableConfig(unitAccessInvitation);
		expect(getTableName(unitAccessInvitation)).toBe("unit_access_invitation");
		expect(invitation.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"unit_access_invitation_role_check",
				"unit_access_invitation_resolution_shape_check",
			]),
		);
		expect(invitation.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"unit_access_invitation_unit_unresolved_idx",
				"unit_access_invitation_profile_unresolved_idx",
			]),
		);
		expect(UnitPermissionValues).toContain("unit.association.manage");
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

	it("separates Entity credit consent from subject association consent", () => {
		expect(entityAssociationPolicy.kind.enumValues).toEqual(AssociationKindValues);
		expect(entityAssociationPolicy.mode.enumValues).toEqual(EntityAssociationPolicyModeValues);
		const policy = getTableConfig(entityAssociationPolicy);
		expect(policy.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"entity_id",
			"kind",
		]);
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

	it("centralizes governance contracts and Post-identity note bindings", () => {
		expect(realmUnitStatus.enumValues).toEqual(["pending", "visible", "hidden", "removed"]);
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

		const action = getTableConfig(moderationAction);
		expect(governanceReasonCode.enumValues).toEqual(GovernanceReasonCodeValues);
		expect(moderationAction.reasonCode.enumValues).toEqual(GovernanceReasonCodeValues);
		expect(feedback.resolutionCode.enumValues).toEqual(GovernanceReasonCodeValues);
		expect(unitAccessRestriction.reasonCode.enumValues).toEqual(GovernanceReasonCodeValues);
		expect(unitProtection.reasonCode.enumValues).toEqual(GovernanceReasonCodeValues);
		expect(action.indexes.map((index) => index.config.name)).toContain(
			"moderation_action_actor_case_idempotency_key",
		);
		expect(action.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"moderation_action_state_outcome_check",
				"moderation_action_post_targeting_lock_outcome_check",
				"moderation_action_single_outcome_check",
				"moderation_action_request_fingerprint_check",
			]),
		);
		expect(getTableConfig(feedback).columns.map((column) => column.name)).not.toEqual(
			expect.arrayContaining(["content", "resolution"]),
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

	it("models live Score identity, ordered Post display, and Realm context", () => {
		const scoreConfig = getTableConfig(score);
		expect(scoreConfig.primaryKeys).toHaveLength(0);
		expect(score.id.primary).toBe(true);
		expect(scoreConfig.uniqueConstraints.map((constraint) => constraint.name)).toContain(
			"score_profile_unit_realm_key",
		);

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
	});

	it("stores a Profile default scoring Realm with referential integrity", () => {
		const preference = getTableConfig(profilePreference);
		expect(preference.foreignKeys.map((key) => key.getName())).toContain(
			"profile_preference_default_score_realm_id_realm_id_fk",
		);
		expect(preference.indexes.map((index) => index.config.name)).toContain(
			"profile_preference_default_score_realm_idx",
		);
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

	it("keeps structural, Redirect, and staff capability meanings explicit", () => {
		expect(UnitKindValues).toContain("slug_namespace");
		expect(UnitKindValues).not.toContain("redirect");
		expect(CommunityCatalogUnitKindValues).toEqual([
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
				"unit.ownership.transfer",
				"platform.api_token_policy.manage",
			]),
		);
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
		expect(realmTag.foreignKeys.map((key) => key.getName())).toContain(
			"realm_tag_vote_stat_context_fkey",
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

	it("keeps aggregate counters and read-model identities constrained", () => {
		for (const table of [
			scoreStat,
			unitAliasVoteStat,
			unitTagVoteStat,
			realmTagVoteStat,
			unitReactionStat,
			conversationParticipantStat,
		]) {
			expect(getTableConfig(table).checks.length).toBeGreaterThan(0);
		}
		expect(scoreStat.totalCount.getSQLType()).toBe("bigint");
		expect(unitAliasVoteStat.voteCount.getSQLType()).toBe("bigint");
		expect(recommendationUnitStat.impressions.getSQLType()).toBe("bigint");
		expect(recommendationMetricDaily.impressions.getSQLType()).toBe("bigint");
		expect(recommendationSignalKind.enumValues).toEqual(
			expect.arrayContaining(["score_high", "score_medium", "score_low"]),
		);
	});
});
