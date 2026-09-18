import { users } from "./auth";
import { index, primaryKey, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { createCreatedAtColumn } from "../shared/columns";
import { entityIdentity } from "../catalog/identity";

export const accountEntityBlock = pgTable(
	"account_entity_block",
	{
		blockerAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		blockedEntityId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.blockerAuthUserId, table.blockedEntityId] }),
		index("account_entity_block_blocked_idx").on(table.blockedEntityId),
	],
);
