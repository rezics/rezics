import { inArray, sql } from "drizzle-orm";
import { bigint, check, index, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { createCreatedAtColumn } from "../shared/columns";
import { users } from "./auth";
import { accessScope, accessSubject } from "../access/access-identity";

/** Private service principal owned by an installation scope or a named platform duty; no public Persona is required. @internal */
export const workloadPrincipal = pgTable(
	"workload_principal",
	{
		authUserId: uuid()
			.primaryKey()
			.references(() => users.id, { onDelete: "restrict" }),
		ownerScopeId: uuid()
			.notNull()
			.references(() => accessScope.id, { onDelete: "restrict" }),
		purpose: text().$type<"installation" | "system">().notNull(),
		systemKey: text(),
		version: bigint({ mode: "number" }).notNull().default(0),
		credentialEpoch: bigint({ mode: "number" }).notNull().default(0),
		state: text().$type<"draft" | "active" | "suspended" | "revoked">().notNull().default("draft"),
	},
	(table) => [
		uniqueIndex("workload_principal_scope_key").on(table.authUserId, table.ownerScopeId),
		uniqueIndex("workload_principal_system_key")
			.on(table.systemKey)
			.where(sql`${table.systemKey} is not null`),
		index("workload_principal_owner_idx").on(table.ownerScopeId, table.authUserId),
		check(
			"workload_principal_purpose_check",
			sql`(${table.purpose}='installation' and ${table.systemKey} is null) or (${table.purpose}='system' and ${table.systemKey} is not null and ${table.systemKey} ~ '^[a-z][a-z0-9-]{0,63}$')`,
		),
		check(
			"workload_principal_version_check",
			sql`${table.version} between 0 and 9007199254740991 and ${table.credentialEpoch} between 0 and ${table.version} and (${table.version}=0 or ${table.credentialEpoch}>0)`,
		),
		check(
			"workload_principal_state_check",
			sql`(${table.state}='draft' and ${table.version}=0) or (${table.state} in ('active','suspended','revoked') and ${table.version}>0)`,
		),
	],
);

/** Immutable workload control receipt; the initiating operator is historical, not the workload owner. @internal */
export const workloadPrincipalEvent = pgTable(
	"workload_principal_event",
	{
		authUserId: uuid()
			.notNull()
			.references(() => workloadPrincipal.authUserId, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull(),
		operationId: uuid().notNull(),
		requestDigest: text().notNull(),
		operation: text().$type<"create" | "rename" | "suspend" | "resume" | "revoke">().notNull(),
		stateAfter: text().$type<"active" | "suspended" | "revoked">().notNull(),
		credentialEpochAfter: bigint({ mode: "number" }).notNull(),
		label: text().notNull(),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		authoritySubjectId: uuid()
			.notNull()
			.references(() => accessSubject.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.authUserId, table.version] }),
		uniqueIndex("workload_principal_event_operation_key").on(table.authUserId, table.operationId),
		check(
			"workload_principal_event_version_check",
			sql`${table.version} between 1 and 9007199254740991 and ${table.credentialEpochAfter} between 1 and ${table.version}`,
		),
		check("workload_principal_event_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
		check(
			"workload_principal_event_operation_check",
			inArray(table.operation, ["create", "rename", "suspend", "resume", "revoke"]),
		),
		check(
			"workload_principal_event_state_check",
			inArray(table.stateAfter, ["active", "suspended", "revoked"]),
		),
		check(
			"workload_principal_event_label_check",
			sql`length(btrim(${table.label}))>0 and octet_length(${table.label})<=512`,
		),
	],
);
