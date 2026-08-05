import { sql } from "drizzle-orm";
import { check, jsonb, uuid } from "drizzle-orm/pg-core";
import type { SharedSearchQueryDocument } from "@rezics/filter";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { profile } from "./profile";

/**
 * Immutable public Search query snapshots.
 *
 * The UUIDv7 primary key is the bearer identifier used by share links. Stored
 * presentation metadata is never trusted for execution; the API revalidates
 * the Search Feature state before insert and after read.
 */
export const sharedSearchQuery = pgTable(
	"shared_search_query",
	{
		id: createUuidv7PrimaryKey(),
		document: jsonb().$type<SharedSearchQueryDocument>().notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		check(
			"shared_search_query_document_check",
			sql`jsonb_typeof(${table.document}) = 'object'`,
		),
	],
);
