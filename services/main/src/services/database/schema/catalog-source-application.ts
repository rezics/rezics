import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, integer, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn } from "./columns";
import { catalogSourceAdoptionProposal, catalogSourceSnapshot } from "./catalog-source";
import { musicComponentRevision } from "./catalog-music";
import { softwareComponentRevision, softwareRecordRevision } from "./catalog-software";

/** Immutable native application evidence, separate from both source bytes and current native authority. */
export const catalogSourceApplication = pgTable(
	"catalog_source_application",
	{
		sourceRecordId: uuid().notNull(),
		proposalId: uuid().notNull(),
		action: text().$type<"apply" | "withdraw">().notNull(),
		previousSnapshotId: uuid(),
		beforeRevision: bigint({ mode: "number" }).notNull(),
		afterRevision: bigint({ mode: "number" }).notNull(),
		changeCount: integer().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.proposalId, t.action] }),
		foreignKey({
			columns: [t.sourceRecordId, t.proposalId],
			foreignColumns: [
				catalogSourceAdoptionProposal.sourceRecordId,
				catalogSourceAdoptionProposal.id,
			],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.sourceRecordId, t.previousSnapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		check(
			"catalog_source_application_values",
			sql`${t.action} in ('apply','withdraw') and ${t.beforeRevision} >= 1 and ${t.afterRevision} > ${t.beforeRevision} and ${t.afterRevision} <= 9007199254740991 and ${t.changeCount} between 0 and 128`,
		),
	],
);

function applicationColumns() {
	return {
		sourceRecordId: uuid().notNull(),
		proposalId: uuid().notNull(),
		action: text().$type<"apply" | "withdraw">().notNull(),
		position: integer().notNull(),
		ownerId: uuid().notNull(),
	};
}

/** Exact music history foreign keys remain valid after component removal or source rebinding. */
export const musicSourceApplicationChange = pgTable(
	"music_source_application_change",
	{
		...applicationColumns(),
		component: text().notNull(),
		componentKey: text().notNull(),
		beforeRevisionId: uuid(),
		afterRevisionId: uuid().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.proposalId, t.action, t.position] }),
		foreignKey({
			columns: [t.sourceRecordId, t.proposalId, t.action],
			foreignColumns: [
				catalogSourceApplication.sourceRecordId,
				catalogSourceApplication.proposalId,
				catalogSourceApplication.action,
			],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.ownerId, t.beforeRevisionId],
			foreignColumns: [musicComponentRevision.ownerId, musicComponentRevision.id],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.ownerId, t.afterRevisionId],
			foreignColumns: [musicComponentRevision.ownerId, musicComponentRevision.id],
		}).onDelete("restrict"),
		check(
			"music_source_application_values",
			sql`${t.position} between 0 and 127 and octet_length(${t.component}) between 1 and 96 and octet_length(${t.componentKey}) between 1 and 512 and (${t.beforeRevisionId} is null or ${t.beforeRevisionId} <> ${t.afterRevisionId})`,
		),
	],
);

export const softwareSourceComponentApplicationChange = pgTable(
	"software_source_component_application_change",
	{
		...applicationColumns(),
		component: text().$type<typeof softwareComponentRevision.$inferSelect.kind>().notNull(),
		componentKey: text().notNull(),
		beforeRevision: bigint({ mode: "number" }),
		afterRevision: bigint({ mode: "number" }).notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.proposalId, t.action, t.position] }),
		foreignKey({
			columns: [t.sourceRecordId, t.proposalId, t.action],
			foreignColumns: [
				catalogSourceApplication.sourceRecordId,
				catalogSourceApplication.proposalId,
				catalogSourceApplication.action,
			],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.ownerId, t.component, t.componentKey, t.beforeRevision],
			foreignColumns: [
				softwareComponentRevision.releaseId,
				softwareComponentRevision.kind,
				softwareComponentRevision.componentId,
				softwareComponentRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.ownerId, t.component, t.componentKey, t.afterRevision],
			foreignColumns: [
				softwareComponentRevision.releaseId,
				softwareComponentRevision.kind,
				softwareComponentRevision.componentId,
				softwareComponentRevision.revision,
			],
		}).onDelete("restrict"),
		check(
			"software_source_component_application_values",
			sql`${t.position} between 0 and 127 and (${t.beforeRevision} is null or ${t.beforeRevision} < ${t.afterRevision})`,
		),
	],
);

export const softwareSourceRecordApplicationChange = pgTable(
	"software_source_record_application_change",
	{
		...applicationColumns(),
		beforeRevision: bigint({ mode: "number" }),
		afterRevision: bigint({ mode: "number" }).notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.proposalId, t.action, t.position] }),
		foreignKey({
			columns: [t.sourceRecordId, t.proposalId, t.action],
			foreignColumns: [
				catalogSourceApplication.sourceRecordId,
				catalogSourceApplication.proposalId,
				catalogSourceApplication.action,
			],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.ownerId, t.beforeRevision],
			foreignColumns: [softwareRecordRevision.ownerId, softwareRecordRevision.revision],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.ownerId, t.afterRevision],
			foreignColumns: [softwareRecordRevision.ownerId, softwareRecordRevision.revision],
		}).onDelete("restrict"),
		check(
			"software_source_record_application_values",
			sql`${t.position} between 0 and 127 and (${t.beforeRevision} is null or ${t.beforeRevision} < ${t.afterRevision})`,
		),
	],
);
