import {
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { Unit } from "./catalog";
import { createdAt, jsonData, updatedAt } from "./columns";

export const Shelf = pgTable("Shelf", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  kindKey: varchar({ length: 64 }),
  extra: jsonData(),
  itemCount: integer().default(0).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const ShelfUnit = pgTable(
  "ShelfUnit",
  {
    shelfId: uuid()
      .notNull()
      .references(() => Shelf.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    unitId: uuid().notNull(),
    kind: varchar({ length: 32 }).notNull(),
    position: varchar({ length: 64 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    variantUnitId: uuid(),
  },
  (table) => [
    primaryKey({
      columns: [table.shelfId, table.unitId],
      name: "ShelfUnit_pkey",
    }),
    index("ShelfUnit_shelfId_position_idx").using(
      "btree",
      table.shelfId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("ShelfUnit_variantUnitId_idx").using(
      "btree",
      table.variantUnitId.asc().nullsLast(),
    ),
  ],
);

export const ShelfUnitRelation = pgTable(
  "ShelfUnitRelation",
  {
    shelfId: uuid()
      .notNull()
      .references(() => Shelf.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    parentUnitId: uuid().notNull(),
    childUnitId: uuid().notNull(),
    role: varchar({ length: 32 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.shelfId,
        table.parentUnitId,
        table.childUnitId,
        table.role,
      ],
      name: "ShelfUnitRelation_pkey",
    }),
    foreignKey({
      columns: [table.shelfId, table.childUnitId],
      foreignColumns: [ShelfUnit.shelfId, ShelfUnit.unitId],
      name: "ShelfUnitRelation_shelfId_childUnitId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.shelfId, table.parentUnitId],
      foreignColumns: [ShelfUnit.shelfId, ShelfUnit.unitId],
      name: "ShelfUnitRelation_shelfId_parentUnitId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("ShelfUnitRelation_childUnitId_role_idx").using(
      "btree",
      table.childUnitId.asc().nullsLast(),
      table.role.asc().nullsLast(),
    ),
    index("ShelfUnitRelation_parentUnitId_role_idx").using(
      "btree",
      table.parentUnitId.asc().nullsLast(),
      table.role.asc().nullsLast(),
    ),
    index("ShelfUnitRelation_shelfId_childUnitId_idx").using(
      "btree",
      table.shelfId.asc().nullsLast(),
      table.childUnitId.asc().nullsLast(),
    ),
    index("ShelfUnitRelation_shelfId_parentUnitId_role_idx").using(
      "btree",
      table.shelfId.asc().nullsLast(),
      table.parentUnitId.asc().nullsLast(),
      table.role.asc().nullsLast(),
    ),
  ],
);
