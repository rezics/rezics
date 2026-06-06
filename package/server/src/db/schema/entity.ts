import { sql } from "drizzle-orm";
import { boolean, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { textArray } from "./columns";
import { Unit } from "./unit";

export const Entity = pgTable("Entity", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  kind: varchar({ length: 32 }),
  verified: boolean().default(false).notNull(),
  avatar: text(),
  eligibleCreditRoles: textArray().default(sql`ARRAY[]`).notNull(),
  eligibleSubjectRoles: textArray().default(sql`ARRAY[]`).notNull(),
});
