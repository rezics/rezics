import { sql } from "drizzle-orm";
import { check, index, primaryKey, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { pgTable } from "./base";
import { createCreatedAtColumn, createTimestampMsColumn, createUpdatedAtColumn } from "./columns";
import { unit } from "./unit";

export const profile = pgTable(
	"profile",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		joinedAt: createTimestampMsColumn().defaultNow().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [unique("profile_auth_user_id_key").on(table.authUserId)],
);

export const profileBlock = pgTable(
	"profile_block",
	{
		blockerProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		blockedProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.blockerProfileId, table.blockedProfileId] }),
		index("profile_block_blocked_idx").on(table.blockedProfileId),
		check(
			"profile_block_not_self_check",
			sql`${table.blockerProfileId} <> ${table.blockedProfileId}`,
		),
	],
);
