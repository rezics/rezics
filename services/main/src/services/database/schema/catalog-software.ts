import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	primaryKey,
	unique,
	text,
	type AnyPgColumn,
	type PgTableExtraConfigValue,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn } from "./columns";
import { users } from "./auth";
import { catalogSourceSnapshot, catalogSourceBindingRevision } from "./catalog-source";
import {
	catalogDateColumns,
	catalogDateConstraint,
	catalogSubtypeColumns,
	catalogSubtypeConstraints,
} from "./catalog-domain-columns";
import { catalogDefinitionRevision, softwareIdentity } from "./catalog-identity";
import { referenceArea } from "./catalog-reference";

/** Immutable normalized SQL-row snapshots, captured by the software owner's trigger. */
export const softwareRecordRevision = pgTable(
	"software_record_revision",
	{
		ownerId: uuid()
			.notNull()
			.references(() => softwareIdentity.id, { onDelete: "restrict" }),
		revision: bigint({ mode: "number" }).notNull(),
		shape: text().$type<"content" | "version" | "release">().notNull(),
		value: jsonb().$type<unknown>().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.ownerId, table.revision] }),
		check(
			"software_record_revision_check",
			sql`${table.revision} between 1 and 9007199254740991 and ${table.shape} in ('content', 'version', 'release') and jsonb_typeof(${table.value}) = 'object' and octet_length(${table.value}::text) <= 1048576`,
		),
	],
);

/** Immutable component snapshots permit exact edit, withdrawal and restoration without losing occurrence IDs. */
export const softwareComponentRevision = pgTable(
	"software_component_revision",
	{
		releaseId: uuid()
			.notNull()
			.references(() => softwareRelease.id, { onDelete: "restrict" }),
		kind: text()
			.$type<
				"content" | "platform" | "medium" | "language" | "event" | "patch_target" | "animation"
			>()
			.notNull(),
		componentId: text().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		operation: text().$type<"put" | "remove">().notNull(),
		value: jsonb().$type<unknown>().notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.releaseId, table.kind, table.componentId, table.revision],
		}),
		check(
			"software_component_revision_check",
			sql`${table.revision} between 1 and 9007199254740991 and ${table.kind} in ('content', 'platform', 'medium', 'language', 'event', 'patch_target', 'animation') and octet_length(${table.componentId}) between 1 and 96 and ${table.operation} in ('put', 'remove') and jsonb_typeof(${table.value}) = 'object' and octet_length(${table.value}::text) <= 524288`,
		),
	],
);

export const softwareContent = pgTable(
	"software_content",
	{
		...catalogSubtypeColumns("content"),
		originalLanguageTag: text(),
		developmentStatus: text().$type<"finished" | "in_development" | "cancelled">(),
		description: text(),
	},
	(table) => [
		...catalogSubtypeConstraints("software_content", "software", "content", table),
		check(
			"software_content_language_check",
			sql`${table.originalLanguageTag} is null or octet_length(${table.originalLanguageTag}) between 1 and 255`,
		),
		check(
			"software_content_status_check",
			sql`${table.developmentStatus} is null or ${table.developmentStatus} in ('finished', 'in_development', 'cancelled')`,
		),
		check(
			"software_content_description_check",
			sql`${table.description} is null or octet_length(${table.description}) <= 524288`,
		),
	],
);

/** An evidenced content variant; source staff-list group numbers never create these identities. */
export const softwareVersion = pgTable(
	"software_version",
	{
		...catalogSubtypeColumns("version"),
		contentId: uuid()
			.notNull()
			.references(() => softwareContent.id, { onDelete: "restrict" }),
		kind: text()
			.$type<"revision" | "translation" | "localization" | "port" | "variant">()
			.notNull(),
		versionLabel: text(),
		languageTag: text(),
		/** Human-reviewable distinguishing evidence, independent of any provider identifier. */
		distinguishingEvidence: text().notNull(),
	},
	(table) => [
		...catalogSubtypeConstraints("software_version", "software", "version", table),
		unique("software_version_content_id_unique").on(table.contentId, table.id),
		check(
			"software_version_kind_check",
			sql`${table.kind} in ('revision', 'translation', 'localization', 'port', 'variant')`,
		),
		check(
			"software_version_evidence_check",
			sql`octet_length(${table.distinguishingEvidence}) between 1 and 16384`,
		),
		check(
			"software_version_label_check",
			sql`${table.versionLabel} is null or octet_length(${table.versionLabel}) between 1 and 4096`,
		),
		check(
			"software_version_language_check",
			sql`${table.languageTag} is null or octet_length(${table.languageTag}) between 1 and 255`,
		),
	],
);

export const softwareVisualNovel = pgTable("software_visual_novel", {
	id: uuid()
		.primaryKey()
		.references(() => softwareContent.id, { onDelete: "restrict" }),
});

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
		mappingKey: uuid().notNull(),
		correspondenceRevision: bigint({ mode: "number" }).notNull(),
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
			columns: [
				table.sourceRecordId,
				table.mappingKey,
				table.correspondenceRevision,
				table.snapshotId,
				table.namespace,
				table.localKey,
			],
		}),
		foreignKey({
			name: "software_context_occurrence_correspondence_fk",
			columns: [table.sourceRecordId, table.mappingKey, table.correspondenceRevision],
			foreignColumns: [
				catalogSourceBindingRevision.sourceRecordId,
				catalogSourceBindingRevision.mappingKey,
				catalogSourceBindingRevision.revision,
			],
		}).onDelete("restrict"),
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
		typeRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
		isPatch: boolean(),
		freeware: boolean(),
		uncensored: boolean(),
		hasEroticContent: boolean(),
		minimumAge: integer(),
		resolutionKind: text().$type<"pixels" | "non_standard">(),
		resolutionWidth: integer(),
		resolutionHeight: integer(),
		engine: text(),
		voicing: text().$type<"none" | "erotic_only" | "partial" | "full">(),
		notes: text(),
		gtin: text(),
		catalogNumber: text(),
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
		check(
			"software_release_resolution_check",
			sql`((${table.resolutionKind} is null and ${table.resolutionWidth} is null and ${table.resolutionHeight} is null) or (${table.resolutionKind} = 'non_standard' and ${table.resolutionWidth} is null and ${table.resolutionHeight} is null) or (${table.resolutionKind} = 'pixels' and ${table.resolutionWidth} is not null and ${table.resolutionHeight} is not null and ${table.resolutionWidth} between 1 and 2147483647 and ${table.resolutionHeight} between 1 and 2147483647)) is true`,
		),
		check(
			"software_release_voicing_check",
			sql`${table.voicing} is null or ${table.voicing} in ('none', 'erotic_only', 'partial', 'full')`,
		),
		check(
			"software_release_text_budget_check",
			sql`(${table.engine} is null or octet_length(${table.engine}) <= 4096) and (${table.notes} is null or octet_length(${table.notes}) <= 524288) and (${table.gtin} is null or octet_length(${table.gtin}) <= 128) and (${table.catalogNumber} is null or octet_length(${table.catalogNumber}) <= 4096)`,
		),
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
		versionId: uuid(),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.id] }),
		foreignKey({
			name: "software_release_content_version_fk",
			columns: [table.contentId, table.versionId],
			foreignColumns: [softwareVersion.contentId, softwareVersion.id],
		}).onDelete("restrict"),
		index("software_release_content_version_idx").on(
			table.contentId,
			table.versionId,
			table.releaseId,
			table.id,
		),
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
		title: text(),
		transliteratedTitle: text(),
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
		check(
			"software_release_language_title_check",
			sql`(${table.title} is null or octet_length(${table.title}) <= 131072) and (${table.transliteratedTitle} is null or octet_length(${table.transliteratedTitle}) <= 131072)`,
		),
	],
);

/** Territory and date are an occurrence, not a global language or officialness flag. */
export const softwareReleaseEvent = pgTable(
	"software_release_event",
	{
		releaseId: uuid()
			.notNull()
			.references(() => softwareRelease.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		areaId: uuid().references(() => referenceArea.id, { onDelete: "restrict" }),
		...catalogDateColumns(),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.id] }),
		index("software_release_event_area_idx").on(table.areaId, table.releaseId, table.id),
		catalogDateConstraint("software_release_event_date_check", table),
	],
);

/** Applicable base releases for patches; a patch can target several independently distributed bases. */
export const softwarePatchTarget = pgTable(
	"software_patch_target",
	{
		releaseId: uuid()
			.notNull()
			.references(() => softwareRelease.id, { onDelete: "restrict" }),
		baseReleaseId: uuid()
			.notNull()
			.references(() => softwareRelease.id, { onDelete: "restrict" }),
		compatibility: text(),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.baseReleaseId] }),
		index("software_patch_target_reverse_idx").on(table.baseReleaseId, table.releaseId),
		check("software_patch_not_self_check", sql`${table.releaseId} <> ${table.baseReleaseId}`),
		check(
			"software_patch_compatibility_check",
			sql`${table.compatibility} is null or octet_length(${table.compatibility}) <= 16384`,
		),
	],
);

/** Animation semantics are scoped to their presentation surface, independent of a source bitmask. */
export const softwareReleaseAnimation = pgTable(
	"software_release_animation",
	{
		releaseId: uuid()
			.notNull()
			.references(() => softwareRelease.id, { onDelete: "restrict" }),
		context: text()
			.$type<"story_sprite" | "story_scene" | "cutscene" | "erotic_sprite" | "erotic_scene">()
			.notNull(),
		state: text().$type<"unknown" | "none" | "not_applicable" | "animated">().notNull(),
		handDrawn: boolean().notNull().default(false),
		vectorial: boolean().notNull().default(false),
		threeDimensional: boolean().notNull().default(false),
		liveAction: boolean().notNull().default(false),
		frequency: text().$type<"unknown" | "some" | "all">().notNull().default("unknown"),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.context] }),
		check(
			"software_animation_context_check",
			sql`${table.context} in ('story_sprite','story_scene','cutscene','erotic_sprite','erotic_scene')`,
		),
		check(
			"software_animation_state_check",
			sql`${table.state} in ('unknown','none','not_applicable','animated') and ${table.frequency} in ('unknown','some','all')`,
		),
		check(
			"software_animation_technique_check",
			sql`(${table.state} = 'animated' and (${table.handDrawn} or ${table.vectorial} or ${table.threeDimensional} or ${table.liveAction})) or (${table.state} <> 'animated' and not (${table.handDrawn} or ${table.vectorial} or ${table.threeDimensional} or ${table.liveAction}) and ${table.frequency} = 'unknown')`,
		),
		check(
			"software_animation_cutscene_check",
			sql`${table.context} <> 'cutscene' or (${table.state} <> 'none' and ${table.frequency} = 'unknown')`,
		),
	],
);
