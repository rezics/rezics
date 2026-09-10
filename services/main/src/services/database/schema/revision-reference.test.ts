import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { CatalogOwnerValues } from "@rezics/reference";
import { CatalogNameTables } from "./catalog-names";
import { revisionReference } from "./revision-reference";
import { CatalogRevisionReferenceSchema } from "../../units/revision-reference-contract";

describe("exact catalog revision reference values", () => {
	it("references complete owner-local revision keys without an independently writable parent value", () => {
		const config = getTableConfig(revisionReference);
		expect(config.columns).toHaveLength(1 + CatalogOwnerValues.length * 2 * 3);
		expect(config.foreignKeys).toHaveLength(CatalogOwnerValues.length * 2);
		for (const owner of CatalogOwnerValues) {
			for (const target of [
				CatalogNameTables[owner].nameRevision,
				CatalogNameTables[owner].identifierRevision,
			]) {
				const key = config.foreignKeys.find((key) => key.reference().foreignTable === target);
				expect(key?.reference().foreignColumns).toEqual([
					target.ownerId,
					target.id,
					target.revision,
				]);
				expect(key?.reference().columns).toHaveLength(3);
				expect(key?.onDelete).toBe("restrict");
			}
		}
		expect(config.indexes).toHaveLength(CatalogOwnerValues.length * 2);
		expect(
			config.indexes.every(
				(index) => index.config.unique && index.config.where && index.config.columns.length === 3,
			),
		).toBe(true);
		expect(
			config.foreignKeys.map((key) => getTableName(key.reference().foreignTable)),
		).not.toContain("reference_value");
	});
	it("requires an exact, safe owner-local revision and rejects ambiguous input", () => {
		const input = {
			owner: "publishing",
			kind: "named_form",
			ownerId: "019b0000-0000-7000-8000-000000000001",
			itemId: "019b0000-0000-7000-8000-000000000002",
			revision: 1,
		};
		expect(CatalogRevisionReferenceSchema.parse(input)).toEqual(input);
		for (const revision of [undefined, null, 0, -1, 1.5, "1", Number.MAX_SAFE_INTEGER + 1])
			expect(CatalogRevisionReferenceSchema.safeParse({ ...input, revision }).success).toBe(false);
		expect(
			CatalogRevisionReferenceSchema.safeParse({ ...input, parentReferenceId: input.ownerId })
				.success,
		).toBe(false);
		expect(CatalogRevisionReferenceSchema.safeParse({ ...input, owner: "post" }).success).toBe(
			false,
		);
		expect(CatalogRevisionReferenceSchema.safeParse({ ...input, kind: "current" }).success).toBe(
			false,
		);
	});
});
