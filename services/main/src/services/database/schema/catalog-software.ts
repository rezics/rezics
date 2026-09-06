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
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
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

export const softwareEdition = pgTable(
	"software_edition",
	{
		contentId: uuid()
			.notNull()
			.references(() => softwareContent.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		sourceNamespace: text(),
		sourceLocalId: text(),
		name: text(),
	},
	(table) => [
		primaryKey({ columns: [table.contentId, table.id] }),
		uniqueIndex("software_edition_source_local_key")
			.on(table.contentId, table.sourceNamespace, table.sourceLocalId)
			.where(sql`${table.sourceNamespace} is not null and ${table.sourceLocalId} is not null`),
		check(
			"software_edition_source_local_check",
			sql`(${table.sourceNamespace} is null and ${table.sourceLocalId} is null) or (${table.sourceNamespace} is not null and ${table.sourceLocalId} is not null and octet_length(${table.sourceNamespace}) between 1 and 96 and octet_length(${table.sourceLocalId}) between 1 and 128)`,
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
		editionId: uuid(),
		releaseTypeRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.id] }),
		foreignKey({
			name: "software_release_content_edition_fk",
			columns: [table.contentId, table.editionId],
			foreignColumns: [softwareEdition.contentId, softwareEdition.id],
		}).onDelete("restrict"),
		index("software_release_content_reverse_idx").on(
			table.contentId,
			table.editionId,
			table.releaseId,
			table.id,
		),
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
