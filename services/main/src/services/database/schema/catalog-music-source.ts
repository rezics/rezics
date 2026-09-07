import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { musicComponentRevision, musicComponentSourceOccurrence } from "./catalog-music";
import { catalogSourceApplication } from "./catalog-source-application";
import { catalogSourceMappingClaim } from "./catalog-source";

/** Current source support frontier; immutable source occurrences and applications remain its proof. */
export const musicComponentSourceBaseline = pgTable(
	"music_component_source_baseline",
	{
		sourceRecordId: uuid().notNull(),
		mappingKey: uuid().notNull(),
		ownerId: uuid().notNull(),
		component: text().notNull(),
		componentKey: text().notNull(),
		snapshotId: uuid().notNull(),
		sourcePath: text().notNull(),
		sourceHistoryId: uuid().notNull(),
		currentHistoryId: uuid().notNull(),
		absent: boolean().notNull(),
		proposalId: uuid().notNull(),
		action: text().$type<"apply" | "withdraw">().notNull(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.sourceRecordId,
				table.mappingKey,
				table.ownerId,
				table.component,
				table.componentKey,
			],
		}),
		foreignKey({
			name: "music_source_baseline_mapping_fk",
			columns: [table.sourceRecordId, table.mappingKey],
			foreignColumns: [
				catalogSourceMappingClaim.sourceRecordId,
				catalogSourceMappingClaim.mappingKey,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_source_baseline_occurrence_fk",
			columns: [
				table.sourceRecordId,
				table.snapshotId,
				table.ownerId,
				table.component,
				table.sourcePath,
			],
			foreignColumns: [
				musicComponentSourceOccurrence.sourceRecordId,
				musicComponentSourceOccurrence.snapshotId,
				musicComponentSourceOccurrence.ownerId,
				musicComponentSourceOccurrence.component,
				musicComponentSourceOccurrence.sourcePath,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_source_baseline_original_fk",
			columns: [table.ownerId, table.sourceHistoryId],
			foreignColumns: [musicComponentRevision.ownerId, musicComponentRevision.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_source_baseline_current_fk",
			columns: [table.ownerId, table.currentHistoryId],
			foreignColumns: [musicComponentRevision.ownerId, musicComponentRevision.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_source_baseline_application_fk",
			columns: [table.sourceRecordId, table.proposalId, table.action],
			foreignColumns: [
				catalogSourceApplication.sourceRecordId,
				catalogSourceApplication.proposalId,
				catalogSourceApplication.action,
			],
		}).onDelete("restrict"),
		index("music_source_baseline_current_idx").on(table.ownerId, table.currentHistoryId),
		check("music_source_baseline_action_check", sql`${table.action} in ('apply','withdraw')`),
	],
);
