import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	profileResourceParticipation,
	studioProfileEditorCandidate,
	studioRealmEditorCandidate,
} from "./index";

describe("Studio workspace and contribution projections", () => {
	it("keeps historical participation outside the Studio schema", () => {
		const participation = getTableConfig(profileResourceParticipation);
		expect(getTableName(profileResourceParticipation)).toBe("profile_resource_participation");
		expect(participation.primaryKeys[0]?.columns.map(({ name }) => name)).toEqual([
			"profile_id",
			"resource_unit_id",
		]);
		expect(participation.indexes.map(({ config }) => config.name)).toEqual(
			expect.arrayContaining([
				"profile_resource_participation_profile_recent_idx",
				"profile_resource_participation_profile_created_idx",
				"profile_resource_participation_profile_contributed_idx",
			]),
		);
	});

	it("indexes only current explicit editor candidates under Studio", () => {
		const profileCandidate = getTableConfig(studioProfileEditorCandidate);
		const realmCandidate = getTableConfig(studioRealmEditorCandidate);
		expect(profileCandidate.primaryKeys[0]?.columns.map(({ name }) => name)).toEqual([
			"profile_id",
			"unit_id",
		]);
		expect(realmCandidate.primaryKeys[0]?.columns.map(({ name }) => name)).toEqual([
			"realm_id",
			"realm_relation",
			"unit_id",
		]);
		expect(profileCandidate.indexes.map(({ config }) => config.name)).toContain(
			"studio_profile_editor_candidate_expiry_idx",
		);
		expect(realmCandidate.indexes.map(({ config }) => config.name)).toContain(
			"studio_realm_editor_candidate_expiry_idx",
		);
	});
});
