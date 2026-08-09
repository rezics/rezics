import { sql } from "drizzle-orm";
import { boolean, check, index, primaryKey, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createFractionalIndexPositionByteLengthConstraint,
	createUpdatedAtColumn,
	fractionalIndexPosition,
} from "./columns";
import { profile } from "./profile";
import { unit } from "./unit";

/**
 * A Profile's one-way interest relation to a Unit and the source of truth for
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
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		position: fractionalIndexPosition()
			.default(sql`'a0' || replace(uuidv7()::text, '-', '') || 'V'`)
			.notNull(),
		favorite: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.followerProfileId, table.unitId] }),
		index("unit_follow_follower_favorite_position_idx").on(
			table.followerProfileId,
			table.favorite.desc(),
			table.position,
			table.unitId,
		),
		index("unit_follow_unit_created_at_idx").on(
			table.unitId,
			table.createdAt.desc(),
			table.followerProfileId,
		),
		check("unit_follow_not_self_check", sql`${table.followerProfileId} <> ${table.unitId}`),
		createFractionalIndexPositionByteLengthConstraint(
			"unit_follow_position_byte_length_check",
			table.position,
		),
	],
);
