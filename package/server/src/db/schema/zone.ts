import { index, pgTable, uuid } from "drizzle-orm/pg-core";
import { createdAt, jsonData, nullableTimestamp, updatedAt } from "./columns";
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
    // The whole zone configuration as one self-describing versioned
    // envelope (`rezics/zone-config`); see `@rezics/contract` zone module.
    // 整个专区配置作为单一自描述版本化信封（`rezics/zone-config`）；
    // 见 `@rezics/contract` 的 zone 模块。
    config: jsonData().notNull(),
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
