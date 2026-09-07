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
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createTimestampMsColumn, createUuidv7PrimaryKey } from "./columns";
import {
	catalogDateColumns,
	catalogDateConstraint,
	catalogSubtypeColumns,
	catalogSubtypeConstraints,
} from "./catalog-domain-columns";
import { catalogDefinitionRevision, entityIdentity, musicIdentity } from "./catalog-identity";
import { referenceArea } from "./catalog-reference";
import { users } from "./auth";

/** Exact native row revisions, including removals; this is not a source-payload archive. */
export const musicComponentRevision = pgTable(
	"music_component_revision",
	{
		ownerId: uuid()
			.notNull()
			.references(() => musicIdentity.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		component: text().notNull(),
		componentKey: text().notNull(),
		ownerRevision: bigint({ mode: "number" }).notNull(),
		operation: text().$type<"INSERT" | "UPDATE" | "DELETE">().notNull(),
		value: jsonb().$type<Record<string, unknown>>().notNull(),
		recordedAt: createTimestampMsColumn().defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.ownerId, table.id] }),
		index("music_component_revision_lookup_idx").on(
			table.ownerId,
			table.component,
			table.componentKey,
			table.id,
		),
		check(
			"music_component_revision_operation_check",
			sql`${table.operation} in ('INSERT', 'UPDATE', 'DELETE')`,
		),
		check(
			"music_component_revision_value_check",
			sql`jsonb_typeof(${table.value}) = 'object' and octet_length(${table.componentKey}) between 1 and 512 and ${table.ownerRevision} > 0`,
		),
	],
);

/** A shared presentation credit is not an artist, recording or social Unit. */
export const musicArtistCredit = pgTable(
	"music_artist_credit",
	{
		id: createUuidv7PrimaryKey(),
		renderedName: text(),
		createdByAuthUserId: uuid().references(() => users.id, { onDelete: "set null" }),
		publiclyReusable: boolean().default(false).notNull(),
		memberCount: bigint({ mode: "number" }).default(0).notNull(),
		lastPosition: bigint({ mode: "number" }).default(-1).notNull(),
		sealedAt: createTimestampMsColumn(),
		retiredAt: createTimestampMsColumn(),
	},
	(table) => [
		index("music_artist_credit_creator_idx").on(table.createdByAuthUserId, table.id),
		check(
			"music_credit_prefix_check",
			sql`${table.memberCount} between 0 and 9007199254740991 and ${table.lastPosition} between -1 and 9007199254740991 and (${table.sealedAt} is null or (${table.memberCount} > 0 and ${table.lastPosition} = ${table.memberCount} - 1))`,
		),
	],
);

export const musicArtistCreditName = pgTable(
	"music_artist_credit_name",
	{
		creditId: uuid()
			.notNull()
			.references(() => musicArtistCredit.id, { onDelete: "restrict" }),
		position: bigint({ mode: "number" }).notNull(),
		sourcePosition: bigint({ mode: "number" }),
		artistId: uuid().references(() => entityIdentity.id, { onDelete: "restrict" }),
		creditedName: text().notNull(),
		joinPhrase: text().default("").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.creditId, table.position] }),
		index("music_credit_artist_idx").on(table.artistId, table.creditId, table.position),
		check("music_credit_position_check", sql`${table.position} between 0 and 9007199254740991`),
		check("music_credit_name_check", sql`length(${table.creditedName}) > 0`),
	],
);

export const musicWork = pgTable(
	"music_work",
	{
		...catalogSubtypeColumns("work"),
		typeRevisionId: uuid().references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
	},
	(table) => [
		...catalogSubtypeConstraints("music_work", "music", "work", table),
		index("music_work_type_idx").on(table.typeRevisionId, table.id),
	],
);

/** Incomplete disc catalog candidates are not silently promoted into issued releases. */
export const musicReleaseCandidate = pgTable(
	"music_release_candidate",
	{
		...catalogSubtypeColumns("release_candidate"),
		creditedArtistText: text(),
		barcode: text(),
		comment: text(),
	},
	(table) => [
		...catalogSubtypeConstraints("music_release_candidate", "music", "release_candidate", table),
	],
);

export const musicCandidateTrack = pgTable(
	"music_candidate_track",
	{
		candidateId: uuid()
			.notNull()
			.references(() => musicReleaseCandidate.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		position: bigint({ mode: "number" }).notNull(),
		name: text().notNull(),
		creditedArtistText: text(),
	},
	(table) => [
		primaryKey({ columns: [table.candidateId, table.id] }),
		unique("music_candidate_track_position_key").on(table.candidateId, table.position),
		check(
			"music_candidate_track_position_check",
			sql`${table.position} between 0 and 9007199254740991`,
		),
	],
);

export const musicWorkLanguage = pgTable(
	"music_work_language",
	{
		workId: uuid()
			.notNull()
			.references(() => musicWork.id, { onDelete: "restrict" }),
		languageTag: text().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.workId, table.languageTag] }),
		index("music_work_language_reverse_idx").on(table.languageTag, table.workId),
		check(
			"music_work_language_size_check",
			sql`octet_length(${table.languageTag}) between 1 and 255`,
		),
	],
);

export const musicRecording = pgTable(
	"music_recording",
	{
		...catalogSubtypeColumns("recording"),
		artistCreditId: uuid().references(() => musicArtistCredit.id, { onDelete: "restrict" }),
		lengthMilliseconds: bigint({ mode: "number" }),
		video: boolean(),
	},
	(table) => [
		...catalogSubtypeConstraints("music_recording", "music", "recording", table),
		index("music_recording_credit_idx").on(table.artistCreditId, table.id),
		check(
			"music_recording_length_check",
			sql`${table.lengthMilliseconds} is null or ${table.lengthMilliseconds} between 0 and 9007199254740991`,
		),
	],
);

export const musicReleaseGroup = pgTable(
	"music_release_group",
	{
		...catalogSubtypeColumns("release_group"),
		artistCreditId: uuid().references(() => musicArtistCredit.id, { onDelete: "restrict" }),
		primaryTypeRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
	},
	(table) => [
		...catalogSubtypeConstraints("music_release_group", "music", "release_group", table),
		index("music_release_group_credit_idx").on(table.artistCreditId, table.id),
		index("music_release_group_type_idx").on(table.primaryTypeRevisionId, table.id),
	],
);

export const musicReleaseGroupSecondaryType = pgTable(
	"music_release_group_secondary_type",
	{
		releaseGroupId: uuid()
			.notNull()
			.references(() => musicReleaseGroup.id, { onDelete: "restrict" }),
		typeRevisionId: uuid()
			.notNull()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.releaseGroupId, table.typeRevisionId] }),
		index("music_release_group_secondary_type_reverse_idx").on(
			table.typeRevisionId,
			table.releaseGroupId,
		),
	],
);

export const musicRelease = pgTable(
	"music_release",
	{
		...catalogSubtypeColumns("release"),
		releaseGroupId: uuid().references(() => musicReleaseGroup.id, { onDelete: "restrict" }),
		artistCreditId: uuid().references(() => musicArtistCredit.id, { onDelete: "restrict" }),
		statusRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
		packagingRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
		languageTag: text(),
		scriptCode: text(),
		barcode: text(),
	},
	(table) => [
		...catalogSubtypeConstraints("music_release", "music", "release", table),
		index("music_release_group_idx").on(table.releaseGroupId, table.id),
		index("music_release_credit_idx").on(table.artistCreditId, table.id),
		index("music_release_status_idx").on(table.statusRevisionId, table.id),
		index("music_release_packaging_idx").on(table.packagingRevisionId, table.id),
		check(
			"music_release_language_check",
			sql`${table.languageTag} is null or octet_length(${table.languageTag}) between 1 and 255`,
		),
		check(
			"music_release_script_check",
			sql`${table.scriptCode} is null or ${table.scriptCode} ~ '^[A-Z][a-z]{3}$'`,
		),
	],
);

export const musicReleaseEvent = pgTable(
	"music_release_event",
	{
		releaseId: uuid()
			.notNull()
			.references(() => musicRelease.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		areaId: uuid().references(() => referenceArea.id, { onDelete: "restrict" }),
		...catalogDateColumns(),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.id] }),
		catalogDateConstraint("music_release_event_date_check", table),
		index("music_release_event_area_idx").on(table.areaId, table.releaseId, table.id),
	],
);

export const musicReleaseLabel = pgTable(
	"music_release_label",
	{
		releaseId: uuid()
			.notNull()
			.references(() => musicRelease.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		labelId: uuid().references(() => entityIdentity.id, { onDelete: "restrict" }),
		catalogNumber: text(),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.id] }),
		index("music_release_label_reverse_idx").on(table.labelId, table.releaseId, table.id),
	],
);

export const musicMedium = pgTable(
	"music_medium",
	{
		releaseId: uuid()
			.notNull()
			.references(() => musicRelease.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		position: bigint({ mode: "number" }).notNull(),
		name: text(),
		formatRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
		sourceTrackCount: bigint({ mode: "number" }),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.id] }),
		unique("music_medium_position_key").on(table.releaseId, table.position),
		index("music_medium_format_idx").on(table.formatRevisionId, table.releaseId, table.id),
		check("music_medium_position_check", sql`${table.position} between 0 and 9007199254740991`),
		check(
			"music_medium_track_count_check",
			sql`${table.sourceTrackCount} is null or ${table.sourceTrackCount} between 0 and 9007199254740991`,
		),
	],
);

/** Position and printed number belong to this occurrence, not the recording. */
export const musicTrackOccurrence = pgTable(
	"music_track_occurrence",
	{
		releaseId: uuid().notNull(),
		mediumId: uuid().notNull(),
		id: uuid().default(sql`uuidv7()`).notNull(),
		position: bigint({ mode: "number" }).notNull(),
		number: text().notNull(),
		name: text(),
		recordingId: uuid().references(() => musicRecording.id, { onDelete: "restrict" }),
		artistCreditId: uuid().references(() => musicArtistCredit.id, { onDelete: "restrict" }),
		lengthMilliseconds: bigint({ mode: "number" }),
		isDataTrack: boolean(),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.id] }),
		unique("music_track_occurrence_position_key").on(
			table.releaseId,
			table.mediumId,
			table.position,
		),
		unique("music_track_occurrence_medium_key").on(table.releaseId, table.id, table.mediumId),
		foreignKey({
			name: "music_track_occurrence_medium_fk",
			columns: [table.releaseId, table.mediumId],
			foreignColumns: [musicMedium.releaseId, musicMedium.id],
		}).onDelete("restrict"),
		index("music_track_recording_idx").on(table.recordingId, table.releaseId, table.id),
		index("music_track_credit_idx").on(table.artistCreditId, table.releaseId, table.id),
		check("music_track_position_check", sql`${table.position} between 0 and 9007199254740991`),
		check(
			"music_track_length_check",
			sql`${table.lengthMilliseconds} is null or ${table.lengthMilliseconds} between 0 and 9007199254740991`,
		),
	],
);

export const musicDiscToc = pgTable(
	"music_disc_toc",
	{
		id: createUuidv7PrimaryKey(),
		discId: text(),
		freeDbId: text(),
		trackCount: integer().notNull(),
		leadoutOffset: bigint({ mode: "number" }).notNull(),
	},
	(table) => [
		index("music_disc_toc_disc_id_idx").on(table.discId, table.id),
		check(
			"music_disc_toc_count_check",
			sql`${table.trackCount} between 1 and 99 and ${table.leadoutOffset} between 0 and 9007199254740991`,
		),
	],
);

export const musicDiscTocOffset = pgTable(
	"music_disc_toc_offset",
	{
		tocId: uuid()
			.notNull()
			.references(() => musicDiscToc.id, { onDelete: "restrict" }),
		position: integer().notNull(),
		offset: bigint({ mode: "number" }).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.tocId, table.position] }),
		check(
			"music_disc_toc_offset_check",
			sql`${table.position} between 0 and 98 and ${table.offset} between 0 and 9007199254740991`,
		),
	],
);

export const musicCandidateToc = pgTable(
	"music_candidate_toc",
	{
		candidateId: uuid()
			.notNull()
			.references(() => musicReleaseCandidate.id, { onDelete: "restrict" }),
		tocId: uuid()
			.notNull()
			.references(() => musicDiscToc.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.candidateId, table.tocId] }),
		index("music_candidate_toc_reverse_idx").on(table.tocId, table.candidateId),
	],
);

/** Immutable reviewed applicability policy for one attribute definition revision. */
export const musicMediumAttributePolicy = pgTable(
	"music_medium_attribute_policy",
	{
		definitionRevisionId: uuid()
			.primaryKey()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		valueMode: text().$type<"text" | "vocabulary">().notNull(),
	},
	(table) => [
		check(
			"music_medium_attribute_policy_mode_check",
			sql`${table.valueMode} in ('text', 'vocabulary')`,
		),
	],
);

export const musicMediumAttributeAllowedFormat = pgTable(
	"music_medium_attribute_allowed_format",
	{
		definitionRevisionId: uuid()
			.notNull()
			.references(() => musicMediumAttributePolicy.definitionRevisionId, { onDelete: "restrict" }),
		formatRevisionId: uuid()
			.notNull()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
	},
	(table) => [primaryKey({ columns: [table.definitionRevisionId, table.formatRevisionId] })],
);

/** Enumerated values may have stricter format applicability than their attribute family. */
export const musicMediumAttributeAllowedValueFormat = pgTable(
	"music_medium_attribute_allowed_value_format",
	{
		definitionRevisionId: uuid().notNull(),
		valueRevisionId: uuid()
			.notNull()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		formatRevisionId: uuid().notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.definitionRevisionId, table.valueRevisionId, table.formatRevisionId],
		}),
		foreignKey({
			name: "music_medium_attribute_allowed_value_format_policy_fk",
			columns: [table.definitionRevisionId, table.formatRevisionId],
			foreignColumns: [
				musicMediumAttributeAllowedFormat.definitionRevisionId,
				musicMediumAttributeAllowedFormat.formatRevisionId,
			],
		}).onDelete("restrict"),
	],
);

/** Medium characteristics are governed values on the carrier occurrence. */
export const musicMediumAttribute = pgTable(
	"music_medium_attribute",
	{
		releaseId: uuid().notNull(),
		mediumId: uuid().notNull(),
		id: uuid().default(sql`uuidv7()`).notNull(),
		definitionRevisionId: uuid()
			.notNull()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		valueRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
		textValue: text(),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.mediumId, table.id] }),
		foreignKey({
			name: "music_medium_attribute_policy_fk",
			columns: [table.definitionRevisionId],
			foreignColumns: [musicMediumAttributePolicy.definitionRevisionId],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_medium_attribute_medium_fk",
			columns: [table.releaseId, table.mediumId],
			foreignColumns: [musicMedium.releaseId, musicMedium.id],
		}).onDelete("restrict"),
		index("music_medium_attribute_definition_idx").on(
			table.definitionRevisionId,
			table.releaseId,
			table.mediumId,
			table.id,
		),
		index("music_medium_attribute_value_idx").on(
			table.valueRevisionId,
			table.releaseId,
			table.mediumId,
			table.id,
		),
		check(
			"music_medium_attribute_value_check",
			sql`(${table.valueRevisionId} is not null) <> (${table.textValue} is not null)`,
		),
	],
);

export const musicMediumToc = pgTable(
	"music_medium_toc",
	{
		releaseId: uuid().notNull(),
		mediumId: uuid().notNull(),
		tocId: uuid()
			.notNull()
			.references(() => musicDiscToc.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.mediumId, table.tocId] }),
		foreignKey({
			name: "music_medium_toc_medium_fk",
			columns: [table.releaseId, table.mediumId],
			foreignColumns: [musicMedium.releaseId, musicMedium.id],
		}).onDelete("restrict"),
		index("music_medium_toc_reverse_idx").on(table.tocId, table.releaseId, table.mediumId),
	],
);

export const musicCreditIdentifier = pgTable(
	"music_credit_identifier",
	{
		creditId: uuid()
			.notNull()
			.references(() => musicArtistCredit.id, { onDelete: "restrict" }),
		namespace: text().notNull(),
		value: text().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.creditId, table.namespace, table.value] }),
		index("music_credit_identifier_lookup_idx").on(table.namespace, table.value, table.creditId),
		check(
			"music_credit_identifier_size_check",
			sql`octet_length(${table.namespace}) between 1 and 96 and octet_length(${table.value}) between 1 and 512`,
		),
	],
);

export const musicMediumIdentifier = pgTable(
	"music_medium_identifier",
	{
		releaseId: uuid().notNull(),
		mediumId: uuid().notNull(),
		namespace: text().notNull(),
		value: text().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.mediumId, table.namespace, table.value] }),
		foreignKey({
			name: "music_medium_identifier_medium_fk",
			columns: [table.releaseId, table.mediumId],
			foreignColumns: [musicMedium.releaseId, musicMedium.id],
		}).onDelete("restrict"),
		index("music_medium_identifier_lookup_idx").on(
			table.namespace,
			table.value,
			table.releaseId,
			table.mediumId,
		),
		check(
			"music_medium_identifier_size_check",
			sql`octet_length(${table.namespace}) between 1 and 96 and octet_length(${table.value}) between 1 and 512`,
		),
	],
);

export const musicTrackIdentifier = pgTable(
	"music_track_identifier",
	{
		releaseId: uuid().notNull(),
		trackId: uuid().notNull(),
		namespace: text().notNull(),
		value: text().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.trackId, table.namespace, table.value] }),
		foreignKey({
			name: "music_track_identifier_track_fk",
			columns: [table.releaseId, table.trackId],
			foreignColumns: [musicTrackOccurrence.releaseId, musicTrackOccurrence.id],
		}).onDelete("restrict"),
		index("music_track_identifier_lookup_idx").on(
			table.namespace,
			table.value,
			table.releaseId,
			table.trackId,
		),
		check(
			"music_track_identifier_size_check",
			sql`octet_length(${table.namespace}) between 1 and 96 and octet_length(${table.value}) between 1 and 512`,
		),
	],
);

/** Source alternate tracklists retain their own language, names and credits. */
export const musicReleasePresentation = pgTable(
	"music_release_presentation",
	{
		releaseId: uuid()
			.notNull()
			.references(() => musicRelease.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		name: text(),
		artistCreditId: uuid().references(() => musicArtistCredit.id, { onDelete: "restrict" }),
		languageTag: text(),
		scriptCode: text(),
		typeRevisionId: uuid().references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		comment: text(),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.id] }),
		index("music_release_presentation_credit_idx").on(
			table.artistCreditId,
			table.releaseId,
			table.id,
		),
		index("music_release_presentation_type_idx").on(
			table.typeRevisionId,
			table.releaseId,
			table.id,
		),
		check(
			"music_release_presentation_language_check",
			sql`${table.languageTag} is null or octet_length(${table.languageTag}) between 1 and 255`,
		),
		check(
			"music_release_presentation_script_check",
			sql`${table.scriptCode} is null or ${table.scriptCode} ~ '^[A-Z][a-z]{3}$'`,
		),
	],
);

export const musicMediumPresentation = pgTable(
	"music_medium_presentation",
	{
		releaseId: uuid().notNull(),
		id: uuid().default(sql`uuidv7()`).notNull(),
		releasePresentationId: uuid().notNull(),
		mediumId: uuid().notNull(),
		name: text(),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.id] }),
		unique("music_medium_presentation_medium_key").on(table.releaseId, table.id, table.mediumId),
		foreignKey({
			name: "music_medium_presentation_release_fk",
			columns: [table.releaseId, table.releasePresentationId],
			foreignColumns: [musicReleasePresentation.releaseId, musicReleasePresentation.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_medium_presentation_medium_fk",
			columns: [table.releaseId, table.mediumId],
			foreignColumns: [musicMedium.releaseId, musicMedium.id],
		}).onDelete("restrict"),
		index("music_medium_presentation_release_idx").on(
			table.releaseId,
			table.releasePresentationId,
			table.id,
		),
		index("music_medium_presentation_medium_idx").on(table.releaseId, table.mediumId, table.id),
	],
);

export const musicAlternativeTrack = pgTable(
	"music_alternative_track",
	{
		id: createUuidv7PrimaryKey(),
		name: text(),
		artistCreditId: uuid().references(() => musicArtistCredit.id, { onDelete: "restrict" }),
	},
	(table) => [
		index("music_alternative_track_credit_idx").on(table.artistCreditId, table.id),
		check(
			"music_alternative_track_value_check",
			sql`(${table.name} is not null or ${table.artistCreditId} is not null) and (${table.name} is null or length(${table.name}) > 0)`,
		),
	],
);

export const musicTrackPresentation = pgTable(
	"music_track_presentation",
	{
		releaseId: uuid().notNull(),
		mediumPresentationId: uuid().notNull(),
		mediumId: uuid().notNull(),
		trackId: uuid().notNull(),
		alternativeTrackId: uuid()
			.notNull()
			.references(() => musicAlternativeTrack.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.releaseId, table.mediumPresentationId, table.trackId] }),
		foreignKey({
			name: "music_track_presentation_medium_fk",
			columns: [table.releaseId, table.mediumPresentationId, table.mediumId],
			foreignColumns: [
				musicMediumPresentation.releaseId,
				musicMediumPresentation.id,
				musicMediumPresentation.mediumId,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_track_presentation_track_fk",
			columns: [table.releaseId, table.trackId, table.mediumId],
			foreignColumns: [
				musicTrackOccurrence.releaseId,
				musicTrackOccurrence.id,
				musicTrackOccurrence.mediumId,
			],
		}).onDelete("restrict"),
		index("music_track_presentation_alternative_idx").on(
			table.alternativeTrackId,
			table.releaseId,
			table.trackId,
		),
		index("music_track_presentation_track_idx").on(table.releaseId, table.trackId, table.mediumId),
	],
);
