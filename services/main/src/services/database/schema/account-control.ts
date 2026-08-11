import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgEnum, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { users } from "./auth";
import { createCreatedAtColumn, createTimestampMsColumn, createUpdatedAtColumn } from "./columns";
import { UserAccountStateValues, toEnumValues } from "./contract-values";
import { profile } from "./profile";
import { governanceDecision } from "./governance";

export const userAccountStateValue = pgEnum(
	"user_account_state_value",
	toEnumValues(UserAccountStateValues),
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
		decisionId: uuid().references(() => governanceDecision.id, { onDelete: "restrict" }),
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
		index("user_account_state_decision_idx")
			.on(table.decisionId)
			.where(sql`${table.decisionId} is not null`),
		check("user_account_state_revision_check", sql`${table.revision} > 0`),
		check(
			"user_account_state_shape_check",
			sql`(
				${table.state} = 'active'::user_account_state_value
				and ${table.note} is null
				and ${table.expiresAt} is null
			) or (
				${table.state} = 'suspended'::user_account_state_value
			) or (
				${table.state} = 'closed'::user_account_state_value
				and ${table.expiresAt} is null
			)`,
		),
	],
);
