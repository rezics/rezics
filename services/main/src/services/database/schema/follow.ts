import { referenceValue } from "./reference-value";
import { sql } from "drizzle-orm";
import { boolean, foreignKey, index, primaryKey, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { entityIdentity } from "./catalog-identity";
import { users } from "./auth";
import {
	createCreatedAtColumn,
	createFractionalIndexPositionByteLengthConstraint,
	createUpdatedAtColumn,
	fractionalIndexPosition,
} from "./columns";

/**
 * An Entity's one-way interest relation to a Unit and the source of truth for
 * follow state. Every readable Unit kind can be a follow target.
 *
 * This relation does not enable notification delivery channels or define which
 * activities are surfaced to followers. Downstream consumers define those
 * behaviors independently.
 */
export const unitFollow = pgTable(
	"unit_follow",
	{
		followerProfileId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "cascade" }),
		targetReferenceId: uuid()
			.notNull()
			.references(() => referenceValue.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.followerProfileId, table.targetReferenceId] }),
		index("unit_follow_unit_created_at_idx").on(
			table.targetReferenceId,
			table.createdAt.desc(),
			table.followerProfileId,
		),
	],
);

/** Account-private ordering and delivery choices, separate from the public Entity follow relation. */
export const accountFollowPreference = pgTable(
	"account_follow_preference",
	{
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		followerEntityId: uuid().notNull(),
		targetReferenceId: uuid().notNull(),
		position: fractionalIndexPosition()
			.default(sql`'a0' || replace(uuidv7()::text, '-', '') || 'V'`)
			.notNull(),
		favorite: boolean().default(false).notNull(),
		inApp: boolean().default(true).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.authUserId, table.targetReferenceId] }),
		unique("account_follow_preference_follow_key").on(
			table.followerEntityId,
			table.targetReferenceId,
		),
		foreignKey({
			name: "account_follow_preference_follow_fk",
			columns: [table.followerEntityId, table.targetReferenceId],
			foreignColumns: [unitFollow.followerProfileId, unitFollow.targetReferenceId],
		}).onDelete("cascade"),
		index("account_follow_preference_auth_order_idx").on(
			table.authUserId,
			table.favorite.desc(),
			table.position,
			table.targetReferenceId,
		),
		index("account_follow_preference_enabled_unit_idx")
			.on(table.targetReferenceId, table.authUserId)
			.where(sql`${table.inApp}`),
		createFractionalIndexPositionByteLengthConstraint(
			"account_follow_preference_position_check",
			table.position,
		),
	],
);
