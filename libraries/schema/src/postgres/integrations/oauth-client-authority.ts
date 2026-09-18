import { sql } from "drizzle-orm";
import { bigint, check, index, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { createCreatedAtColumn } from "../shared/columns";

/** Stable protocol-client configuration fence; it neither admits an App nor grants machine authority. @internal */
export const oauthClientAuthority = pgTable(
	"oauth_client_authority",
	{
		id: uuid().primaryKey(),
		clientId: text().notNull(),
		discoveryId: text(),
		version: bigint({ mode: "number" }).notNull().default(0),
		credentialEpoch: bigint({ mode: "number" }).notNull().default(0),
		revokedAt: timestamp({ withTimezone: true, precision: 3, mode: "date" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		uniqueIndex("oauth_client_authority_identifier_key").on(table.clientId),
		index("oauth_client_authority_created_idx").on(table.createdAt, table.id),
		index("oauth_client_authority_revoked_idx")
			.on(table.revokedAt, table.id)
			.where(sql`${table.revokedAt} is not null`),
		check(
			"oauth_client_authority_identifier_check",
			sql`octet_length(${table.clientId}) between 1 and 2048`,
		),
		check(
			"oauth_client_authority_version_check",
			sql`${table.version} between 0 and 9007199254740991 and ${table.credentialEpoch} between 0 and ${table.version}`,
		),
		check(
			"oauth_client_authority_time_check",
			sql`${table.revokedAt} is null or (isfinite(${table.revokedAt}) and ${table.revokedAt}>=${table.createdAt})`,
		),
	],
);
