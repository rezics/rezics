import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export const UserBlock = pgTable(
  "UserBlock",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    blockerId: uuid().notNull(),
    blockedId: uuid().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("UserBlock_blockedId_idx").using(
      "btree",
      table.blockedId.asc().nullsLast(),
    ),
    uniqueIndex("UserBlock_blockerId_blockedId_key").using(
      "btree",
      table.blockerId.asc().nullsLast(),
      table.blockedId.asc().nullsLast(),
    ),
    index("UserBlock_blockerId_idx").using(
      "btree",
      table.blockerId.asc().nullsLast(),
    ),
  ],
);
