import { getTableName, type SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	auditEvent,
	entityAssociationPolicy,
	subjectAssociation,
	feedback,
	unit,
	conversationParticipantStat,
	realmTagVoteStat,
	recommendationMetricDaily,
	recommendationSignalKind,
	recommendationUnitStat,
	governancePostBinding,
	governanceReasonCode,
	GovernanceNoteRoleValues,
	GovernanceReasonCodeValues,
	CommunityCatalogUnitKindValues,
	EntityAssociationKindValues,
	EntityAssociationPolicyModeValues,
	moderationAction,
	moderationCase,
	ModerationActionKindValues,
	PostKindValues,
	realmUnitStatus,
	realmUnitStatusEvent,
	RealmUnitMutationCommandValues,
	scoreStat,
	unitAccessBinding,
	unitAccessRestriction,
	unitProtection,
	unitAlias,
	unitAliasVoteStat,
	unitReactionStat,
	unitTagVoteStat,
	unitLocalization,
	unitRedirect,
	PlatformCapabilityValues,
	UnitKindValues,
} from "./schema";

const dialect = new PgDialect();

describe("database schema contracts", () => {
	it("uses PostgreSQL uuidv7 for generated identifiers", () => {
		expect(dialect.sqlToQuery(unit.id.default as SQL).sql).toBe("uuidv7()");
	});

	it("tracks every PGroonga search index in the schema", () => {
		const indexes = [unit, unitAlias, unitLocalization]
			.flatMap((table) => getTableConfig(table).indexes)
			.filter((index) => index.config.method === "pgroonga");

		expect(indexes.map((index) => index.config.name).sort()).toEqual(
			[
				"unit_alias_term_search_idx",
				"unit_localization_content_search_idx",
				"unit_localization_description_search_idx",
				"unit_localization_summary_search_idx",
				"unit_localization_title_search_idx",
				"unit_slug_search_idx",
			].sort(),
		);
		for (const name of [
			"unit_localization_content_search_idx",
			"unit_localization_description_search_idx",
		]) {
			const index = indexes.find((candidate) => candidate.config.name === name);
			const column = index?.config.columns[0];
			expect(
				column && "indexConfig" in column ? column.indexConfig?.opClass : undefined,
			).toBe("pgroonga_jsonb_full_text_search_ops_v2");
		}
		expect(
			indexes.find((index) => index.config.name === "unit_slug_search_idx")?.config.where,
		).toBeDefined();
		expect(
			indexes.find((index) => index.config.name === "unit_alias_term_search_idx")?.config
				.where,
		).toBeDefined();
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
			"system",
		]);
		expect(binding.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"unit_access_binding_active_system_scope_key",
				"unit_access_binding_active_owner_key",
			]),
		);
		expect(binding.checks.map((constraint) => constraint.name)).toContain(
			"unit_access_binding_owner_scope_check",
		);
	});

	it("separates Entity credit consent from subject association consent", () => {
		expect(entityAssociationPolicy.kind.enumValues).toEqual(EntityAssociationKindValues);
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
	});

	it("centralizes governance contracts and immutable note bindings", () => {
		expect(realmUnitStatus.enumValues).toEqual(["pending", "visible", "hidden", "removed"]);
		expect(RealmUnitMutationCommandValues).toEqual([
			"approve",
			"hide",
			"remove",
			"restore",
			"lock",
			"unlock",
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
		expect(binding.foreignKeys.map((key) => key.getName())).toContain(
			"governance_post_binding_revision_post_fkey",
		);
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
				"moderation_action_lock_outcome_check",
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

	it("models Unit slugs as one scoped address tree", () => {
		const address = getTableConfig(unit);
		expect(unit.kind.getSQLType()).toBe("text");
		expect(address.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining(["unit_slug_scope_slug_key", "unit_slug_root_key"]),
		);
		expect(address.indexes.map((index) => index.config.name)).not.toContain(
			"unit_kind_slug_key",
		);
		expect(address.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"unit_kind_check",
				"unit_slug_address_shape_check",
				"unit_slug_label_check",
				"unit_slug_scope_not_self_check",
			]),
		);
		expect(address.foreignKeys.map((key) => key.getName())).toContain(
			"unit_slug_scope_id_unit_id_fk",
		);
	});

	it("keeps structural, Redirect, and staff capability meanings explicit", () => {
		expect(UnitKindValues).toEqual(expect.arrayContaining(["slug_namespace", "redirect"]));
		expect(CommunityCatalogUnitKindValues).toEqual([
			"book",
			"software",
			"media",
			"series",
			"entity",
			"tag",
		]);
		expect(PlatformCapabilityValues).toEqual(
			expect.arrayContaining([
				"unit.slug.manage",
				"unit.slug.namespace.manage",
				"unit.slug.redirect.release",
				"entity.association-policy.manage",
				"entity.associations.override",
				"unit.ownership.transfer",
			]),
		);
		const redirect = getTableConfig(unitRedirect);
		expect(redirect.checks.map((constraint) => constraint.name)).toContain(
			"unit_redirect_not_self_check",
		);
		expect(redirect.indexes.map((index) => index.config.name)).toContain(
			"unit_redirect_target_unit_idx",
		);
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
