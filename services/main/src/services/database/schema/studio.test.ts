import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	profileResourceParticipation,
	studioAuthEditorCandidate,
	studioRealmEditorCandidate,
	studioResourceVisit,
	referenceValue,
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

	it("stores private visits with one restrictive canonical reference", () => {
		const config = getTableConfig(studioResourceVisit);
		expect(config.columns.map((column) => column.name).sort()).toEqual([
			"auth_user_id",
			"last_visited_at",
			"target_reference_id",
		]);
		expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
			"auth_user_id",
			"target_reference_id",
		]);
		expect(config.foreignKeys).toHaveLength(2);
		expect(
			config.foreignKeys.find((key) => key.reference().foreignTable === referenceValue)?.onDelete,
		).toBe("restrict");
		expect(config.indexes).toHaveLength(2);
	});

	it("indexes only current explicit editor candidates under Studio", () => {
		const profileCandidate = getTableConfig(studioAuthEditorCandidate);
		const realmCandidate = getTableConfig(studioRealmEditorCandidate);
		expect(profileCandidate.primaryKeys[0]?.columns.map(({ name }) => name)).toEqual([
			"auth_user_id",
			"unit_id",
		]);
		expect(realmCandidate.primaryKeys[0]?.columns.map(({ name }) => name)).toEqual([
			"realm_id",
			"realm_relation",
			"unit_id",
		]);
		expect(profileCandidate.indexes.map(({ config }) => config.name)).toContain(
			"studio_auth_editor_candidate_expiry_idx",
		);
		expect(realmCandidate.indexes.map(({ config }) => config.name)).toContain(
			"studio_realm_editor_candidate_expiry_idx",
		);
	});
});
