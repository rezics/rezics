import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  createdAt,
  jsonData,
  timestampMs,
  updatedAt,
  uuidv7PrimaryKey,
} from "./columns";
import { Entity } from "./entity";
import { Unit } from "./unit";

export const SourceSite = pgTable(
  "SourceSite",
  {
    entityUnitId: uuid()
      .primaryKey()
      .references(() => Entity.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    key: varchar({ length: 64 }).notNull(),
    crawlSupport: varchar({ length: 32 }).notNull(),
    crawlEnabled: boolean().default(false).notNull(),
    crawlerAdapterKey: varchar({ length: 64 }),
    refRules: jsonData().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("SourceSite_crawlSupport_crawlEnabled_idx").using(
      "btree",
      table.crawlSupport.asc().nullsLast(),
      table.crawlEnabled.asc().nullsLast(),
    ),
    uniqueIndex("SourceSite_key_key").using(
      "btree",
      table.key.asc().nullsLast(),
    ),
  ],
);

export const UnitExternalRef = pgTable(
  "UnitExternalRef",
  {
    id: uuidv7PrimaryKey(),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    sourceSiteEntityUnitId: uuid()
      .notNull()
      .references(() => SourceSite.entityUnitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    externalKind: varchar({ length: 64 }).notNull(),
    externalId: text().notNull(),
    canonicalUrl: text().notNull(),
    originalUrl: text(),
    firstSeenAt: timestampMs().default(sql`CURRENT_TIMESTAMP`).notNull(),
    lastSeenAt: timestampMs().default(sql`CURRENT_TIMESTAMP`).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex(
      "UnitExternalRef_sourceSiteEntityUnitId_externalKind_externa_key",
    ).using(
      "btree",
      table.sourceSiteEntityUnitId.asc().nullsLast(),
      table.externalKind.asc().nullsLast(),
      table.externalId.asc().nullsLast(),
    ),
    index("UnitExternalRef_sourceSiteEntityUnitId_externalKind_idx").using(
      "btree",
      table.sourceSiteEntityUnitId.asc().nullsLast(),
      table.externalKind.asc().nullsLast(),
    ),
    index(
      "UnitExternalRef_unitId_sourceSiteEntityUnitId_externalKind_idx",
    ).using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.sourceSiteEntityUnitId.asc().nullsLast(),
      table.externalKind.asc().nullsLast(),
    ),
  ],
);
