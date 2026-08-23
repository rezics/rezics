import { readFile } from "node:fs/promises";

import { is } from "drizzle-orm";
import { getViewConfig, PgColumn } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	currentTagPrimaryDisplayPath,
	currentUnitEffectiveTag,
	currentUnitEffectiveTagVote,
	currentUnitStructureEdge,
	currentUnitStructureEnd,
	currentUnitStructureMember,
	currentUnitStructurePrimaryPathCandidate,
	currentUnitTagJudgmentStat,
	currentUnitTagStructureSupport,
} from "../src/services/database/schema/structure-correction";
import {
	PostgreSqlSchemaFileNames,
	PostgreSqlSchemaViews,
} from "../src/services/database/schema/postgres/manifest";
import {
	assertCanonicalPostgreSqlViewDeclarations,
	assertPostgreSqlViewDefinitionsEqual,
	assertPostgreSqlViewManifest,
	decodePostgreSqlViewSnapshots,
	type PostgreSqlViewSnapshot,
} from "./postgres-schema-view-contract";

function snapshot(overrides: Partial<PostgreSqlViewSnapshot> = {}): PostgreSqlViewSnapshot {
	return {
		key: "current_example",
		relationKind: "v",
		relOptions: ["security_barrier=true"],
		columns: [{ name: "id", dataType: "uuid" }],
		definition: "SELECT id FROM example;",
		...overrides,
	};
}

const ExampleManifest = [
	{
		name: "current_example",
		relOptions: ["security_barrier=true"],
		columns: [{ name: "id", dataType: "uuid" }],
	},
] as const;

const TypedCurrentViews = [
	currentUnitStructureMember,
	currentUnitStructureEdge,
	currentUnitStructureEnd,
	currentUnitStructurePrimaryPathCandidate,
	currentUnitTagStructureSupport,
	currentUnitEffectiveTag,
	currentUnitEffectiveTagVote,
	currentUnitTagJudgmentStat,
	currentTagPrimaryDisplayPath,
] as const;

function toCatalogDataType(sqlType: string): string {
	return sqlType.replace(/^timestamp \(/u, "timestamp(");
}

describe("canonical PostgreSQL current Structure view contract", () => {
	it("manifests every typed current view with its exact ordered column signature", () => {
		const typedViews = TypedCurrentViews.map((view) => {
			const config = getViewConfig(view);
			return {
				name: config.name,
				columns: Object.values(config.selectedFields).map((field) => {
					if (!is(field, PgColumn))
						throw new TypeError(`View ${config.name} contains a non-column field`);
					return {
						name: field.name,
						dataType: toCatalogDataType(field.getSQLType()),
					};
				}),
			};
		}).sort((left, right) => left.name.localeCompare(right.name));
		const manifestViews = PostgreSqlSchemaViews.map(({ name, columns, relOptions }) => ({
			name,
			columns,
			relOptions,
		})).sort((left, right) => left.name.localeCompare(right.name));

		expect(manifestViews.map(({ name, columns }) => ({ name, columns }))).toEqual(typedViews);
		expect(manifestViews).toHaveLength(9);
		for (const { relOptions } of manifestViews)
			expect(relOptions).toEqual(["security_barrier=true"]);
	});

	it("requires one canonical CREATE OR REPLACE declaration for every current view", async () => {
		const definitions = await Promise.all(
			PostgreSqlSchemaFileNames.map((fileName) =>
				readFile(
					new URL(`../src/services/database/schema/postgres/${fileName}`, import.meta.url),
					"utf8",
				),
			),
		);
		expect(() =>
			assertCanonicalPostgreSqlViewDeclarations(definitions, PostgreSqlSchemaViews),
		).not.toThrow();
	});

	it("rejects missing, unexpected, non-view, option, and column drift", () => {
		expect(() => assertPostgreSqlViewManifest([], ExampleManifest)).toThrow(/Missing/);
		expect(() =>
			assertPostgreSqlViewManifest(
				[snapshot(), snapshot({ key: "current_unexpected" })],
				ExampleManifest,
			),
		).toThrow(/Unexpected/);
		expect(() =>
			assertPostgreSqlViewManifest([snapshot({ relationKind: "m" })], ExampleManifest),
		).toThrow(/not an ordinary view/);
		expect(() =>
			assertPostgreSqlViewManifest([snapshot({ relOptions: [] })], ExampleManifest),
		).toThrow(/options diverge/);
		expect(() =>
			assertPostgreSqlViewManifest(
				[snapshot({ columns: [{ name: "id", dataType: "text" }] })],
				ExampleManifest,
			),
		).toThrow(/column signature diverges/);
	});

	it("rejects canonical definition drift after replay", () => {
		expect(() =>
			assertPostgreSqlViewDefinitionsEqual(
				[snapshot()],
				[snapshot({ definition: "SELECT other_id AS id FROM example;" })],
			),
		).toThrow(/diverges from canonical PostgreSQL view/);
	});

	it("fails closed on malformed PostgreSQL catalog values", () => {
		expect(() =>
			decodePostgreSqlViewSnapshots([
				{
					key: "current_example",
					relationKind: "v",
					relOptions: ["security_barrier=true"],
					columns: [{ name: "id", dataType: 1 }],
					definition: "SELECT id FROM example;",
				},
			]),
		).toThrow(/dataType must be a string/);
	});
});
