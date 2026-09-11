import { sql } from "drizzle-orm";
import { bigint, check, index, jsonb, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { users } from "./auth";
import { referenceValue } from "./reference-value";
import {
	createCreatedAtColumn,
	createUpdatedAtColumn,
	fractionalIndexPosition,
	createFractionalIndexPositionByteLengthConstraint,
} from "./columns";

/** One account-local optimistic concurrency token; no public Collection or immutable content store. */
export const accountFavoritesState = pgTable(
	"account_favorites_state",
	{
		authUserId: uuid()
			.primaryKey()
			.references(() => users.id, { onDelete: "restrict" }),
		revision: bigint({ mode: "number" }).notNull().default(0),
	},
	(table) => [
		check(
			"account_favorites_state_revision_check",
			sql`${table.revision} between 0 and 9007199254740991`,
		),
	],
);

/** Private order, note and captured preview, owned directly by the authenticated account. */
export const accountFavorite = pgTable(
	"account_favorite",
	{
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		targetReferenceId: uuid()
			.notNull()
			.references(() => referenceValue.id, { onDelete: "restrict" }),
		position: fractionalIndexPosition().notNull(),
		note: text(),
		snapshot: jsonb().$type<unknown>().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.authUserId, table.targetReferenceId] }),
		unique("account_favorite_position_key").on(table.authUserId, table.position),
		index("account_favorite_target_idx").on(table.targetReferenceId, table.authUserId),
		check(
			"account_favorite_note_check",
			sql`${table.note} is null or octet_length(${table.note}) <= 65536`,
		),
		check(
			"account_favorite_snapshot_check",
			sql`jsonb_typeof(${table.snapshot}) = 'object' and octet_length(${table.snapshot}::text) <= 8192`,
		),
		check("account_favorite_revision_check", sql`${table.revision} between 1 and 9007199254740991`),
		createFractionalIndexPositionByteLengthConstraint(
			"account_favorite_position_check",
			table.position,
		),
	],
);

/** Deletable account-local history. Account erasure removes these rows before the state row. */
export const accountFavoriteRevision = pgTable(
	"account_favorite_revision",
	{
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		revision: bigint({ mode: "number" }).notNull(),
		targetReferenceId: uuid()
			.notNull()
			.references(() => referenceValue.id, { onDelete: "restrict" }),
		operation: text().$type<"save" | "update" | "delete" | "restore">().notNull(),
		snapshot: jsonb().$type<unknown>(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.authUserId, table.revision] }),
		index("account_favorite_revision_target_idx").on(
			table.authUserId,
			table.targetReferenceId,
			table.revision.desc(),
		),
		index("account_favorite_revision_target_merge_idx").on(
			table.targetReferenceId,
			table.authUserId,
		),
		check(
			"account_favorite_revision_number_check",
			sql`${table.revision} between 1 and 9007199254740991`,
		),
		check(
			"account_favorite_revision_operation_check",
			sql`${table.operation} in ('save','update','delete','restore')`,
		),
		check(
			"account_favorite_revision_snapshot_check",
			sql`(${table.operation} = 'delete' and ${table.snapshot} is null) or (${table.operation} <> 'delete' and ${table.snapshot} is not null and jsonb_typeof(${table.snapshot}) = 'object' and not (${table.snapshot} ? 'target') and octet_length(${table.snapshot}::text) <= 98304)`,
		),
	],
);
