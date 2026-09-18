import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgEnum, text, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { pgTable } from "../shared/base";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
} from "../shared/columns";
import { UserAccountStateValues, toEnumValues } from "../shared/contract-values";
import { governanceDecision } from "../governance/governance";

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
		updatedByAuthUserId: uuid().notNull(),
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
			name: "user_account_state_updated_by_auth_user_id_fkey",
			columns: [table.updatedByAuthUserId],
			foreignColumns: [users.id],
		}).onDelete("restrict"),
		index("user_account_state_state_expiry_idx").on(table.state, table.expiresAt),
		index("user_account_state_updated_by_idx").on(table.updatedByAuthUserId),
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
