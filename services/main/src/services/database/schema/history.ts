import { inArray, sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	pgEnum,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import {
	type ContentLanguage,
	ContentLanguageValues,
	UnitStatusActorKindValues,
	toEnumValues,
} from "./contract-values";
import { profile } from "./profile";
import { unit, unitStatus } from "./unit";

export const UnitRevisionSlotRoleValues = [
	"main",
	"localization",
	"relations",
	"structure",
	"rules",
] as const;

export const RevisionContentEncodingValues = ["full", "delta"] as const;
export type RevisionContentEncoding = (typeof RevisionContentEncodingValues)[number];
export const unitRevisionSlotRole = pgEnum(
	"unit_revision_slot_role",
	toEnumValues(UnitRevisionSlotRoleValues),
);
export const unitStatusActorKind = pgEnum(
	"unit_status_actor_kind",
	toEnumValues(UnitStatusActorKindValues),
);

export const revisionContent = pgTable(
	"revision_content",
	{
		id: createUuidv7PrimaryKey(),
		model: text().notNull(),
		sha256: text().notNull(),
		byteSize: integer().notNull(),
		encoding: text().$type<RevisionContentEncoding>().default("full").notNull(),
		baseContentId: uuid(),
		deltaDepth: integer().default(0).notNull(),
		payload: jsonb().$type<unknown>().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.baseContentId],
			foreignColumns: [table.id],
			name: "revision_content_base_fkey",
		}).onDelete("restrict"),
		unique("revision_content_model_sha256_key").on(table.model, table.sha256),
		check("revision_content_model_not_blank", sql`btrim(${table.model}) <> ''`),
		check("revision_content_sha256_check", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
		check("revision_content_byte_size_check", sql`${table.byteSize} >= 0`),
		check("revision_content_encoding_check", sql`${table.encoding} in ('full', 'delta')`),
		check(
			"revision_content_delta_shape_check",
			sql`(
				${table.encoding} = 'full'
				and ${table.baseContentId} is null
				and ${table.deltaDepth} = 0
			) or (
				${table.encoding} = 'delta'
				and ${table.baseContentId} is not null
				and ${table.deltaDepth} > 0
			)`,
		),
		check(
			"revision_content_payload_check",
			sql`jsonb_typeof(${table.payload}) in ('object', 'array')`,
		),
	],
);

export const unitRevision = pgTable(
	"unit_revision",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		parentRevisionId: uuid(),
		actorProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		/** @UNIT_LOCALIZATION_EXEMPT Authored snapshot: original point-in-time edit summary, never interface copy. */
		editSummary: text(),
		minor: boolean().default(false).notNull(),
		byteSize: integer().notNull(),
		contentHidden: boolean().default(false).notNull(),
		summaryHidden: boolean().default(false).notNull(),
		actorHidden: boolean().default(false).notNull(),
		suppressed: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("unit_revision_id_unit_key").on(table.id, table.unitId),
		foreignKey({
			columns: [table.parentRevisionId, table.unitId],
			foreignColumns: [table.id, table.unitId],
			name: "unit_revision_parent_unit_fkey",
		}).onDelete("restrict"),
		index("unit_revision_unit_created_at_idx").on(
			table.unitId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("unit_revision_parent_idx").on(table.parentRevisionId),
		index("unit_revision_actor_created_at_idx").on(
			table.actorProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check("unit_revision_byte_size_check", sql`${table.byteSize} >= 0`),
		check(
			"unit_revision_suppressed_check",
			sql`not ${table.suppressed} or ${table.contentHidden} or ${table.summaryHidden} or ${table.actorHidden}`,
		),
	],
);

/** Immutable provenance for every real Unit lifecycle transition. */
export const unitStatusEvent = pgTable(
	"unit_status_event",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		fromStatus: unitStatus(),
		toStatus: unitStatus().notNull(),
		actorKind: unitStatusActorKind().notNull(),
		changedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		revisionId: uuid(),
		actorHidden: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.revisionId, table.unitId],
			foreignColumns: [unitRevision.id, unitRevision.unitId],
			name: "unit_status_event_revision_unit_fkey",
		}).onDelete("restrict"),
		index("unit_status_event_unit_created_at_idx").on(
			table.unitId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("unit_status_event_publication_idx").on(
			table.unitId,
			table.toStatus,
			table.createdAt,
			table.id,
		),
		index("unit_status_event_actor_created_at_idx").on(
			table.changedByProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"unit_status_event_transition_check",
			sql`${table.fromStatus} is null or ${table.fromStatus} <> ${table.toStatus}`,
		),
		check(
			"unit_status_event_actor_shape_check",
			sql`(
				${table.actorKind} = 'profile'::unit_status_actor_kind
				and ${table.changedByProfileId} is not null
			) or (
				${table.actorKind} in ('system'::unit_status_actor_kind, 'import'::unit_status_actor_kind)
				and ${table.changedByProfileId} is null
			)`,
		),
	],
);

export const unitRevisionSlot = pgTable(
	"unit_revision_slot",
	{
		revisionId: uuid().notNull(),
		unitId: uuid().notNull(),
		role: unitRevisionSlotRole().notNull(),
		slotKey: text().$type<ContentLanguage | "">().notNull(),
		contentId: uuid()
			.notNull()
			.references(() => revisionContent.id, { onDelete: "restrict" }),
		originRevisionId: uuid().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.revisionId, table.role, table.slotKey] }),
		foreignKey({
			columns: [table.revisionId, table.unitId],
			foreignColumns: [unitRevision.id, unitRevision.unitId],
			name: "unit_revision_slot_revision_unit_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.originRevisionId, table.unitId],
			foreignColumns: [unitRevision.id, unitRevision.unitId],
			name: "unit_revision_slot_origin_unit_fkey",
		}).onDelete("restrict"),
		index("unit_revision_slot_content_idx").on(table.contentId),
		index("unit_revision_slot_origin_idx").on(table.originRevisionId),
		check(
			"unit_revision_slot_key_shape_check",
			sql`(
				${table.role} = 'localization'::unit_revision_slot_role
				and ${inArray(table.slotKey, ContentLanguageValues)}
			) or (
				${table.role} <> 'localization'::unit_revision_slot_role
				and ${table.slotKey} = ''
			)`,
		),
	],
);

export const unitRevisionHead = pgTable(
	"unit_revision_head",
	{
		unitId: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		revisionId: uuid().notNull(),
	},
	(table) => [
		unique("unit_revision_head_revision_key").on(table.revisionId),
		foreignKey({
			columns: [table.revisionId, table.unitId],
			foreignColumns: [unitRevision.id, unitRevision.unitId],
			name: "unit_revision_head_revision_unit_fkey",
		}).onDelete("restrict"),
	],
);

export const unitRevisionTag = pgTable(
	"unit_revision_tag",
	{
		revisionId: uuid()
			.notNull()
			.references(() => unitRevision.id, { onDelete: "cascade" }),
		tag: text().notNull(),
		metadata: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.revisionId, table.tag] }),
		index("unit_revision_tag_tag_revision_idx").on(table.tag, table.revisionId),
		check("unit_revision_tag_not_blank", sql`btrim(${table.tag}) <> ''`),
		check("unit_revision_tag_metadata_check", sql`jsonb_typeof(${table.metadata}) = 'object'`),
	],
);
