import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	primaryKey,
	text,
	uuid,
	type PgTableExtraConfigValue,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { users } from "../identity/auth";
import { createCreatedAtColumn } from "../shared/columns";
import { catalogDefinitionRevision, entityIdentity } from "../catalog/identity";
import { CatalogNameTables } from "../knowledge/names";
import { catalogSourceSnapshot, catalogSourceBindingRevision } from "../ingestion/source";
import { softwareContent, softwareParticipationContextRevision } from "./software";

/** Content-local participation is a credited role, not a software version or release. */
export const softwareParticipation = pgTable(
	"software_participation",
	{
		contentId: uuid()
			.notNull()
			.references(() => softwareContent.id, { onDelete: "restrict" }),
		id: uuid().notNull().default(sql`uuidv7()`),
		currentRevision: bigint({ mode: "number" }),
	},
	(t): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [t.contentId, t.id] }),
		foreignKey({
			name: "software_participation_head_fk",
			columns: [t.contentId, t.id, t.currentRevision],
			foreignColumns: [
				softwareParticipationRevision.contentId,
				softwareParticipationRevision.participationId,
				softwareParticipationRevision.revision,
			],
		}).onDelete("restrict"),
		check(
			"software_participation_head_check",
			sql`${t.currentRevision} is null or ${t.currentRevision} between 1 and 9007199254740991`,
		),
	],
);

/** Complete immutable role values bind the exact credited name and optional context revision. */
export const softwareParticipationRevision = pgTable(
	"software_participation_revision",
	{
		contentId: uuid().notNull(),
		participationId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		entityId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		nameId: uuid(),
		nameRevision: bigint({ mode: "number" }),
		contextId: uuid(),
		contextRevision: bigint({ mode: "number" }),
		characterId: uuid().references(() => entityIdentity.id, { onDelete: "restrict" }),
		roleRevisionId: uuid()
			.notNull()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		note: text(),
		state: text().$type<"active" | "withdrawn">().notNull(),
		createdAt: createCreatedAtColumn(),
		createdByAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
	},
	(t): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [t.contentId, t.participationId, t.revision] }),
		foreignKey({
			name: "software_participation_revision_identity_fk",
			columns: [t.contentId, t.participationId],
			foreignColumns: [softwareParticipation.contentId, softwareParticipation.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_participation_alias_revision_fk",
			columns: [t.entityId, t.nameId, t.nameRevision],
			foreignColumns: [
				CatalogNameTables.entity.nameRevision.ownerId,
				CatalogNameTables.entity.nameRevision.id,
				CatalogNameTables.entity.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_participation_context_revision_fk",
			columns: [t.contentId, t.contextId, t.contextRevision],
			foreignColumns: [
				softwareParticipationContextRevision.contentId,
				softwareParticipationContextRevision.contextId,
				softwareParticipationContextRevision.revision,
			],
		}).onDelete("restrict"),
		index("software_participation_entity_idx").on(
			t.entityId,
			t.contentId,
			t.participationId,
			t.revision,
		),
		index("software_participation_character_idx")
			.on(t.characterId, t.contentId, t.participationId, t.revision)
			.where(sql`${t.characterId} is not null`),
		check(
			"software_participation_revision_check",
			sql`${t.revision} between 1 and 9007199254740991 and ${t.state} in ('active','withdrawn')`,
		),
		check(
			"software_participation_alias_pair_check",
			sql`(${t.nameId} is null) = (${t.nameRevision} is null)`,
		),
		check(
			"software_participation_context_pair_check",
			sql`(${t.contextId} is null) = (${t.contextRevision} is null)`,
		),
		check(
			"software_participation_note_check",
			sql`${t.note} is null or octet_length(${t.note}) <= 16384`,
		),
	],
);

/** Snapshot-local staff and voice occurrences retain exact joins even when upstream keys reorder. */
export const softwareParticipationCreditSourceOccurrence = pgTable(
	"software_participation_credit_source_occurrence",
	{
		sourceRecordId: uuid().notNull(),
		mappingKey: uuid().notNull(),
		correspondenceRevision: bigint({ mode: "number" }).notNull(),
		snapshotId: uuid().notNull(),
		sourcePath: text().notNull(),
		contentId: uuid().notNull(),
		participationId: uuid().notNull(),
		participationRevision: bigint({ mode: "number" }).notNull(),
	},
	(t): PgTableExtraConfigValue[] => [
		primaryKey({
			columns: [
				t.sourceRecordId,
				t.mappingKey,
				t.correspondenceRevision,
				t.snapshotId,
				t.sourcePath,
			],
		}),
		foreignKey({
			name: "software_participation_credit_correspondence_fk",
			columns: [t.sourceRecordId, t.mappingKey, t.correspondenceRevision],
			foreignColumns: [
				catalogSourceBindingRevision.sourceRecordId,
				catalogSourceBindingRevision.mappingKey,
				catalogSourceBindingRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_participation_credit_source_fk",
			columns: [t.sourceRecordId, t.snapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_participation_credit_revision_fk",
			columns: [t.contentId, t.participationId, t.participationRevision],
			foreignColumns: [
				softwareParticipationRevision.contentId,
				softwareParticipationRevision.participationId,
				softwareParticipationRevision.revision,
			],
		}).onDelete("restrict"),
		index("software_participation_credit_target_idx").on(
			t.contentId,
			t.participationId,
			t.participationRevision,
		),
		check(
			"software_participation_credit_path_check",
			sql`octet_length(${t.sourcePath}) between 1 and 512 and left(${t.sourcePath},1) = '/'`,
		),
	],
);
