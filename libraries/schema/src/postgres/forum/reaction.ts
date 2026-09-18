import { unitReferenceColumns, unitReferenceConstraints } from "../shared/unit-reference-columns";
import { index, pgEnum, primaryKey, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "../shared/base";
import { entityIdentity } from "../catalog/identity";
import {
	createCreatedAtColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "../shared/columns";
import { ReactionKindValues, toEnumValues } from "../shared/contract-values";
import { realm } from "../realms/realm";

export const reactionKind = pgEnum("reaction_kind", toEnumValues(ReactionKindValues));

export const unitReaction = pgTable(
	"unit_reaction",
	{
		id: createUuidv7PrimaryKey(),
		profileId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "cascade" }),
		unitId: uuid().notNull(),
		realmId: uuid().references(() => realm.id, { onDelete: "cascade" }),
		reaction: reactionKind().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_reaction", "unit", table, false, table.unitId),

		unique("unit_reaction_identity_key")
			.on(table.profileId, table.unitId, table.realmId)
			.nullsNotDistinct(),
		index("unit_reaction_unit_kind_realm_idx").on(table.unitId, table.reaction, table.realmId),
		index("unit_reaction_realm_idx").on(table.realmId),
		index("unit_reaction_profile_created_at_idx").on(
			table.profileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
	],
);

export const unitShare = pgTable(
	"unit_share",
	{
		profileId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "cascade" }),
		unitId: uuid().notNull(),
		createdAt: createCreatedAtColumn(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_share", "unit", table, false, table.unitId),

		primaryKey({ columns: [table.profileId, table.unitId] }),
		index("unit_share_unit_created_at_idx").on(
			table.unitId,
			table.createdAt.desc(),
			table.profileId,
		),
	],
);
