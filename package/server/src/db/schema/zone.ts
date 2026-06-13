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
} from "./columns";
import { Unit } from "./unit";

export const Zone = pgTable(
  "Zone",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    // Permission authority only; interaction context lives in
    // `config.context` and may point elsewhere (or be global).
    // 仅承担权限归属；交互语境存放在 `config.context` 中，可能指向别处
    // （或为 global）。
    ownerRealmUnitId: uuid()
      .notNull()
      .references(() => Unit.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    // Split shell columns match manage tabs and enable column-level updates, so
    // a nav save cannot overwrite concurrent theme/boundary edits. Each column
    // owns an independent versioned envelope and upgrade chain.
    boundary: jsonData().notNull(),
    // Menus stay JSON: recursive trees are loaded whole, capped at three
    // levels, and never queried by node. `header.menuId` remains validated in
    // the same nav envelope as the menu tree.
    nav: jsonData().notNull(),
    // Decorative theme images are external HTTPS URLs, not IMAGE units. IMAGE
    // units remain catalog works, not a zone asset library.
    theme: jsonData().notNull(),
    // Home is explicit page identity for rename safety and semantics; it is
    // not a reserved slug. Service code creates it with the zone and blocks
    // deletion. This intentionally avoids a Drizzle-level mutual FK because
    // `ZonePage.zoneUnitId` already owns the cascade edge and immediate
    // circular inserts are not deferrable through ordinary Drizzle generation.
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
    // Pages own their section tree. Section ids are unique within one page, not
    // across the whole zone, because data execution addresses
    // `(zoneId, pageId, sectionId)`.
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
