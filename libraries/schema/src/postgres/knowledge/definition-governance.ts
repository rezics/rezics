import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { createCreatedAtColumn } from "../shared/columns";
import { catalogDefinitionRevision } from "../catalog/identity";
import { users } from "../identity/auth";
import { platformCapabilityGrant } from "../realms/realm";

/** Immutable language-specific names for one exact governed meaning; 32 unique slots bound each read. */
export const catalogDefinitionLabel = pgTable(
	"catalog_definition_label",
	{
		definitionRevisionId: uuid()
			.notNull()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		languageTag: text().notNull(),
		position: integer().notNull(),
		label: text().notNull(),
		description: text(),
	},
	(table) => [
		primaryKey({ columns: [table.definitionRevisionId, table.languageTag] }),
		unique("catalog_definition_label_slot_key").on(table.definitionRevisionId, table.position),
		check(
			"catalog_definition_label_bounds",
			sql`${table.position} between 0 and 31 and octet_length(${table.languageTag}) between 1 and 255 and octet_length(${table.label}) between 1 and 800 and (${table.description} is null or octet_length(${table.description}) between 1 and 4096)`,
		),
	],
);

/** Private human review proof; public history exposes only its presence and the exact meaning. */
export const catalogDefinitionReview = pgTable(
	"catalog_definition_review",
	{
		definitionRevisionId: uuid()
			.primaryKey()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		grantId: uuid()
			.notNull()
			.references(() => platformCapabilityGrant.id, { onDelete: "restrict" }),
		reason: text().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		index("catalog_definition_review_auth_idx").on(table.authUserId, table.definitionRevisionId),
		index("catalog_definition_review_grant_idx").on(table.grantId, table.definitionRevisionId),
		check(
			"catalog_definition_review_reason_check",
			sql`octet_length(${table.reason}) between 1 and 8192`,
		),
	],
);
