export const PostgreSqlSchemaFileNames = [
	"book-chapter-progress.sql",
	"content-label-policy.sql",
	"content-language-search.sql",
	"custom-theme-integrity.sql",
	"entity-measurement.sql",
	"realm-tag-authority.sql",
	"tag-judgment-aggregates.sql",
	"tag-path.sql",
	"tag-path-search.sql",
	"unit-license-grant.sql",
	"unit-variant-integrity.sql",
] as const;

export type PostgreSqlSchemaFileName = (typeof PostgreSqlSchemaFileNames)[number];

/**
 * Release migrations may install one atomic domain cutover while the canonical
 * PostgreSQL definitions remain split by responsibility for review and drift checks.
 */
export const PostgreSqlSchemaMigrationBundles = {
	tag_path_semantic_model: [
		"realm-tag-authority.sql",
		"tag-judgment-aggregates.sql",
		"tag-path.sql",
		"content-label-policy.sql",
		"tag-path-search.sql",
	],
} as const satisfies Readonly<Record<string, readonly PostgreSqlSchemaFileName[]>>;

export const PostgreSqlSchemaFunctionNames = [
	"apply_book_chapter_delta",
	"book_chapter_node_scope",
	"enforce_unit_variant_star",
	"enqueue_tag_expression_projection_rebuild",
	"guard_content_label_unit_merge",
	"guard_direct_tag_application_policy",
	"guard_entity_measurement",
	"guard_entity_variant_delete",
	"guard_entity_variant_kind_change",
	"guard_realm_tag_path_sense_adoption",
	"guard_realm_unit_tag_path_application",
	"guard_tag_directly_applicable_transition",
	"guard_tag_expression_argument_mutation",
	"guard_tag_expression_inference_graph",
	"guard_tag_expression_inference_rule_mutation",
	"guard_tag_expression_mutation",
	"guard_tag_expression_presentation_component_mutation",
	"guard_tag_expression_presentation_mutation",
	"guard_tag_path_definition",
	"guard_tag_path_merge",
	"guard_tag_path_projection",
	"guard_tag_path_sense_binding_mutation",
	"guard_tag_path_sense_mutation",
	"guard_tag_path_vote_stat_projection",
	"guard_tag_relation_path_lifecycle",
	"guard_tag_relation_graph",
	"guard_unit_license_grant_mutation",
	"guard_unit_tag_path_application",
	"guard_vocabulary_node_path_lifecycle",
	"lock_realm_tag_judgment_keys",
	"lock_vote_hot_key",
	"lock_vote_hot_keys",
	"maintain_book_chapter_from_node",
	"maintain_book_chapter_from_post",
	"maintain_book_chapter_from_progress",
	"maintain_book_chapter_from_structure",
	"maintain_book_chapter_from_unit",
	"maintain_realm_application_expression",
	"maintain_realm_expression_from_direct",
	"maintain_realm_tag_judgment_stat",
	"maintain_realm_tag_path_vote_stat",
	"maintain_realm_unit_tag_path_application_judgment_stat",
	"maintain_subject_association_judgment_stat",
	"maintain_tag_expression_inference_closure",
	"maintain_tag_path_vote_stat",
	"maintain_unit_application_expression",
	"maintain_unit_content_language_search",
	"maintain_unit_expression_from_direct",
	"maintain_unit_tag_judgment_stat",
	"maintain_unit_tag_path_application_judgment_stat",
	"project_tag_path_definition",
	"protect_custom_theme_external_live_grant",
	"protect_custom_theme_revision_package",
	"protect_realm_tag_path_application_judgment_identity",
	"protect_unit_tag_path_application_judgment_identity",
	"rebuild_tag_expression_effective_tags",
	"refresh_realm_unit_effective_tags",
	"refresh_realm_unit_expression_assertion",
	"refresh_unit_effective_tags",
	"refresh_unit_expression_assertion",
	"reject_content_label_judgment",
	"reject_custom_theme_immutable_history_mutation",
	"search_text_candidates",
] as const;

export const PostgreSqlSchemaTriggers = [
	{
		table: "custom_theme_revision",
		name: "custom_theme_revision_package_immutable",
	},
	{
		table: "custom_theme_revision_file",
		name: "custom_theme_revision_file_immutable",
	},
	{
		table: "custom_theme_revision_review_event",
		name: "custom_theme_revision_review_event_immutable",
	},
	{ table: "content_structure", name: "book_chapter_structure_stat_maintain" },
	{ table: "content_structure_node", name: "book_chapter_node_stat_maintain" },
	{ table: "content_structure_node_progress", name: "book_chapter_progress_stat_maintain" },
	{ table: "entity", name: "entity_variant_delete_guard" },
	{ table: "entity", name: "entity_variant_kind_change_guard" },
	{ table: "entity_measurement", name: "entity_measurement_guard" },
	{ table: "post", name: "book_chapter_post_stat_maintain" },
	{
		table: "platform_capability_grant",
		name: "platform_capability_grant_custom_theme_lifecycle_guard",
	},
	{ table: "profile_unit_tag", name: "profile_unit_tag_application_policy_guard" },
	{ table: "realm_tag_judgment", name: "realm_tag_judgment_content_label_reject" },
	{ table: "realm_tag_judgment", name: "realm_tag_judgment_stat_maintain" },
	{ table: "realm_tag_path_sense", name: "realm_tag_path_sense_adoption_guard" },
	{ table: "realm_tag_path_vote", name: "realm_tag_path_vote_stat_maintain" },
	{ table: "realm_unit_tag", name: "realm_unit_tag_application_policy_guard" },
	{ table: "realm_unit_tag", name: "realm_unit_tag_expression_assertion_maintain" },
	{
		table: "realm_unit_tag_path_application",
		name: "realm_unit_tag_path_application_expression_maintain",
	},
	{
		table: "realm_unit_tag_path_application",
		name: "realm_unit_tag_path_application_guard",
	},
	{
		table: "realm_unit_tag_path_application_judgment",
		name: "realm_unit_tag_path_application_judgment_identity_guard",
	},
	{
		table: "realm_unit_tag_path_application_judgment",
		name: "realm_unit_tag_path_application_judgment_stat_maintain",
	},
	{ table: "subject_association_judgment", name: "subject_association_judgment_stat_maintain" },
	{ table: "tag", name: "tag_directly_applicable_transition_guard" },
	{ table: "tag_expression", name: "tag_expression_closure_from_definition" },
	{ table: "tag_expression", name: "tag_expression_mutation_guard" },
	{ table: "tag_expression_argument", name: "tag_expression_argument_mutation_guard" },
	{
		table: "tag_expression_group_key",
		name: "tag_expression_group_key_mutation_guard",
	},
	{
		table: "tag_expression_inference_rule",
		name: "tag_expression_closure_from_rule",
	},
	{
		table: "tag_expression_inference_rule",
		name: "tag_expression_inference_graph_guard",
	},
	{
		table: "tag_expression_inference_rule",
		name: "tag_expression_inference_rule_mutation_guard",
	},
	{
		table: "tag_expression_label_component",
		name: "tag_expression_label_component_mutation_guard",
	},
	{
		table: "tag_expression_presentation_revision",
		name: "tag_expression_presentation_mutation_guard",
	},
	{ table: "tag_path", name: "tag_path_definition_guard" },
	{ table: "tag_path", name: "tag_path_definition_project" },
	{ table: "tag_path_member", name: "tag_path_member_projection_guard" },
	{ table: "tag_path_merge", name: "tag_path_merge_guard" },
	{ table: "tag_path_sense", name: "tag_path_sense_mutation_guard" },
	{ table: "tag_path_sense_binding", name: "tag_path_sense_binding_mutation_guard" },
	{ table: "tag_path_vote", name: "tag_path_vote_stat_maintain" },
	{ table: "tag_path_vote_stat", name: "tag_path_vote_stat_projection_guard" },
	{ table: "tag_relation", name: "tag_relation_path_lifecycle_guard" },
	{ table: "tag_relation", name: "tag_relation_graph_guard" },
	{ table: "unit", name: "book_chapter_unit_stat_maintain" },
	{ table: "unit_presentation_revision", name: "unit_presentation_revision_immutable" },
	{ table: "unit_content_language_support", name: "unit_content_language_search_maintain" },
	{ table: "unit_license_grant", name: "unit_license_grant_guard_mutation" },
	{ table: "unit_merge_operation", name: "unit_merge_operation_content_label_guard" },
	{ table: "unit_tag", name: "unit_tag_application_policy_guard" },
	{ table: "unit_tag", name: "unit_tag_expression_assertion_maintain" },
	{ table: "unit_tag_judgment", name: "unit_tag_judgment_content_label_reject" },
	{ table: "unit_tag_judgment", name: "unit_tag_judgment_stat_maintain" },
	{
		table: "unit_tag_path_application",
		name: "unit_tag_path_application_expression_maintain",
	},
	{ table: "unit_tag_path_application", name: "unit_tag_path_application_guard" },
	{
		table: "unit_tag_path_application_judgment",
		name: "unit_tag_path_application_judgment_identity_guard",
	},
	{
		table: "unit_tag_path_application_judgment",
		name: "unit_tag_path_application_judgment_stat_maintain",
	},
	{ table: "unit_variant", name: "unit_variant_star_enforce" },
	{ table: "vocabulary_node", name: "vocabulary_node_path_lifecycle_guard" },
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
