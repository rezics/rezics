import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	jsonb,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { users } from "../identity/auth";
import { referenceValue } from "../knowledge/reference-value";
import { realm } from "../realms/realm";

/** @alpha Wiki pages own identity and editing locality independently of high-volume forum rows. */
export const wikiPage = pgTable(
	"wiki_page",
	{
		id: uuid().primaryKey(),
		realmId: uuid().references(() => realm.id),
		subjectRefId: uuid().references(() => referenceValue.id),
		state: text().notNull(),
		createdAt: timestamp({ withTimezone: true, precision: 3 }).defaultNow().notNull(),
	},
	(t) => [
		index("wiki_page_subject").on(t.subjectRefId, t.id),
		check("wiki_page_state", sql`${t.state} in ('draft','published','withdrawn','erased')`),
	],
);
export const wikiRevision = pgTable(
	"wiki_revision",
	{
		pageId: uuid()
			.notNull()
			.references(() => wikiPage.id),
		id: uuid().notNull(),
		language: text().notNull(),
		parentId: uuid(),
		authorUserId: uuid().references(() => users.id),
		summary: text(),
		createdAt: timestamp({ withTimezone: true, precision: 3 }).defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.pageId, t.id] }),
		unique("wiki_revision_language").on(t.pageId, t.id, t.language),
		foreignKey({
			columns: [t.pageId, t.parentId, t.language],
			foreignColumns: [t.pageId, t.id, t.language],
		}),
		index("wiki_revision_history").on(t.pageId, t.language, t.createdAt, t.id),
	],
);
export const wikiRevisionPayload = pgTable(
	"wiki_revision_payload",
	{
		pageId: uuid().notNull(),
		revisionId: uuid().notNull(),
		title: text().notNull(),
		format: text().notNull(),
		body: jsonb().$type<unknown>().notNull(),
		digest: text().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.pageId, t.revisionId] }),
		foreignKey({
			columns: [t.pageId, t.revisionId],
			foreignColumns: [wikiRevision.pageId, wikiRevision.id],
		}),
		check("wiki_payload_format", sql`${t.format} in ('portable-text','markdown','plain-text')`),
	],
);
export const wikiHead = pgTable(
	"wiki_head",
	{
		pageId: uuid()
			.notNull()
			.references(() => wikiPage.id),
		language: text().notNull(),
		branch: text().notNull(),
		revisionId: uuid().notNull(),
		version: bigint({ mode: "number" }).notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.pageId, t.language, t.branch] }),
		foreignKey({
			columns: [t.pageId, t.revisionId, t.language],
			foreignColumns: [wikiRevision.pageId, wikiRevision.id, wikiRevision.language],
		}),
		check("wiki_head_version", sql`${t.version}>0`),
	],
);
export const wikiLink = pgTable(
	"wiki_link",
	{
		pageId: uuid().notNull(),
		revisionId: uuid().notNull(),
		id: uuid().notNull(),
		targetPageId: uuid().references(() => wikiPage.id),
		externalIri: text(),
		selector: text(),
	},
	(t) => [
		primaryKey({ columns: [t.pageId, t.revisionId, t.id] }),
		foreignKey({
			columns: [t.pageId, t.revisionId],
			foreignColumns: [wikiRevision.pageId, wikiRevision.id],
		}),
		check("wiki_link_target", sql`num_nonnulls(${t.targetPageId},${t.externalIri})=1`),
		index("wiki_link_reverse").on(t.targetPageId, t.pageId),
	],
);
export const wikiAddress = pgTable(
	"wiki_address",
	{
		namespace: text().notNull(),
		language: text().notNull(),
		path: text().notNull(),
		pageId: uuid()
			.notNull()
			.references(() => wikiPage.id),
	},
	(t) => [
		primaryKey({ columns: [t.namespace, t.language, t.path] }),
		index("wiki_address_page").on(t.pageId),
	],
);
export const wikiSelection = pgTable(
	"wiki_selection",
	{
		pageId: uuid()
			.notNull()
			.references(() => wikiPage.id),
		language: text().notNull(),
		revisionId: uuid().notNull(),
		version: bigint({ mode: "number" }).notNull(),
		reviewedByUserId: uuid().references(() => users.id),
		selectedAt: timestamp({ withTimezone: true, precision: 3 }).defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.pageId, t.language] }),
		foreignKey({
			columns: [t.pageId, t.revisionId, t.language],
			foreignColumns: [wikiRevision.pageId, wikiRevision.id, wikiRevision.language],
		}),
		check("wiki_selection_version", sql`${t.version}>0`),
	],
);
