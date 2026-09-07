import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	text,
	type AnyPgColumn,
	type PgTableExtraConfigValue,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn } from "./columns";
import { users } from "./auth";
import { catalogSourceSnapshot } from "./catalog-source";
import {
	catalogDateColumns,
	catalogDateConstraint,
	catalogSubtypeColumns,
	catalogSubtypeConstraints,
} from "./catalog-domain-columns";
import { catalogDefinitionRevision } from "./catalog-identity";

export const softwareContent = pgTable(
	"software_content",
	{
		...catalogSubtypeColumns("content"),
	},
	(table) => catalogSubtypeConstraints("software_content", "software", "content", table),
);

export const softwareVisualNovel = pgTable(
	"software_visual_novel",
	{
		id: uuid()
			.primaryKey()
			.references(() => softwareContent.id, { onDelete: "restrict" }),
		lengthTypeRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
		lengthMinutes: bigint({ mode: "number" }),
	},
	(table) => [
		index("software_vn_length_type_idx").on(table.lengthTypeRevisionId, table.id),
		check(
			"software_vn_length_check",
			sql`${table.lengthMinutes} is null or ${table.lengthMinutes} between 0 and 9007199254740991`,
		),
	],
);

/** Provider-independent grouping of participation in one software content. */
export const softwareParticipationContext = pgTable(
	"software_participation_context",
	{
		contentId: uuid()
			.notNull()
			.references(() => softwareContent.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		/** Null only while creating the first revision; a deferred trigger rejects an unsealed commit. */
		currentRevision: bigint({ mode: "number" }),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [table.contentId, table.id] }),
		foreignKey({
			name: "software_context_current_revision_fk",
			columns: [table.contentId, table.id, table.currentRevision],
			foreignColumns: [
				softwareParticipationContextRevision.contentId,
				softwareParticipationContextRevision.contextId,
				softwareParticipationContextRevision.revision,
			],
		}).onDelete("restrict"),
		check(
			"software_context_revision_check",
			sql`${table.currentRevision} is null or ${table.currentRevision} between 1 and 9007199254740991`,
		),
	],
);

/** Complete immutable values: restoring old values appends another revision. */
export const softwareParticipationContextRevision = pgTable(
	"software_participation_context_revision",
	{
		contentId: uuid().notNull(),
		contextId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		label: text(),
		languageTag: text(),
		state: text().$type<"active" | "withdrawn">().notNull(),
		createdAt: createCreatedAtColumn(),
		createdByAuthUserId: uuid()
			.notNull()
			.references((): AnyPgColumn => users.id, { onDelete: "restrict" }),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [table.contentId, table.contextId, table.revision] }),
		foreignKey({
			name: "software_context_revision_context_fk",
			columns: [table.contentId, table.contextId],
			foreignColumns: [softwareParticipationContext.contentId, softwareParticipationContext.id],
		}).onDelete("restrict"),
		index("software_context_revision_actor_idx").on(
			table.createdByAuthUserId,
			table.contentId,
			table.contextId,
			table.revision,
		),
		check(
			"software_context_revision_number_check",
			sql`${table.revision} between 1 and 9007199254740991`,
		),
		check(
			"software_context_revision_label_check",
			sql`${table.label} is null or octet_length(${table.label}) between 1 and 4096`,
		),
		check(
			"software_context_revision_language_check",
			sql`${table.languageTag} is null or octet_length(${table.languageTag}) between 1 and 255`,
		),
		check("software_context_revision_state_check", sql`${table.state} in ('active', 'withdrawn')`),
	],
);

/** An immutable source occurrence points at the exact native revision it initialized. */
export const softwareParticipationSourceOccurrence = pgTable(
	"software_participation_source_occurrence",
	{
		sourceRecordId: uuid().notNull(),
		snapshotId: uuid().notNull(),
		namespace: text().notNull(),
		localKey: text().notNull(),
		contentId: uuid().notNull(),
		contextId: uuid().notNull(),
		contextRevision: bigint({ mode: "number" }).notNull(),
		sourcePointer: text().notNull(),
		sourceLabel: text().notNull(),
		sourceLanguage: text(),
		sourceLanguageTag: text(),
		sourceClaimedOfficial: boolean().notNull(),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({
			columns: [table.sourceRecordId, table.snapshotId, table.namespace, table.localKey],
		}),
		foreignKey({
			name: "software_context_occurrence_snapshot_fk",
			columns: [table.sourceRecordId, table.snapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_context_occurrence_revision_fk",
			columns: [table.contentId, table.contextId, table.contextRevision],
			foreignColumns: [
				softwareParticipationContextRevision.contentId,
				softwareParticipationContextRevision.contextId,
				softwareParticipationContextRevision.revision,
			],
		}).onDelete("restrict"),
		index("software_context_occurrence_target_idx").on(
			table.contentId,
			table.contextId,
			table.contextRevision,
			table.sourceRecordId,
			table.snapshotId,
		),
		check(
			"software_context_occurrence_key_check",
			sql`octet_length(${table.namespace}) between 1 and 96 and octet_length(${table.localKey}) between 1 and 128 and octet_length(${table.sourcePointer}) between 1 and 512`,
		),
		check(
			"software_context_occurrence_label_check",
			sql`octet_length(${table.sourceLabel}) <= 4096`,
		),
		check(
			"software_context_occurrence_language_check",
			sql`(${table.sourceLanguage} is null and ${table.sourceLanguageTag} is null) or (${table.sourceLanguage} is not null and ${table.sourceLanguageTag} is not null and octet_length(${table.sourceLanguage}) between 1 and 255 and octet_length(${table.sourceLanguageTag}) between 1 and 255)`,
		),
	],
);

export const softwareRelease = pgTable(
	"software_release",
	{
		...catalogSubtypeColumns("release"),
		typeRevisionId: uuid().references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		isPatch: boolean(),
		freeware: boolean(),
		uncensored: boolean(),
		hasEroticContent: boolean(),
		minimumAge: integer(),
		...catalogDateColumns(),
	},
	(table) => [
		...catalogSubtypeConstraints("software_release", "software", "release", table),
		index("software_release_type_idx").on(table.typeRevisionId, table.id),
		check(
			"software_release_age_check",
			sql`${table.minimumAge} is null or ${table.minimumAge} between 0 and 255`,
		),
		catalogDateConstraint("software_release_date_check", table),
	],
);

export const softwareReleaseContent = pgTable(
	"software_release_content",
	{
		releaseId: uuid()
			.notNull()
			.references(() => softwareRelease.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		contentId: uuid()
			.notNull()
			.references(() => softwareContent.id, { onDelete: "restrict" }),
		releaseTypeRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.id] }),
		index("software_release_content_reverse_idx").on(table.contentId, table.releaseId, table.id),
		index("software_release_content_type_idx").on(
			table.releaseTypeRevisionId,
			table.releaseId,
			table.id,
		),
	],
);

export const softwareReleasePlatform = pgTable(
	"software_release_platform",
	{
		releaseId: uuid()
			.notNull()
			.references(() => softwareRelease.id, { onDelete: "restrict" }),
		platformRevisionId: uuid()
			.notNull()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.platformRevisionId] }),
		index("software_release_platform_reverse_idx").on(table.platformRevisionId, table.releaseId),
	],
);

export const softwareReleaseMedium = pgTable(
	"software_release_medium",
	{
		releaseId: uuid()
			.notNull()
			.references(() => softwareRelease.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		mediumTypeRevisionId: uuid()
			.notNull()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		quantity: bigint({ mode: "number" }),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.id] }),
		index("software_release_medium_type_idx").on(
			table.mediumTypeRevisionId,
			table.releaseId,
			table.id,
		),
		check(
			"software_release_medium_quantity_check",
			sql`${table.quantity} is null or ${table.quantity} between 0 and 9007199254740991`,
		),
	],
);

export const softwareReleaseLanguage = pgTable(
	"software_release_language",
	{
		releaseId: uuid()
			.notNull()
			.references(() => softwareRelease.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		languageTag: text().notNull(),
		channelRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
		machineTranslated: boolean(),
		main: boolean(),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.id] }),
		index("software_release_language_idx").on(table.languageTag, table.releaseId, table.id),
		index("software_release_language_channel_idx").on(
			table.channelRevisionId,
			table.releaseId,
			table.id,
		),
		check(
			"software_release_language_tag_check",
			sql`octet_length(${table.languageTag}) between 1 and 255`,
		),
	],
);
