import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { AccessPermissionValues, accessPermissionKey, type AccessPermission } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { accessRole } from "../database/schema/access-role";
import { accessScope, accessSubject } from "../database/schema/access-identity";
import { accessGroup, accessGroupTree } from "../database/schema/access-group";
import {
	accessRoleBinding,
	accessRoleBindingScope,
	accessRoleBindingEvent,
	accessRoleBindingRevision,
	accessRoleBindingPermission,
} from "../database/schema/access-role-binding";
import { AccessPermissionSchema, decodeAccessPermissionSnapshot } from "./permission";
const versionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const recipientSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("subject"), subjectId: z.uuid().toLowerCase() }),
	z.strictObject({ kind: z.literal("group"), groupId: z.uuid().toLowerCase(), scopeId: z.uuid().toLowerCase() }),
	z.strictObject({ kind: z.literal("all-members"), scopeId: z.uuid().toLowerCase() }),
]);
const termsSchema = z
	.strictObject({
		targetPath: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8),
		validFrom: z.date(),
		validUntil: z.date().nullable(),
		recipientEligibility: z.strictObject({
			membershipId: z.uuid().toLowerCase(),
			generation: versionSchema.min(1),
			selection: z.strictObject({ groupId: z.uuid().toLowerCase(), version: versionSchema.min(1) }).nullable(),
		}).nullable(),
		permissionPolicy: z.discriminatedUnion("mode", [
			z.strictObject({ mode: z.literal("local-role") }),
			z.strictObject({
				mode: z.literal("frozen-ceiling"),
				permissions: z.array(AccessPermissionSchema).max(AccessPermissionValues.length),
			}),
		]),
	})
	.refine(
		(terms) => terms.validUntil === null || terms.validUntil > terms.validFrom,
		"Binding validity must be a nonempty half-open interval",
	);
const base = {
	targetScopeId: z.uuid().toLowerCase(),
	bindingId: z.uuid().toLowerCase(),
	expectedVersion: versionSchema,
	operationId: z.uuid().toLowerCase(),
	operatorAuthUserId: z.uuid().toLowerCase(),
	authoritySubjectId: z.uuid().toLowerCase(),
};
const schema = z.discriminatedUnion("operation", [
	z.strictObject({
		...base,
		operation: z.literal("create"),
		roleId: z.uuid().toLowerCase(),
		recipient: recipientSchema,
		terms: termsSchema,
	}),
	z.strictObject({ ...base, operation: z.literal("amend"), terms: termsSchema }),
	z.strictObject({ ...base, operation: z.literal("revoke") }),
]);
/** Explicit binding control; its owner must admit management, constraints and assignment impact. @internal */
export type AccessRoleBindingCommand = z.infer<typeof schema>;
/** Stable historical command result; active means selected terms, not current permission. @internal */
export interface AccessRoleBindingReceipt {
	bindingId: string;
	operationId: string;
	version: number;
	termsRevision: number;
	state: "active" | "revoked";
}
/** A binding identity, expected version or requested terms conflict with current state. @internal */
export class AccessRoleBindingConflict extends Error {
	constructor() {
		super("Role binding command conflicts with identity, state or receipt");
	}
}
/** Current binding admission denied the operation. @internal */
export class AccessRoleBindingAdmissionDenied extends Error {
	constructor() {
		super("Current role binding authority and admission are required");
	}
}
/** Missing owner facts or unknown admission cannot produce a binding effect. @internal */
export class AccessRoleBindingUnavailable extends Error {
	constructor() {
		super("Role binding state or admission is unavailable");
	}
}
function requireAdmission(value: boolean | null | undefined) {
	if (value === false) throw new AccessRoleBindingAdmissionDenied();
	if (value !== true) throw new AccessRoleBindingUnavailable();
}
function receipt(row: typeof accessRoleBindingEvent.$inferSelect): AccessRoleBindingReceipt {
	const termsRevision = row.operation === "revoke" ? row.retainedTermsRevision : row.version;
	if (termsRevision === null) throw new AccessRoleBindingUnavailable();
	return {
		bindingId: row.bindingId,
		operationId: row.operationId,
		version: row.version,
		termsRevision,
		state: row.operation === "revoke" ? "revoked" : "active",
	};
}
function canonicalPermissions(permissions: readonly AccessPermission[]): AccessPermission[] {
	const keys = new Set(permissions.map(accessPermissionKey));
	return AccessPermissionValues.filter((value) => keys.has(accessPermissionKey(value)))
		.map((value) => ({ ...value }))
		.sort((a, b) => (accessPermissionKey(a) < accessPermissionKey(b) ? -1 : 1));
}
/**
 * Persist sealed binding terms and its current selection under a rollback-safe savepoint.
 * @internal
 * @remarks The owner discovers/promotes the complete authority fence set first.
 * This primitive locks target binding scope, optional recipient Group tree, role,
 * then binding. Admission is current side-effect-free SQL checked before writes,
 * after waits and in the final head effect. It includes scope/recipient grantability,
 * assignment ceilings, lineage/conditions and continuity; audit IDs do not prove it.
 * The supplied frozen permission set is already approved: this store never expands it.
 */
export async function applyAccessRoleBindingCommand(
	tx: DatabaseTransaction,
	input: AccessRoleBindingCommand,
	admission: SQL<boolean | null>,
): Promise<AccessRoleBindingReceipt> {
	const command = schema.parse(input);
	if (command.operation !== "revoke" && command.terms.permissionPolicy.mode === "frozen-ceiling")
		command.terms.permissionPolicy.permissions = canonicalPermissions(
			command.terms.permissionPolicy.permissions,
		);
	const requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async (work) => {
		const authorize = async () =>
			requireAdmission(
				(await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`))
					.rows[0]?.admitted,
			);
		await authorize();
		const [scope] = await work
			.select()
			.from(accessRoleBindingScope)
			.where(eq(accessRoleBindingScope.scopeId, command.targetScopeId))
			.for("update");
		if (!scope) throw new AccessRoleBindingUnavailable();
		await authorize();
		const [existing] = await work
			.select()
			.from(accessRoleBinding)
			.where(
				and(
					eq(accessRoleBinding.id, command.bindingId),
					eq(accessRoleBinding.targetScopeId, command.targetScopeId),
				),
			)
			.limit(1);
		const roleId = existing?.roleId ?? (command.operation === "create" ? command.roleId : null);
		const recipient = existing
			? recipientFromHead(existing)
			: command.operation === "create"
				? command.recipient
				: null;
		if (!roleId || !recipient) throw new AccessRoleBindingConflict();
		if (command.operation !== "revoke" && command.terms.recipientEligibility) {
			if (recipient.kind !== "subject") throw new AccessRoleBindingConflict();
			const dependency = command.terms.recipientEligibility;
			await work.execute(sql`select public.lock_access_role_binding_eligibility(
				${dependency.membershipId}::uuid, ${dependency.generation}::bigint,
				${dependency.selection?.groupId ?? null}::uuid)`);
			await authorize();
		}
		if (recipient.kind === "group") {
			const [tree] = await work
				.select({ id: accessGroupTree.scopeId })
				.from(accessGroupTree)
				.where(eq(accessGroupTree.scopeId, recipient.scopeId))
				.for("share");
			if (!tree) {
				if (!existing) throw new AccessRoleBindingConflict();
				throw new AccessRoleBindingUnavailable();
			}
			await authorize();
		}
		const [role] = await work
			.select()
			.from(accessRole)
			.where(eq(accessRole.id, roleId))
			.for("share");
		if (!role) throw new AccessRoleBindingConflict();
		await authorize();
		if (!existing && command.operation === "create") {
			if (recipient.kind === "group") {
				const [group] = await work
					.select({ state: accessGroup.state })
					.from(accessGroup)
					.where(
						and(eq(accessGroup.id, recipient.groupId), eq(accessGroup.scopeId, recipient.scopeId)),
					)
					.limit(1);
				if (group?.state !== "active") throw new AccessRoleBindingConflict();
			} else if (recipient.kind === "subject") {
				const [subject] = await work
					.select({ id: accessSubject.id })
					.from(accessSubject)
					.where(eq(accessSubject.id, recipient.subjectId))
					.limit(1);
				if (!subject) throw new AccessRoleBindingConflict();
			} else {
				const [recipientScope] = await work
					.select({ id: accessScope.id })
					.from(accessScope)
					.where(eq(accessScope.id, recipient.scopeId))
					.limit(1);
				if (!recipientScope) throw new AccessRoleBindingConflict();
			}
		}
		if (command.operation === "create")
			await work
				.insert(accessRoleBinding)
				.values({
					id: command.bindingId,
					targetScopeId: command.targetScopeId,
					roleId: command.roleId,
					recipientKind: command.recipient.kind,
					recipientSubjectId:
						command.recipient.kind === "subject" ? command.recipient.subjectId : null,
					recipientGroupId: command.recipient.kind === "group" ? command.recipient.groupId : null,
					recipientScopeId: command.recipient.kind === "subject" ? null : command.recipient.scopeId,
				})
				.onConflictDoNothing({ target: accessRoleBinding.id });
		const [head] = await work
			.select()
			.from(accessRoleBinding)
			.where(
				and(
					eq(accessRoleBinding.id, command.bindingId),
					eq(accessRoleBinding.targetScopeId, command.targetScopeId),
				),
			)
			.for("update");
		if (!head) throw new AccessRoleBindingConflict();
		await authorize();
		if (
			command.operation === "create" &&
			(head.roleId !== command.roleId ||
				head.recipientKind !== command.recipient.kind ||
				head.recipientSubjectId !==
					(command.recipient.kind === "subject" ? command.recipient.subjectId : null) ||
				head.recipientGroupId !==
					(command.recipient.kind === "group" ? command.recipient.groupId : null) ||
				head.recipientScopeId !==
					(command.recipient.kind === "subject" ? null : command.recipient.scopeId))
		)
			throw new AccessRoleBindingConflict();
		const [prior] = await work
			.select()
			.from(accessRoleBindingEvent)
			.where(
				and(
					eq(accessRoleBindingEvent.bindingId, head.id),
					eq(accessRoleBindingEvent.operationId, command.operationId),
				),
			)
			.limit(1);
		if (prior) {
			if (
				prior.requestDigest !== requestDigest ||
				prior.operatorAuthUserId !== command.operatorAuthUserId ||
				prior.authoritySubjectId !== command.authoritySubjectId
			)
				throw new AccessRoleBindingConflict();
			return receipt(prior);
		}
		if (
			head.version !== command.expectedVersion ||
			head.state === "revoked" ||
			(command.operation === "create") !== (head.version === 0)
		)
			throw new AccessRoleBindingConflict();
		if (command.operation !== "revoke") {
			if (
				role.state !== "active" ||
				(command.terms.permissionPolicy.mode === "local-role" &&
					(role.scopeId !== command.targetScopeId ||
						(recipient.kind !== "subject" && recipient.scopeId !== command.targetScopeId)))
			)
				throw new AccessRoleBindingConflict();
			if (recipient.kind === "group") {
				const [group] = await work
					.select({ state: accessGroup.state })
					.from(accessGroup)
					.where(
						and(eq(accessGroup.id, recipient.groupId), eq(accessGroup.scopeId, recipient.scopeId)),
					)
					.limit(1);
				if (group?.state !== "active") throw new AccessRoleBindingConflict();
			}
		}
		const nextVersion = head.version + 1;
		const [event] = await work
			.insert(accessRoleBindingEvent)
			.values({
				bindingId: head.id,
				version: nextVersion,
				operationId: command.operationId,
				requestDigest,
				operation: command.operation,
				retainedTermsRevision: command.operation === "revoke" ? head.termsRevision : null,
				operatorAuthUserId: command.operatorAuthUserId,
				authoritySubjectId: command.authoritySubjectId,
			})
			.returning();
		if (!event) throw Error("Binding receipt was not written");
		if (command.operation !== "revoke") {
			const terms = command.terms,
				permissions =
					terms.permissionPolicy.mode === "frozen-ceiling"
						? terms.permissionPolicy.permissions
						: [];
			await work.insert(accessRoleBindingRevision).values({
				bindingId: head.id,
				revision: nextVersion,
				targetPath: terms.targetPath,
				validFrom: terms.validFrom,
				validUntil: terms.validUntil,
				membershipId: terms.recipientEligibility?.membershipId ?? null,
				membershipGeneration: terms.recipientEligibility?.generation ?? null,
				selectionGroupId: terms.recipientEligibility?.selection?.groupId ?? null,
				selectionVersion: terms.recipientEligibility?.selection?.version ?? null,
				permissionPolicy: terms.permissionPolicy.mode,
				permissionCount: permissions.length,
				permissionDigest: createHash("sha256")
					.update(permissions.map(accessPermissionKey).join("\n"))
					.digest("hex"),
			});
			if (permissions.length)
				await work.insert(accessRoleBindingPermission).values(
					permissions.map((permission) => ({
						bindingId: head.id,
						revision: nextVersion,
						family: permission.family,
						permission: permission.key,
					})),
				);
			await work
				.update(accessRoleBindingRevision)
				.set({ sealed: true })
				.where(
					and(
						eq(accessRoleBindingRevision.bindingId, head.id),
						eq(accessRoleBindingRevision.revision, nextVersion),
					),
				);
		}
		const resultReceipt = receipt(event);
		if (command.operation !== "revoke") {
			const current = await work.execute<{ eligible: boolean | null }>(sql`
				select public.access_role_binding_recipient_is_current(${head.id}::uuid,${nextVersion}::bigint) as eligible`);
			if (current.rows[0]?.eligible !== true) throw new AccessRoleBindingConflict();
		}
		const result = await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
   with admission as materialized(select (${admission}) as admitted),changed as(
    update public.access_role_binding set version=${nextVersion},terms_revision=${resultReceipt.termsRevision},state=${resultReceipt.state}
    where id=${head.id}::uuid and version=${head.version} and(select admitted from admission) is true returning id
   ) select(select admitted from admission) as admitted,(select id from changed) as changed`);
		requireAdmission(result.rows[0]?.admitted);
		if (!result.rows[0]?.changed) throw new AccessRoleBindingConflict();
		return resultReceipt;
	});
}
function recipientFromHead(
	head: typeof accessRoleBinding.$inferSelect,
): z.infer<typeof recipientSchema> {
	if (head.recipientKind === "subject" && head.recipientSubjectId)
		return { kind: "subject", subjectId: head.recipientSubjectId };
	if (head.recipientKind === "group" && head.recipientGroupId && head.recipientScopeId)
		return { kind: "group", groupId: head.recipientGroupId, scopeId: head.recipientScopeId };
	if (head.recipientKind === "all-members" && head.recipientScopeId)
		return { kind: "all-members", scopeId: head.recipientScopeId };
	throw new AccessRoleBindingUnavailable();
}
/** Exact management snapshot; it deliberately includes retired roles and revoked bindings without making them effective. @internal */
export interface AccessRoleBindingSnapshot {
	bindingId: string;
	targetScopeId: string;
	roleId: string;
	roleState: "draft" | "active" | "retired";
	recipient: z.infer<typeof recipientSchema>;
	version: number;
	state: "active" | "revoked";
	termsRevision: number;
	terms: z.infer<typeof termsSchema>;
}
/**
 * Read one binding control version and its exact sealed terms.
 * @internal
 * @remarks Current reads retain shared binding-scope and role fences. Historical
 * reads preserve the selected binding terms but never establish past/current
 * authority. This management hydration is not the hot binding-candidate query.
 */
export async function readAccessRoleBindingSnapshot(
	tx: DatabaseTransaction,
	input: { targetScopeId: string; bindingId: string; revision: number | "current" },
): Promise<AccessRoleBindingSnapshot | null> {
	input = { ...input, targetScopeId: z.uuid().toLowerCase().parse(input.targetScopeId), bindingId: z.uuid().toLowerCase().parse(input.bindingId) };
	if (input.revision !== "current") versionSchema.min(1).parse(input.revision);
	if (input.revision === "current") {
		const [scope] = await tx
			.select({ id: accessRoleBindingScope.scopeId })
			.from(accessRoleBindingScope)
			.where(eq(accessRoleBindingScope.scopeId, input.targetScopeId))
			.for("share");
		if (!scope) throw new AccessRoleBindingUnavailable();
	}
	const [head] = await tx
		.select()
		.from(accessRoleBinding)
		.where(
			and(
				eq(accessRoleBinding.id, input.bindingId),
				eq(accessRoleBinding.targetScopeId, input.targetScopeId),
			),
		)
		.limit(1);
	if (!head) return null;
	const query = tx.select().from(accessRole).where(eq(accessRole.id, head.roleId));
	const [role] = input.revision === "current" ? await query.for("share") : await query;
	if (!role) throw new AccessRoleBindingUnavailable();
	const [event] = await tx
		.select()
		.from(accessRoleBindingEvent)
		.where(
			and(
				eq(accessRoleBindingEvent.bindingId, head.id),
				eq(
					accessRoleBindingEvent.version,
					input.revision === "current" ? head.version : input.revision,
				),
			),
		)
		.limit(1);
	if (!event) return null;
	const result = receipt(event);
	const [terms] = await tx
		.select()
		.from(accessRoleBindingRevision)
		.where(
			and(
				eq(accessRoleBindingRevision.bindingId, head.id),
				eq(accessRoleBindingRevision.revision, result.termsRevision),
				eq(accessRoleBindingRevision.sealed, true),
			),
		)
		.limit(1);
	if (!terms) throw new AccessRoleBindingUnavailable();
	const rows = await tx
		.select()
		.from(accessRoleBindingPermission)
		.where(
			and(
				eq(accessRoleBindingPermission.bindingId, head.id),
				eq(accessRoleBindingPermission.revision, terms.revision),
			),
		)
		.orderBy(accessRoleBindingPermission.family, accessRoleBindingPermission.permission)
		.limit(AccessPermissionValues.length + 1);
	if (rows.length !== terms.permissionCount || rows.length > AccessPermissionValues.length)
		throw new AccessRoleBindingUnavailable();
	const permissions = decodeAccessPermissionSnapshot(rows, terms.permissionCount, terms.permissionDigest);
	return {
		bindingId: head.id,
		targetScopeId: head.targetScopeId,
		roleId: head.roleId,
		roleState: role.state,
		recipient: recipientFromHead(head),
		version: result.version,
		state: result.state,
		termsRevision: terms.revision,
		terms: {
			targetPath: terms.targetPath,
			validFrom: terms.validFrom,
			validUntil: terms.validUntil,
			recipientEligibility: terms.membershipId !== null && terms.membershipGeneration !== null
				? {
					membershipId: terms.membershipId,
					generation: terms.membershipGeneration,
					selection: terms.selectionGroupId !== null && terms.selectionVersion !== null
						? { groupId: terms.selectionGroupId, version: terms.selectionVersion }
						: null,
				}
				: null,
			permissionPolicy:
				terms.permissionPolicy === "local-role"
					? { mode: "local-role" }
					: { mode: "frozen-ceiling", permissions },
		},
	};
}
