import { sql } from "drizzle-orm";
import { check, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createUuidv7PrimaryKey } from "./columns";
import { users } from "./auth";
import { entityIdentity } from "./catalog-identity";
import { referenceValue } from "./reference-value";

/** Immutable private subject values, independent from representation and participation. @internal */
export const accessSubject = pgTable(
	"access_subject",
	{
		id: createUuidv7PrimaryKey(),
		authUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
		entityId: uuid().references(() => entityIdentity.id, { onDelete: "restrict" }),
	},
	(table) => [
		check(
			"access_subject_target_check",
			sql`num_nonnulls(${table.authUserId},${table.entityId})=1`,
		),
		uniqueIndex("access_subject_principal_key")
			.on(table.authUserId)
			.where(sql`${table.authUserId} is not null`),
		uniqueIndex("access_subject_entity_key")
			.on(table.entityId)
			.where(sql`${table.entityId} is not null`),
	],
);

/** Immutable authority roots. A root's existence grants no authority over its target. @internal */
export const accessScope = pgTable(
	"access_scope",
	{
		id: createUuidv7PrimaryKey(),
		platformRoot: text().$type<"platform">(),
		authUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
		unitRef: uuid().references(() => referenceValue.id, { onDelete: "restrict" }),
	},
	(table) => [
		check(
			"access_scope_target_check",
			sql`num_nonnulls(${table.platformRoot},${table.authUserId},${table.unitRef})=1`,
		),
		check(
			"access_scope_platform_check",
			sql`${table.platformRoot} is null or ${table.platformRoot}='platform'`,
		),
		uniqueIndex("access_scope_platform_key")
			.on(table.platformRoot)
			.where(sql`${table.platformRoot} is not null`),
		uniqueIndex("access_scope_account_key")
			.on(table.authUserId)
			.where(sql`${table.authUserId} is not null`),
		uniqueIndex("access_scope_resource_key")
			.on(table.unitRef)
			.where(sql`${table.unitRef} is not null`),
	],
);
