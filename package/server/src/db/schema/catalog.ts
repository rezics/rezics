import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  AiDisclosureMode,
  CatalogEntryKind,
  ContentRating,
  ModerationStatus,
  UnitStatus,
  UnitType,
  UnitVisibility,
} from "./enums";
import { User } from "./identity";

export const Unit = pgTable(
  "Unit",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    type: UnitType().notNull(),
    slug: text(),
    slugScope: uuid().notNull(),
    userId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    defaultLanguage: varchar({ length: 16 }),
    isLanguageNeutral: boolean().default(false).notNull(),
    status: UnitStatus().default("DRAFT").notNull(),
    visibility: UnitVisibility().default("PUBLIC").notNull(),
    rating: ContentRating().default("GENERAL").notNull(),
    extra: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    publishedAt: timestamp({ precision: 3 }),
    subscriberCount: integer().default(0).notNull(),
    licenseSlug: text(),
    aiDisclosureMode: AiDisclosureMode().default("UNKNOWN").notNull(),
    aiDisclosureDetails: jsonb(),
    catalogEntryKind: CatalogEntryKind(),
    targetUnitId: uuid(),
    moderationStatus: ModerationStatus().default("APPROVED").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.targetUnitId],
      foreignColumns: [table.id],
      name: "Unit_targetUnitId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("Unit_catalogEntryKind_targetUnitId_idx").using(
      "btree",
      table.catalogEntryKind.asc().nullsLast(),
      table.targetUnitId.asc().nullsLast(),
    ),
    index("Unit_defaultLanguage_idx").using(
      "btree",
      table.defaultLanguage.asc().nullsLast(),
    ),
    index("Unit_moderationStatus_idx").using(
      "btree",
      table.moderationStatus.asc().nullsLast(),
    ),
    uniqueIndex("Unit_slugScope_slug_key").using(
      "btree",
      table.slugScope.asc().nullsLast(),
      table.slug.asc().nullsLast(),
    ),
    index("Unit_slugScope_type_idx").using(
      "btree",
      table.slugScope.asc().nullsLast(),
      table.type.asc().nullsLast(),
    ),
    index("Unit_status_visibility_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.visibility.asc().nullsLast(),
    ),
    index("Unit_targetUnitId_idx").using(
      "btree",
      table.targetUnitId.asc().nullsLast(),
    ),
    index("Unit_type_status_createdAt_idx").using(
      "btree",
      table.type.asc().nullsLast(),
      table.status.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Unit_userId_createdAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    check(
      "Unit_series_catalogEntryKind_check",
      sql`((type <> 'SERIES'::"UnitType") OR ("catalogEntryKind" IS NULL))`,
    ),
    check(
      "Unit_variant_targetUnitId_check",
      sql`(("catalogEntryKind" <> 'VARIANT'::"CatalogEntryKind") OR ("targetUnitId" IS NOT NULL))`,
    ),
  ],
);

export const Book = pgTable(
  "Book",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    isbn13: varchar({ length: 32 }),
    publicationDate: timestamp({ precision: 3 }),
    pageCount: integer(),
    textLength: integer().default(0).notNull(),
    formatKey: varchar({ length: 32 }),
    isLicensed: boolean().default(false).notNull(),
    extra: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    chapterCount: integer().default(0).notNull(),
  },
  (table) => [
    index("Book_isbn13_idx").using("btree", table.isbn13.asc().nullsLast()),
    index("Book_publicationDate_idx").using(
      "btree",
      table.publicationDate.asc().nullsLast(),
    ),
  ],
);

export const Game = pgTable("Game", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  releaseDate: timestamp({ precision: 3 }),
  versionLabel: text(),
  isLicensed: boolean().default(false).notNull(),
  extra: jsonb(),
  createdAt: timestamp({ precision: 3 })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
});

export const Media = pgTable(
  "Media",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    kindKey: varchar({ length: 32 }).notNull(),
    releaseDate: timestamp({ precision: 3 }),
    runtimeMinutes: integer(),
    episodeCount: integer(),
    seasonCount: integer(),
    isLicensed: boolean().default(false).notNull(),
    extra: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("Media_kindKey_releaseDate_idx").using(
      "btree",
      table.kindKey.asc().nullsLast(),
      table.releaseDate.asc().nullsLast(),
    ),
  ],
);

export const Link = pgTable("Link", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  url: text().notNull(),
  siteName: varchar({ length: 128 }),
  faviconUrl: text(),
  extra: jsonb(),
  createdAt: timestamp({ precision: 3 })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
});

export const Entity = pgTable("Entity", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  kind: varchar({ length: 32 }),
  verified: boolean().default(false).notNull(),
  avatar: text(),
  eligibleCreditRoles: text().array().default(sql`ARRAY[]`).notNull(),
  eligibleSubjectRoles: text().array().default(sql`ARRAY[]`).notNull(),
});

export const Zone = pgTable("Zone", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  filters: jsonb().notNull(),
  template: varchar({ length: 64 }).notNull(),
  styling: jsonb(),
  startsAt: timestamp({ precision: 3 }),
  endsAt: timestamp({ precision: 3 }),
  createdAt: timestamp({ precision: 3 })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
  wiki: jsonb(),
});

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
    refRules: jsonb().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
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
    id: uuid().default(sql`uuidv7()`).primaryKey(),
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
    firstSeenAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastSeenAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
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

export const GameSystemRequirement = pgTable(
  "GameSystemRequirement",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
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
    hardware: jsonb().notNull(),
    rawText: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
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
