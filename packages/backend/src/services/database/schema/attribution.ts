import { sql } from "drizzle-orm";
import {
  doublePrecision,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, timestampMs, updatedAt, uuidv7PrimaryKey } from "./columns.ts";
import { UnitExternalLink } from "./entity.ts";
import { Unit } from "./unit.ts";

export const CreditAttribution = pgTable(
  "CreditAttribution",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    entityId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: varchar({ length: 64 }).notNull(),
    position: varchar({ length: 64 }).default("V").notNull(), // Fractional Indexing
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.entityId, table.role],
      name: "CreditAttribution_pkey",
    }),
    index("CreditAttribution_entityId_role_idx").using(
      "btree",
      table.entityId.asc().nullsLast(),
      table.role.asc().nullsLast(),
    ),
    index("CreditAttribution_unitId_role_position_entityId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.role.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.entityId.asc().nullsLast(),
    ),
  ],
);

export const CreditAttributionEvidence = pgTable(
  "CreditAttributionEvidence",
  {
    id: uuidv7PrimaryKey(),
    unitId: uuid().notNull(),
    entityId: uuid().notNull(),
    role: varchar({ length: 64 }).notNull(),
    sourceExternalLinkId: uuid()
      .notNull()
      .references(() => UnitExternalLink.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    claimPath: text(),
    observedUrl: text(),
    observedAt: timestampMs().default(sql`CURRENT_TIMESTAMP`).notNull(),
    confidence: doublePrecision(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      columns: [table.unitId, table.entityId, table.role],
      foreignColumns: [
        CreditAttribution.unitId,
        CreditAttribution.entityId,
        CreditAttribution.role,
      ],
      name: "CreditAttributionEvidence_unitId_entityId_role_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("CreditAttributionEvidence_sourceExternalLinkId_idx").using(
      "btree",
      table.sourceExternalLinkId.asc().nullsLast(),
    ),
    index("CreditAttributionEvidence_unitId_entityId_role_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.entityId.asc().nullsLast(),
      table.role.asc().nullsLast(),
    ),
  ],
);

export const SubjectAttribution = pgTable(
  "SubjectAttribution",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    entityId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: varchar({ length: 64 }).notNull(),
    position: varchar({ length: 64 }).default("V").notNull(), // Fractional Indexing
    weight: doublePrecision(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.entityId, table.role],
      name: "SubjectAttribution_pkey",
    }),
    index("SubjectAttribution_entityId_role_position_unitId_idx").using(
      "btree",
      table.entityId.asc().nullsLast(),
      table.role.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    index("SubjectAttribution_entityId_position_unitId_idx").using(
      "btree",
      table.entityId.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    index("SubjectAttribution_unitId_role_position_entityId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.role.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.entityId.asc().nullsLast(),
    ),
  ],
);
