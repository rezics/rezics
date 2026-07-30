import { index, pgEnum, primaryKey, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { ReactionKindValues, toEnumValues } from "./contract-values";
import { createCreatedAtColumn, createUpdatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { profile } from "./profile";
import { unit } from "./unit";
import { realm } from "./realm";

export const reactionKind = pgEnum("reaction_kind", toEnumValues(ReactionKindValues));

export const unitReaction = pgTable(
	"unit_reaction",
	{
		id: createUuidv7PrimaryKey(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		realmId: uuid().references(() => realm.id, { onDelete: "cascade" }),
		reaction: reactionKind().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
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
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.unitId] }),
		index("unit_share_unit_created_at_idx").on(
			table.unitId,
			table.createdAt.desc(),
			table.profileId,
		),
	],
);
