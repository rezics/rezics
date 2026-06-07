import {
  aiDisclosureModeValues,
  catalogEntryKindValues,
  contentRatingValues,
  unitStatusValues,
  unitVisibilityValues,
} from "@rezics/contract";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
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
import { User } from "./identity";
import { ModerationStatus } from "./moderation";

export const unitTypeStorageValues = [
  "BOOK",
  "GAME",
  "MEDIA",
  "POST",
  "TAG",
  "REALM",
  "SHELF",
  "IMAGE",
  "VIDEO",
  "QUOTE",
  "LINK",
  "ENTITY",
  "ZONE",
  "USER",
  "SCOPE",
  "SERIES",
  "LABEL",
  "POLL",
  "COMMENT",
] as const;

export type UnitTypeStorage = (typeof unitTypeStorageValues)[number];

/**
 * Unified persisted Unit types. USER rows are type-extension markers whose
 * `User.unitId` equals `Unit.id`; SCOPE rows back named slug namespaces and
 * use null slugs.
 */
export const UnitType = pgEnum("UnitType", unitTypeStorageValues);

// DELETED is a soft-delete marker. Units are never hard-deleted; read paths
// must filter it out when deleted content should be hidden.
export const UnitStatus = pgEnum("UnitStatus", unitStatusValues);

export const UnitVisibility = pgEnum("UnitVisibility", unitVisibilityValues);

export const ContentRating = pgEnum("ContentRating", contentRatingValues);

export const AiDisclosureMode = pgEnum(
  "AiDisclosureMode",
  aiDisclosureModeValues,
);

export const CatalogEntryKind = pgEnum(
  "CatalogEntryKind",
  catalogEntryKindValues,
);

/**
 * Core Unit identity and shared catalog state. Type-specific rows extend this
 * table one-to-one where needed.
 */
export const Unit = pgTable(
  "Unit",
  {
    id: uuidv7PrimaryKey(),
    type: UnitType().notNull(),
    slug: text(),
    /**
     * Slug namespace key. Top-level slugs point at placeholder SCOPE units for
     * named scopes such as user, realm, tag, zone, and entity; owner-scoped
     * sub-resources use the owner Unit id directly.
     */
    slugScope: uuid().notNull(),
    userId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    defaultLanguage: varchar({ length: 16 }),
    /**
     * Language-independent units, such as tags, bypass UnitSupportLanguage and
     * match any language filter.
     */
    isLanguageNeutral: boolean().default(false).notNull(),
    status: UnitStatus().default("DRAFT").notNull(),
    visibility: UnitVisibility().default("PUBLIC").notNull(),
    rating: ContentRating().default("GENERAL").notNull(),
    extra: jsonData(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    publishedAt: nullableTimestamp(),
    /**
     * Denormalized count of Subscription rows targeting this unit. Maintained
     * transactionally by the subscription service to avoid counting on every
     * unit-detail read.
     */
    subscriberCount: integer().default(0).notNull(),
    referenceCount: integer().default(0).notNull(),
    /**
     * Publication license slug from the contract registry. Nullable during
     * rollout; readers may treat null as the platform default when an effective
     * license is required.
     */
    licenseSlug: text(),
    /**
     * Declared AI involvement/provenance for public-facing content. UNKNOWN is
     * the default because historical data must not imply a no-AI claim.
     */
    aiDisclosureMode: AiDisclosureMode().default("UNKNOWN").notNull(),
    aiDisclosureDetails: jsonData(),
    /**
     * Native catalog identity for discovery. MAIN rows are ordinary native
     * catalog entries; VARIANT rows use `targetUnitId` to point at the main
     * catalog Unit.
     */
    catalogEntryKind: CatalogEntryKind(),
    /**
     * Canonical weak target edge for a Unit whose normal interactions,
     * aggregation, or "about" relation resolve to another Unit.
     *
     * Catalog VARIANT rows point to the main catalog Unit. POST rows use this
     * as the owning Post extension's aggregation target. Normal interactions
     * starting from a VARIANT target the main catalog Unit; only progress and
     * rating may target a VARIANT directly.
     *
     * This is not ownership, containment, ordering, discussion topology, realm
     * membership, moderation state, or a generic edge table. This is also the
     * only persisted column that may use the generic `targetUnitId` name;
     * domain-specific endpoints must use domain-specific field names.
     */
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
