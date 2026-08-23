export const PostgreSqlSchemaFileNames = [
	"book-chapter-progress.sql",
	"content-language-search.sql",
	"content-pack-import.sql",
	"unit-license-grant.sql",
	"unit-variant-integrity.sql",
	"vndb-v11-contract.sql",
	"vndb-v11-cutover-verification.sql",
] as const;

export const PostgreSqlSchemaFunctionNames = [
	"apply_book_chapter_delta",
	"apply_realm_tag_judgment_stat_delta",
	"apply_subject_association_judgment_stat_delta",
	"apply_unit_structure_application_judgment_stat_delta",
	"apply_unit_tag_judgment_stat_delta",
	"book_chapter_node_scope",
	"enforce_vndb_v11_cutover_control_transition",
	"enforce_vndb_v11_cutover_verification_checkpoint",
	"enforce_vndb_v11_cutover_verification_proof",
	"enforce_vndb_v11_cutover_write_fence",
	"guard_entity_variant_delete",
	"guard_unit_license_grant_mutation",
	"guard_entity_variant_kind_change",
	"maintain_book_chapter_from_node",
	"maintain_book_chapter_from_post",
	"maintain_book_chapter_from_progress",
	"maintain_book_chapter_from_structure",
	"maintain_book_chapter_from_unit",
	"maintain_unit_content_language_search",
	"enforce_unit_variant_star",
	"enforce_realm_tag_judgment_enabled",
	"guard_content_label_unit_merge",
	"guard_direct_tag_application_policy",
	"guard_tag_directly_applicable_transition",
	"guard_entity_measurement",
	"guard_content_pack_structure_application_evidence_retarget",
	"guard_content_pack_subject_association_evidence_retarget",
	"guard_content_pack_unit_tag_evidence_retarget",
	"guard_platform_content_label_unit_tag",
	"lock_realm_tag_judgment_key",
	"lock_realm_tag_judgment_keys",
	"lock_subject_association_judgment_key",
	"lock_tag_primary_display_path_key",
	"lock_unit_effective_tag_key",
	"lock_unit_effective_tag_vote_key",
	"lock_unit_structure_application_judgment_key",
	"lock_unit_structure_definition_key",
	"lock_vndb_vote_hot_keys",
	"maintain_effective_tag_from_direct_context",
	"maintain_effective_tag_from_direct_judgment",
	"maintain_effective_tag_from_structure_support",
	"maintain_realm_tag_judgment_stat",
	"maintain_structure_application_support",
	"maintain_subject_association_judgment_stat",
	"maintain_tag_primary_display_path_from_end",
	"maintain_tag_primary_display_path_from_structure",
	"maintain_tag_primary_display_path_from_vote_stat",
	"maintain_unit_structure_application_judgment_stat",
	"maintain_unit_tag_judgment_stat",
	"prepare_entity_measurement_merge_freeze",
	"prepare_entity_measurement_merge_freeze_update",
	"prepare_unit_structure_definition",
	"prepare_unit_structure_end_change",
	"prepare_realm_tag_judgment_hot_key",
	"prepare_structure_application_judgment_hot_keys",
	"prepare_unit_tag_hot_key",
	"prepare_vndb_vote_hot_keys",
	"project_unit_structure_definition",
	"protect_realm_tag_judgment_identity",
	"protect_subject_association_judgment_identity",
	"protect_unit_structure_application_judgment_identity",
	"protect_unit_tag_judgment_identity",
	"protect_vndb_projection",
	"protect_vndb_v11_cutover_control",
	"protect_vndb_v11_cutover_transition",
	"protect_vndb_v11_cutover_verification_checkpoint",
	"protect_vndb_v11_cutover_verification_proof",
	"refresh_tag_primary_display_path",
	"refresh_unit_effective_tag_vote",
	"refresh_unit_structure_application_judgment_stat",
	"refresh_unit_structure_primary_path_candidate",
	"refresh_unit_tag_judgment_stat",
	"reject_conflicting_direct_tag_judgment",
	"reject_conflicting_structure_application_judgment",
	"reject_content_label_judgment",
	"reject_content_pack_import_evidence_mutation",
	"require_content_pack_evidence_merge_operation",
	"vndb_v11_verification_cursor_advanced",
] as const;

export const PostgreSqlSchemaTriggers = [
	{ table: "content_pack_import", name: "content_pack_import_immutable" },
	{
		table: "content_pack_structure_application_evidence",
		name: "content_pack_structure_application_evidence_delete_guard",
	},
	{
		table: "content_pack_structure_application_evidence",
		name: "content_pack_structure_application_evidence_retarget_guard",
	},
	{
		table: "content_pack_structure_definition_evidence",
		name: "content_pack_structure_definition_evidence_immutable",
	},
	{
		table: "content_pack_subject_association_evidence",
		name: "content_pack_subject_association_evidence_delete_guard",
	},
	{
		table: "content_pack_subject_association_evidence",
		name: "content_pack_subject_association_evidence_retarget_guard",
	},
	{ table: "content_pack_tag_evidence", name: "content_pack_tag_evidence_immutable" },
	{
		table: "content_pack_unit_tag_evidence",
		name: "content_pack_unit_tag_evidence_delete_guard",
	},
	{
		table: "content_pack_unit_tag_evidence",
		name: "content_pack_unit_tag_evidence_retarget_guard",
	},
	{ table: "content_structure_node", name: "book_chapter_node_stat_maintain" },
	{ table: "post", name: "book_chapter_post_stat_maintain" },
	{
		table: "content_structure_node_progress",
		name: "book_chapter_progress_stat_maintain",
	},
	{ table: "content_structure", name: "book_chapter_structure_stat_maintain" },
	{ table: "unit", name: "book_chapter_unit_stat_maintain" },
	{
		table: "unit_content_language_support",
		name: "unit_content_language_search_maintain",
	},
	{ table: "entity", name: "entity_variant_delete_guard" },
	{ table: "entity", name: "entity_variant_kind_change_guard" },
	{ table: "unit_license_grant", name: "unit_license_grant_guard_mutation" },
	{ table: "unit_variant", name: "unit_variant_star_enforce" },
	{ table: "entity_measurement", name: "entity_measurement_guard" },
	{
		table: "unit_effective_tag_vote",
		name: "unit_effective_tag_vote_hot_key_lock",
	},
	{
		table: "profile_unit_tag",
		name: "profile_unit_tag_application_policy_guard",
	},
	{
		table: "realm_tag_judgment",
		name: "realm_tag_judgment_content_label_reject",
	},
	{
		table: "realm_tag_judgment",
		name: "realm_tag_judgment_application_policy_guard",
	},
	{ table: "realm_tag_judgment", name: "realm_tag_judgment_identity_immutable" },
	{ table: "realm_tag_judgment", name: "realm_tag_judgment_hot_key_lock" },
	{
		table: "realm_tag_judgment",
		name: "realm_tag_judgment_realm_tag_voting_enabled",
	},
	{ table: "realm_tag_judgment", name: "realm_tag_judgment_stat_maintain" },
	{ table: "realm_unit_tag", name: "realm_unit_tag_application_policy_guard" },
	{
		table: "subject_association_judgment",
		name: "subject_association_judgment_identity_immutable",
	},
	{ table: "subject_association_judgment", name: "subject_association_judgment_stat_maintain" },
	{ table: "tag", name: "tag_directly_applicable_transition_guard" },
	{ table: "tag_primary_display_path", name: "tag_primary_display_path_immutable" },
	{ table: "unit_effective_tag_vote", name: "unit_tag_judgment_stat_maintain" },
	{
		table: "unit_merge_operation",
		name: "unit_merge_operation_content_label_guard",
	},
	{
		table: "unit_merge_operation",
		name: "unit_merge_operation_entity_measurement_freeze_insert_prepare",
	},
	{
		table: "unit_merge_operation",
		name: "unit_merge_operation_entity_measurement_freeze_update_prepare",
	},
	{ table: "unit_structure", name: "unit_structure_definition_prepare" },
	{ table: "unit_structure", name: "unit_structure_definition_project" },
	{ table: "unit_structure", name: "unit_structure_primary_display_maintain" },
	{
		table: "unit_structure_application_judgment",
		name: "unit_structure_application_judgment_hot_key_lock",
	},
	{
		table: "unit_structure_application_judgment",
		name: "unit_structure_application_judgment_stat_maintain",
	},
	{
		table: "unit_structure_application_judgment",
		name: "unit_structure_application_judgment_identity_immutable",
	},
	{
		table: "unit_structure_application_judgment",
		name: "unit_structure_application_judgment_support_maintain",
	},
	{
		table: "unit_structure_application_judgment",
		name: "unit_structure_application_judgment_tag_conflict",
	},
	{ table: "unit_structure_end", name: "unit_structure_end_immutable" },
	{
		table: "unit_structure_end",
		name: "unit_structure_end_primary_display_prepare",
	},
	{ table: "unit_structure_end", name: "unit_structure_end_primary_display_maintain" },
	{
		table: "unit_structure_primary_path_candidate",
		name: "unit_structure_primary_path_candidate_immutable",
	},
	{ table: "unit_structure_vote_stat", name: "unit_structure_vote_stat_primary_display_maintain" },
	{
		table: "unit_tag_structure_support",
		name: "unit_tag_structure_support_hot_key_lock",
	},
	{ table: "unit_tag", name: "unit_tag_application_policy_guard" },
	{ table: "unit_tag", name: "unit_tag_hot_key_lock" },
	{ table: "unit_tag", name: "unit_tag_platform_content_label_guard" },
	{ table: "unit_tag_judgment", name: "unit_tag_judgment_content_label_reject" },
	{ table: "unit_tag_judgment", name: "unit_tag_judgment_effective_maintain" },
	{ table: "unit_tag_judgment", name: "unit_tag_judgment_hot_key_lock" },
	{ table: "unit_tag_judgment", name: "unit_tag_judgment_identity_immutable" },
	{ table: "unit_tag_judgment", name: "unit_tag_judgment_structure_conflict" },
	{
		table: "unit_tag",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "realm_unit_tag",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "profile_unit_tag",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "unit_tag_judgment",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "unit_structure",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "unit_structure_vote",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "unit_structure_application",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "unit_structure_application_judgment",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "realm_tag_context",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "realm_tag_judgment",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "unit_merge_operation",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "entity_measurement",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "subject_association_judgment",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "unit_structure_correction",
		name: "vndb_v11_cutover_write_fence",
	},
	{
		table: "vndb_v11_cutover_control",
		name: "vndb_v11_cutover_control_transition",
	},
	{
		table: "vndb_v11_cutover_control",
		name: "vndb_v11_cutover_control_row_protect",
	},
	{
		table: "vndb_v11_cutover_control",
		name: "vndb_v11_cutover_control_truncate_protect",
	},
	{
		table: "vndb_v11_cutover_transition",
		name: "vndb_v11_cutover_transition_mutation_protect",
	},
	{
		table: "vndb_v11_cutover_transition",
		name: "vndb_v11_cutover_transition_truncate_protect",
	},
	{
		table: "vndb_v11_cutover_verification_checkpoint",
		name: "vndb_v11_cutover_verification_checkpoint_enforce",
	},
	{
		table: "vndb_v11_cutover_verification_checkpoint",
		name: "vndb_v11_cutover_verification_checkpoint_delete_protect",
	},
	{
		table: "vndb_v11_cutover_verification_checkpoint",
		name: "vndb_v11_cutover_verification_checkpoint_truncate_protect",
	},
	{
		table: "vndb_v11_cutover_verification_proof",
		name: "vndb_v11_cutover_verification_proof_enforce",
	},
	{
		table: "vndb_v11_cutover_verification_proof",
		name: "vndb_v11_cutover_verification_proof_mutation_protect",
	},
	{
		table: "vndb_v11_cutover_verification_proof",
		name: "vndb_v11_cutover_verification_proof_truncate_protect",
	},
] as const;

export type PostgreSqlSchemaTriggerContract = {
	readonly table: string;
	readonly name: string;
	readonly timing: "BEFORE" | "AFTER" | "INSTEAD OF";
	readonly events: readonly ("DELETE" | "INSERT" | "TRUNCATE" | "UPDATE")[];
	readonly level: "ROW" | "STATEMENT";
	readonly functionName: string;
};

const VndbV11CutoverWriteFenceTables = [
	"unit_tag",
	"realm_unit_tag",
	"profile_unit_tag",
	"unit_tag_judgment",
	"unit_structure",
	"unit_structure_vote",
	"unit_structure_application",
	"unit_structure_application_judgment",
	"realm_tag_context",
	"realm_tag_judgment",
	"unit_merge_operation",
	"entity_measurement",
	"subject_association_judgment",
	"unit_structure_correction",
] as const;

const VndbV11CutoverWriteFenceEvents = ["INSERT", "DELETE", "UPDATE", "TRUNCATE"] as const;

export const PostgreSqlSchemaTriggerContracts = [
	{
		table: "unit_license_grant",
		name: "unit_license_grant_guard_mutation",
		timing: "BEFORE",
		events: ["DELETE", "UPDATE"],
		level: "ROW",
		functionName: "guard_unit_license_grant_mutation",
	},
	...VndbV11CutoverWriteFenceTables.map(
		(table) =>
			({
				table,
				name: "vndb_v11_cutover_write_fence",
				timing: "BEFORE",
				events: VndbV11CutoverWriteFenceEvents,
				level: "STATEMENT",
				functionName: "enforce_vndb_v11_cutover_write_fence",
			}) satisfies PostgreSqlSchemaTriggerContract,
	),
	{
		table: "vndb_v11_cutover_control",
		name: "vndb_v11_cutover_control_transition",
		timing: "BEFORE",
		events: ["UPDATE"],
		level: "ROW",
		functionName: "enforce_vndb_v11_cutover_control_transition",
	},
	{
		table: "vndb_v11_cutover_control",
		name: "vndb_v11_cutover_control_row_protect",
		timing: "BEFORE",
		events: ["INSERT", "DELETE"],
		level: "ROW",
		functionName: "protect_vndb_v11_cutover_control",
	},
	{
		table: "vndb_v11_cutover_control",
		name: "vndb_v11_cutover_control_truncate_protect",
		timing: "BEFORE",
		events: ["TRUNCATE"],
		level: "STATEMENT",
		functionName: "protect_vndb_v11_cutover_control",
	},
	{
		table: "vndb_v11_cutover_transition",
		name: "vndb_v11_cutover_transition_mutation_protect",
		timing: "BEFORE",
		events: ["INSERT", "UPDATE", "DELETE"],
		level: "ROW",
		functionName: "protect_vndb_v11_cutover_transition",
	},
	{
		table: "vndb_v11_cutover_transition",
		name: "vndb_v11_cutover_transition_truncate_protect",
		timing: "BEFORE",
		events: ["TRUNCATE"],
		level: "STATEMENT",
		functionName: "protect_vndb_v11_cutover_transition",
	},
	{
		table: "vndb_v11_cutover_verification_checkpoint",
		name: "vndb_v11_cutover_verification_checkpoint_enforce",
		timing: "BEFORE",
		events: ["INSERT", "UPDATE"],
		level: "ROW",
		functionName: "enforce_vndb_v11_cutover_verification_checkpoint",
	},
	{
		table: "vndb_v11_cutover_verification_checkpoint",
		name: "vndb_v11_cutover_verification_checkpoint_delete_protect",
		timing: "BEFORE",
		events: ["DELETE"],
		level: "STATEMENT",
		functionName: "protect_vndb_v11_cutover_verification_checkpoint",
	},
	{
		table: "vndb_v11_cutover_verification_checkpoint",
		name: "vndb_v11_cutover_verification_checkpoint_truncate_protect",
		timing: "BEFORE",
		events: ["TRUNCATE"],
		level: "STATEMENT",
		functionName: "protect_vndb_v11_cutover_verification_checkpoint",
	},
	{
		table: "vndb_v11_cutover_verification_proof",
		name: "vndb_v11_cutover_verification_proof_enforce",
		timing: "BEFORE",
		events: ["INSERT"],
		level: "ROW",
		functionName: "enforce_vndb_v11_cutover_verification_proof",
	},
	{
		table: "vndb_v11_cutover_verification_proof",
		name: "vndb_v11_cutover_verification_proof_mutation_protect",
		timing: "BEFORE",
		events: ["UPDATE", "DELETE"],
		level: "STATEMENT",
		functionName: "protect_vndb_v11_cutover_verification_proof",
	},
	{
		table: "vndb_v11_cutover_verification_proof",
		name: "vndb_v11_cutover_verification_proof_truncate_protect",
		timing: "BEFORE",
		events: ["TRUNCATE"],
		level: "STATEMENT",
		functionName: "protect_vndb_v11_cutover_verification_proof",
	},
] as const satisfies readonly PostgreSqlSchemaTriggerContract[];

export type PostgreSqlSchemaView = {
	readonly name: `current_${string}`;
	readonly relOptions: readonly string[];
	readonly columns: readonly {
		readonly name: string;
		readonly dataType: string;
	}[];
};

const SecurityBarrierViewOptions = ["security_barrier=true"] as const;

export const PostgreSqlSchemaViews = [
	{
		name: "current_unit_structure_member",
		relOptions: SecurityBarrierViewOptions,
		columns: [
			{ name: "structure_id", dataType: "uuid" },
			{ name: "projection_version", dataType: "integer" },
			{ name: "ordinal", dataType: "integer" },
			{ name: "member_unit_id", dataType: "uuid" },
		],
	},
	{
		name: "current_unit_structure_edge",
		relOptions: SecurityBarrierViewOptions,
		columns: [
			{ name: "structure_id", dataType: "uuid" },
			{ name: "projection_version", dataType: "integer" },
			{ name: "ordinal", dataType: "integer" },
			{ name: "parent_unit_id", dataType: "uuid" },
			{ name: "child_unit_id", dataType: "uuid" },
		],
	},
	{
		name: "current_unit_structure_end",
		relOptions: SecurityBarrierViewOptions,
		columns: [
			{ name: "structure_id", dataType: "uuid" },
			{ name: "projection_version", dataType: "integer" },
			{ name: "final_tag_id", dataType: "uuid" },
		],
	},
	{
		name: "current_unit_structure_primary_path_candidate",
		relOptions: SecurityBarrierViewOptions,
		columns: [
			{ name: "structure_id", dataType: "uuid" },
			{ name: "projection_version", dataType: "integer" },
			{ name: "final_tag_id", dataType: "uuid" },
			{ name: "accepted", dataType: "boolean" },
			{ name: "wilson_lower_bound", dataType: "double precision" },
			{ name: "score", dataType: "bigint" },
			{ name: "vote_count", dataType: "bigint" },
			{ name: "updated_at", dataType: "timestamp(3) with time zone" },
		],
	},
	{
		name: "current_unit_tag_structure_support",
		relOptions: SecurityBarrierViewOptions,
		columns: [
			{ name: "unit_id", dataType: "uuid" },
			{ name: "tag_id", dataType: "uuid" },
			{ name: "profile_id", dataType: "uuid" },
			{ name: "structure_id", dataType: "uuid" },
			{ name: "projection_version", dataType: "integer" },
			{ name: "created_at", dataType: "timestamp(3) with time zone" },
		],
	},
	{
		name: "current_unit_effective_tag",
		relOptions: SecurityBarrierViewOptions,
		columns: [
			{ name: "unit_id", dataType: "uuid" },
			{ name: "tag_id", dataType: "uuid" },
			{ name: "direct", dataType: "boolean" },
			{ name: "structure_support_count", dataType: "bigint" },
			{ name: "created_at", dataType: "timestamp(3) with time zone" },
			{ name: "updated_at", dataType: "timestamp(3) with time zone" },
		],
	},
	{
		name: "current_unit_effective_tag_vote",
		relOptions: SecurityBarrierViewOptions,
		columns: [
			{ name: "unit_id", dataType: "uuid" },
			{ name: "tag_id", dataType: "uuid" },
			{ name: "profile_id", dataType: "uuid" },
			{ name: "value", dataType: "integer" },
			{ name: "created_at", dataType: "timestamp(3) with time zone" },
			{ name: "updated_at", dataType: "timestamp(3) with time zone" },
		],
	},
	{
		name: "current_unit_tag_judgment_stat",
		relOptions: SecurityBarrierViewOptions,
		columns: [
			{ name: "unit_id", dataType: "uuid" },
			{ name: "tag_id", dataType: "uuid" },
			{ name: "score", dataType: "bigint" },
			{ name: "vote_count", dataType: "bigint" },
			{ name: "spoiler_vote_count", dataType: "bigint" },
			{ name: "spoiler_none_count", dataType: "bigint" },
			{ name: "spoiler_minor_count", dataType: "bigint" },
			{ name: "spoiler_major_count", dataType: "bigint" },
			{ name: "updated_at", dataType: "timestamp(3) with time zone" },
		],
	},
	{
		name: "current_tag_primary_display_path",
		relOptions: SecurityBarrierViewOptions,
		columns: [
			{ name: "tag_id", dataType: "uuid" },
			{ name: "structure_id", dataType: "uuid" },
			{ name: "structure_projection_version", dataType: "integer" },
			{ name: "created_at", dataType: "timestamp(3) with time zone" },
			{ name: "updated_at", dataType: "timestamp(3) with time zone" },
		],
	},
] as const satisfies readonly PostgreSqlSchemaView[];
