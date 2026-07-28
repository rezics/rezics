import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgEnum, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { users } from "./auth";
import { createCreatedAtColumn, createTimestampMsColumn, createUpdatedAtColumn } from "./columns";
import {
	UserAccountStateReasonValues,
	UserAccountStateValues,
	toEnumValues,
} from "./contract-values";
import { profile } from "./core";

export const userAccountStateValue = pgEnum(
	"user_account_state_value",
	toEnumValues(UserAccountStateValues),
);
export const userAccountStateReason = pgEnum(
	"user_account_state_reason",
	toEnumValues(UserAccountStateReasonValues),
);

/**
 * Administrative account lifecycle state.
 *
 * No row means the account is active at revision zero. The first management
 * command materializes the row, which keeps ordinary sign-up independent from
 * the platform control plane.
 */
export const userAccountState = pgTable(
	"user_account_state",
	{
		userId: uuid().primaryKey(),
		state: userAccountStateValue().default("active").notNull(),
		reason: userAccountStateReason(),
		note: text(),
		expiresAt: createTimestampMsColumn(),
		updatedByProfileId: uuid().notNull(),
		revision: integer().default(1).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			name: "user_account_state_user_id_fkey",
			columns: [table.userId],
			foreignColumns: [users.id],
		}).onDelete("cascade"),
		foreignKey({
			name: "user_account_state_updated_by_profile_id_fkey",
			columns: [table.updatedByProfileId],
			foreignColumns: [profile.id],
		}).onDelete("restrict"),
		index("user_account_state_state_expiry_idx").on(table.state, table.expiresAt),
		index("user_account_state_updated_by_idx").on(table.updatedByProfileId),
		check("user_account_state_revision_check", sql`${table.revision} > 0`),
		check(
			"user_account_state_shape_check",
			sql`(
				${table.state} = 'active'::user_account_state_value
				and ${table.reason} is null
				and ${table.note} is null
				and ${table.expiresAt} is null
			) or (
				${table.state} = 'suspended'::user_account_state_value
				and ${table.reason} is not null
			) or (
				${table.state} = 'closed'::user_account_state_value
				and ${table.reason} is not null
				and ${table.expiresAt} is null
			)`,
		),
	],
);
