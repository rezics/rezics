import { lockAccessMembershipScopePolicy } from "./memberships";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { AccessPermissionValues, accessPermissionKey, accessPermissionCeilingCovers, scopeCovers, type AccessPermission } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { accessAssignmentCeiling, accessAssignmentCeilingPermission, accessAssignmentCeilingEvent } from "../database/schema/access-assignment-ceiling";
import { accessRoleBindingScope } from "../database/schema/access-role-binding";
import { accessMembership } from "../database/schema/access-membership";
import { accessSubject } from "../database/schema/access-identity";
import { AccessPermissionSchema, decodeAccessPermissionSnapshot } from "./permission";
import { readSubjectRoleBindingPermissions } from "./role-binding-permissions";
import { readAccessMemberSetRecipients } from "./member-set-recipients";

const id = z.uuid().toLowerCase(), version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const recipient = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("subject"), subjectId: id }),
	z.strictObject({ kind: z.literal("group"), scopeId: id, groupId: id }),
	z.strictObject({ kind: z.literal("all-members"), scopeId: id }),
	z.strictObject({ kind: z.literal("scope-members"), scopeId: id, subjectKind: z.enum(["principal", "entity"]) }),
]);
const base = { scopeId: id, ceilingId: id, operationId: id, operatorAuthUserId: id, authoritySubjectId: id, expectedVersion: version };
const schema = z.discriminatedUnion("operation", [
	z.strictObject({ ...base, operation: z.literal("create"), managerBindingId: id,
		managerTermsRevision: version.min(1), roleId: id,
		targetPath: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8), recipient,
		validFrom: z.date(), validUntil: z.date().nullable(),
		maximumGrantDurationSeconds: z.number().int().positive().max(2147483647).nullable(), grantNotAfter: z.date().nullable(),
		permissions: z.array(AccessPermissionSchema).max(AccessPermissionValues.length),
	}),
	z.strictObject({ ...base, operation: z.literal("revoke") }),
]);
/** An immutable institutional approval for an exact manager source, named role and recipient policy. @internal */
export type AccessAssignmentCeilingCommand = z.infer<typeof schema>;
/** Original creation/revocation outcome; this does not grant the manager data access. @internal */
export interface AccessAssignmentCeilingReceipt { ceilingId: string; operationId: string; version: number; state: "active" | "revoked" }
/** Approval identity or expected state does not match this operation. @internal */
export class AccessAssignmentCeilingConflict extends Error {
	constructor() { super("Assignment ceiling conflicts with its current state or receipt"); }
}
/** The current owner denied approval management or proposed assignment. @internal */
export class AccessAssignmentCeilingDenied extends Error {
	constructor() { super("Current assignment approval is required"); }
}
/** Missing, stale or excessive approval evidence cannot authorize assignment. @internal */
export class AccessAssignmentCeilingUnavailable extends Error {
	constructor() { super("Assignment ceiling evidence is unavailable or exceeds its budget"); }
}
function admit(value: boolean | null | undefined) {
	if (value === false) throw new AccessAssignmentCeilingDenied();
	if (value !== true) throw new AccessAssignmentCeilingUnavailable();
}
function receipt(row: typeof accessAssignmentCeilingEvent.$inferSelect): AccessAssignmentCeilingReceipt {
	return { ceilingId: row.ceilingId, operationId: row.operationId, version: row.version, state: row.operation === "create" ? "active" : "revoked" };
}
/**
 * Admit or revoke a sealed confer ceiling under current resource-authority SQL.
 * @internal
 * @remarks The owner supplies pre-change ceiling-management authority, applicability,
 * recipient constraints and any independent approval/recovery conditions. It first
 * promotes its complete authority fences. Replacing terms creates another approval;
 * this store never expands a previously approved set or follows new manager terms.
 */
export async function applyAccessAssignmentCeilingCommand(
	tx: DatabaseTransaction, input: AccessAssignmentCeilingCommand, admission: SQL<boolean | null>,
): Promise<AccessAssignmentCeilingReceipt> {
	const command = schema.parse(input);
	if (command.operation === "create") {
		if (command.validUntil !== null && command.validUntil <= command.validFrom) throw new AccessAssignmentCeilingConflict();
		const keys = new Set(command.permissions.map(accessPermissionKey));
		command.permissions = AccessPermissionValues.filter(permission => keys.has(accessPermissionKey(permission)))
			.map(permission => ({ ...permission })).sort((a, b) => accessPermissionKey(a) < accessPermissionKey(b) ? -1 : 1);
	}
	const requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async work => {
		const authorize = async () => admit((await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted);
		await authorize();
		const [fence] = await work.select({ id: accessRoleBindingScope.scopeId }).from(accessRoleBindingScope)
			.where(eq(accessRoleBindingScope.scopeId, command.scopeId)).for("update");
		if (!fence) throw new AccessAssignmentCeilingUnavailable();
		await authorize();
		if (command.operation === "create") await work.insert(accessAssignmentCeiling).values({
			id: command.ceilingId, scopeId: command.scopeId, managerBindingId: command.managerBindingId,
			managerTermsRevision: command.managerTermsRevision, roleId: command.roleId, targetPath: command.targetPath,
			recipientKind: command.recipient.kind,
			recipientSubjectId: command.recipient.kind === "subject" ? command.recipient.subjectId : null,
			recipientGroupId: command.recipient.kind === "group" ? command.recipient.groupId : null,
			recipientScopeId: command.recipient.kind === "subject" ? null : command.recipient.scopeId,
			memberSubjectKind: command.recipient.kind === "scope-members" ? command.recipient.subjectKind : null,
			validFrom: command.validFrom, validUntil: command.validUntil,
			maximumGrantDurationSeconds: command.maximumGrantDurationSeconds, grantNotAfter: command.grantNotAfter,
			permissionCount: command.permissions.length,
			permissionDigest: createHash("sha256").update(command.permissions.map(accessPermissionKey).join("\n")).digest("hex"),
		}).onConflictDoNothing({ target: accessAssignmentCeiling.id });
		const [head] = await work.select().from(accessAssignmentCeiling)
			.where(and(eq(accessAssignmentCeiling.id, command.ceilingId), eq(accessAssignmentCeiling.scopeId, command.scopeId))).for("update");
		if (!head) throw new AccessAssignmentCeilingConflict();
		await authorize();
		if (command.operation === "create" && (
			head.managerBindingId !== command.managerBindingId || head.managerTermsRevision !== command.managerTermsRevision || head.roleId !== command.roleId ||
			JSON.stringify(head.targetPath) !== JSON.stringify(command.targetPath) || head.recipientKind !== command.recipient.kind ||
			head.recipientSubjectId !== (command.recipient.kind === "subject" ? command.recipient.subjectId : null) ||
			head.recipientGroupId !== (command.recipient.kind === "group" ? command.recipient.groupId : null) ||
			head.recipientScopeId !== (command.recipient.kind === "subject" ? null : command.recipient.scopeId) ||
			head.memberSubjectKind !== (command.recipient.kind === "scope-members" ? command.recipient.subjectKind : null) ||
			head.validFrom.getTime() !== command.validFrom.getTime() || head.validUntil?.getTime() !== command.validUntil?.getTime() ||
			head.maximumGrantDurationSeconds !== command.maximumGrantDurationSeconds || head.grantNotAfter?.getTime() !== command.grantNotAfter?.getTime() ||
			head.permissionCount !== command.permissions.length || head.permissionDigest !== createHash("sha256").update(command.permissions.map(accessPermissionKey).join("\n")).digest("hex")
		)) throw new AccessAssignmentCeilingConflict();
		const [prior] = await work.select().from(accessAssignmentCeilingEvent).where(and(
			eq(accessAssignmentCeilingEvent.ceilingId, head.id), eq(accessAssignmentCeilingEvent.operationId, command.operationId),
		)).limit(1);
		if (prior) {
			if (prior.requestDigest !== requestDigest || prior.operatorAuthUserId !== command.operatorAuthUserId || prior.authoritySubjectId !== command.authoritySubjectId)
				throw new AccessAssignmentCeilingConflict();
			return receipt(prior);
		}
		if (head.version !== command.expectedVersion || head.state === "revoked" || (command.operation === "create") !== (head.version === 0))
			throw new AccessAssignmentCeilingConflict();
		const nextVersion = head.version + 1;
		const [event] = await work.insert(accessAssignmentCeilingEvent).values({ ceilingId: head.id, version: nextVersion,
			operationId: command.operationId, requestDigest, operation: command.operation,
			operatorAuthUserId: command.operatorAuthUserId, authoritySubjectId: command.authoritySubjectId }).returning();
		if (!event) throw new AccessAssignmentCeilingUnavailable();
		if (command.operation === "create" && command.permissions.length) await work.insert(accessAssignmentCeilingPermission).values(
			command.permissions.map(permission => ({ ceilingId: head.id, family: permission.family, permission: permission.key })),
		);
		const resultReceipt = receipt(event);
		const result = await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
			with admission as materialized(select (${admission}) as admitted),changed as(
			 update public.access_assignment_ceiling set version=${nextVersion},state=${resultReceipt.state},sealed=true
			 where id=${head.id}::uuid and version=${head.version} and(select admitted from admission) is true returning id
			) select(select admitted from admission) as admitted,(select id from changed) as changed`);
		admit(result.rows[0]?.admitted);
		if (!result.rows[0]?.changed) throw new AccessAssignmentCeilingConflict();
		return resultReceipt;
	});
}

/** Current immutable approvals for a bounded set of manager bindings at one exact authority root. @internal */
export async function readAccessAssignmentCeilings(
	tx: DatabaseTransaction, input: { scopeId: string; roleId: string; managerBindingIds: string[] },
) {
	const request = z.strictObject({ scopeId: id, roleId: id, managerBindingIds: z.array(id).max(256) }).parse(input);
	const [fence] = await tx.select({ id: accessRoleBindingScope.scopeId }).from(accessRoleBindingScope)
		.where(eq(accessRoleBindingScope.scopeId, request.scopeId)).for("share");
	if (!fence) throw new AccessAssignmentCeilingUnavailable();
	if (!request.managerBindingIds.length) return [];
	const approvals = await tx.select().from(accessAssignmentCeiling).where(and(
		eq(accessAssignmentCeiling.scopeId, request.scopeId), eq(accessAssignmentCeiling.roleId, request.roleId),
		inArray(accessAssignmentCeiling.managerBindingId, request.managerBindingIds), eq(accessAssignmentCeiling.state, "active"),
		eq(accessAssignmentCeiling.sealed, true),
	)).orderBy(accessAssignmentCeiling.id).limit(257);
	if (approvals.length > 256) throw new AccessAssignmentCeilingUnavailable();
	if (!approvals.length) return [];
	const rows = await tx.select().from(accessAssignmentCeilingPermission)
		.where(inArray(accessAssignmentCeilingPermission.ceilingId, approvals.map(approval => approval.id)))
		.limit(approvals.length * AccessPermissionValues.length + 1);
	const members = new Map<string, typeof rows>();
	for (const row of rows) { const values = members.get(row.ceilingId) ?? []; values.push(row); members.set(row.ceilingId, values); }
	return approvals.map(approval => ({ approval,
		permissions: decodeAccessPermissionSnapshot(members.get(approval.id) ?? [], approval.permissionCount, approval.permissionDigest) }));
}

/**
 * Find one complete confer approval for a proposed named-role effect.
 * @internal
 * @remarks Manager sources are loaded for the selected subject in this transaction.
 * The caller separately admits actor, credentials,
 * representation, restrictions, resource grantability and recovery/approval policy.
 * This never intersects the manager's data permissions with the proposed role.
 * It does require the exact live management binding and its management permission.
 * Scope-member approvals require the grant to retain the exact live admission.
 */
export async function findRoleAssignmentCeiling(
	tx: DatabaseTransaction,
	input: {
		scopeId: string; roleId: string; targetPath: string[];
		operation: "bind" | "activate" | "ceiling";
		ceilingConstraints?: { maximumGrantDurationSeconds: number | null; grantNotAfter: Date | null };
		permissions: AccessPermission[];
		validFrom: Date; validUntil: Date | null;
		recipient: z.infer<typeof recipient>;
		recipientEligibility: { membershipId: string; generation: number } | null;
		managerSubjectId: string;
        excludeBindingId?: string;excludeRoleId?: string;
		/** Server-owned dynamic Group source; only that same Group approval can cover an individual path effect. */
		recipientGroupEffect?: { scopeId: string; groupId: string } | null;
	},
	observe?: (evidence: {
		manager: Awaited<ReturnType<typeof readSubjectRoleBindingPermissions>>;
		approvals: Awaited<ReturnType<typeof readAccessAssignmentCeilings>>;
		recipientMemberSets: Awaited<ReturnType<typeof readAccessMemberSetRecipients>> | null;
		memberScopes: string[]; memberships: (typeof accessMembership.$inferSelect)[];
	}) => Promise<void>,
): Promise<string | null> {
	const request = z.strictObject({ scopeId: id, roleId: id,
		targetPath: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8), operation: z.enum(["bind", "activate", "ceiling"]),
        ceilingConstraints: z.strictObject({ maximumGrantDurationSeconds: z.number().int().positive().nullable(),grantNotAfter: z.date().nullable() }).optional(),
		permissions: z.array(AccessPermissionSchema).max(AccessPermissionValues.length), recipient,
		validFrom: z.date(), validUntil: z.date().nullable(), managerSubjectId: id,excludeBindingId: id.optional(),excludeRoleId: id.optional(),
		recipientGroupEffect: z.strictObject({ scopeId: id, groupId: id }).nullable().default(null),
		recipientEligibility: z.strictObject({ membershipId: id, generation: version.min(1) }).nullable(),
	}).parse({ scopeId: input.scopeId, roleId: input.roleId, targetPath: input.targetPath, operation: input.operation,
		permissions: input.permissions, recipient: input.recipient, recipientEligibility: input.recipientEligibility,
		validFrom: input.validFrom, validUntil: input.validUntil, managerSubjectId: input.managerSubjectId, recipientGroupEffect: input.recipientGroupEffect,ceilingConstraints: input.ceilingConstraints,excludeBindingId: input.excludeBindingId,excludeRoleId: input.excludeRoleId });
	if ((request.recipient.kind === "scope-members" && request.operation !== "ceiling") || (request.operation === "ceiling" && !request.ceilingConstraints)) throw new AccessAssignmentCeilingUnavailable();
	if (request.validUntil !== null && request.validUntil <= request.validFrom) throw new AccessAssignmentCeilingConflict();
	const managementPath = request.operation === "activate" ? ["roles", request.roleId] : request.targetPath;
	const manager = await readSubjectRoleBindingPermissions(tx, { subjectId: request.managerSubjectId,
		targets: [{ scopeId: request.scopeId, path: managementPath }] });
	const required = request.operation === "bind" ? "access.role-binding.manage" : request.operation === "activate" ? "access.role.activate" : "access.assignment-ceiling.manage";
	const sources = manager.bindings.filter(source => source.active && source.binding.id!==request.excludeBindingId && source.binding.roleId!==request.excludeRoleId && source.binding.targetScopeId === request.scopeId &&
		scopeCovers(source.terms.targetPath, managementPath) && source.permissions.some(permission => permission.family === "management" && permission.key === required));
	const approvals = await readAccessAssignmentCeilings(tx, { scopeId: request.scopeId, roleId: request.roleId, managerBindingIds: sources.map(source => source.binding.id) });
	const memberScopes = [...new Set(approvals.flatMap(({ approval }) => (approval.recipientKind === "scope-members" || approval.recipientKind === "group" || approval.recipientKind === "all-members") && approval.recipientScopeId ? [approval.recipientScopeId] : []))].sort();
	if (memberScopes.length > 64) throw new AccessAssignmentCeilingUnavailable();
	let subjectKind: "principal" | "entity" | null = null;
	let memberships: (typeof accessMembership.$inferSelect)[] = [];
	if (request.recipient.kind === "subject" && memberScopes.length) {
		const isolation = (await tx.execute<{ isolation: string }>(sql`select current_setting('transaction_isolation') as isolation`)).rows[0]?.isolation;
		if (isolation !== "read committed") throw new AccessAssignmentCeilingUnavailable();
		const [subject] = await tx.select().from(accessSubject).where(eq(accessSubject.id, request.recipient.subjectId)).limit(1);
		if (!subject) throw new AccessAssignmentCeilingUnavailable();
		subjectKind = subject.authUserId !== null ? "principal" : "entity";
		await tx.execute(sql`select public.lock_access_membership_keys(array[${sql.join(memberScopes.map(scope => sql`${scope}::uuid`), sql`, `)}],${subject.id}::uuid,false)`);
		await lockAccessMembershipScopePolicy(tx,memberScopes);
		memberships = await tx.select().from(accessMembership).where(and(eq(accessMembership.subjectId, subject.id), inArray(accessMembership.scopeId, memberScopes),sql`public.access_membership_is_eligible(${accessMembership.id}) is true`))
			.orderBy(accessMembership.id).for("share");
	}
	const groupScopes = [...new Set(approvals.flatMap(({ approval }) => approval.recipientKind === "group" && approval.recipientScopeId !== null && request.recipientGroupEffect !== null &&
		approval.recipientScopeId === request.recipientGroupEffect.scopeId && approval.recipientGroupId === request.recipientGroupEffect.groupId ? [approval.recipientScopeId] : []))];
	const recipientMemberSets = request.recipient.kind === "subject" && groupScopes.length
		? await readAccessMemberSetRecipients(tx,{ subjectId: request.recipient.subjectId,scopeIds: groupScopes }) : null;
	await observe?.({ manager, approvals, memberScopes, memberships,recipientMemberSets });
	const value = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
	const now = new Date(value ?? "invalid");
	if (!Number.isFinite(now.getTime())) throw new AccessAssignmentCeilingUnavailable();
	for (const { approval, permissions } of approvals) {
		const source = sources.find(candidate => candidate.binding.id === approval.managerBindingId && candidate.terms.revision === approval.managerTermsRevision);
		if (!source || source.terms.validFrom > now || (source.terms.validUntil !== null && source.terms.validUntil <= now) ||
			approval.validFrom > now || (approval.validUntil !== null && approval.validUntil <= now) ||
			!scopeCovers(approval.targetPath, request.targetPath) || !accessPermissionCeilingCovers(request.permissions, permissions)) continue;
		if (request.operation === "ceiling") {
            const limits = request.ceilingConstraints!;
            if ((approval.grantNotAfter !== null && (request.validUntil === null || request.validUntil>approval.grantNotAfter)) ||
                (approval.maximumGrantDurationSeconds !== null && (request.validUntil === null || request.validUntil.getTime()-request.validFrom.getTime()>approval.maximumGrantDurationSeconds*1000)) ||
                (approval.maximumGrantDurationSeconds !== null && (limits.maximumGrantDurationSeconds === null || limits.maximumGrantDurationSeconds > approval.maximumGrantDurationSeconds)) ||
                (approval.grantNotAfter !== null && (limits.grantNotAfter === null || limits.grantNotAfter > approval.grantNotAfter))) continue;
            // Issuing another ceiling preserves recipient identity; membership-dependent
            // individual matching must never become an independent approval.
            const target = request.recipient;
            if (approval.recipientKind !== target.kind ||
                (target.kind === "subject" && approval.recipientSubjectId !== target.subjectId) ||
                (target.kind !== "subject" && approval.recipientScopeId !== target.scopeId) ||
                (target.kind === "group" && approval.recipientGroupId !== target.groupId) ||
                (target.kind === "scope-members" && approval.memberSubjectKind !== target.subjectKind)) continue;
            return approval.id;
        }
        if (approval.grantNotAfter !== null && (request.validUntil === null || request.validUntil > approval.grantNotAfter)) continue;
		if (approval.maximumGrantDurationSeconds !== null && (request.validUntil === null ||
			request.validUntil.getTime() - request.validFrom.getTime() > approval.maximumGrantDurationSeconds * 1000)) continue;
		const target = request.recipient;
		if (approval.recipientKind === "subject" && target.kind === "subject" && approval.recipientSubjectId === target.subjectId) return approval.id;
		if (approval.recipientKind === "group" && target.kind === "group" && approval.recipientGroupId === target.groupId && approval.recipientScopeId === target.scopeId) return approval.id;
		if (approval.recipientKind === "all-members" && target.kind === "all-members" && approval.recipientScopeId === target.scopeId) return approval.id;
		// A named member-set ceiling may cover an individual only through the exact
		// currently retained admission. Proposed topology cannot authorize its own expansion.
		if (approval.recipientKind === "all-members" && target.kind === "subject" && request.recipientEligibility) {
			const eligibility = request.recipientEligibility;
			if (memberships.some(member => member.id === eligibility.membershipId && member.scopeId === approval.recipientScopeId && member.activeGeneration === eligibility.generation)) return approval.id;
		}
		if (approval.recipientKind === "group" && target.kind === "subject" && request.recipientEligibility && recipientMemberSets && request.recipientGroupEffect !== null &&
			approval.recipientScopeId === request.recipientGroupEffect.scopeId && approval.recipientGroupId === request.recipientGroupEffect.groupId) {
			const eligibility = request.recipientEligibility;
			const exact = recipientMemberSets.memberships.some(member => member.id === eligibility.membershipId && member.scopeId === approval.recipientScopeId && member.activeGeneration === eligibility.generation);
			if (exact && recipientMemberSets.recipients.some(set => set.scopeId === approval.recipientScopeId && set.kind === approval.recipientKind &&
				(set.kind !== "group" || set.groupId === approval.recipientGroupId))) return approval.id;
		}
		if (approval.recipientKind === "scope-members" && target.kind === "subject" && approval.memberSubjectKind === subjectKind && request.recipientEligibility) {
			const eligibility = request.recipientEligibility;
			if (memberships.some(member => member.id === eligibility.membershipId && member.scopeId === approval.recipientScopeId && member.activeGeneration === eligibility.generation)) return approval.id;
		}
	}
	return null;
}

/** Owning native command decoder for server-resolved proposals. @internal */
export { schema as AccessAssignmentCeilingCommandSchema };
