import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { getTableName } from "drizzle-orm";
import {
	accessRole,
	accessRoleRevision,
	accessRolePermission,
	accessRoleEvent,
} from "./access-role";

describe("scoped role persistence", () => {
	it("keeps a narrow scoped head and independent immutable definition keys", () => {
		expect(getTableConfig(accessRole).columns.map((column) => column.name)).toEqual([
			"id",
			"scope_id",
			"version",
			"active_revision",
			"state",
		]);
		expect(
			getTableConfig(accessRoleRevision).primaryKeys[0]!.columns.map((column) => column.name),
		).toEqual(["role_id", "revision"]);
		expect(
			getTableConfig(accessRolePermission).primaryKeys[0]!.columns.map((column) => column.name),
		).toEqual(["role_id", "revision", "family", "permission"]);
	});
	it("retains concrete references for scope, snapshots and private operator/subject history", () => {
		expect(
			getTableConfig(accessRole).foreignKeys.map((key) =>
				getTableName(key.reference().foreignTable),
			),
		).toContain("access_scope");
		expect(
			getTableConfig(accessRolePermission)
				.foreignKeys[0]!.reference()
				.foreignColumns.map((column) => column.name),
		).toEqual(["role_id", "revision"]);
		expect(
			getTableConfig(accessRoleEvent).foreignKeys.map((key) =>
				getTableName(key.reference().foreignTable),
			),
		).toEqual(expect.arrayContaining(["access_role", "access_subject", "users"]));
	});
});
