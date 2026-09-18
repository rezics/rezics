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
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { referenceValue } from "../knowledge/reference-value";
import { schemaTerm } from "../vocabulary/registry";
import { mediaItem, mediaRepresentation, mediaFragment } from "./indexing";

export const mediaUse = pgTable(
	"media_use",
	{
		id: uuid().primaryKey(),
		subjectRefId: uuid()
			.notNull()
			.references(() => referenceValue.id),
		mediaId: uuid()
			.notNull()
			.references(() => mediaItem.id),
		roleId: uuid()
			.notNull()
			.references(() => schemaTerm.id),
	},
	(t) => [
		unique("media_use_id_media").on(t.id, t.mediaId),
		unique("media_use_subject_role").on(t.id, t.subjectRefId, t.roleId),
		index("media_use_subject").on(t.subjectRefId, t.roleId, t.id),
		index("media_use_media").on(t.mediaId, t.id),
	],
);
export const mediaUseRevision = pgTable(
	"media_use_revision",
	{
		useId: uuid().notNull(),
		id: uuid().notNull(),
		mediaId: uuid().notNull(),
		representationId: uuid(),
		fragmentId: uuid(),
		language: text(),
		caption: text(),
		sourceUri: text(),
	},
	(t) => [
		primaryKey({ columns: [t.useId, t.id] }),
		foreignKey({ columns: [t.useId, t.mediaId], foreignColumns: [mediaUse.id, mediaUse.mediaId] }),
		foreignKey({
			columns: [t.representationId, t.mediaId],
			foreignColumns: [mediaRepresentation.id, mediaRepresentation.mediaId],
		}),
		foreignKey({
			columns: [t.fragmentId, t.representationId],
			foreignColumns: [mediaFragment.id, mediaFragment.representationId],
		}),
		check(
			"media_use_fragment_representation",
			sql`${t.fragmentId} is null or ${t.representationId} is not null`,
		),
	],
);
export const mediaSlot = pgTable(
	"media_slot",
	{
		id: uuid().primaryKey(),
		subjectRefId: uuid()
			.notNull()
			.references(() => referenceValue.id),
		roleId: uuid()
			.notNull()
			.references(() => schemaTerm.id),
		language: text().notNull().default(""),
		contextKey: text().notNull().default(""),
		minimum: integer().notNull().default(0),
		maximum: integer().notNull(),
	},
	(t) => [
		unique("media_slot_scope").on(t.subjectRefId, t.roleId, t.language, t.contextKey),
		unique("media_slot_subject_role").on(t.id, t.subjectRefId, t.roleId),
		check(
			"media_slot_cardinality",
			sql`${t.minimum}>=0 and ${t.maximum}>=${t.minimum} and ${t.maximum}<=1024`,
		),
	],
);
export const mediaSelectionRevision = pgTable(
	"media_selection_revision",
	{
		slotId: uuid()
			.notNull()
			.references(() => mediaSlot.id),
		id: uuid().notNull(),
		sealed: boolean().notNull().default(false),
	},
	(t) => [primaryKey({ columns: [t.slotId, t.id] })],
);
export const mediaSelectionMember = pgTable(
	"media_selection_member",
	{
		slotId: uuid().notNull(),
		selectionRevisionId: uuid().notNull(),
		position: integer().notNull(),
		subjectRefId: uuid().notNull(),
		roleId: uuid().notNull(),
		useId: uuid().notNull(),
		useRevisionId: uuid().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.slotId, t.selectionRevisionId, t.position] }),
		foreignKey({
			columns: [t.slotId, t.selectionRevisionId],
			foreignColumns: [mediaSelectionRevision.slotId, mediaSelectionRevision.id],
		}),
		foreignKey({
			columns: [t.slotId, t.subjectRefId, t.roleId],
			foreignColumns: [mediaSlot.id, mediaSlot.subjectRefId, mediaSlot.roleId],
		}),
		foreignKey({
			columns: [t.useId, t.subjectRefId, t.roleId],
			foreignColumns: [mediaUse.id, mediaUse.subjectRefId, mediaUse.roleId],
		}),
		foreignKey({
			columns: [t.useId, t.useRevisionId],
			foreignColumns: [mediaUseRevision.useId, mediaUseRevision.id],
		}),
		check("media_selection_position", sql`${t.position} between 0 and 1023`),
	],
);
export const mediaSelectionHead = pgTable(
	"media_selection_head",
	{
		slotId: uuid()
			.primaryKey()
			.references(() => mediaSlot.id),
		revisionId: uuid().notNull(),
		version: bigint({ mode: "number" }).notNull(),
	},
	(t) => [
		foreignKey({
			columns: [t.slotId, t.revisionId],
			foreignColumns: [mediaSelectionRevision.slotId, mediaSelectionRevision.id],
		}),
		check("media_selection_head_version", sql`${t.version}>0`),
	],
);
