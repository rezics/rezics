export const PostgreSqlSchemaFileNames = [
	"book-chapter-progress.sql",
	"content-label-policy.sql",
	"content-language-search.sql",
	"content-pack-import.sql",
	"entity-measurement-evidence.sql",
	"realm-tag-authority.sql",
	"tag-judgment-aggregates.sql",
	"tag-path.sql",
	"tag-path-search.sql",
	"unit-license-grant.sql",
	"unit-variant-integrity.sql",
] as const;

export const PostgreSqlSchemaFunctionNames = [
	"apply_book_chapter_delta",
	"book_chapter_node_scope",
	"enforce_unit_variant_star",
	"guard_content_label_unit_merge",
	"guard_content_pack_subject_association_evidence_retarget",
	"guard_content_pack_unit_tag_evidence_retarget",
	"guard_content_pack_unit_tag_path_evidence_retarget",
	"guard_direct_tag_application_policy",
	"guard_entity_measurement",
	"guard_entity_variant_delete",
	"guard_entity_variant_kind_change",
	"guard_tag_directly_applicable_transition",
	"guard_tag_path_definition",
	"guard_tag_path_member_lifecycle",
	"guard_tag_path_merge",
	"guard_tag_path_projection",
	"guard_tag_path_vote_stat_projection",
	"guard_unit_license_grant_mutation",
	"lock_realm_tag_judgment_keys",
	"lock_vote_hot_keys",
	"lock_vote_hot_key",
	"maintain_book_chapter_from_node",
	"maintain_book_chapter_from_post",
	"maintain_book_chapter_from_progress",
	"maintain_book_chapter_from_structure",
	"maintain_book_chapter_from_unit",
	"maintain_realm_tag_judgment_stat",
	"maintain_realm_tag_path_vote_stat",
	"maintain_realm_unit_tag_path_judgment_stat",
	"maintain_realm_unit_tag_path_support",
	"maintain_subject_association_judgment_stat",
	"maintain_tag_path_vote_stat",
	"maintain_unit_content_language_search",
	"maintain_unit_effective_tag_from_direct",
	"maintain_unit_effective_tag_vote_from_direct",
	"maintain_unit_effective_tag_vote_from_path",
	"maintain_unit_tag_fit_stat",
	"maintain_unit_tag_path_judgment_stat",
	"maintain_unit_tag_path_support",
	"maintain_unit_tag_spoiler_stat",
	"project_tag_path_definition",
	"protect_realm_tag_path_judgment_identity",
	"protect_unit_tag_path_judgment_identity",
	"refresh_realm_unit_effective_tag",
	"refresh_unit_effective_tag_context",
	"refresh_unit_effective_tag_from_path_support",
	"refresh_unit_effective_tag_vote",
	"reject_content_label_judgment",
	"reject_content_pack_entity_measurement_evidence_mutation",
	"reject_content_pack_import_evidence_mutation",
	"require_content_pack_evidence_merge_operation",
	"search_text_candidates",
] as const;

export const PostgreSqlSchemaTriggers = [
	{
		table: "content_pack_entity_measurement_evidence",
		name: "content_pack_entity_measurement_evidence_immutable",
	},
	{ table: "content_pack_import", name: "content_pack_import_immutable" },
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
		table: "content_pack_tag_path_definition_evidence",
		name: "content_pack_tag_path_definition_evidence_immutable",
	},
	{ table: "content_pack_unit_tag_evidence", name: "content_pack_unit_tag_evidence_delete_guard" },
	{
		table: "content_pack_unit_tag_evidence",
		name: "content_pack_unit_tag_evidence_retarget_guard",
	},
	{
		table: "content_pack_unit_tag_path_evidence",
		name: "content_pack_unit_tag_path_evidence_delete_guard",
	},
	{
		table: "content_pack_unit_tag_path_evidence",
		name: "content_pack_unit_tag_path_evidence_retarget_guard",
	},
	{ table: "content_structure", name: "book_chapter_structure_stat_maintain" },
	{ table: "content_structure_node", name: "book_chapter_node_stat_maintain" },
	{ table: "content_structure_node_progress", name: "book_chapter_progress_stat_maintain" },
	{ table: "entity", name: "entity_variant_delete_guard" },
	{ table: "entity", name: "entity_variant_kind_change_guard" },
	{ table: "entity_measurement", name: "entity_measurement_guard" },
	{ table: "post", name: "book_chapter_post_stat_maintain" },
	{ table: "profile_unit_tag", name: "profile_unit_tag_application_policy_guard" },
	{ table: "realm_tag_judgment", name: "realm_tag_judgment_content_label_reject" },
	{ table: "realm_tag_judgment", name: "realm_tag_judgment_stat_maintain" },
	{ table: "realm_tag_path_vote", name: "realm_tag_path_vote_stat_maintain" },
	{ table: "realm_unit_tag", name: "realm_unit_tag_application_policy_guard" },
	{ table: "realm_unit_tag", name: "realm_unit_tag_effective_maintain" },
	{ table: "realm_unit_tag_path_judgment", name: "realm_unit_tag_path_judgment_identity_guard" },
	{ table: "realm_unit_tag_path_judgment", name: "realm_unit_tag_path_judgment_stat_maintain" },
	{ table: "realm_unit_tag_path_judgment", name: "realm_unit_tag_path_support_maintain" },
	{ table: "realm_unit_tag_path_support", name: "realm_unit_tag_path_support_effective_maintain" },
	{ table: "subject_association_judgment", name: "subject_association_judgment_stat_maintain" },
	{ table: "tag", name: "tag_directly_applicable_transition_guard" },
	{ table: "tag_path", name: "tag_path_definition_guard" },
	{ table: "tag_path", name: "tag_path_definition_project" },
	{ table: "tag_path_edge", name: "tag_path_edge_projection_guard" },
	{ table: "tag_path_member", name: "tag_path_member_projection_guard" },
	{ table: "tag_path_merge", name: "tag_path_merge_guard" },
	{ table: "tag_path_vote", name: "tag_path_vote_stat_maintain" },
	{ table: "tag_path_vote_stat", name: "tag_path_vote_stat_projection_guard" },
	{ table: "unit", name: "book_chapter_unit_stat_maintain" },
	{ table: "unit", name: "tag_path_member_unit_lifecycle_guard" },
	{ table: "unit_content_language_support", name: "unit_content_language_search_maintain" },
	{ table: "unit_effective_tag_vote", name: "unit_effective_tag_vote_fit_stat_maintain" },
	{ table: "unit_license_grant", name: "unit_license_grant_guard_mutation" },
	{ table: "unit_merge_operation", name: "unit_merge_operation_content_label_guard" },
	{ table: "unit_tag", name: "unit_tag_application_policy_guard" },
	{ table: "unit_tag", name: "unit_tag_effective_context_maintain" },
	{ table: "unit_tag_judgment", name: "unit_tag_judgment_content_label_reject" },
	{ table: "unit_tag_judgment", name: "unit_tag_judgment_effective_vote_maintain" },
	{ table: "unit_tag_judgment", name: "unit_tag_judgment_spoiler_stat_maintain" },
	{ table: "unit_tag_path_judgment", name: "unit_tag_path_judgment_identity_guard" },
	{ table: "unit_tag_path_judgment", name: "unit_tag_path_judgment_stat_maintain" },
	{ table: "unit_tag_path_judgment", name: "unit_tag_path_support_maintain" },
	{ table: "unit_tag_path_support", name: "unit_tag_path_support_effective_maintain" },
	{ table: "unit_tag_path_support", name: "unit_tag_path_support_effective_vote_maintain" },
	{ table: "unit_variant", name: "unit_variant_star_enforce" },
] as const;

export type PostgreSqlSchemaTriggerContract = {
	readonly table: string;
	readonly name: string;
	readonly timing: "BEFORE" | "AFTER" | "INSTEAD OF";
	readonly events: readonly ("DELETE" | "INSERT" | "TRUNCATE" | "UPDATE")[];
	readonly level: "ROW" | "STATEMENT";
	readonly functionName: string;
};

export const PostgreSqlSchemaTriggerContracts =
	[] as const satisfies readonly PostgreSqlSchemaTriggerContract[];

export type PostgreSqlSchemaView = {
	readonly name: `current_${string}`;
	readonly relOptions: readonly string[];
	readonly columns: readonly { readonly name: string; readonly dataType: string }[];
};

export const PostgreSqlSchemaViews = [] as const satisfies readonly PostgreSqlSchemaView[];
