import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	numeric,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { entityIdentity } from "../catalog/identity";
const instant = () => timestamp({ withTimezone: true, precision: 3 }).defaultNow().notNull();

/** @alpha Observed binary identity is independent of an upload account or a public image presentation. */
export const mediaBlob = pgTable(
	"media_blob",
	{
		id: uuid().primaryKey(),
		storageDomain: text().notNull(),
		algorithm: text().notNull(),
		digest: text().notNull(),
		byteLength: numeric().notNull(),
		availability: text().notNull(),
		erasureEpoch: bigint({ mode: "number" }).default(0).notNull(),
	},
	(t) => [
		unique("media_blob_domain_digest").on(t.storageDomain, t.algorithm, t.digest),
		check(
			"media_blob_bytes",
			sql`${t.byteLength}>=0 and ${t.byteLength}=trunc(${t.byteLength}) and ${t.byteLength}<1e40`,
		),
		check(
			"media_blob_availability",
			sql`${t.availability} in ('observed','stored','unavailable','erased')`,
		),
	],
);
export const mediaBlobLocation = pgTable(
	"media_blob_location",
	{
		blobId: uuid()
			.notNull()
			.references(() => mediaBlob.id),
		id: uuid().notNull(),
		backend: text().notNull(),
		objectKey: text().notNull(),
		objectVersion: text(),
		state: text().notNull(),
		verifiedAt: timestamp({ withTimezone: true }),
	},
	(t) => [
		primaryKey({ columns: [t.blobId, t.id] }),
		index("media_blob_location_backend").on(t.backend, t.objectKey),
		check(
			"media_blob_location_state",
			sql`${t.state} in ('pending','ready','unavailable','erased')`,
		),
	],
);

/** @alpha Indexed media has identity before downloading or hosting any binary. */
export const mediaItem = pgTable(
	"media_item",
	{
		id: uuid().primaryKey(),
		kind: text().$type<"image" | "video" | "audio">().notNull(),
		state: text().$type<"active" | "withdrawn" | "erased">().default("active").notNull(),
		createdAt: instant(),
		revision: bigint({ mode: "number" }).default(1).notNull(),
	},
	(t) => [
		check("media_item_kind", sql`${t.kind} in ('image','video','audio')`),
		check("media_item_state", sql`${t.state} in ('active','withdrawn','erased')`),
		check("media_item_revision", sql`${t.revision}>0`),
	],
);

export const mediaLocator = pgTable(
	"media_locator",
	{
		id: uuid().primaryKey(),
		mediaId: uuid()
			.notNull()
			.references(() => mediaItem.id),
		url: text().notNull(),
		urlHash: text().notNull(),
		provider: text(),
		externalKey: text(),
		firstObservedAt: instant(),
	},
	(t) => [
		unique("media_locator_id_media").on(t.id, t.mediaId),
		index("media_locator_url_idx").on(t.urlHash, t.id),
		index("media_locator_media_idx").on(t.mediaId, t.id),
		check(
			"media_locator_hash",
			sql`encode(sha256(convert_to(${t.url},'UTF8')),'hex')=${t.urlHash}`,
		),
	],
);

export const mediaObservation = pgTable(
	"media_observation",
	{
		id: uuid().primaryKey(),
		mediaId: uuid()
			.notNull()
			.references(() => mediaItem.id),
		locatorId: uuid(),
		observedAt: instant(),
		status: text().notNull(),
		contentHash: text(),
		etag: text(),
		mimeType: text(),
		byteLength: numeric(),
		artifactBlobId: uuid().references(() => mediaBlob.id),
		evidenceUri: text(),
	},
	(t) => [
		unique("media_observation_id_media").on(t.id, t.mediaId),
		unique("media_observation_id_locator").on(t.id, t.locatorId),
		foreignKey({
			columns: [t.locatorId, t.mediaId],
			foreignColumns: [mediaLocator.id, mediaLocator.mediaId],
		}),
		index("media_observation_locator_time").on(t.locatorId, t.observedAt, t.id),
		check(
			"media_observation_status",
			sql`${t.status} in ('available','unavailable','forbidden','unknown')`,
		),
		check(
			"media_observation_bytes",
			sql`${t.byteLength} is null or ${t.byteLength}>=0 and ${t.byteLength}=trunc(${t.byteLength}) and ${t.byteLength}<1e40`,
		),
	],
);

/** @alpha Page appearances are distinct from bytes, URLs and conceptual image/video identity. */
export const mediaOccurrence = pgTable(
	"media_occurrence",
	{
		id: uuid().primaryKey(),
		mediaId: uuid()
			.notNull()
			.references(() => mediaItem.id),
		pageUri: text().notNull(),
		pageUriHash: text().notNull(),
		pageRevision: text().notNull(),
		selector: text().notNull(),
		selectorHash: text().notNull(),
		observationId: uuid(),
		observedAt: instant(),
	},
	(t) => [
		foreignKey({
			columns: [t.observationId, t.mediaId],
			foreignColumns: [mediaObservation.id, mediaObservation.mediaId],
		}),
		unique("media_occurrence_page_location").on(
			t.pageUriHash,
			t.pageRevision,
			t.selectorHash,
			t.mediaId,
		),
		index("media_occurrence_media_idx").on(t.mediaId, t.id),
	],
);

export const mediaRepresentation = pgTable(
	"media_representation",
	{
		id: uuid().primaryKey(),
		mediaId: uuid()
			.notNull()
			.references(() => mediaItem.id),
		observationId: uuid(),
		blobId: uuid().references(() => mediaBlob.id),
		mimeType: text().notNull(),
		codec: text(),
		width: numeric(),
		height: numeric(),
		durationTicks: numeric(),
		timeScale: integer(),
		channels: integer(),
		sampleRate: integer(),
		byteLength: numeric(),
		createdAt: instant(),
	},
	(t) => [
		unique("media_representation_id_media").on(t.id, t.mediaId),
		foreignKey({
			columns: [t.observationId, t.mediaId],
			foreignColumns: [mediaObservation.id, mediaObservation.mediaId],
		}),
		index("media_representation_media_idx").on(t.mediaId, t.id),
		check(
			"media_representation_values",
			sql`(${t.byteLength} is null or ${t.byteLength}>=0 and ${t.byteLength}=trunc(${t.byteLength}) and ${t.byteLength}<1e40) and (${t.channels} is null or ${t.channels}>0) and (${t.sampleRate} is null or ${t.sampleRate}>0)`,
		),
		check(
			"media_representation_dimensions",
			sql`(${t.width} is null or ${t.width}>0 and ${t.width}=trunc(${t.width}) and ${t.width}<1e40) and (${t.height} is null or ${t.height}>0 and ${t.height}=trunc(${t.height}) and ${t.height}<1e40)`,
		),
		check(
			"media_representation_time",
			sql`num_nonnulls(${t.durationTicks},${t.timeScale}) in (0,2) and (${t.durationTicks} is null or (${t.durationTicks}>=0 and ${t.durationTicks}=trunc(${t.durationTicks}) and ${t.durationTicks}<1e40 and ${t.timeScale}>0))`,
		),
	],
);

export const mediaStream = pgTable(
	"media_stream",
	{
		representationId: uuid()
			.notNull()
			.references(() => mediaRepresentation.id),
		ordinal: integer().notNull(),
		kind: text().notNull(),
		codec: text(),
		language: text(),
		durationTicks: numeric(),
		timeScale: integer(),
	},
	(t) => [
		primaryKey({ columns: [t.representationId, t.ordinal] }),
		check(
			"media_stream_time",
			sql`num_nonnulls(${t.durationTicks},${t.timeScale}) in (0,2) and (${t.durationTicks} is null or (${t.durationTicks}>=0 and ${t.durationTicks}=trunc(${t.durationTicks}) and ${t.durationTicks}<1e40 and ${t.timeScale}>0))`,
		),
		check(
			"media_stream_kind",
			sql`${t.kind} in ('video','audio','subtitle','data') and ${t.ordinal}>=0`,
		),
	],
);

export const mediaFragment = pgTable(
	"media_fragment",
	{
		id: uuid().primaryKey(),
		representationId: uuid()
			.notNull()
			.references(() => mediaRepresentation.id),
		startTicks: numeric(),
		endTicks: numeric(),
		timeScale: integer(),
		x: numeric(),
		y: numeric(),
		width: numeric(),
		height: numeric(),
		coordinateUnit: text(),
		selectorUri: text(),
	},
	(t) => [
		unique("media_fragment_id_representation").on(t.id, t.representationId),
		check(
			"media_fragment_percent",
			sql`${t.coordinateUnit} is distinct from 'percent' or (${t.x}+${t.width}<=100 and ${t.y}+${t.height}<=100)`,
		),
		index("media_fragment_representation_idx").on(t.representationId, t.id),
		check(
			"media_fragment_time",
			sql`num_nonnulls(${t.startTicks},${t.endTicks},${t.timeScale}) in (0,3) and (${t.timeScale} is null or (${t.timeScale}>0 and ${t.startTicks}>=0 and ${t.startTicks}=trunc(${t.startTicks}) and ${t.endTicks}=trunc(${t.endTicks}) and ${t.endTicks}<1e40 and ${t.endTicks}>=${t.startTicks}))`,
		),
		check(
			"media_fragment_space",
			sql`num_nonnulls(${t.x},${t.y},${t.width},${t.height},${t.coordinateUnit}) in (0,5) and (${t.coordinateUnit} is null or (${t.coordinateUnit} in ('pixel','percent') and ${t.x}>=0 and ${t.y}>=0 and ${t.width}>0 and ${t.height}>0))`,
		),
	],
);

export const mediaFingerprint = pgTable(
	"media_fingerprint",
	{
		mediaId: uuid()
			.notNull()
			.references(() => mediaItem.id),
		representationId: uuid().notNull(),
		algorithm: text().notNull(),
		version: text().notNull(),
		digest: text().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.representationId, t.algorithm, t.version] }),
		foreignKey({
			columns: [t.representationId, t.mediaId],
			foreignColumns: [mediaRepresentation.id, mediaRepresentation.mediaId],
		}),
		index("media_fingerprint_lookup").on(t.algorithm, t.version, t.digest),
	],
);

export const mediaMetadataRevision = pgTable(
	"media_metadata_revision",
	{
		mediaId: uuid()
			.notNull()
			.references(() => mediaItem.id),
		id: uuid().notNull(),
		parentId: uuid(),
		/** Audit attribution for this metadata revision; media authorship belongs to identified credit relations. */
		creatorEntityId: uuid().references(() => entityIdentity.id),
		fields: jsonb().$type<Record<string, unknown>>().notNull(),
		evidence: jsonb().$type<string[]>().notNull(),
		createdAt: instant(),
	},
	(t) => [
		primaryKey({ columns: [t.mediaId, t.id] }),
		foreignKey({ columns: [t.mediaId, t.parentId], foreignColumns: [t.mediaId, t.id] }),
		check(
			"media_metadata_shape",
			sql`jsonb_typeof(${t.fields})='object' and jsonb_typeof(${t.evidence})='array'`,
		),
	],
);

export const mediaFetchState = pgTable(
	"media_fetch_state",
	{
		locatorId: uuid()
			.primaryKey()
			.references(() => mediaLocator.id),
		nextAttemptAt: timestamp({ withTimezone: true }),
		leaseToken: uuid(),
		leaseUntil: timestamp({ withTimezone: true }),
		attempt: integer().default(0).notNull(),
		lastObservationId: uuid(),
	},
	(t) => [
		foreignKey({
			columns: [t.lastObservationId, t.locatorId],
			foreignColumns: [mediaObservation.id, mediaObservation.locatorId],
		}),
		check("media_fetch_attempt", sql`${t.attempt}>=0`),
		index("media_fetch_due_idx").on(t.nextAttemptAt, t.locatorId),
		check("media_fetch_lease", sql`num_nonnulls(${t.leaseToken},${t.leaseUntil}) in (0,2)`),
	],
);

export const mediaMetadataSelection = pgTable(
	"media_metadata_selection",
	{
		mediaId: uuid()
			.primaryKey()
			.references(() => mediaItem.id),
		revisionId: uuid().notNull(),
		version: bigint({ mode: "number" }).notNull(),
		selectedAt: instant(),
	},
	(t) => [
		foreignKey({
			columns: [t.mediaId, t.revisionId],
			foreignColumns: [mediaMetadataRevision.mediaId, mediaMetadataRevision.id],
		}),
		check("media_metadata_selection_version", sql`${t.version}>0`),
	],
);

export const mediaIndexGeneration = pgTable(
	"media_index_generation",
	{
		id: uuid().primaryKey(),
		kind: text().notNull(),
		state: text().notNull(),
		inputManifestHash: text().notNull(),
		createdAt: instant(),
	},
	(t) => [
		check(
			"media_index_generation_state",
			sql`${t.state} in ('building','sealed','active','retired','failed')`,
		),
	],
);
export const mediaIndexEntry = pgTable(
	"media_index_entry",
	{
		generationId: uuid()
			.notNull()
			.references(() => mediaIndexGeneration.id),
		mediaId: uuid()
			.notNull()
			.references(() => mediaItem.id),
		metadataRevisionId: uuid().notNull(),
		payload: jsonb().$type<Record<string, unknown>>().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.generationId, t.mediaId] }),
		foreignKey({
			columns: [t.mediaId, t.metadataRevisionId],
			foreignColumns: [mediaMetadataRevision.mediaId, mediaMetadataRevision.id],
		}),
	],
);
