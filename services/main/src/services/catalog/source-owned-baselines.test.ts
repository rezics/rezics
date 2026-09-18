import { describe, expect, it } from "vitest";
import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import {
	CatalogSourceOwnedBaselines,
	softwareSourceComponentBaseline,
	softwareSourceContextBaseline,
	softwareSourceParticipationBaseline,
	softwareSourceRecordBaseline,
} from "@rezics/schema/postgres/ingestion/source-owned-baseline";
import {
	CatalogSourceOwnedApplicationTables,
	softwareSourceContextApplicationChange,
	softwareSourceParticipationApplicationChange,
} from "@rezics/schema/postgres/ingestion/source-application";
import {
	softwareComponentSourceOccurrence,
	softwareRecordSourceOccurrence,
} from "@rezics/schema/postgres/software/software-source";
import {
	softwareParticipation,
	softwareParticipationRevision,
	softwareParticipationCreditSourceOccurrence,
} from "@rezics/schema/postgres/software/software-participation";
import { CatalogNameTables } from "@rezics/schema/postgres/knowledge/names";
import {
	catalogSourceBindingRevision,
	catalogSourceMappingClaim,
} from "@rezics/schema/postgres/ingestion/source";
import { softwareParticipationSourceOccurrence } from "@rezics/schema/postgres/software/software";

const tables: AnyPgTable[] = [
	catalogSourceBindingRevision,
	catalogSourceMappingClaim,
	softwareParticipationSourceOccurrence,
	...Object.values(CatalogNameTables).flatMap((value) => [
		value.sourceBinding,
		value.sourceOccurrence,
	]),
	...Object.values(CatalogSourceOwnedBaselines),
	softwareSourceComponentBaseline,
	softwareSourceContextBaseline,
	softwareSourceParticipationBaseline,
	softwareSourceRecordBaseline,
	...Object.values(CatalogSourceOwnedApplicationTables).flatMap((value) => Object.values(value)),
	softwareSourceContextApplicationChange,
	softwareSourceParticipationApplicationChange,
	softwareComponentSourceOccurrence,
	softwareRecordSourceOccurrence,
	softwareParticipation,
	softwareParticipationRevision,
	softwareParticipationCreditSourceOccurrence,
];

describe("exact source/native schema reference keys", () => {
	it("targets a complete declared primary or unique key for every compound foreign key", () => {
		let checked = 0;
		for (const table of tables) {
			const config = getTableConfig(table);
			for (const key of config.foreignKeys) {
				const reference = key.reference();
				const target = getTableConfig(reference.foreignTable);
				const keys = [
					...target.primaryKeys.map((value) => value.columns),
					...target.uniqueConstraints.map((value) => value.columns),
					...target.columns
						.filter((column) => column.primary || column.isUnique)
						.map((column) => [column]),
				];
				const wanted = reference.foreignColumns
					.map((column) => column.name)
					.sort()
					.join(",");
				expect(
					keys.some(
						(columns) =>
							columns
								.map((column) => column.name)
								.sort()
								.join(",") === wanted,
					),
					`${config.name}.${key.getName()} -> ${target.name}(${wanted})`,
				).toBe(true);
				checked++;
			}
		}
		expect(checked).toBeGreaterThan(150);
	});
	it("pins every numeric baseline to an immutable root correspondence epoch", () => {
		for (const table of [
			...Object.values(CatalogSourceOwnedBaselines),
			softwareSourceComponentBaseline,
			softwareSourceContextBaseline,
			softwareSourceParticipationBaseline,
			softwareSourceRecordBaseline,
		]) {
			const config = getTableConfig(table);
			const mapping = config.foreignKeys.find(
				(key) =>
					getTableConfig(key.reference().foreignTable).name === "catalog_source_binding_revision",
			);
			expect(mapping?.reference().foreignColumns.map((column) => column.name)).toEqual([
				"source_record_id",
				"mapping_key",
				"revision",
			]);
			expect(mapping?.reference().columns.map((column) => column.name)).toEqual([
				"source_record_id",
				"mapping_key",
				"correspondence_revision",
			]);
		}
	});
});
