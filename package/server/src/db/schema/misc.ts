import {
  bigint,
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
import { Unit } from "./catalog";
import { EmailVerificationContractStatus } from "./enums";
import { User } from "./identity";

export const EchoKV = pgTable("EchoKV", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  createdAt: timestamp({ precision: 3 })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
});

export const EmailVerificationContract = pgTable(
  "EmailVerificationContract",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    contractName: varchar({ length: 96 }).notNull(),
    ownerId: uuid().notNull(),
    email: varchar({ length: 320 }).notNull(),
    status: EmailVerificationContractStatus().default("PENDING").notNull(),
    codeHash: text(),
    deliveryStatus: varchar({ length: 64 }),
    source: varchar({ length: 64 }),
    verifiedAt: timestamp({ precision: 3 }),
    expiresAt: timestamp({ precision: 3 }),
    lastSentAt: timestamp({ precision: 3 }),
    attempts: integer().default(0).notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    uniqueIndex(
      "EmailVerificationContract_contractName_ownerId_email_key",
    ).using(
      "btree",
      table.contractName.asc().nullsLast(),
      table.ownerId.asc().nullsLast(),
      table.email.asc().nullsLast(),
    ),
    index("EmailVerificationContract_contractName_ownerId_status_idx").using(
      "btree",
      table.contractName.asc().nullsLast(),
      table.ownerId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    index("EmailVerificationContract_email_idx").using(
      "btree",
      table.email.asc().nullsLast(),
    ),
  ],
);

export const HistoryOutbox = pgTable(
  "HistoryOutbox",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    sequence: bigint({ mode: "number" }).notNull(),
    actorUserId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    category: varchar({ length: 64 }).notNull(),
    payload: jsonb().notNull(),
    payloadHash: varchar({ length: 64 }),
    status: varchar({ length: 32 }).default("pending").notNull(),
    attempts: integer().default(0).notNull(),
    nextAttemptAt: timestamp({ precision: 3 }),
    processedAt: timestamp({ precision: 3 }),
    processedById: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    lastError: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("HistoryOutbox_actorUserId_createdAt_idx").using(
      "btree",
      table.actorUserId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("HistoryOutbox_processedById_idx").using(
      "btree",
      table.processedById.asc().nullsLast(),
    ),
    index("HistoryOutbox_status_nextAttemptAt_createdAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.nextAttemptAt.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("HistoryOutbox_unitId_createdAt_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    uniqueIndex("HistoryOutbox_unitId_sequence_key").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.sequence.asc().nullsLast(),
    ),
  ],
);

export const UnitHistoryClock = pgTable("UnitHistoryClock", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  nextSequence: bigint({ mode: "number" }).default(1).notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
});
