import {
  boolean,
  index,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  jsonData,
  nullableTimestamp,
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns";
import { UnitExternalRef } from "./source";
import { Unit } from "./unit";

export const Game = pgTable("Game", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  releaseDate: nullableTimestamp(),
  versionLabel: text(),
  isLicensed: boolean().default(false).notNull(),
  extra: jsonData(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const GameSystemRequirement = pgTable(
  "GameSystemRequirement",
  {
    id: uuidv7PrimaryKey(),
    gameUnitId: uuid()
      .notNull()
      .references(() => Game.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    platformEntityId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    tier: varchar({ length: 32 }).notNull(),
    language: varchar({ length: 16 }),
    sourceRefId: uuid().references(() => UnitExternalRef.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    hardware: jsonData().notNull(),
    rawText: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("GameSystemRequirement_gameUnitId_idx").using(
      "btree",
      table.gameUnitId.asc().nullsLast(),
    ),
    index(
      "GameSystemRequirement_gameUnitId_platformEntityId_tier_sour_idx",
    ).using(
      "btree",
      table.gameUnitId.asc().nullsLast(),
      table.platformEntityId.asc().nullsLast(),
      table.tier.asc().nullsLast(),
      table.sourceRefId.asc().nullsLast(),
    ),
    index("GameSystemRequirement_platformEntityId_idx").using(
      "btree",
      table.platformEntityId.asc().nullsLast(),
    ),
    index("GameSystemRequirement_sourceRefId_idx").using(
      "btree",
      table.sourceRefId.asc().nullsLast(),
    ),
    index("GameSystemRequirement_tier_idx").using(
      "btree",
      table.tier.asc().nullsLast(),
    ),
  ],
);
