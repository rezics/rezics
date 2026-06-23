import {
  index,
  pgTable,
  text,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  jsonData,
  nullableTimestamp,
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns.ts";
import { Unit } from "./unit.ts";

export const Zone = pgTable(
  "Zone",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    // Permission authority only; interaction context lives in config.context.
    // 仅承担权限归属；交互语境存放在 config.context 中。
    ownerRealmUnitId: uuid()
      .notNull()
      .references(() => Unit.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    boundary: jsonData().notNull(),
    nav: jsonData().notNull(),
    theme: jsonData().notNull(),
    homePageId: uuid(),
    startsAt: nullableTimestamp(),
    endsAt: nullableTimestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("Zone_ownerRealmUnitId_idx").using(
      "btree",
      table.ownerRealmUnitId.asc().nullsLast(),
    ),
  ],
);

export const ZonePage = pgTable(
  "ZonePage",
  {
    id: uuidv7PrimaryKey(),
    zoneUnitId: uuid()
      .notNull()
      .references(() => Zone.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    slug: text().notNull(),
    config: jsonData().notNull(),
    position: varchar({ length: 64 }).notNull().default("V"), // Fractional Indexing
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("ZonePage_zoneUnitId_slug_unique").on(table.zoneUnitId, table.slug),
    index("ZonePage_zoneUnitId_position_id_idx").using(
      "btree",
      table.zoneUnitId.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
  ],
);
