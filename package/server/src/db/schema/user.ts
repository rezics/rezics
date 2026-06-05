import { index, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, uuidv7PrimaryKey } from "./columns";
export const UserBlock = pgTable(
  "UserBlock",
  {
    id: uuidv7PrimaryKey(),
    blockerId: uuid().notNull(),
    blockedId: uuid().notNull(),
    createdAt: createdAt(),
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
