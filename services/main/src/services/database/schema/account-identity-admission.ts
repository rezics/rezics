import { sql } from "drizzle-orm";
import { bigint, check, index, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn } from "./columns";
import { users } from "./auth";
import { entityIdentity } from "./catalog-identity";
import { accessRepresentation } from "./access-representation";

/** Private idempotent outcome of creating a new controlled identity; never an ownership grant. @internal */
export const accountIdentityAdmission = pgTable("account_identity_admission", {
	authUserId: uuid().notNull().references(() => users.id, { onDelete: "restrict" }),
	operationId: uuid().notNull(),
	requestDigest: text().notNull(),
	entityId: uuid().notNull().references(() => entityIdentity.id, { onDelete: "restrict" }),
	representationId: uuid().notNull().references(() => accessRepresentation.id, { onDelete: "restrict" }),
	mainPreferenceVersion: bigint({ mode: "number" }),
	createdAt: createCreatedAtColumn(),
}, table => [
	primaryKey({ columns: [table.authUserId, table.operationId] }),
	uniqueIndex("account_identity_admission_entity_key").on(table.entityId),
	uniqueIndex("account_identity_admission_representation_key").on(table.representationId),
	index("account_identity_admission_created_idx").on(table.authUserId, table.createdAt, table.operationId),
	check("account_identity_admission_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
	check("account_identity_admission_version_check", sql`${table.mainPreferenceVersion} is null or ${table.mainPreferenceVersion} between 1 and 9007199254740991`),
]);
