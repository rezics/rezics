import { sql, inArray } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	primaryKey,
	text,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { createCreatedAtColumn } from "../shared/columns";
import { accessMembership, accessMembershipAdmission } from "./access-membership";
import { accessGroup, accessGroupTree } from "./access-group";
import { accessSubject } from "./access-identity";
import { users } from "../identity/auth";

/** Mutable fence for one admission's direct Group selections, including currently absent selections. @internal */
export const accessGroupMembershipSet = pgTable(
	"access_group_membership_set",
	{
		membershipId: uuid().notNull(),
		generation: bigint({ mode: "number" }).notNull(),
		scopeId: uuid()
			.notNull()
			.references(() => accessGroupTree.scopeId, { onDelete: "restrict" }),
		version: bigint({ mode: "number" }).notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.membershipId, table.generation] }),
		uniqueIndex("access_group_membership_set_scope_key").on(
			table.membershipId,
			table.generation,
			table.scopeId,
		),
		foreignKey({
			name: "access_group_membership_set_admission_fk",
			columns: [table.membershipId, table.generation],
			foreignColumns: [
				accessMembershipAdmission.membershipId,
				accessMembershipAdmission.generation,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "access_group_membership_set_scope_fk",
			columns: [table.membershipId, table.scopeId],
			foreignColumns: [accessMembership.id, accessMembership.scopeId],
		}).onDelete("restrict"),
		check(
			"access_group_membership_set_version_check",
			sql`${table.version} between 0 and 9007199254740991`,
		),
	],
);

/** A direct selection for an exact admission. Selection alone is not current effective membership. @internal */
export const accessGroupMembership = pgTable(
	"access_group_membership",
	{
		membershipId: uuid().notNull(),
		generation: bigint({ mode: "number" }).notNull(),
		groupId: uuid().notNull(),
		scopeId: uuid().notNull(),
		version: bigint({ mode: "number" }).notNull().default(0),
		selected: boolean().notNull().default(false),
	},
	(table) => [
		primaryKey({ columns: [table.membershipId, table.generation, table.groupId] }),
		foreignKey({
			name: "access_group_membership_set_fk",
			columns: [table.membershipId, table.generation, table.scopeId],
			foreignColumns: [
				accessGroupMembershipSet.membershipId,
				accessGroupMembershipSet.generation,
				accessGroupMembershipSet.scopeId,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "access_group_membership_group_scope_fk",
			columns: [table.groupId, table.scopeId],
			foreignColumns: [accessGroup.id, accessGroup.scopeId],
		}).onDelete("restrict"),
		index("access_group_membership_selected_idx")
			.on(table.membershipId, table.generation, table.groupId)
			.where(sql`${table.selected}`),
		index("access_group_membership_roster_idx")
			.on(table.groupId, table.membershipId, table.generation)
			.where(sql`${table.selected}`),
		check(
			"access_group_membership_version_check",
			sql`${table.version} between 0 and 9007199254740991`,
		),
	],
);

/** Private immutable command receipt for a selection transition; pruning only closes permanently ineffective selections. @internal */
export const accessGroupMembershipEvent = pgTable(
	"access_group_membership_event",
	{
		membershipId: uuid().notNull(),
		generation: bigint({ mode: "number" }).notNull(),
		groupId: uuid().notNull(),
		version: bigint({ mode: "number" }).notNull(),
		operationId: uuid().notNull(),
		requestDigest: text().notNull(),
		operation: text().$type<"assign" | "remove" | "prune">().notNull(),
		selectedAfter: boolean().notNull(),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		authoritySubjectId: uuid()
			.notNull()
			.references(() => accessSubject.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.membershipId, table.generation, table.groupId, table.version] }),
		uniqueIndex("access_group_membership_event_operation_key").on(
			table.membershipId,
			table.generation,
			table.groupId,
			table.operationId,
		),
		foreignKey({
			name: "access_group_membership_event_selection_fk",
			columns: [table.membershipId, table.generation, table.groupId],
			foreignColumns: [
				accessGroupMembership.membershipId,
				accessGroupMembership.generation,
				accessGroupMembership.groupId,
			],
		}).onDelete("restrict"),
		check(
			"access_group_membership_event_version_check",
			sql`${table.version} between 1 and 9007199254740991`,
		),
		check(
			"access_group_membership_event_digest_check",
			sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"access_group_membership_event_operation_check",
			inArray(table.operation, ["assign", "remove", "prune"]),
		),
		check(
			"access_group_membership_event_selection_check",
			sql`${table.selectedAfter}=(${table.operation}='assign')`,
		),
	],
);
