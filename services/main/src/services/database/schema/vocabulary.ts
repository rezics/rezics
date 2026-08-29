import { inArray, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { ContentLanguageValues, type ContentLanguage } from "./contract-values";
import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile } from "./profile";

export const VocabularyNodeKindValues = ["concept", "guide"] as const;
export type VocabularyNodeKind = (typeof VocabularyNodeKindValues)[number];

export const VocabularyNodeStatusValues = ["active", "retired"] as const;
export type VocabularyNodeStatus = (typeof VocabularyNodeStatusValues)[number];

export const TagRelationKindValues = [
	"generic",
	"partitive",
	"instance",
	"organizational",
	"facet_value",
] as const;
export type TagRelationKind = (typeof TagRelationKindValues)[number];

export type VocabularyProvenance = Readonly<Record<string, unknown>>;

/** Stable identity shared by indexable Tag concepts and non-indexable guide nodes. */
export const vocabularyNode = pgTable(
	"vocabulary_node",
	{
		id: createUuidv7PrimaryKey(),
		kind: text().$type<VocabularyNodeKind>().notNull(),
		status: text().$type<VocabularyNodeStatus>().default("active").notNull(),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		createdAt: createCreatedAtColumn(),
		retiredAt: createTimestampMsColumn(),
	},
	(table) => [
		unique("vocabulary_node_id_kind_key").on(table.id, table.kind),
		index("vocabulary_node_kind_status_idx").on(table.kind, table.status, table.id),
		check("vocabulary_node_kind_check", inArray(table.kind, VocabularyNodeKindValues)),
		check("vocabulary_node_status_check", inArray(table.status, VocabularyNodeStatusValues)),
		check(
			"vocabulary_node_retirement_check",
			sql`(${table.status} = 'active' and ${table.retiredAt} is null)
				or (${table.status} = 'retired' and ${table.retiredAt} is not null)`,
		),
	],
);

/** Organizational vocabulary node that cannot be applied to a Unit or indexed as a Tag. */
export const guideNode = pgTable("guide_node", {
	id: uuid()
		.primaryKey()
		.references(() => vocabularyNode.id, { onDelete: "cascade" }),
	createdAt: createCreatedAtColumn(),
	updatedAt: createUpdatedAtColumn(),
});

/** Human-readable guide-node label; guide nodes deliberately are not Units. */
export const guideNodeLocalization = pgTable(
	"guide_node_localization",
	{
		nodeId: uuid()
			.notNull()
			.references(() => guideNode.id, { onDelete: "cascade" }),
		language: text().$type<ContentLanguage>().notNull(),
		title: text().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.nodeId, table.language] }),
		index("guide_node_localization_language_node_idx").on(table.language, table.nodeId),
		check("guide_node_localization_language_check", inArray(table.language, ContentLanguageValues)),
		check(
			"guide_node_localization_title_check",
			sql`btrim(${table.title}) <> '' and octet_length(${table.title}) <= 512`,
		),
	],
);

/** Governed typed adjacency in the vocabulary graph. */
export const tagRelation = pgTable(
	"tag_relation",
	{
		id: createUuidv7PrimaryKey(),
		parentNodeId: uuid()
			.notNull()
			.references(() => vocabularyNode.id, { onDelete: "restrict" }),
		childNodeId: uuid()
			.notNull()
			.references(() => vocabularyNode.id, { onDelete: "restrict" }),
		relationKind: text().$type<TagRelationKind>().notNull(),
		revision: integer().default(1).notNull(),
		status: text().$type<VocabularyNodeStatus>().default("active").notNull(),
		provenance: createJsonObjectColumn<VocabularyProvenance>(),
		createdByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		createdAt: createCreatedAtColumn(),
		retiredAt: createTimestampMsColumn(),
	},
	(table) => [
		unique("tag_relation_revision_key").on(
			table.parentNodeId,
			table.childNodeId,
			table.relationKind,
			table.revision,
		),
		uniqueIndex("tag_relation_active_key")
			.on(table.parentNodeId, table.childNodeId, table.relationKind)
			.where(sql`${table.status} = 'active'`),
		index("tag_relation_parent_route_idx").on(
			table.parentNodeId,
			table.status,
			table.relationKind,
			table.childNodeId,
			table.id,
		),
		index("tag_relation_child_route_idx").on(
			table.childNodeId,
			table.status,
			table.relationKind,
			table.parentNodeId,
			table.id,
		),
		check("tag_relation_kind_check", inArray(table.relationKind, TagRelationKindValues)),
		check("tag_relation_status_check", inArray(table.status, VocabularyNodeStatusValues)),
		check("tag_relation_revision_check", sql`${table.revision} >= 1`),
		check("tag_relation_distinct_check", sql`${table.parentNodeId} <> ${table.childNodeId}`),
		check(
			"tag_relation_retirement_check",
			sql`(${table.status} = 'active' and ${table.retiredAt} is null)
				or (${table.status} = 'retired' and ${table.retiredAt} is not null)`,
		),
		createJsonObjectConstraint("tag_relation_provenance_object_check", table.provenance),
	],
);
