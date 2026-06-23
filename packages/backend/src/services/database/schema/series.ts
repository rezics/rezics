import {
  index,
  pgTable,
  primaryKey,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, jsonData, updatedAt } from "./columns.ts";
import { ContentStructureNode } from "./content-structure.ts";
import { Unit } from "./unit.ts";

/**
 * Series extension on a Unit.
 * Unit 上的 Series 扩展。
 */
export const Series = pgTable(
  "Series",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    /**
     * Public-knowledge grouping kind; contract values come from SeriesKind.
     * 公共知识分组类别；契约取值来自 SeriesKind。
     */
    kindKey: varchar({ length: 64 }).notNull(),
    extra: jsonData(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("Series_kindKey_idx").using("btree", table.kindKey.asc().nullsLast()),
    index("Series_updatedAt_idx").using(
      "btree",
      table.updatedAt.desc().nullsFirst(),
    ),
  ],
);

/**
 * Direct lookup projection from counted release member nodes.
 * 来自已计数的 release 成员节点的直接查询投影。
 */
export const SeriesContentIndex = pgTable(
  "SeriesContentIndex",
  {
    seriesUnitId: uuid()
      .notNull()
      .references(() => Series.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    releaseUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    contentNodeId: uuid()
      .notNull()
      .references(() => ContentStructureNode.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.seriesUnitId, table.releaseUnitId, table.contentNodeId],
      name: "SeriesContentIndex_pkey",
    }),
    uniqueIndex("SeriesContentIndex_contentNodeId_key").using(
      "btree",
      table.contentNodeId.asc().nullsLast(),
    ),
    index("SeriesContentIndex_releaseUnitId_seriesUnitId_idx").using(
      "btree",
      table.releaseUnitId.asc().nullsLast(),
      table.seriesUnitId.asc().nullsLast(),
    ),
    index("SeriesContentIndex_seriesUnitId_releaseUnitId_idx").using(
      "btree",
      table.seriesUnitId.asc().nullsLast(),
      table.releaseUnitId.asc().nullsLast(),
    ),
  ],
);
