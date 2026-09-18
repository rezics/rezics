import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	primaryKey,
	text,
	uniqueIndex,
	uuid,
	type PgTableExtraConfigValue,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "../shared/columns";
import { users } from "../identity/auth";
import { accessScope, accessSubject } from "./access-identity";

/** Scope/subject enrollment identity; no active generation means no membership-derived authority. @internal */
export const accessMembership = pgTable(
	"access_membership",
	{
		id: createUuidv7PrimaryKey(),
		scopeId: uuid()
			.notNull()
			.references(() => accessScope.id, { onDelete: "restrict" }),
		subjectId: uuid()
			.notNull()
			.references(() => accessSubject.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull().default(0),
		lastGeneration: bigint({ mode: "number" }).notNull().default(0),
		activeGeneration: bigint({ mode: "number" }),
	},
	(table): PgTableExtraConfigValue[] => [
		uniqueIndex("access_membership_scope_subject_key").on(table.scopeId, table.subjectId),
		uniqueIndex("access_membership_id_scope_key").on(table.id, table.scopeId),
		uniqueIndex("access_membership_id_scope_subject_key").on(
			table.id,
			table.scopeId,
			table.subjectId,
		),
		index("access_membership_active_scope_idx")
			.on(table.scopeId, table.subjectId)
			.where(sql`${table.activeGeneration} is not null`),
		index("access_membership_active_subject_idx")
			.on(table.subjectId, table.scopeId)
			.where(sql`${table.activeGeneration} is not null`),
		index("access_membership_subject_scope_idx").on(table.subjectId, table.scopeId),
		foreignKey({
			name: "access_membership_active_admission_fk",
			columns: [table.id, table.activeGeneration],
			foreignColumns: [
				accessMembershipAdmission.membershipId,
				accessMembershipAdmission.generation,
			],
		}).onDelete("restrict"),
		check(
			"access_membership_version_check",
			sql`${table.version} between 0 and 9007199254740991 and ${table.lastGeneration} between 0 and ${table.version}`,
		),
		check(
			"access_membership_active_check",
			sql`${table.activeGeneration} is null or (${table.activeGeneration}=${table.lastGeneration} and ${table.activeGeneration}>0)`,
		),
	],
);

/** Every membership transition preserves its private operator and selected authority subject. @internal */
export const accessMembershipEvent = pgTable(
	"access_membership_event",
	{
		membershipId: uuid()
			.notNull()
			.references(() => accessMembership.id, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull(),
		operationId: uuid().notNull(),
		requestDigest: text().notNull(),
		operation: text().$type<"admit" | "leave" | "remove">().notNull(),
		lastGeneration: bigint({ mode: "number" }).notNull(),
		activeGeneration: bigint({ mode: "number" }),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		authoritySubjectId: uuid()
			.notNull()
			.references(() => accessSubject.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [table.membershipId, table.version] }),
		uniqueIndex("access_membership_event_operation_key").on(table.membershipId, table.operationId),
		check(
			"access_membership_event_version_check",
			sql`${table.version} between 1 and 9007199254740991 and ${table.lastGeneration} between 1 and ${table.version}`,
		),
		check("access_membership_event_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
		check(
			"access_membership_event_operation_check",
			inArray(table.operation, ["admit", "leave", "remove"]),
		),
		check(
			"access_membership_event_active_check",
			sql`(${table.operation}='admit' and ${table.activeGeneration} is not null and ${table.activeGeneration}=${table.lastGeneration}) or (${table.operation}<>'admit' and ${table.activeGeneration} is null)`,
		),
	],
);

/** An immutable admission identity. Old generation references never follow a later rejoin. @internal */
export const accessMembershipAdmission = pgTable(
	"access_membership_admission",
	{
		membershipId: uuid().notNull(),
		generation: bigint({ mode: "number" }).notNull(),
		eventVersion: bigint({ mode: "number" }).notNull(),
	},
	(table): PgTableExtraConfigValue[] => [
		primaryKey({ columns: [table.membershipId, table.generation] }),
		foreignKey({
			name: "access_membership_admission_event_fk",
			columns: [table.membershipId, table.eventVersion],
			foreignColumns: [accessMembershipEvent.membershipId, accessMembershipEvent.version],
		}).onDelete("restrict"),
		check(
			"access_membership_admission_generation_check",
			sql`${table.generation} between 1 and ${table.eventVersion}`,
		),
	],
);
