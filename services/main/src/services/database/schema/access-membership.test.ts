import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { getTableName } from "drizzle-orm";
import {
	accessMembership,
	accessMembershipAdmission,
	accessMembershipEvent,
} from "./access-membership";

describe("shared typed membership storage", () => {
	it("keeps one scope/subject identity with a distinct selected admission generation", () => {
		const config = getTableConfig(accessMembership);
		expect(config.columns.map((column) => column.name)).toEqual([
			"id",
			"scope_id",
			"subject_id",
			"version",
			"last_generation",
			"active_generation",
		]);
		expect(config.foreignKeys.map((key) => getTableName(key.reference().foreignTable))).toEqual(
			expect.arrayContaining(["access_scope", "access_subject", "access_membership_admission"]),
		);
	});
	it("uses complete immutable admission keys and private transition evidence", () => {
		expect(
			getTableConfig(accessMembershipAdmission).primaryKeys[0]!.columns.map(
				(column) => column.name,
			),
		).toEqual(["membership_id", "generation"]);
		expect(
			getTableConfig(accessMembershipEvent).foreignKeys.map((key) =>
				getTableName(key.reference().foreignTable),
			),
		).toEqual(expect.arrayContaining(["access_membership", "users", "access_subject"]));
	});
});
