import {
  bigint,
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
} from "./columns.ts";
import { User } from "./identity.ts";
import { Unit } from "./unit.ts";

// Inlined from @rezics/contract
// 从 @rezics/contract 内联
const mainEmailVerificationContractStatusValues = [
  "PENDING",
  "VERIFIED",
  "EXPIRED",
] as const;

export const EmailVerificationContractStatus = pgEnum(
  "EmailVerificationContractStatus",
  mainEmailVerificationContractStatusValues,
);

export const EchoKV = pgTable("EchoKV", {
  key: text().primaryKey(),
  value: jsonData().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const EmailVerificationContract = pgTable(
  "EmailVerificationContract",
  {
    id: uuidv7PrimaryKey(),
    contractName: varchar({ length: 96 }).notNull(),
    ownerId: uuid().notNull(),
    email: varchar({ length: 320 }).notNull(),
    status: EmailVerificationContractStatus().default("PENDING").notNull(),
    codeHash: text(),
    deliveryStatus: varchar({ length: 64 }),
    source: varchar({ length: 64 }),
    verifiedAt: nullableTimestamp(),
    expiresAt: nullableTimestamp(),
    lastSentAt: nullableTimestamp(),
    attempts: integer().default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
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

/**
 * Durable queue for canonical history commits.
 * 用于规范历史提交的持久化队列。
 */
export const HistoryOutbox = pgTable(
  "HistoryOutbox",
  {
    id: uuidv7PrimaryKey(),
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
    payload: jsonData().notNull(),
    payloadHash: varchar({ length: 64 }),
    status: varchar({ length: 32 }).default("pending").notNull(),
    attempts: integer().default(0).notNull(),
    nextAttemptAt: nullableTimestamp(),
    processedAt: nullableTimestamp(),
    processedById: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    lastError: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
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

/**
 * Per-Unit canonical history sequence allocator.
 * 每个 Unit 的规范历史序列分配器。
 */
export const UnitHistoryClock = pgTable("UnitHistoryClock", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  nextSequence: bigint({ mode: "number" }).default(1).notNull(),
  updatedAt: updatedAt(),
});
