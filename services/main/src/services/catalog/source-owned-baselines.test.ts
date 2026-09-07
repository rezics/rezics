import { describe, expect, it } from "vitest";
import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import {
	CatalogSourceOwnedBaselines,
	softwareSourceComponentBaseline,
	softwareSourceContextBaseline,
	softwareSourceParticipationBaseline,
	softwareSourceRecordBaseline,
} from "../database/schema/catalog-source-owned-baseline";
import {
	CatalogSourceOwnedApplicationTables,
	softwareSourceContextApplicationChange,
	softwareSourceParticipationApplicationChange,
} from "../database/schema/catalog-source-application";
import {
	softwareComponentSourceOccurrence,
	softwareRecordSourceOccurrence,
} from "../database/schema/catalog-software-source";
import {
	softwareParticipation,
	softwareParticipationRevision,
	softwareParticipationCreditSourceOccurrence,
} from "../database/schema/catalog-software-participation";
import { CatalogNameTables } from "../database/schema/catalog-names";
import {
	catalogSourceBindingRevision,
	catalogSourceMappingClaim,
} from "../database/schema/catalog-source";
import { softwareParticipationSourceOccurrence } from "../database/schema/catalog-software";

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
	it("retains the concrete mapping owner in every numeric baseline foreign key", () => {
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
					getTableConfig(key.reference().foreignTable).name === "catalog_source_mapping_claim",
			);
			expect(mapping?.reference().foreignColumns.map((column) => column.name)).toEqual([
				"source_record_id",
				"mapping_key",
				"owner",
			]);
			expect(mapping?.reference().columns.map((column) => column.name)).toEqual([
				"source_record_id",
				"mapping_key",
				"mapping_owner",
			]);
		}
	});
});
