export const IntegrityConstraints = [
	{ table: "image_object", name: "image_object_metadata_shape_check" },
	{
		table: "content_structure_node",
		name: "content_structure_node_target_shape_check",
	},
	{ table: "email_outbox", name: "email_outbox_intent_check" },
	{
		table: "content_governance_action",
		name: "content_governance_action_license_grant_transition_check",
	},
	{
		table: "unit_ownership_claim",
		name: "unit_ownership_claim_resolution_shape_check",
	},
	{ table: "unit_localization", name: "unit_localization_avatar_value_check" },
	{ table: "unit_localization", name: "unit_localization_position_byte_length_check" },
	{ table: "unit_alias", name: "unit_alias_position_byte_length_check" },
	{ table: "unit_external_link", name: "unit_external_link_position_byte_length_check" },
	{ table: "unit_tag_path", name: "unit_tag_path_position_byte_length_check" },
	{ table: "realm_pin", name: "realm_pin_position_byte_length_check" },
	{ table: "unit_follow", name: "unit_follow_position_byte_length_check" },
	{
		table: "content_structure_node",
		name: "content_structure_node_position_byte_length_check",
	},
	{ table: "unit_tag", name: "unit_tag_position_byte_length_check" },
	{
		table: "profile_realm_tag_subscription",
		name: "profile_realm_tag_subscription_position_byte_length_check",
	},
	{ table: "realm_unit_tag", name: "realm_unit_tag_position_byte_length_check" },
	{ table: "profile_unit_tag", name: "profile_unit_tag_position_byte_length_check" },
	{
		table: "post_progress_entry",
		name: "post_progress_entry_position_byte_length_check",
	},
	{ table: "series_release", name: "series_release_position_byte_length_check" },
	{ table: "collection_item", name: "collection_item_position_byte_length_check" },
	{ table: "post_score", name: "post_score_position_byte_length_check" },
	{ table: "credit_attribution", name: "credit_attribution_position_byte_length_check" },
	{ table: "subject_association", name: "subject_association_position_byte_length_check" },
	{
		table: "notification_recipient_stat",
		name: "notification_recipient_stat_read_through_shape_check",
	},
	{
		table: "notification_recipient_stat",
		name: "notification_recipient_stat_read_through_time_check",
	},
] as const;

export type IntegrityConstraint = (typeof IntegrityConstraints)[number];
export type IntegrityConstraintName = IntegrityConstraint["name"];

export type IntegrityConstraintCommand =
	| { readonly action: "status"; readonly constraint?: IntegrityConstraint }
	| { readonly action: "validate"; readonly constraint: IntegrityConstraint }
	| { readonly action: "validate-disposable" };

const constraintByName = new Map(
	IntegrityConstraints.map((constraint) => [constraint.name, constraint] as const),
);

export function parseIntegrityConstraintCommand(
	arguments_: readonly string[],
): IntegrityConstraintCommand {
	const [action = "status", name, ...extra] = arguments_;
	if (extra.length) throw new TypeError("Integrity constraint command received extra arguments");
	if (action === "validate-disposable") {
		if (name) throw new TypeError("validate-disposable does not accept a constraint name");
		return { action };
	}
	if (action !== "status" && action !== "validate")
		throw new TypeError("Expected status, validate, or validate-disposable");
	if (!name) {
		if (action === "validate")
			throw new TypeError("validate requires one allowlisted constraint name");
		return { action };
	}
	const constraint = constraintByName.get(name as IntegrityConstraintName);
	if (!constraint) throw new TypeError(`Unknown integrity constraint: ${name}`);
	return { action, constraint };
}
