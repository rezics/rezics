import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { Unit } from "./catalog";
import { ContentRating } from "./enums";
import { User } from "./identity";

export const ContentStructure = pgTable(
  "ContentStructure",
  {
    ownerUnitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("ContentStructure_updatedAt_idx").using(
      "btree",
      table.updatedAt.desc().nullsFirst(),
    ),
  ],
);

export const ContentStructureAnchor = pgTable(
  "ContentStructureAnchor",
  {
    nodeId: uuid()
      .primaryKey()
      .references(() => ContentStructureNode.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ownerUnitId: uuid()
      .notNull()
      .references(() => ContentStructure.ownerUnitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    contentUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    parentNodeId: uuid(),
    ancestorNodeIds: jsonb().notNull(),
    path: jsonb().notNull(),
    depth: integer().notNull(),
    position: text().notNull(),
    positionPath: text().notNull(),
    titlePath: jsonb().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("ContentStructureAnchor_contentUnitId_ownerUnitId_idx").using(
      "btree",
      table.contentUnitId.asc().nullsLast(),
      table.ownerUnitId.asc().nullsLast(),
    ),
    index("ContentStructureAnchor_ownerUnitId_depth_idx").using(
      "btree",
      table.ownerUnitId.asc().nullsLast(),
      table.depth.asc().nullsLast(),
    ),
    index("ContentStructureAnchor_ownerUnitId_parentNodeId_position_idx").using(
      "btree",
      table.ownerUnitId.asc().nullsLast(),
      table.parentNodeId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("ContentStructureAnchor_ownerUnitId_positionPath_idx").using(
      "btree",
      table.ownerUnitId.asc().nullsLast(),
      table.positionPath.asc().nullsLast(),
    ),
  ],
);

export const ContentStructureNode = pgTable(
  "ContentStructureNode",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    ownerUnitId: uuid()
      .notNull()
      .references(() => ContentStructure.ownerUnitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    parentId: uuid(),
    position: text().notNull(),
    contentUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: text().notNull(),
    noContent: boolean().default(false).notNull(),
    rating: ContentRating(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    isDeleted: boolean().default(false).notNull(),
    deletedAt: timestamp({ precision: 3 }),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "ContentStructureNode_parentId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("ContentStructureNode_contentUnitId_idx").using(
      "btree",
      table.contentUnitId.asc().nullsLast(),
    ),
    index("ContentStructureNode_ownerUnitId_isDeleted_updatedAt_idx").using(
      "btree",
      table.ownerUnitId.asc().nullsLast(),
      table.isDeleted.asc().nullsLast(),
      table.updatedAt.desc().nullsFirst(),
    ),
    index(
      "ContentStructureNode_ownerUnitId_parentId_position_isDelete_idx",
    ).using(
      "btree",
      table.ownerUnitId.asc().nullsLast(),
      table.parentId.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.isDeleted.asc().nullsLast(),
    ),
    index("ContentStructureNode_ownerUnitId_updatedAt_idx").using(
      "btree",
      table.ownerUnitId.asc().nullsLast(),
      table.updatedAt.desc().nullsFirst(),
    ),
  ],
);

export const UserContentNodeProgress = pgTable(
  "UserContentNodeProgress",
  {
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    nodeId: uuid()
      .notNull()
      .references(() => ContentStructureNode.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    completedAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.nodeId],
      name: "UserContentNodeProgress_pkey",
    }),
    index("UserContentNodeProgress_nodeId_idx").using(
      "btree",
      table.nodeId.asc().nullsLast(),
    ),
  ],
);
