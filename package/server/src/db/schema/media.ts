import {
  boolean,
  index,
  integer,
  pgTable,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, jsonData, nullableTimestamp, updatedAt } from "./columns";
import { Unit } from "./unit";

export const Media = pgTable(
  "Media",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    kindKey: varchar({ length: 32 }).notNull(),
    releaseDate: nullableTimestamp(),
    runtimeMinutes: integer(),
    episodeCount: integer(),
    seasonCount: integer(),
    isLicensed: boolean().default(false).notNull(),
    extra: jsonData(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("Media_kindKey_releaseDate_idx").using(
      "btree",
      table.kindKey.asc().nullsLast(),
      table.releaseDate.asc().nullsLast(),
    ),
  ],
);
