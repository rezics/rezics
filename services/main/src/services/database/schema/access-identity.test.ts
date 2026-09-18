import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { accessScope, accessSubject } from "@rezics/schema/postgres/access/access-identity";

describe("mixed access identity storage", () => {
	it("uses concrete principal/Entity keys without admitting groups as callers", () => {
		const config = getTableConfig(accessSubject);
		expect(config.columns.map((column) => column.name)).toEqual([
			"id",
			"auth_user_id",
			"entity_id",
		]);
		expect(
			config.foreignKeys.map((key) => getTableName(key.reference().foreignTable)).sort(),
		).toEqual(["entity_identity", "users"]);
		expect(config.foreignKeys.every((key) => key.onDelete === "restrict")).toBe(true);
		expect(
			config.indexes.filter((index) => index.config.unique && index.config.where),
		).toHaveLength(2);
		expect(config.checks).toHaveLength(1);
	});
	it("uses one canonical public resource value, distinct from private account and platform scopes", () => {
		const config = getTableConfig(accessScope);
		expect(config.columns.map((column) => column.name)).toEqual([
			"id",
			"platform_root",
			"auth_user_id",
			"unit_ref",
		]);
		expect(
			config.foreignKeys.map((key) => getTableName(key.reference().foreignTable)).sort(),
		).toEqual(["reference_value", "users"]);
		expect(config.foreignKeys.every((key) => key.onDelete === "restrict")).toBe(true);
		expect(
			config.indexes.filter((index) => index.config.unique && index.config.where),
		).toHaveLength(3);
		expect(config.checks).toHaveLength(2);
	});
});
