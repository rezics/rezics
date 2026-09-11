import { describe, expect, it } from "vitest";

import { databaseConstraintName, databaseErrorMatches, databaseSqlState } from "./constraint";

describe("database error identity", () => {
	it("ignores domain codes and keeps looking for a SQLSTATE cause", () => {
		expect(databaseSqlState({ code: "binding_changed" })).toBeUndefined();
		expect(databaseSqlState({ code: "CatalogRevisionConflict", cause: { code: "40001" } })).toBe(
			"40001",
		);
		expect(databaseSqlState({ code: "23514suffix" })).toBeUndefined();
		expect(databaseSqlState({ code: "55p03" })).toBeUndefined();
	});

	it("reads PostgreSQL identity through a cause chain", () => {
		const postgresError = {
			code: "55P03",
			constraint: "vote_hot_key_busy",
		};
		const wrapped = new Error("wrapped", { cause: postgresError });

		expect(databaseSqlState(wrapped)).toBe("55P03");
		expect(databaseConstraintName(wrapped)).toBe("vote_hot_key_busy");
		expect(
			databaseErrorMatches(wrapped, {
				code: "55P03",
				constraint: "vote_hot_key_busy",
			}),
		).toBe(true);
	});

	it("requires the SQLSTATE and constraint on the same database error", () => {
		const splitIdentity = {
			code: "55P03",
			cause: { constraint: "vote_hot_key_busy" },
		};

		expect(
			databaseErrorMatches(splitIdentity, {
				code: "55P03",
				constraint: "vote_hot_key_busy",
			}),
		).toBe(false);
		expect(
			databaseErrorMatches(
				{ code: "23505", constraint: "vote_hot_key_busy" },
				{ code: "55P03", constraint: "vote_hot_key_busy" },
			),
		).toBe(false);
		expect(
			databaseErrorMatches(
				{ code: "55P03", constraint: "other_constraint" },
				{ code: "55P03", constraint: "vote_hot_key_busy" },
			),
		).toBe(false);
	});

	it("stops safely at cause cycles and inaccessible properties", () => {
		const cyclic: { cause?: unknown } = {};
		cyclic.cause = cyclic;
		const inaccessible = new Proxy(cyclic, {
			get() {
				throw new Error("inaccessible");
			},
		});

		expect(databaseSqlState(cyclic)).toBeUndefined();
		expect(databaseConstraintName(inaccessible)).toBeUndefined();
		expect(
			databaseErrorMatches(inaccessible, {
				code: "55P03",
				constraint: "vote_hot_key_busy",
			}),
		).toBe(false);
	});
});
