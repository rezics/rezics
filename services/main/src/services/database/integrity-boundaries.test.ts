import { getTableConfig, PgDialect, type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { FractionalPositionStorageMaximumBytes } from "../ordering/contract";
import {
	collectionItem,
	contentStructureNode,
	creditAttribution,
	emailOutbox,
	imageObject,
	moderationAction,
	postProgressEntry,
	postScore,
	profileRealmTagSubscription,
	profileUnitTag,
	realmPin,
	realmUnitTag,
	seriesRelease,
	subjectAssociation,
	unitAlias,
	unitExternalLink,
	unitFollow,
	unitLocalization,
	unitOwnershipClaim,
	unitStructureApplication,
	unitTag,
} from "./schema";

const dialect = new PgDialect();

function renderedCheck(table: PgTable, name: string) {
	const constraint = getTableConfig(table).checks.find((candidate) => candidate.name === name);
	if (!constraint) throw new Error(`Missing database constraint ${name}`);
	return dialect.sqlToQuery(constraint.value);
}

describe("database integrity boundaries", () => {
	it("keeps every indexed fractional position below the PostgreSQL byte ceiling", () => {
		const constraints = [
			[unitLocalization, "unit_localization_position_byte_length_check"],
			[unitAlias, "unit_alias_position_byte_length_check"],
			[unitExternalLink, "unit_external_link_position_byte_length_check"],
			[unitStructureApplication, "unit_structure_application_position_byte_length_check"],
			[realmPin, "realm_pin_position_byte_length_check"],
			[unitFollow, "unit_follow_position_byte_length_check"],
			[contentStructureNode, "content_structure_node_position_byte_length_check"],
			[unitTag, "unit_tag_position_byte_length_check"],
			[
				profileRealmTagSubscription,
				"profile_realm_tag_subscription_position_byte_length_check",
			],
			[realmUnitTag, "realm_unit_tag_position_byte_length_check"],
			[profileUnitTag, "profile_unit_tag_position_byte_length_check"],
			[postProgressEntry, "post_progress_entry_position_byte_length_check"],
			[seriesRelease, "series_release_position_byte_length_check"],
			[collectionItem, "collection_item_position_byte_length_check"],
			[postScore, "post_score_position_byte_length_check"],
			[creditAttribution, "credit_attribution_position_byte_length_check"],
			[subjectAssociation, "subject_association_position_byte_length_check"],
		] as const;

		expect(constraints).toHaveLength(17);
		for (const [table, name] of constraints) {
			const rendered = renderedCheck(table, name);
			expect(rendered.sql).toMatch(/^octet_length\(.+\."position"\) <= \$1$/);
			expect(rendered.params).toEqual([FractionalPositionStorageMaximumBytes]);
		}
	});

	it.each([
		[
			imageObject,
			"image_object_metadata_shape_check",
			'"image_object"."media_type" is not null',
		],
		[
			contentStructureNode,
			"content_structure_node_target_shape_check",
			'"content_structure_node"."target_url" is not null',
		],
		[emailOutbox, "email_outbox_intent_check", '"email_outbox"."locale" is not null'],
		[
			moderationAction,
			"moderation_action_content_license_transition_check",
			'"moderation_action"."previous_content_license_status" is not null',
		],
		[
			unitOwnershipClaim,
			"unit_ownership_claim_resolution_shape_check",
			'"unit_ownership_claim"."resolution" is not null',
		],
		[
			unitLocalization,
			"unit_localization_avatar_value_check",
			'"unit_localization"."avatar_icon_prefix" is not null',
		],
	] as const)("closes SQL NULL pass-through in %s", (table, name, requiredClause) => {
		const rendered = renderedCheck(table, name).sql.toLowerCase().replaceAll(/\s+/g, " ");
		expect(rendered).toContain(requiredClause);
	});
});
