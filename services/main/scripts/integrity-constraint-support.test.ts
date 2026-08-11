import { describe, expect, it } from "vitest";

import {
	IntegrityConstraints,
	parseIntegrityConstraintCommand,
} from "./integrity-constraint-support";

describe("integrity constraint operations", () => {
	it("owns a unique allowlist for every staged constraint", () => {
		expect(IntegrityConstraints).toHaveLength(25);
		expect(new Set(IntegrityConstraints.map(({ name }) => name)).size).toBe(
			IntegrityConstraints.length,
		);
		for (const { table, name } of IntegrityConstraints) {
			expect(table).toMatch(/^[a-z][a-z0-9_]{0,62}$/);
			expect(name).toMatch(/^[a-z][a-z0-9_]{0,62}$/);
		}
	});

	it("requires one exact allowlisted name for production validation", () => {
		expect(parseIntegrityConstraintCommand([])).toEqual({ action: "status" });
		expect(
			parseIntegrityConstraintCommand(["validate", "image_object_metadata_shape_check"]),
		).toEqual({ action: "validate", constraint: IntegrityConstraints[0] });
		expect(() => parseIntegrityConstraintCommand(["validate"])).toThrow(/requires one/);
		expect(() => parseIntegrityConstraintCommand(["validate", "anything"])).toThrow(/Unknown/);
	});

	it("keeps bulk validation behind its disposable-database command", () => {
		expect(parseIntegrityConstraintCommand(["validate-disposable"])).toEqual({
			action: "validate-disposable",
		});
		expect(() =>
			parseIntegrityConstraintCommand(["validate-disposable", "image_object_metadata_shape_check"]),
		).toThrow(/does not accept/);
	});
});
