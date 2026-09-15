import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { AccessPermissionValues, accessPermissionKey, type AccessPermission } from "@rezics/access";
import { AccessPermissionSchema, decodeAccessPermissionSnapshot } from "./permission";
import type { DatabaseTransaction } from "../database";
import {
	accessRole,
	accessRoleEvent,
	accessRolePermission,
	accessRoleRevision,
} from "../database/schema/access-role";

/** Complete proposed definition; callers merge patches before entering persistence. @internal */
export interface AccessRoleDefinition {
	label: string;
	description: string | null;
	permissions: readonly AccessPermission[];
}
type CommandBase = {
	scopeId: string;
	roleId: string;
	expectedVersion: number;
	operationId: string;
	operatorAuthUserId: string;
	authoritySubjectId: string;
};
/** A stable role command identity and its captured precondition/audit context. @internal */
export type AccessRoleCommand = CommandBase &
	(
		| { operation: "create" | "revise"; definition: AccessRoleDefinition }
		| { operation: "activate"; definitionRevision: number }
		| { operation: "retire" }
	);
/** Stored outcome of one command, independent from any later role head. @internal */
export interface AccessRoleReceipt {
	roleId: string;
	operationId: string;
	version: number;
	state: "draft" | "active" | "retired";
	activeRevision: number | null;
	definitionRevision: number | null;
}
/** Stale state, a retired role or a reused operation identity with different intent. @internal */
export class AccessRoleConflict extends Error {
	constructor() {
		super("Role command conflicts with its scope, state or operation receipt");
	}
}
/** Current admission rejected this command; no provisional role changes survive. @internal */
export class AccessRoleAdmissionDenied extends Error {
	constructor() {
		super("Current role command authority is required");
	}
}
/** Authority could not be established; absence is not converted into a deny fact. @internal */
export class AccessRoleAdmissionUnavailable extends Error {
	constructor() {
		super("Role command authority is unavailable");
	}
}
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
/** Literal role definition shared by management transport and persistence. @internal */
export const AccessRoleDefinitionSchema = z.strictObject({
	label: z
		.string()
		.refine((value) => value.trim().length > 0 && Buffer.byteLength(value, "utf8") <= 512),
	description: z
		.string()
		.refine((value) => Buffer.byteLength(value, "utf8") <= 4096)
		.nullable(),
	permissions: z
		.array(AccessPermissionSchema)
		.max(AccessPermissionValues.length)
		.refine((values) => new Set(values.map(accessPermissionKey)).size === values.length),
});
const common = {
	scopeId: z.uuid().toLowerCase(),
	roleId: z.uuid().toLowerCase(),
	expectedVersion: revision,
	operationId: z.uuid().toLowerCase(),
	operatorAuthUserId: z.uuid().toLowerCase(),
	authoritySubjectId: z.uuid().toLowerCase(),
};
const commandSchema = z.discriminatedUnion("operation", [
	z.strictObject({
		...common,
		operation: z.literal("create"),
		expectedVersion: z.literal(0),
		definition: AccessRoleDefinitionSchema,
	}),
	z.strictObject({ ...common, operation: z.literal("revise"), definition: AccessRoleDefinitionSchema }),
	z.strictObject({
		...common,
		operation: z.literal("activate"),
		definitionRevision: revision.refine((value) => value > 0),
	}),
	z.strictObject({ ...common, operation: z.literal("retire") }),
]);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function receipt(event: typeof accessRoleEvent.$inferSelect): AccessRoleReceipt {
	return {
		roleId: event.roleId,
		operationId: event.operationId,
		version: event.version,
		state: event.stateAfter,
		activeRevision: event.activeRevision,
		definitionRevision:
			event.operation === "create" || event.operation === "revise" ? event.version : null,
	};
}
function requireAdmission(admitted: boolean | null | undefined) {
	if (admitted === false) throw new AccessRoleAdmissionDenied();
	if (admitted !== true) throw new AccessRoleAdmissionUnavailable();
}

/**
 * Persist one role command in a rollback-safe savepoint.
 * @internal
 * @remarks The owner supplies a side-effect-free SQL admission predicate after
 * its complete authority-fence discovery/locking. It must include action-specific
 * conditions and assignment impact; actor/creator fields are audit only. Admission
 * is checked before provisional writes, after role-lock waits and again in the
 * final head mutation. A receipt never substitutes for current admission. This
 * primitive does not load grants or authorize an HTTP request by itself.
 */
export async function applyAccessRoleCommand(
	tx: DatabaseTransaction,
	input: AccessRoleCommand,
	admission: SQL<boolean | null>,
): Promise<AccessRoleReceipt> {
	const command = commandSchema.parse(input);
	if (command.operation === "create" || command.operation === "revise")
		command.definition.permissions.sort((a, b) => accessPermissionKey(a) < accessPermissionKey(b) ? -1 : accessPermissionKey(a) > accessPermissionKey(b) ? 1 : 0);
	const requestDigest = hash(JSON.stringify(command));
	return tx.transaction(async (work) => {
		const authorize = async () =>
			requireAdmission(
				(await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`))
					.rows[0]?.admitted,
			);
		const load = async () =>
			(
				await work
					.select()
					.from(accessRole)
					.where(and(eq(accessRole.id, command.roleId), eq(accessRole.scopeId, command.scopeId)))
					.limit(1)
					.for("update")
			)[0];
		let head = await load();
		if (!head && command.operation === "create") {
			await authorize();
			await work
				.insert(accessRole)
				.values({ id: command.roleId, scopeId: command.scopeId })
				.onConflictDoNothing({ target: accessRole.id });
			head = await load();
		}
		if (!head) throw new AccessRoleConflict();
		await authorize();
		const [prior] = await work
			.select()
			.from(accessRoleEvent)
			.where(
				and(
					eq(accessRoleEvent.roleId, command.roleId),
					eq(accessRoleEvent.operationId, command.operationId),
				),
			)
			.limit(1);
		if (prior) {
			if (
				prior.requestDigest !== requestDigest ||
				prior.operatorAuthUserId !== command.operatorAuthUserId ||
				prior.authoritySubjectId !== command.authoritySubjectId
			)
				throw new AccessRoleConflict();
			return receipt(prior);
		}
		if (
			head.version !== command.expectedVersion ||
			head.state === "retired" ||
			(command.operation === "create") !== (head.version === 0)
		)
			throw new AccessRoleConflict();
		const version = head.version + 1;
		const state =
			command.operation === "activate"
				? "active"
				: command.operation === "retire"
					? "retired"
					: head.state;
		const activeRevision =
			command.operation === "activate" ? command.definitionRevision : head.activeRevision;
		const [event] = await work
			.insert(accessRoleEvent)
			.values({
				roleId: head.id,
				version,
				operationId: command.operationId,
				requestDigest,
				operation: command.operation,
				stateAfter: state,
				activeRevision,
				operatorAuthUserId: command.operatorAuthUserId,
				authoritySubjectId: command.authoritySubjectId,
			})
			.returning();
		if (!event) throw new Error("Role receipt was not written");
		if (command.operation === "create" || command.operation === "revise") {
			const definition = command.definition;
			await work.insert(accessRoleRevision).values({
				roleId: head.id,
				revision: version,
				label: definition.label,
				description: definition.description,
				permissionCount: definition.permissions.length,
				permissionDigest: hash(definition.permissions.map(accessPermissionKey).join("\n")),
			});
			if (definition.permissions.length)
				await work.insert(accessRolePermission).values(
					definition.permissions.map((permission) => ({
						roleId: head.id,
						revision: version,
						family: permission.family,
						permission: permission.key,
					})),
				);
			await work
				.update(accessRoleRevision)
				.set({ sealed: true })
				.where(
					and(eq(accessRoleRevision.roleId, head.id), eq(accessRoleRevision.revision, version)),
				);
		}
		const result = await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
		 with admission as materialized (select (${admission}) as admitted), changed as (
		  update public.access_role set version=${version},state=${state},active_revision=${activeRevision}
		  where id=${head.id}::uuid and version=${head.version} and (select admitted from admission) is true returning id
		 ) select (select admitted from admission) as admitted,(select id from changed) as changed`);
		requireAdmission(result.rows[0]?.admitted);
		if (!result.rows[0]?.changed) throw new AccessRoleConflict();
		return receipt(event);
	});
}

/** Read a sealed definition; active selection holds the head share lock through the owner transaction. Drafts/retired roles have no active fallback. @internal */
export async function readAccessRoleSnapshot(
	tx: DatabaseTransaction,
	input: { scopeId: string; roleId: string; revision: number | "active" },
) {
	input = { ...input, scopeId: z.uuid().toLowerCase().parse(input.scopeId), roleId: z.uuid().toLowerCase().parse(input.roleId) };
	if (input.revision !== "active") revision.refine((value) => value > 0).parse(input.revision);
	const query = tx
		.select()
		.from(accessRole)
		.where(and(eq(accessRole.scopeId, input.scopeId), eq(accessRole.id, input.roleId)))
		.limit(1);
	const [head] = input.revision === "active" ? await query.for("share") : await query;
	if (!head || (input.revision === "active" && head.state !== "active")) return null;
	const selected = input.revision === "active" ? head.activeRevision : input.revision;
	if (selected === null) return null;
	const [snapshot] = await tx
		.select()
		.from(accessRoleRevision)
		.where(
			and(
				eq(accessRoleRevision.roleId, head.id),
				eq(accessRoleRevision.revision, selected),
				eq(accessRoleRevision.sealed, true),
			),
		)
		.limit(1);
	if (!snapshot) return null;
	const permissions = await tx
		.select({ family: accessRolePermission.family, permission: accessRolePermission.permission })
		.from(accessRolePermission)
		.where(
			and(eq(accessRolePermission.roleId, head.id), eq(accessRolePermission.revision, selected)),
		)
		.orderBy(
			sql`${accessRolePermission.family} collate "C"`,
			sql`${accessRolePermission.permission} collate "C"`,
		).limit(AccessPermissionValues.length + 1);
	return {
		...snapshot,
		permissions: decodeAccessPermissionSnapshot(permissions, snapshot.permissionCount, snapshot.permissionDigest),
	};
}

/** Native role command decoder for retained server-owned proposals. @internal */
export { commandSchema as AccessRoleCommandSchema };
