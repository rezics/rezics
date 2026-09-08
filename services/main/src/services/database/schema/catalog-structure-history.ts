import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	jsonb,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn } from "./columns";
import { CatalogIdentityTables } from "./catalog-identity";

function structureHistory(owner: "program" | "publishing") {
	const history = pgTable(
		`${owner}_component_revision`,
		{
			ownerId: uuid()
				.notNull()
				.references(() => CatalogIdentityTables[owner].id, { onDelete: "restrict" }),
			id: uuid().default(sql`uuidv7()`).notNull(),
			component: text().notNull(),
			componentKey: text().notNull(),
			componentSequence: bigint({ mode: "number" }).notNull(),
			ownerRevision: bigint({ mode: "number" }).notNull(),
			operation: text().$type<"INSERT" | "UPDATE" | "DELETE">().notNull(),
			value: jsonb().$type<Record<string, unknown>>().notNull(),
			createdAt: createCreatedAtColumn(),
		},
		(t) => [
			primaryKey({ columns: [t.ownerId, t.id] }),
			unique(`${owner}_component_revision_sequence_key`).on(
				t.ownerId,
				t.component,
				t.componentKey,
				t.componentSequence,
			),
			check(
				`${owner}_component_revision_values`,
				sql`${t.operation} in ('INSERT','UPDATE','DELETE') and ${t.ownerRevision} between 1 and 9007199254740991 and ${t.componentSequence} between 1 and 9007199254740991 and octet_length(${t.component}) between 1 and 96 and octet_length(${t.componentKey}) between 1 and 512 and jsonb_typeof(${t.value})='object' and octet_length(${t.value}::text)<=1048576`,
			),
		],
	);
	const head = pgTable(
		`${owner}_component_head`,
		{
			ownerId: uuid()
				.notNull()
				.references(() => CatalogIdentityTables[owner].id, { onDelete: "restrict" }),
			component: text().notNull(),
			componentKey: text().notNull(),
			componentSequence: bigint({ mode: "number" }).notNull(),
			historyId: uuid().notNull(),
		},
		(t) => [
			primaryKey({ columns: [t.ownerId, t.component, t.componentKey] }),
			foreignKey({
				name: `${owner}_component_head_history_fk`,
				columns: [t.ownerId, t.historyId],
				foreignColumns: [history.ownerId, history.id],
			}).onDelete("restrict"),
			check(
				`${owner}_component_head_values`,
				sql`${t.componentSequence} between 1 and 9007199254740991 and octet_length(${t.component}) between 1 and 96 and octet_length(${t.componentKey}) between 1 and 512`,
			),
		],
	);
	return { history, head };
}

/** Independent native structure histories; these are not a new common identity parent. */
export const CatalogStructureHistoryTables = {
	program: structureHistory("program"),
	publishing: structureHistory("publishing"),
};
export const programComponentRevision = CatalogStructureHistoryTables.program.history;
export const programComponentHead = CatalogStructureHistoryTables.program.head;
export const publishingComponentRevision = CatalogStructureHistoryTables.publishing.history;
export const publishingComponentHead = CatalogStructureHistoryTables.publishing.head;
