import { createHash, createHmac, randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
	AccessPermissionValues,
	scopeCovers,
	snapshotAccessPermissionCeiling,
	constrainAccessPermissions,
	accessPermissionCeilingCovers,
	type AccessPermission,
} from "@rezics/access";
import type { PrincipalRequestContext } from "../auth/principal-session";
import type { DatabaseTransaction } from "../database";
import { env } from "../config";
import { accessRole } from "@rezics/schema/postgres/access/access-role";
import { accessRoleBinding, accessRoleBindingScope } from "@rezics/schema/postgres/access/access-role-binding";
import {
	accessAssignmentCeiling,
	accessAssignmentCeilingPermission,
} from "@rezics/schema/postgres/access/access-assignment-ceiling";
import { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import { accessGroup, accessGroupTree } from "@rezics/schema/postgres/access/access-group";
import { accessGroupMembership } from "@rezics/schema/postgres/access/access-group-membership";
import {
	accessAssignmentReview as reviews,
	accessAssignmentApproval as approvals,
	accessAssignmentReceipt as receipts,
} from "@rezics/schema/postgres/access/access-assignment-management";
import {
	accessRecoveryPath,
	accessRecoveryPolicy,
} from "@rezics/schema/postgres/access/access-group-admission";
import { accessImpactFence } from "@rezics/schema/postgres/access/access-group-impact";
import { applyAccessRoleCommand, AccessRoleCommandSchema, readAccessRoleSnapshot } from "./roles";
import {
	applyAccessRoleBindingCommand,
	AccessRoleBindingCommandSchema,
	readAccessRoleBindingSnapshot,
	type AccessRoleBindingSnapshot,
} from "./role-bindings";
import {
	applyAccessAssignmentCeilingCommand,
	AccessAssignmentCeilingCommandSchema,
	findRoleAssignmentCeiling,
} from "./assignment-ceilings";
import { readManagementAuthority } from "./management-authority";
import { requireAssignmentApplicability } from "./assignment-grantability";
import {
	assignmentAuthority,
	assignmentClock,
	assignmentRecipients,
	assignmentRecipientContext,
	presentAssignmentSubject,
} from "./assignment-recipients";
import { createScopeSelectors } from "./scope-selectors";
import { scopeLifecycleAdmission } from "./scope-policy";
import {
	AssignmentRecipientSchema,
	AssignmentProposalSchema,
} from "./assignment-management-contracts";
import { GroupImpactEffectSchema, type GroupImpactEffect } from "./group-impact-delta";
import { readGroupImpactCurrentPolicy } from "./group-impact-policy";
import { groupAuthoritySourceDigest } from "./group-impact-evaluation";
import {
	readNativeRecoveryAuthorities,
	recoveryPathContext,
	requireIndependentAccessOperator,
} from "./group-admission";
import { readAccessMemberSetRecipients } from "./member-set-recipients";
import { decodeAccessPermissionSnapshot } from "./permission";
import { requireAccessAdmission, runAccessTransaction, rethrowAccessFailure } from "./transaction";
import {
	AccessChanged,
	AccessDenied,
	AccessRecordUnavailable,
	AccessUnavailable,
} from "./http-errors";
import { AccessRoleBindingDiscoveryChanged } from "./role-binding-permissions";

// JSONB reorders object properties. Canonical hashes preserve array order and
// literal snapshots while excluding only the observation instant of live readers.
const hash = (value: unknown) =>
	createHash("sha256")
		.update(
			JSON.stringify(value, (key, value) => {
				if (key === "evaluatedAt") return undefined;
				if (value && typeof value === "object" && !Array.isArray(value))
					return Object.fromEntries(
						Object.keys(value)
							.sort()
							.map((key) => [key, value[key]]),
					);
				return value;
			}),
		)
		.digest("hex");
const selectors = createScopeSelectors(env.BETTER_AUTH_SECRET);
const roleRequest = z
	.strictObject({ kind: z.literal("role"), command: AccessRoleCommandSchema })
	.refine(
		(value) => value.command.operation === "activate" || value.command.operation === "retire",
	);
const bindingRequest = z
	.strictObject({
		kind: z.literal("binding"),
		command: AccessRoleBindingCommandSchema,
		roleScopeId: z.uuid(),
		definitionRevision: z.number().int().safe().positive().nullable(),
	})
	.refine(
		(value) => (value.command.operation === "revoke") === (value.definitionRevision === null),
	);
const ceilingRequest = z
	.strictObject({
		kind: z.literal("ceiling"),
		command: AccessAssignmentCeilingCommandSchema,
		roleScopeId: z.uuid().nullable(),
		definitionRevision: z.number().int().safe().positive().nullable(),
	})
	.refine((value) =>
		value.command.operation === "create"
			? value.roleScopeId !== null && value.definitionRevision !== null
			: value.roleScopeId === null && value.definitionRevision === null,
	);
const requestSchema = z.union([roleRequest, bindingRequest, ceilingRequest]);
type Request = z.infer<typeof requestSchema>;
type Authority = Awaited<ReturnType<typeof readManagementAuthority>>;
type Review = typeof reviews.$inferSelect;
type Snapshot = AccessRoleBindingSnapshot;
const factBytes = new WeakMap<unknown[], number>();
function retainFacts(facts: unknown[], ...values: unknown[]) {
	const bytes = (factBytes.get(facts) ?? 0) + Buffer.byteLength(JSON.stringify(values));
	if (bytes > 16 * 1024 * 1024 || facts.length + values.length > 32768)
		throw new AccessUnavailable();
	factBytes.set(facts, bytes);
	facts.push(...values);
}
const commandId = (request: Request) =>
	request.kind === "role"
		? request.command.roleId
		: request.kind === "binding"
			? request.command.bindingId
			: request.command.ceilingId;
function decodeRequest(value: unknown): Request {
	const encoded = JSON.stringify(value);
	if (Buffer.byteLength(encoded) > 65536) throw new AccessUnavailable();
	return requestSchema.parse(
		JSON.parse(encoded, (key, value) =>
			["validFrom", "validUntil", "grantNotAfter"].includes(key) && typeof value === "string"
				? new Date(value)
				: value,
		),
	);
}
async function roleAuthority(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scopeId: string,
	roleId: string,
	operation: "activate" | "retire",
) {
	return readManagementAuthority(
		tx,
		{
			proof: context.credentialProof(),
			selection: context.selection,
			scopeId,
			path: ["roles", roleId],
			permission: operation === "activate" ? "access.role.activate" : "access.role.retire",
			apiPermission: "access:manage",
			requireFreshSession: true,
			mutation: true,
			excludeRoleId: roleId,
		},
		await scopeLifecycleAdmission(tx, scopeId, true),
	);
}
async function mainAuthority(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scopeId: string,
	request: Request,
) {
	if (request.kind === "role") {
		if (request.command.operation !== "activate" && request.command.operation !== "retire")
			throw new AccessChanged();
		return roleAuthority(tx, context, scopeId, request.command.roleId, request.command.operation);
	}
	let path: string[];
	if (request.command.operation !== "revoke")
		path =
			request.kind === "binding" ? request.command.terms.targetPath : request.command.targetPath;
	else if (request.kind === "binding") {
		const prior = await readAccessRoleBindingSnapshot(tx, {
			targetScopeId: scopeId,
			bindingId: request.command.bindingId,
			revision: request.command.expectedVersion,
		});
		if (!prior) throw new AccessRecordUnavailable();
		path = prior.terms.targetPath;
	} else {
		const [prior] = await tx
			.select()
			.from(accessAssignmentCeiling)
			.where(
				and(
					eq(accessAssignmentCeiling.id, request.command.ceilingId),
					eq(accessAssignmentCeiling.scopeId, scopeId),
				),
			);
		if (!prior) throw new AccessRecordUnavailable();
		path = prior.targetPath;
	}
	return assignmentAuthority(
		tx,
		context,
		scopeId,
		request.kind === "binding" ? "access.role-binding.manage" : "access.assignment-ceiling.manage",
		path,
		true,
		request.kind === "binding" ? { excludeBindingId: request.command.bindingId } : {},
	);
}
async function normalize(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scopeId: string,
	proposal: z.infer<typeof AssignmentProposalSchema>,
): Promise<Request> {
	const now = (await assignmentClock(tx)).getTime();
	const resolveScope = (scope: string) => selectors.resolve(scope, context.credentialProof(), now);
	const recipient = async (
		value:
			| z.infer<typeof AssignmentRecipientSchema>
			| { kind: "scope-members"; scope: string; subjectKind: "principal" | "entity" },
	) => {
		if (value.kind === "subject")
			return {
				kind: "subject" as const,
				subjectId: assignmentRecipients.resolve(
					value.recipient,
					assignmentRecipientContext(context, scopeId),
					now,
				),
			};
		return value.kind === "group"
			? { kind: "group" as const, scopeId: resolveScope(value.scope), groupId: value.groupId }
			: value.kind === "all-members"
				? { kind: "all-members" as const, scopeId: resolveScope(value.scope) }
				: {
						kind: "scope-members" as const,
						scopeId: resolveScope(value.scope),
						subjectKind: value.subjectKind,
					};
	};
	if (proposal.kind === "role") {
		const actor = await roleAuthority(tx, context, scopeId, proposal.roleId, proposal.operation);
		const { kind, ...command } = proposal;
		return requestSchema.parse({
			kind,
			command: {
				...command,
				scopeId,
				operatorAuthUserId: actor.principalId,
				authoritySubjectId: actor.subjectId,
			},
		});
	}
	let prior: Snapshot | null = null;
	if (proposal.kind === "binding" && proposal.operation !== "create") {
		prior = await readAccessRoleBindingSnapshot(tx, {
			targetScopeId: scopeId,
			bindingId: proposal.bindingId,
			revision: "current",
		});
		if (!prior) throw new AccessRecordUnavailable();
	}
	const selectedPath =
		proposal.operation === "revoke"
			? (prior?.terms.targetPath ??
				(
					await tx
						.select()
						.from(accessAssignmentCeiling)
						.where(
							and(
								eq(
									accessAssignmentCeiling.id,
									proposal.kind === "ceiling"
										? proposal.ceilingId
										: "00000000-0000-0000-0000-000000000000",
								),
								eq(accessAssignmentCeiling.scopeId, scopeId),
							),
						)
				)[0]?.targetPath)
			: proposal.kind === "binding"
				? proposal.terms.targetPath
				: proposal.targetPath;
	if (!selectedPath) throw new AccessRecordUnavailable();
	const actor = await assignmentAuthority(
		tx,
		context,
		scopeId,
		proposal.kind === "binding" ? "access.role-binding.manage" : "access.assignment-ceiling.manage",
		selectedPath,
		true,
		proposal.kind === "binding" ? { excludeBindingId: proposal.bindingId } : {},
	);
	const audit = { operatorAuthUserId: actor.principalId, authoritySubjectId: actor.subjectId };
	if (proposal.kind === "ceiling") {
		if (proposal.operation === "revoke")
			return {
				kind: "ceiling",
				roleScopeId: null,
				definitionRevision: null,
				command: {
					scopeId,
					...audit,
					operation: "revoke",
					ceilingId: proposal.ceilingId,
					operationId: proposal.operationId,
					expectedVersion: proposal.expectedVersion,
				},
			};
		const { kind, role, recipient: target, ...fields } = proposal;
		return ceilingRequest.parse({
			kind,
			roleScopeId: resolveScope(role.scope),
			definitionRevision: role.definitionRevision,
			command: {
				...fields,
				...audit,
				scopeId,
				roleId: role.roleId,
				recipient: await recipient(target),
				permissions: [...snapshotAccessPermissionCeiling(fields.permissions)],
				validFrom: new Date(fields.validFrom),
				validUntil: fields.validUntil ? new Date(fields.validUntil) : null,
				grantNotAfter: fields.grantNotAfter ? new Date(fields.grantNotAfter) : null,
			},
		});
	}
	const roleScopeId =
		proposal.operation === "create"
			? resolveScope(proposal.role.scope)
			: (await tx.select().from(accessRole).where(eq(accessRole.id, prior!.roleId)))[0]?.scopeId;
	if (!roleScopeId) throw new AccessRecordUnavailable();
	if (proposal.operation === "revoke")
		return {
			kind: "binding",
			roleScopeId,
			definitionRevision: null,
			command: {
				...audit,
				targetScopeId: scopeId,
				bindingId: proposal.bindingId,
				operationId: proposal.operationId,
				expectedVersion: proposal.expectedVersion,
				operation: "revoke",
			},
		};
	const target =
		proposal.operation === "create" ? await recipient(proposal.recipient) : prior!.recipient;
	if (target.kind === "scope-members") throw new AccessDenied();
	let dependency = null;
	if (proposal.terms.recipientEligibility) {
		if (target.kind !== "subject") throw new AccessDenied();
		const selected = proposal.terms.recipientEligibility,
			memberScope = resolveScope(selected.scope);
		await tx.execute(
			sql`select public.lock_access_membership_key(${memberScope}::uuid,${target.subjectId}::uuid,false)`,
		);
		const [member] = await tx
			.select()
			.from(accessMembership)
			.where(
				and(
					eq(accessMembership.scopeId, memberScope),
					eq(accessMembership.subjectId, target.subjectId),
				),
			)
			.for("share");
		if (!member || member.activeGeneration !== selected.generation) throw new AccessChanged();
		dependency = {
			membershipId: member.id,
			generation: selected.generation,
			selection: selected.selection,
		};
	}
	const terms = {
		...proposal.terms,
		permissionPolicy:
			proposal.terms.permissionPolicy.mode === "frozen-ceiling"
				? {
						mode: "frozen-ceiling",
						permissions: [
							...snapshotAccessPermissionCeiling(proposal.terms.permissionPolicy.permissions),
						],
					}
				: proposal.terms.permissionPolicy,
		recipientEligibility: dependency,
		validFrom: new Date(proposal.terms.validFrom),
		validUntil: proposal.terms.validUntil ? new Date(proposal.terms.validUntil) : null,
	};
	const base = {
		...audit,
		targetScopeId: scopeId,
		bindingId: proposal.bindingId,
		operationId: proposal.operationId,
		expectedVersion: proposal.expectedVersion,
		terms,
	};
	return bindingRequest.parse({
		kind: "binding",
		roleScopeId,
		definitionRevision:
			proposal.operation === "create"
				? proposal.role.definitionRevision
				: proposal.definitionRevision,
		command:
			proposal.operation === "create"
				? { ...base, operation: "create", roleId: proposal.role.roleId, recipient: target }
				: { ...base, operation: "amend" },
	});
}

async function readCeiling(tx: DatabaseTransaction, scopeId: string, ceilingId: string) {
	const [head] = await tx
		.select()
		.from(accessAssignmentCeiling)
		.where(
			and(eq(accessAssignmentCeiling.id, ceilingId), eq(accessAssignmentCeiling.scopeId, scopeId)),
		)
		.for("share");
	if (!head) throw new AccessRecordUnavailable();
	if (!head.sealed || head.state === "draft") throw new AccessUnavailable();
	const rows = await tx
		.select()
		.from(accessAssignmentCeilingPermission)
		.where(eq(accessAssignmentCeilingPermission.ceilingId, head.id))
		.orderBy(accessAssignmentCeilingPermission.family, accessAssignmentCeilingPermission.permission)
		.limit(AccessPermissionValues.length + 1);
	return {
		head: { ...head, state: head.state },
		permissions: decodeAccessPermissionSnapshot(rows, head.permissionCount, head.permissionDigest),
	};
}
function ceilingRecipient(row: typeof accessAssignmentCeiling.$inferSelect) {
	if (row.recipientKind === "subject" && row.recipientSubjectId)
		return { kind: "subject" as const, subjectId: row.recipientSubjectId };
	if (row.recipientKind === "group" && row.recipientGroupId && row.recipientScopeId)
		return { kind: "group" as const, groupId: row.recipientGroupId, scopeId: row.recipientScopeId };
	if (row.recipientKind === "all-members" && row.recipientScopeId)
		return { kind: "all-members" as const, scopeId: row.recipientScopeId };
	if (row.recipientKind === "scope-members" && row.recipientScopeId && row.memberSubjectKind)
		return {
			kind: "scope-members" as const,
			scopeId: row.recipientScopeId,
			subjectKind: row.memberSubjectKind,
		};
	throw new AccessUnavailable();
}
type Recipient =
	| Snapshot["recipient"]
	| { kind: "scope-members"; scopeId: string; subjectKind: "principal" | "entity" };

/** Index ranges are bounded before any join, eligibility test or deduplication. */
async function recipientSubjects(
	tx: DatabaseTransaction,
	recipient: Recipient,
	facts: unknown[],
	budget: { candidates: number; groups: number },
) {
	if (recipient.kind === "subject") return [recipient.subjectId];
	const [tree] = await tx
		.select()
		.from(accessGroupTree)
		.where(eq(accessGroupTree.scopeId, recipient.scopeId))
		.for("share");
	if (!tree) throw new AccessUnavailable();
	retainFacts(facts, { tree });
	// The shared negative tree witness serializes all enrollment writers, including
	// a previously absent subject. Group-only reads also retain subtree candidates.
	await tx
		.insert(accessImpactFence)
		.values({ kind: "tree", key: recipient.scopeId })
		.onConflictDoNothing();
	const [witness] = await tx
		.select()
		.from(accessImpactFence)
		.where(and(eq(accessImpactFence.kind, "tree"), eq(accessImpactFence.key, recipient.scopeId)))
		.for("share");
	if (!witness) throw new AccessUnavailable();
	retainFacts(facts, { witness });
	let members: (typeof accessMembership.$inferSelect)[];
	if (recipient.kind === "group") {
		const groupIds: string[] = [],
			pending = [recipient.groupId];
		while (pending.length) {
			const groupId = pending.shift()!;
			if (groupIds.includes(groupId) || groupIds.length >= 4096) throw new AccessUnavailable();
			const [group] = await tx
				.select()
				.from(accessGroup)
				.where(and(eq(accessGroup.id, groupId), eq(accessGroup.scopeId, recipient.scopeId)))
				.for("share");
			if (!group) throw new AccessUnavailable();
			if (group.state !== "active") {
				if (groupId === recipient.groupId) return [];
				continue;
			}
			if (++budget.groups > 4096) throw new AccessUnavailable();
			groupIds.push(groupId);
			retainFacts(facts, { group });
			const children = await tx
				.select()
				.from(accessGroup)
				.where(
					and(
						eq(accessGroup.scopeId, recipient.scopeId),
						eq(accessGroup.parentId, groupId),
						eq(accessGroup.state, "active"),
					),
				)
				.orderBy(accessGroup.id)
				.limit(4097 - budget.groups);
			if (children.length + budget.groups > 4096) throw new AccessUnavailable();
			budget.groups += children.length;
			retainFacts(facts, { children });
			pending.push(
				...children.filter((child) => child.state === "active").map((child) => child.id),
			);
		}
		const selections: (typeof accessGroupMembership.$inferSelect)[] = [];
		for (const groupId of groupIds.sort()) {
			const rows = await tx
				.select()
				.from(accessGroupMembership)
				.where(
					and(eq(accessGroupMembership.groupId, groupId), eq(accessGroupMembership.selected, true)),
				)
				.orderBy(accessGroupMembership.membershipId, accessGroupMembership.generation)
				.limit(257 - budget.candidates);
			budget.candidates += rows.length;
			if (budget.candidates > 256) throw new AccessUnavailable();
			selections.push(...rows);
			retainFacts(facts, { selections: rows });
		}
		const keys = [...new Set(selections.map((row) => row.membershipId))].sort();
		members = keys.length
			? await tx
					.select()
					.from(accessMembership)
					.where(inArray(accessMembership.id, keys))
					.orderBy(accessMembership.id)
					.for("share")
			: [];
		if (members.length !== keys.length) throw new AccessUnavailable();
		members = members.filter((member) =>
			selections.some(
				(selected) =>
					selected.membershipId === member.id && selected.generation === member.activeGeneration,
			),
		);
	} else {
		members = await tx
			.select()
			.from(accessMembership)
			.where(
				and(
					eq(accessMembership.scopeId, recipient.scopeId),
					sql`${accessMembership.activeGeneration} is not null`,
				),
			)
			.orderBy(accessMembership.subjectId)
			.limit(257 - budget.candidates)
			.for("share");
		budget.candidates += members.length;
		if (budget.candidates > 256) throw new AccessUnavailable();
	}
	retainFacts(facts, { members });
	const subjects: string[] = [];
	for (const member of members) {
		if (member.scopeId !== recipient.scopeId) throw new AccessUnavailable();
		const set = await readAccessMemberSetRecipients(tx, {
			subjectId: member.subjectId,
			scopeIds: [recipient.scopeId],
		});
		retainFacts(facts, { memberSet: set });
		const matches = set.recipients.some(
			(value) =>
				value.scopeId === recipient.scopeId &&
				(recipient.kind !== "group" ||
					(value.kind === "group" && value.groupId === recipient.groupId)),
		);
		if (!matches) continue;
		if (recipient.kind === "scope-members") {
			const [subject] = (
				await tx.execute<{ kind: string }>(
					sql`select case when auth_user_id is not null then 'principal' else 'entity' end as kind from public.access_subject where id=${member.subjectId}::uuid`,
				)
			).rows;
			if (subject?.kind !== recipient.subjectKind) continue;
		}
		subjects.push(member.subjectId);
	}
	return [...new Set(subjects)].sort();
}

async function capture(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scopeId: string,
	request: Request,
) {
	const facts: unknown[] = [],
		effects: GroupImpactEffect[] = [],
		authorities: Authority[] = [],
		retained: SQL<boolean | null>[] = [];
	const roots = new Set([scopeId]),
		roleIds = new Set<string>();
	let bindingHeads: (typeof accessRoleBinding.$inferSelect)[] = [];
	if (request.kind === "role") {
		roleIds.add(request.command.roleId);
		const discover = () =>
			tx
				.select()
				.from(accessRoleBinding)
				.where(eq(accessRoleBinding.roleId, request.command.roleId))
				.orderBy(accessRoleBinding.targetScopeId, accessRoleBinding.id)
				.limit(257);
		bindingHeads = await discover();
		if (bindingHeads.length > 256) throw new AccessUnavailable();
		for (const head of bindingHeads) roots.add(head.targetScopeId);
	} else if (request.kind === "binding") {
		const [head] = await tx
			.select()
			.from(accessRoleBinding)
			.where(
				and(
					eq(accessRoleBinding.id, request.command.bindingId),
					eq(accessRoleBinding.targetScopeId, scopeId),
				),
			);
		if (head) {
			bindingHeads.push(head);
			roleIds.add(head.roleId);
		} else if (request.command.operation === "create") roleIds.add(request.command.roleId);
		roots.add(request.roleScopeId);
	} else if (request.command.operation === "create") {
		roots.add(request.roleScopeId!);
		roleIds.add(request.command.roleId);
	}
	if (roots.size > 64) throw new AccessUnavailable();
	const fences = await tx
		.select()
		.from(accessRoleBindingScope)
		.where(inArray(accessRoleBindingScope.scopeId, [...roots]))
		.orderBy(accessRoleBindingScope.scopeId)
		.for("update");
	if (fences.length !== roots.size) throw new AccessUnavailable();
	retainFacts(facts, { fences });
	// Promote every touched role before snapshot readers acquire shared head locks.
	for (const roleId of [...roleIds].sort())
		await tx
			.select()
			.from(accessRole)
			.where(eq(accessRole.id, roleId))
			.for(request.kind === "role" ? "update" : "share");
	if (request.kind === "role") {
		const current = await tx
			.select()
			.from(accessRoleBinding)
			.where(eq(accessRoleBinding.roleId, request.command.roleId))
			.orderBy(accessRoleBinding.targetScopeId, accessRoleBinding.id)
			.limit(257);
		if (hash(current) !== hash(bindingHeads)) throw new AccessRoleBindingDiscoveryChanged();
	}
	const actor = await mainAuthority(tx, context, scopeId, request);
	authorities.push(actor);
	const now = await assignmentClock(tx);
	let validUntil = Math.min(now.getTime() + 300000, actor.validUntil ?? Infinity);
	const observeTime = (date: Date | null) => {
		if (date && date > now) validUntil = Math.min(validUntil, date.getTime());
	};
	const budget = { candidates: 0, groups: 0 };
	const assignments: {
		snapshot: Snapshot;
		before: AccessPermission[];
		after: AccessPermission[];
		strict: boolean;
	}[] = [];
	if (request.kind === "role") {
		const [head] = await tx
			.select()
			.from(accessRole)
			.where(and(eq(accessRole.id, request.command.roleId), eq(accessRole.scopeId, scopeId)));
		if (!head || head.state === "retired" || head.version !== request.command.expectedVersion)
			throw new AccessChanged();
		retainFacts(facts, { role: head });
		const before =
			head.activeRevision === null
				? []
				: (
						await readAccessRoleSnapshot(tx, {
							scopeId,
							roleId: head.id,
							revision: head.activeRevision,
						})
					)?.permissions;
		if (!before) throw new AccessUnavailable();
		const definition =
			request.command.operation === "activate"
				? await readAccessRoleSnapshot(tx, {
						scopeId,
						roleId: head.id,
						revision: request.command.definitionRevision,
					})
				: null;
		if (request.command.operation === "activate" && !definition) throw new AccessChanged();
		retainFacts(facts, { definition });
		for (const binding of bindingHeads) {
			const snapshot = await readAccessRoleBindingSnapshot(tx, {
				targetScopeId: binding.targetScopeId,
				bindingId: binding.id,
				revision: "current",
			});
			if (!snapshot) throw new AccessUnavailable();
			retainFacts(facts, { snapshot });
			if (
				snapshot.state !== "active" ||
				(snapshot.terms.validUntil !== null && snapshot.terms.validUntil <= now)
			)
				continue;
			const permissions = (values: AccessPermission[]) =>
				snapshot.terms.permissionPolicy.mode === "local-role"
					? snapshotAccessPermissionCeiling(values)
					: constrainAccessPermissions(values, snapshot.terms.permissionPolicy.permissions);
			assignments.push({
				snapshot,
				before: head.state === "active" ? [...permissions(before)] : [],
				after: [...permissions(definition?.permissions ?? [])],
				strict: false,
			});
		}
	} else if (request.kind === "binding") {
		const command = request.command;
		const prior = bindingHeads[0]
			? await readAccessRoleBindingSnapshot(tx, {
					targetScopeId: scopeId,
					bindingId: command.bindingId,
					revision: "current",
				})
			: null;
		if (
			command.operation === "create"
				? prior !== null || command.expectedVersion !== 0
				: !prior || prior.version !== command.expectedVersion || prior.state !== "active"
		)
			throw new AccessChanged();
		const roleId = prior?.roleId ?? (command.operation === "create" ? command.roleId : null);
		if (!roleId) throw new AccessChanged();
		const [role] = await tx
			.select()
			.from(accessRole)
			.where(and(eq(accessRole.id, roleId), eq(accessRole.scopeId, request.roleScopeId)))
			.for("share");
		if (!role) throw new AccessChanged();
		retainFacts(facts, { role, prior });
		const definition =
			role.activeRevision === null
				? null
				: await readAccessRoleSnapshot(tx, {
						scopeId: role.scopeId,
						roleId,
						revision: role.activeRevision,
					});
		const before =
			prior?.roleState === "active" && definition
				? prior.terms.permissionPolicy.mode === "local-role"
					? snapshotAccessPermissionCeiling(definition.permissions)
					: constrainAccessPermissions(
							definition.permissions,
							prior.terms.permissionPolicy.permissions,
						)
				: [];
		if (
			command.operation !== "revoke" &&
			(!definition || role.state !== "active" || role.activeRevision !== request.definitionRevision)
		)
			throw new AccessChanged();
		const after =
			command.operation === "revoke"
				? []
				: snapshotAccessPermissionCeiling(definition!.permissions);
		if (
			command.operation !== "revoke" &&
			command.terms.permissionPolicy.mode === "frozen-ceiling"
		) {
			// Reject excess as a whole assignment. Runtime clipping applies only to later
			// changes in an already-approved dynamic role, never to this requested grant.
			if (!accessPermissionCeilingCovers(after, command.terms.permissionPolicy.permissions))
				throw new AccessDenied();
		}
		if (prior)
			authorities.push(
				await assignmentAuthority(
					tx,
					context,
					scopeId,
					"access.role-binding.manage",
					prior.terms.targetPath,
					true,
					{ excludeBindingId: command.bindingId },
				),
			);
		const snapshot: Snapshot =
			command.operation === "revoke"
				? prior!
				: {
						bindingId: command.bindingId,
						targetScopeId: scopeId,
						roleId,
						roleState: role.state,
						recipient: command.operation === "create" ? command.recipient : prior!.recipient,
						version: command.expectedVersion,
						state: "active",
						termsRevision: command.expectedVersion + 1,
						terms: command.terms,
					};
		if (command.operation === "amend" && prior) {
			assignments.push({ snapshot: prior, before: [...before], after: [], strict: false });
			assignments.push({ snapshot, before: [], after: [...after], strict: true });
		} else
			assignments.push({
				snapshot,
				before: [...before],
				after: [...after],
				strict: command.operation !== "revoke",
			});
	}
	for (const assignment of assignments) {
		const { snapshot, before, after, strict } = assignment,
			terms = snapshot.terms;
		const granting =
			strict || (request.kind === "role" && request.command.operation === "activate");
		observeTime(terms.validFrom);
		observeTime(terms.validUntil);
		const grantPermissions =
			strict && terms.permissionPolicy.mode === "frozen-ceiling"
				? terms.permissionPolicy.permissions
				: after;
		// The entire persisted approval is confer intent, including permissions that
		// only a later role head could exercise. Today's effective set cannot approve it.
		if (granting)
			await requireAssignmentApplicability(tx, snapshot.targetScopeId, grantPermissions);
		const recipientScope =
			snapshot.recipient.kind === "subject" ? null : snapshot.recipient.scopeId;
		if (
			terms.permissionPolicy.mode === "local-role" &&
			((request.kind !== "role" && request.roleScopeId !== snapshot.targetScopeId) ||
				(recipientScope !== null && recipientScope !== snapshot.targetScopeId))
		)
			throw new AccessDenied();
		if (terms.recipientEligibility) {
			const dependency = terms.recipientEligibility;
			await tx.execute(
				sql`select public.lock_access_role_binding_eligibility(${dependency.membershipId}::uuid,${dependency.generation}::bigint,${dependency.selection?.groupId ?? null}::uuid)`,
			);
			const [member] = await tx
				.select()
				.from(accessMembership)
				.where(eq(accessMembership.id, dependency.membershipId))
				.for("share");
			retainFacts(facts, { dependency, member });
			if (
				!member ||
				snapshot.recipient.kind !== "subject" ||
				member.subjectId !== snapshot.recipient.subjectId
			)
				throw new AccessDenied();
			const selection = dependency.selection
				? (
						await tx
							.select()
							.from(accessGroupMembership)
							.where(
								and(
									eq(accessGroupMembership.membershipId, member.id),
									eq(accessGroupMembership.generation, dependency.generation),
									eq(accessGroupMembership.groupId, dependency.selection.groupId),
								),
							)
					)[0]
				: null;
			retainFacts(facts, { selection });
			const current = sql<boolean>`public.access_membership_is_eligible(${member.id}::uuid) is true
    and exists(select 1 from public.access_membership where id=${member.id}::uuid and active_generation=${dependency.generation})
    ${
			dependency.selection
				? sql`and exists(select 1 from public.access_group_membership m join public.access_group g on g.id=m.group_id where m.membership_id=${member.id}::uuid
     and m.generation=${dependency.generation} and m.group_id=${dependency.selection.groupId}::uuid and m.version=${dependency.selection.version} and m.selected and g.state='active')`
				: sql``
		}`;
			const eligible = (await tx.execute<{ current: boolean }>(sql`select (${current}) as current`))
				.rows[0]?.current;
			if (!eligible) {
				if (strict) throw new AccessChanged();
				continue;
			}
			retained.push(current);
		}
		if (strict && snapshot.recipient.kind !== "subject") {
			const recipientScopeAdmission = await scopeLifecycleAdmission(
				tx,
				snapshot.recipient.scopeId,
				true,
			);
			const eligibility = sql<boolean>`(${recipientScopeAdmission}) and public.access_membership_scope_is_eligible(${snapshot.recipient.scopeId}::uuid) is true`;
			await requireAccessAdmission(tx, eligibility);
			retained.push(eligibility);
			if (snapshot.recipient.kind === "group") {
				const [group] = await tx
					.select()
					.from(accessGroup)
					.where(
						and(
							eq(accessGroup.id, snapshot.recipient.groupId),
							eq(accessGroup.scopeId, snapshot.recipient.scopeId),
						),
					)
					.for("share");
				if (!group || group.state !== "active") throw new AccessChanged();
			}
		}
		const subjects = await recipientSubjects(tx, snapshot.recipient, facts, budget);
		if (subjects.length > 256 || effects.length + subjects.length > 4096)
			throw new AccessUnavailable();
		if (granting) {
			const source =
				request.kind === "role" && snapshot.targetScopeId === scopeId
					? actor
					: await assignmentAuthority(
							tx,
							context,
							snapshot.targetScopeId,
							"access.role-binding.manage",
							terms.targetPath,
							true,
							request.kind === "binding"
								? { excludeBindingId: request.command.bindingId }
								: request.kind === "role"
									? { excludeRoleId: request.command.roleId }
									: {},
						);
			authorities.push(source);
			if (!source.owner) {
				let conferEvidence:
					| Parameters<NonNullable<Parameters<typeof findRoleAssignmentCeiling>[2]>>[0]
					| null = null;
				const ceiling = await findRoleAssignmentCeiling(
					tx,
					{
						scopeId: snapshot.targetScopeId,
						roleId: snapshot.roleId,
						targetPath: terms.targetPath,
						operation:
							request.kind === "role" && snapshot.targetScopeId === scopeId ? "activate" : "bind",
						permissions: grantPermissions,
						validFrom: terms.validFrom,
						validUntil: terms.validUntil,
						recipient: snapshot.recipient,
						recipientEligibility: terms.recipientEligibility,
						managerSubjectId: source.subjectId,
						...(request.kind === "role"
							? { excludeRoleId: request.command.roleId }
							: request.kind === "binding"
								? { excludeBindingId: request.command.bindingId }
								: {}),
					},
					async (evidence) => {
						conferEvidence = evidence;
						retainFacts(facts, { confer: evidence });
					},
				);
				if (!ceiling || !conferEvidence) throw new AccessDenied();
				retained.push(
					await retainedCeilingAdmission(
						tx,
						ceiling,
						source.subjectId,
						conferEvidence,
						observeTime,
					),
				);
				retained.push(sql`exists(select 1 from public.access_assignment_ceiling where id=${ceiling}::uuid and state='active' and sealed
     and valid_from<=clock_timestamp() and (valid_until is null or valid_until>clock_timestamp()))`);
			}
		}
		for (const subjectId of subjects) {
			if (snapshot.recipient.kind !== "subject")
				retained.push(
					sql`public.access_subject_matches_recipient(${subjectId}::uuid,${snapshot.recipient.kind},null::uuid,${snapshot.recipient.scopeId}::uuid,${snapshot.recipient.kind === "group" ? snapshot.recipient.groupId : null}::uuid) is true`,
				);
			const dependency = terms.recipientEligibility;
			const path = {
				membershipId: dependency?.membershipId ?? null,
				generation: dependency?.generation ?? null,
				selectionGroupId: dependency?.selection?.groupId ?? null,
				selectionVersion: dependency?.selection?.version ?? null,
				selectionSetVersion: null,
				groups: [],
			};
			effects.push(
				GroupImpactEffectSchema.parse({
					kind: "binding",
					sourceId: snapshot.bindingId,
					sourceVersion: snapshot.version,
					termsRevision: snapshot.termsRevision,
					roleId: snapshot.roleId,
					roleRevision:
						request.kind === "role" && request.command.operation === "activate"
							? request.command.definitionRevision
							: null,
					entityId: null,
					dependencySubjectIds: [],
					conditions: null,
					scopeId: snapshot.targetScopeId,
					targetPath: terms.targetPath,
					subjectId,
					recipientGroup:
						snapshot.recipient.kind === "group"
							? { scopeId: snapshot.recipient.scopeId, groupId: snapshot.recipient.groupId }
							: null,
					before,
					after,
					beforePaths: before.length ? [path] : [],
					afterPaths: after.length ? [path] : [],
					lineage: [],
					lineageBases: [],
					validFrom: terms.validFrom.toISOString(),
					validUntil: terms.validUntil?.toISOString() ?? null,
					confer: granting,
				}),
			);
		}
	}
	// Existing institutional ceilings follow their exact manager terms, not a
	// replacement revision. Discover attached physical rows before state filtering.
	let attachedCandidates = 0;
	for (const binding of bindingHeads) {
		const rows = await tx
			.select()
			.from(accessAssignmentCeiling)
			.where(eq(accessAssignmentCeiling.managerBindingId, binding.id))
			.orderBy(accessAssignmentCeiling.id)
			.limit(257 - attachedCandidates);
		attachedCandidates += rows.length;
		if (attachedCandidates > 256) throw new AccessUnavailable();
		retainFacts(facts, { attachedCeilings: rows });
		for (const head of rows) {
			if (head.scopeId !== binding.targetScopeId) throw new AccessUnavailable();
			if (
				head.state !== "active" ||
				head.managerTermsRevision !== binding.termsRevision ||
				(head.validUntil !== null && head.validUntil <= now)
			)
				continue;
			observeTime(head.validFrom);
			observeTime(head.validUntil);
			const { permissions } = await readCeiling(tx, head.scopeId, head.id);
			retainFacts(facts, { attachedPermissions: permissions });
			const contributions = effects.filter(
				(effect) => effect.kind === "binding" && effect.sourceId === binding.id,
			);
			const subjectIds = [...new Set(contributions.map((effect) => effect.subjectId))].sort();
			for (const subjectId of subjectIds) {
				const paths = contributions.filter((effect) => effect.subjectId === subjectId);
				const canConfer = (effect: GroupImpactEffect, before: boolean) =>
					(before ? effect.before : effect.after).some(
						(permission) =>
							permission.family === "management" &&
							(permission.key === "access.role.activate"
								? scopeCovers(effect.targetPath, ["roles", head.roleId])
								: ["access.role-binding.manage", "access.assignment-ceiling.manage"].includes(
										permission.key,
									) && scopeCovers(effect.targetPath, head.targetPath)),
					);
				const before = paths.some((effect) => canConfer(effect, true)) ? permissions : [];
				const after =
					request.kind === "role" &&
					request.command.operation === "activate" &&
					paths.some((effect) => canConfer(effect, false))
						? permissions
						: [];
				const confer = after.length > 0 && before.length === 0;
				if (!before.length && !after.length) continue;
				if (confer) {
					await requireAssignmentApplicability(tx, head.scopeId, permissions);
					authorities.push(
						await assignmentAuthority(
							tx,
							context,
							head.scopeId,
							"access.assignment-ceiling.manage",
							head.targetPath,
							true,
							request.kind === "role"
								? { excludeRoleId: request.command.roleId }
								: request.kind === "binding"
									? { excludeBindingId: request.command.bindingId }
									: {},
						),
					);
				}
				effects.push(
					GroupImpactEffectSchema.parse({
						kind: "ceiling",
						sourceId: head.id,
						sourceVersion: head.version,
						termsRevision: head.managerTermsRevision,
						roleId: head.roleId,
						roleRevision: null,
						entityId: null,
						dependencySubjectIds: [],
						conditions: null,
						scopeId: head.scopeId,
						targetPath: head.targetPath,
						subjectId,
						recipientGroup: null,
						before,
						after,
						beforePaths: paths.flatMap((effect) => effect.beforePaths),
						afterPaths: request.kind === "role" ? paths.flatMap((effect) => effect.afterPaths) : [],
						lineage: [],
						lineageBases: [],
						validFrom: head.validFrom.toISOString(),
						validUntil: head.validUntil?.toISOString() ?? null,
						confer,
						ceilingRecipient: {
							kind: head.recipientKind,
							subjectId: head.recipientSubjectId,
							groupId: head.recipientGroupId,
							scopeId: head.recipientScopeId,
							memberSubjectKind: head.memberSubjectKind,
							maximumGrantDurationSeconds: head.maximumGrantDurationSeconds,
							grantNotAfter: head.grantNotAfter?.toISOString() ?? null,
						},
					}),
				);
				if (effects.length > 4096) throw new AccessUnavailable();
			}
		}
	}
	if (request.kind === "ceiling") {
		const command = request.command;
		const [existing] = await tx
			.select()
			.from(accessAssignmentCeiling)
			.where(
				and(
					eq(accessAssignmentCeiling.id, command.ceilingId),
					eq(accessAssignmentCeiling.scopeId, scopeId),
				),
			)
			.for("update");
		if (
			command.operation === "create"
				? !!existing
				: !existing || existing.version !== command.expectedVersion || existing.state !== "active"
		)
			throw new AccessChanged();
		const previous = existing ? await readCeiling(tx, scopeId, existing.id) : null;
		retainFacts(facts, { ceiling: previous });
		const recipient =
			command.operation === "create" ? command.recipient : ceilingRecipient(existing!);
		if (command.operation === "create" && recipient.kind !== "subject") {
			const recipientScopeAdmission = await scopeLifecycleAdmission(tx, recipient.scopeId, true);
			const eligibility = sql<boolean>`(${recipientScopeAdmission}) and public.access_membership_scope_is_eligible(${recipient.scopeId}::uuid) is true`;
			await requireAccessAdmission(tx, eligibility);
			retained.push(eligibility);
			if (recipient.kind === "group") {
				const [group] = await tx
					.select()
					.from(accessGroup)
					.where(
						and(eq(accessGroup.id, recipient.groupId), eq(accessGroup.scopeId, recipient.scopeId)),
					)
					.for("share");
				if (!group || group.state !== "active") throw new AccessChanged();
			}
		}
		const subjects = await recipientSubjects(tx, recipient, facts, budget);
		if (command.operation === "create") {
			await requireAssignmentApplicability(tx, scopeId, command.permissions);
			const definition = await readAccessRoleSnapshot(tx, {
				scopeId: request.roleScopeId!,
				roleId: command.roleId,
				revision: request.definitionRevision!,
			});
			if (!definition) throw new AccessChanged();
			retainFacts(facts, { definition });
			const manager = await readAccessRoleBindingSnapshot(tx, {
				targetScopeId: scopeId,
				bindingId: command.managerBindingId,
				revision: "current",
			});
			if (
				!manager ||
				manager.state !== "active" ||
				manager.roleState !== "active" ||
				manager.termsRevision !== command.managerTermsRevision ||
				manager.terms.validFrom > now ||
				(manager.terms.validUntil !== null && manager.terms.validUntil <= now)
			)
				throw new AccessChanged();
			const [managerRole] = await tx
				.select()
				.from(accessRole)
				.where(eq(accessRole.id, manager.roleId));
			if (!managerRole) throw new AccessUnavailable();
			const managerDefinition = await readAccessRoleSnapshot(tx, {
				scopeId: managerRole.scopeId,
				roleId: manager.roleId,
				revision: "active",
			});
			if (!managerDefinition) throw new AccessChanged();
			const permissions =
				manager.terms.permissionPolicy.mode === "local-role"
					? snapshotAccessPermissionCeiling(managerDefinition.permissions)
					: constrainAccessPermissions(
							managerDefinition.permissions,
							manager.terms.permissionPolicy.permissions,
						);
			if (
				!permissions.some(
					(permission) =>
						permission.family === "management" &&
						[
							"access.role-binding.manage",
							"access.role.activate",
							"access.assignment-ceiling.manage",
						].includes(permission.key),
				)
			)
				throw new AccessDenied();
			retainFacts(facts, { manager, managerRole, managerDefinition });
			retained.push(sql`public.access_role_binding_recipient_is_current(${manager.bindingId}::uuid,${manager.termsRevision}) is true
    and exists(select 1 from public.access_role_binding where id=${manager.bindingId}::uuid and state='active' and version=${manager.version} and terms_revision=${manager.termsRevision})`);
			observeTime(manager.terms.validUntil);
			observeTime(command.validFrom);
			observeTime(command.validUntil);
			if (!actor.owner) {
				let conferEvidence:
					| Parameters<NonNullable<Parameters<typeof findRoleAssignmentCeiling>[2]>>[0]
					| null = null;
				const ceiling = await findRoleAssignmentCeiling(
					tx,
					{
						scopeId,
						roleId: command.roleId,
						targetPath: command.targetPath,
						operation: "ceiling",
						permissions: command.permissions,
						validFrom: command.validFrom,
						validUntil: command.validUntil,
						recipient: command.recipient,
						recipientEligibility: null,
						managerSubjectId: actor.subjectId,
						ceilingConstraints: {
							maximumGrantDurationSeconds: command.maximumGrantDurationSeconds,
							grantNotAfter: command.grantNotAfter,
						},
					},
					async (evidence) => {
						conferEvidence = evidence;
						retainFacts(facts, { confer: evidence });
					},
				);
				if (!ceiling || !conferEvidence) throw new AccessDenied();
				retained.push(
					await retainedCeilingAdmission(tx, ceiling, actor.subjectId, conferEvidence, observeTime),
				);
				retained.push(
					sql`exists(select 1 from public.access_assignment_ceiling where id=${ceiling}::uuid and state='active' and sealed and valid_from<=clock_timestamp() and (valid_until is null or valid_until>clock_timestamp()))`,
				);
			}
		}
		for (const subjectId of subjects) {
			const after =
				command.operation === "create"
					? [...snapshotAccessPermissionCeiling(command.permissions)]
					: [];
			const before = previous?.permissions ?? [];
			effects.push(
				GroupImpactEffectSchema.parse({
					kind: "ceiling",
					sourceId: command.ceilingId,
					sourceVersion: command.expectedVersion,
					termsRevision: null,
					roleId: command.operation === "create" ? command.roleId : existing!.roleId,
					roleRevision: request.definitionRevision,
					entityId: null,
					dependencySubjectIds: [],
					conditions: null,
					scopeId,
					targetPath: command.operation === "create" ? command.targetPath : existing!.targetPath,
					subjectId,
					recipientGroup:
						recipient.kind === "group"
							? { scopeId: recipient.scopeId, groupId: recipient.groupId }
							: null,
					before,
					after,
					beforePaths: [],
					afterPaths: [],
					lineage: [],
					lineageBases: [],
					validFrom: (command.operation === "create"
						? command.validFrom
						: existing!.validFrom
					).toISOString(),
					validUntil:
						(command.operation === "create"
							? command.validUntil
							: existing!.validUntil
						)?.toISOString() ?? null,
					confer: command.operation === "create",
				}),
			);
		}
	}
	if (
		effects.length > 4096 ||
		Buffer.byteLength(JSON.stringify(facts)) + Buffer.byteLength(JSON.stringify(effects)) >
			16 * 1024 * 1024
	)
		throw new AccessUnavailable();
	const policy = await readGroupImpactCurrentPolicy(tx, effects);
	if (
		policy.outcome === "deny" ||
		(effects.some((effect) => effect.confer) &&
			policy.subjects.some((subject) => subject.action === "read" && subject.outcome === "deny"))
	)
		throw new AccessDenied();
	if (policy.outcome !== "allow") throw new AccessUnavailable();
	// A denied overlay is not silently subtracted from the requested assignment.
	if (policy.restrictions.some((restriction) => restriction.after)) throw new AccessDenied();
	retainFacts(facts, { policy });
	validUntil = Math.min(
		validUntil,
		policy.validUntil ?? Infinity,
		...authorities.map((source) => source.validUntil ?? Infinity),
	);
	for (const source of authorities) {
		// Mutation authority is selected in the old state and cannot be a role/binding
		// that this command itself changes, even if another implication would survive.
		if (
			(request.kind === "role" &&
				source.sourceBinding?.binding.roleId === request.command.roleId) ||
			(request.kind === "binding" && source.sourceBindingId === request.command.bindingId)
		)
			throw new AccessDenied();
	}
	for (const root of [...roots].sort())
		retained.push(await scopeLifecycleAdmission(tx, root, true));
	for (const fact of policy.subjects)
		if (fact.outcome === "allow")
			retained.push(
				sql`public.access_subject_is_eligible(${fact.subjectId}::uuid,${fact.action}) is true`,
			);
	const deadline = new Date(validUntil);
	const admission: SQL<boolean | null> =
		sql`clock_timestamp()<${deadline}::timestamptz and ${sql.join(
			[...authorities.map((source) => source.admission), ...retained].map((part) => sql`(${part})`),
			sql` and `,
		)}`;
	await requireAccessAdmission(tx, admission);
	const sourceFacts = authorities.map((source) => ({
		scopeId: source.scopeId,
		path: source.path,
		permission: source.permission,
		principalId: source.principalId,
		subjectId: source.subjectId,
		selection: source.selection,
		sourceEvidence: source.sourceEvidence,
		sourceBindingId: source.sourceBindingId,
		sourceBinding: source.sourceBinding,
		representationPath: source.representationPath,
	}));
	const packet = { facts, authorities: sourceFacts, effects };
	if (Buffer.byteLength(JSON.stringify(packet, null, 1)) > 16 * 1024 * 1024)
		throw new AccessUnavailable();
	const sourceDigest = hash({ facts, authorities: sourceFacts });
	const requiresApproval =
		request.kind === "role" && bindingHeads.some((head) => head.state === "active");
	return {
		packet,
		actor,
		authorities,
		admission,
		deadline,
		effects,
		sourceDigest,
		effectDigest: hash(effects),
		requiresApproval,
		roots: [
			...new Set([
				scopeId,
				...(request.kind === "role" ? bindingHeads.map((head) => head.targetScopeId) : []),
			]),
		].sort(),
	};
}
type Capture = Awaited<ReturnType<typeof capture>>;

async function loadReview(tx: DatabaseTransaction, scopeId: string, reviewId: string) {
	const [review] = await tx
		.select()
		.from(reviews)
		.where(and(eq(reviews.id, reviewId), eq(reviews.scopeId, scopeId)))
		.for("update");
	if (!review) throw new AccessRecordUnavailable();
	return review;
}
async function currentReview(tx: DatabaseTransaction, review: Review) {
	if (review.validUntil <= (await assignmentClock(tx))) throw new AccessChanged();
	const request = decodeRequest(review.command);
	const packet = z
		.strictObject({
			facts: z.array(z.unknown()).max(32768),
			authorities: z.array(z.unknown()).max(8192),
			effects: z.array(GroupImpactEffectSchema).max(4096),
		})
		.parse(review.evidence);
	if (
		hash(request) !== review.proposalDigest ||
		hash({ facts: packet.facts, authorities: packet.authorities }) !== review.sourceDigest ||
		hash(packet.effects) !== review.effectDigest ||
		packet.effects.length !== review.effectCount
	)
		throw new AccessUnavailable();
	const evidence = await capture(tx, recoveryPathContext(review), review.scopeId, request);
	if (
		evidence.actor.principalId !== review.principalId ||
		evidence.actor.subjectId !== review.subjectId ||
		evidence.sourceDigest !== review.sourceDigest ||
		evidence.effectDigest !== review.effectDigest ||
		evidence.effects.length !== review.effectCount ||
		evidence.requiresApproval !== review.requiresApproval
	)
		throw new AccessChanged();
	return { request, evidence };
}
function summary(review: Review) {
	return {
		reviewId: review.id,
		proposalDigest: review.proposalDigest,
		effectDigest: review.effectDigest,
		effectCount: review.effectCount,
		requiresApproval: review.requiresApproval,
		validUntil: review.validUntil.toISOString(),
		status: "complete" as const,
	};
}
/** Capture one complete bounded proposal; interrupted or excessive capture never creates an approvable partial review. @internal */
export async function startAssignmentReview(
	context: PrincipalRequestContext,
	scopeId: string,
	proposal: z.infer<typeof AssignmentProposalSchema>,
) {
	return runAccessTransaction(async (tx) => {
		const request = await normalize(tx, context, scopeId, AssignmentProposalSchema.parse(proposal));
		const evidence = await capture(tx, context, scopeId, request);
		const active = await tx
			.select({ id: reviews.id })
			.from(reviews)
			.where(
				and(
					eq(reviews.principalId, evidence.actor.principalId),
					gt(reviews.validUntil, await assignmentClock(tx)),
				),
			)
			.limit(17);
		if (active.length >= 16) throw new AccessUnavailable();
		const [review] = await tx
			.insert(reviews)
			.values({
				id: randomUUID(),
				scopeId,
				principalId: evidence.actor.principalId,
				subjectId: evidence.actor.subjectId,
				proof: context.credentialProof(),
				selection: context.selection,
				command: JSON.parse(JSON.stringify(request)),
				proposalDigest: hash(request),
				sourceDigest: evidence.sourceDigest,
				effectDigest: evidence.effectDigest,
				evidence: JSON.parse(JSON.stringify(evidence.packet)),
				effectCount: evidence.effects.length,
				requiresApproval: evidence.requiresApproval,
				validUntil: evidence.deadline,
			})
			.returning();
		if (!review) throw new AccessUnavailable();
		await requireAccessAdmission(tx, evidence.admission);
		return summary(review);
	});
}
async function reviewerEvidence(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	review: Review,
	request: Request,
	original: Capture,
) {
	const evidence = await capture(tx, context, review.scopeId, request);
	if (evidence.effectDigest !== review.effectDigest) throw new AccessChanged();
	if (
		evidence.actor.principalId === review.principalId &&
		evidence.actor.subjectId === review.subjectId
	)
		return evidence;
	await requireIndependentAccessOperator(
		tx,
		{
			principalId: review.principalId,
			subjectId: review.subjectId,
			affectedSubjectIds: original.effects.flatMap((effect) => [
				effect.subjectId,
				...effect.dependencySubjectIds,
			]),
			affectedEntityIds: original.effects.flatMap((effect) =>
				effect.entityId ? [effect.entityId] : [],
			),
		},
		evidence.actor,
	);
	return evidence;
}
/** Revalidate the entire set on every inspection page; the digest covers all pages, never just the displayed prefix. @internal */
export async function inspectAssignmentReview(
	context: PrincipalRequestContext,
	scopeId: string,
	reviewId: string,
	afterOrdinal = 0,
) {
	return runAccessTransaction(async (tx) => {
		const review = await loadReview(tx, scopeId, reviewId),
			{ request, evidence } = await currentReview(tx, review);
		const viewer = await reviewerEvidence(tx, context, review, request, evidence);
		const items = [];
		for (const [index, effect] of evidence.effects
			.slice(afterOrdinal, afterOrdinal + 100)
			.entries()) {
			const targetScope = effect.scopeId;
			if (!targetScope) throw new AccessUnavailable();
			items.push({
				ordinal: afterOrdinal + index + 1,
				kind: effect.kind,
				itemKey: createHmac("sha256", env.BETTER_AUTH_SECRET)
					.update(
						JSON.stringify([
							"assignment-effect",
							review.id,
							afterOrdinal + index + 1,
							context.principalId,
						]),
					)
					.digest("hex"),
				sourceVersion: effect.sourceVersion,
				termsRevision: effect.termsRevision,
				targetScope: selectors.mint(
					targetScope,
					context.credentialProof(),
					(await assignmentClock(tx)).getTime(),
				),
				targetPath: effect.targetPath,
				recipient: {
					disclosure: "review-local" as const,
					recipientKey: createHmac("sha256", env.BETTER_AUTH_SECRET)
						.update(
							JSON.stringify([
								"assignment-impact-recipient",
								review.id,
								context.principalId,
								context.selection,
								effect.subjectId,
							]),
						)
						.digest("hex"),
				},
				before: effect.before,
				after: effect.after,
				validFrom: effect.validFrom,
				validUntil: effect.validUntil,
				confer: effect.confer,
			});
		}
		const proposal = await presentProposal(tx, context, scopeId, request);
		await requireAccessAdmission(
			tx,
			sql`(${evidence.admission}) and (${viewer.admission}) and clock_timestamp()<${review.validUntil}::timestamptz`,
		);
		return {
			...summary(review),
			proposal,
			items,
			nextCursor:
				afterOrdinal + items.length < evidence.effects.length ? afterOrdinal + items.length : null,
		};
	});
}
async function presentRecipient(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scopeId: string,
	recipient: Recipient,
) {
	if (recipient.kind === "subject")
		return {
			kind: "subject" as const,
			subject: await presentAssignmentSubject(tx, context, scopeId, recipient.subjectId),
		};
	const scope = selectors.mint(
		recipient.scopeId,
		context.credentialProof(),
		(await assignmentClock(tx)).getTime(),
	);
	return recipient.kind === "group"
		? { kind: "group" as const, scope, groupId: recipient.groupId }
		: recipient.kind === "scope-members"
			? { kind: "scope-members" as const, scope, subjectKind: recipient.subjectKind }
			: { kind: "all-members" as const, scope };
}
async function presentTerms(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	terms: Snapshot["terms"],
) {
	let recipientEligibility = null;
	if (terms.recipientEligibility) {
		const [member] = await tx
			.select()
			.from(accessMembership)
			.where(eq(accessMembership.id, terms.recipientEligibility.membershipId));
		if (!member) throw new AccessUnavailable();
		recipientEligibility = {
			scope: selectors.mint(
				member.scopeId,
				context.credentialProof(),
				(await assignmentClock(tx)).getTime(),
			),
			generation: terms.recipientEligibility.generation,
			selection: terms.recipientEligibility.selection,
		};
	}
	return {
		...terms,
		recipientEligibility,
		validFrom: terms.validFrom.toISOString(),
		validUntil: terms.validUntil?.toISOString() ?? null,
	};
}
async function presentProposal(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scopeId: string,
	request: Request,
) {
	// Build per-kind projections: the private audit identities and native scope/subject
	// keys never escape through an object spread of a persistence record.
	if (request.kind === "role") {
		if (request.command.operation !== "activate" && request.command.operation !== "retire")
			throw new AccessUnavailable();
		return {
			kind: "role" as const,
			operation: request.command.operation,
			operationId: request.command.operationId,
			roleId: request.command.roleId,
			expectedVersion: request.command.expectedVersion,
			definitionRevision:
				request.command.operation === "activate" ? request.command.definitionRevision : null,
		};
	}
	if (request.kind === "binding") {
		const value = request.command;
		return {
			kind: "binding" as const,
			operation: value.operation,
			operationId: value.operationId,
			bindingId: value.bindingId,
			expectedVersion: value.expectedVersion,
			definitionRevision: request.definitionRevision,
			roleScope: selectors.mint(
				request.roleScopeId,
				context.credentialProof(),
				(await assignmentClock(tx)).getTime(),
			),
			roleId: value.operation === "create" ? value.roleId : null,
			recipient:
				value.operation === "create"
					? await presentRecipient(tx, context, scopeId, value.recipient)
					: null,
			terms: value.operation === "revoke" ? null : await presentTerms(tx, context, value.terms),
		};
	}
	const value = request.command;
	return {
		kind: "ceiling" as const,
		operation: value.operation,
		operationId: value.operationId,
		ceilingId: value.ceilingId,
		expectedVersion: value.expectedVersion,
		terms:
			value.operation === "revoke"
				? null
				: {
						managerBindingId: value.managerBindingId,
						managerTermsRevision: value.managerTermsRevision,
						roleId: value.roleId,
						definitionRevision: request.definitionRevision,
						roleScope: selectors.mint(
							request.roleScopeId!,
							context.credentialProof(),
							(await assignmentClock(tx)).getTime(),
						),
						targetPath: value.targetPath,
						recipient: await presentRecipient(tx, context, scopeId, value.recipient),
						permissions: value.permissions,
						validFrom: value.validFrom.toISOString(),
						validUntil: value.validUntil?.toISOString() ?? null,
						maximumGrantDurationSeconds: value.maximumGrantDurationSeconds,
						grantNotAfter: value.grantNotAfter?.toISOString() ?? null,
					},
	};
}
/** A fresh independent approver must authorize the complete effect from their own unchanged sources. @internal */
export async function approveAssignmentReview(
	context: PrincipalRequestContext,
	scopeId: string,
	reviewId: string,
	input: { approvalId: string; proposalDigest: string; effectDigest: string },
) {
	return runAccessTransaction(async (tx) => {
		const review = await loadReview(tx, scopeId, reviewId),
			{ request, evidence } = await currentReview(tx, review);
		if (
			input.proposalDigest !== review.proposalDigest ||
			input.effectDigest !== review.effectDigest
		)
			throw new AccessChanged();
		const approver = await reviewerEvidence(tx, context, review, request, evidence);
		if (
			approver.actor.principalId === review.principalId ||
			approver.actor.subjectId === review.subjectId
		)
			throw new AccessDenied();
		const [prior] = await tx
			.select()
			.from(approvals)
			.where(eq(approvals.id, input.approvalId))
			.for("update");
		if (prior) {
			if (
				prior.reviewId !== reviewId ||
				prior.principalId !== approver.actor.principalId ||
				prior.subjectId !== approver.actor.subjectId ||
				prior.proposalDigest !== input.proposalDigest ||
				prior.effectDigest !== input.effectDigest
			)
				throw new AccessChanged();
			await requireAccessAdmission(tx, approver.admission);
			return {
				approvalId: prior.id,
				validUntil: prior.validUntil.toISOString(),
				revoked: prior.revokedAt !== null,
			};
		}
		const count = await tx
			.select({ id: approvals.id })
			.from(approvals)
			.where(eq(approvals.reviewId, reviewId))
			.limit(65);
		if (count.length >= 64) throw new AccessUnavailable();
		const same = await tx
			.select({ id: approvals.id })
			.from(approvals)
			.where(
				and(
					eq(approvals.reviewId, reviewId),
					eq(approvals.principalId, approver.actor.principalId),
				),
			);
		if (same.length) throw new AccessChanged();
		const validUntil = new Date(Math.min(review.validUntil.getTime(), approver.deadline.getTime()));
		await tx.insert(approvals).values({
			id: input.approvalId,
			reviewId,
			principalId: approver.actor.principalId,
			subjectId: approver.actor.subjectId,
			proof: context.credentialProof(),
			selection: context.selection,
			sourceDigest: approver.sourceDigest,
			proposalDigest: input.proposalDigest,
			effectDigest: input.effectDigest,
			validUntil,
		});
		await requireAccessAdmission(
			tx,
			sql`(${evidence.admission}) and (${approver.admission}) and clock_timestamp()<${validUntil}::timestamptz`,
		);
		return { approvalId: input.approvalId, validUntil: validUntil.toISOString(), revoked: false };
	});
}
async function selectApproval(
	tx: DatabaseTransaction,
	review: Review,
	request: Request,
	evidence: Capture,
) {
	const rows = await tx
		.select()
		.from(approvals)
		.where(eq(approvals.reviewId, review.id))
		.orderBy(approvals.id)
		.limit(65)
		.for("share");
	if (rows.length > 64) throw new AccessUnavailable();
	let unavailable = false;
	for (const row of rows) {
		if (
			row.revokedAt ||
			row.validUntil <= (await assignmentClock(tx)) ||
			row.proposalDigest !== review.proposalDigest ||
			row.effectDigest !== review.effectDigest
		)
			continue;
		try {
			const current = await reviewerEvidence(
				tx,
				recoveryPathContext(row),
				review,
				request,
				evidence,
			);
			if (current.actor.subjectId !== row.subjectId || current.sourceDigest !== row.sourceDigest)
				continue;
			return { row, current };
		} catch (error) {
			try {
				rethrowAccessFailure(error);
			} catch (failure) {
				if (failure instanceof AccessUnavailable || failure instanceof AccessRecordUnavailable)
					unavailable = true;
				else if (!(failure instanceof AccessDenied || failure instanceof AccessChanged))
					throw failure;
			}
		}
	}
	if (unavailable) throw new AccessUnavailable();
	throw new AccessDenied();
}
/** Terminal own-approval revocation remains possible after losing the old management role. @internal */
export async function revokeAssignmentApproval(
	context: PrincipalRequestContext,
	scopeId: string,
	reviewId: string,
	approvalId: string,
	operationId: string,
) {
	return runAccessTransaction(async (tx) => {
		const { readFirstPartyCredentialAuthority } = await import("../auth/credential-authority");
		const credential = await readFirstPartyCredentialAuthority(tx, {
			proof: context.credentialProof(),
			selection: context.selection,
			apiPermission: "access:manage",
			requireFreshSession: true,
			requireVerifiedEmail: true,
		});
		await loadReview(tx, scopeId, reviewId);
		const [row] = await tx
			.select()
			.from(approvals)
			.where(
				and(
					eq(approvals.id, approvalId),
					eq(approvals.reviewId, reviewId),
					eq(approvals.principalId, credential.principalId),
				),
			)
			.for("update");
		if (!row) throw new AccessRecordUnavailable();
		if (row.revokeOperationId && row.revokeOperationId !== operationId) throw new AccessChanged();
		if (!row.revokedAt)
			await tx
				.update(approvals)
				.set({ revokedAt: await assignmentClock(tx), revokeOperationId: operationId })
				.where(eq(approvals.id, approvalId));
		await requireAccessAdmission(tx, credential.admission);
		return { approvalId, validUntil: row.validUntil.toISOString(), revoked: true };
	});
}

async function prepareRecovery(tx: DatabaseTransaction, review: Review, evidence: Capture) {
	const selected: { row: typeof accessRecoveryPath.$inferSelect; digest: string }[] = [];
	for (const root of evidence.roots) {
		const [policy] = await tx
			.select()
			.from(accessRecoveryPolicy)
			.where(eq(accessRecoveryPolicy.scopeId, root))
			.for("share");
		if (!policy || policy.policy !== "native-repair-v1") throw new AccessUnavailable();
		const paths = await tx
			.select()
			.from(accessRecoveryPath)
			.where(
				and(
					eq(accessRecoveryPath.scopeId, root),
					isNull(accessRecoveryPath.revokedAt),
					gt(accessRecoveryPath.validUntil, await assignmentClock(tx)),
				),
			)
			.orderBy(accessRecoveryPath.validUntil, accessRecoveryPath.id)
			.limit(9)
			.for("share");
		if (paths.length > 8) throw new AccessUnavailable();
		let found = false,
			unavailable = false;
		for (const row of paths) {
			const [visible] = (
				await tx.execute<{ visible: boolean }>(
					sql`select pg_visible_in_snapshot(${row.createdXid}::xid8,${review.baseSnapshot}::pg_snapshot) as visible`,
				)
			).rows;
			if (!visible?.visible || row.createdAt > review.createdAt) continue;
			try {
				const sources = await readNativeRecoveryAuthorities(tx, recoveryPathContext(row), root);
				const digest = hash(sources.map(groupAuthoritySourceDigest));
				if (sources[0]?.subjectId !== row.subjectId || digest !== row.sourceDigest) continue;
				for (const source of sources) await requireAccessAdmission(tx, source.admission);
				selected.push({ row, digest });
				found = true;
				break;
			} catch (error) {
				try {
					rethrowAccessFailure(error);
				} catch (failure) {
					if (failure instanceof AccessUnavailable || failure instanceof AccessRecordUnavailable)
						unavailable = true;
					else if (!(failure instanceof AccessDenied)) throw failure;
				}
			}
		}
		if (!found) {
			if (unavailable) throw new AccessUnavailable();
			throw new AccessDenied();
		}
	}
	return {
		ids: selected.map((item) => item.row.id),
		afterEffect: async () => {
			const conditions: SQL<boolean | null>[] = [];
			for (const { row, digest } of selected) {
				const sources = await readNativeRecoveryAuthorities(
					tx,
					recoveryPathContext(row),
					row.scopeId,
				);
				if (hash(sources.map(groupAuthoritySourceDigest)) !== digest) throw new AccessDenied();
				conditions.push(
					...sources.map((source) => source.admission),
					sql`exists(select 1 from public.access_recovery_path where id=${row.id}::uuid and revoked_at is null and valid_until>clock_timestamp())`,
				);
			}
			return conditions;
		},
	};
}
/** Execute the inspected exact command atomically with its approval attribution and original recovery continuity. @internal */
export async function executeAssignmentReview(
	context: PrincipalRequestContext,
	scopeId: string,
	reviewId: string,
	input: { proposalDigest: string; effectDigest: string },
	expected?: { kind: Request["kind"]; id: string; operation: string },
) {
	return runAccessTransaction(async (tx) => {
		const review = await loadReview(tx, scopeId, reviewId),
			request = decodeRequest(review.command);
		if (
			input.proposalDigest !== review.proposalDigest ||
			input.effectDigest !== review.effectDigest ||
			hash(request) !== review.proposalDigest ||
			(expected &&
				(request.kind !== expected.kind ||
					commandId(request) !== expected.id ||
					request.command.operation !== expected.operation))
		)
			throw new AccessChanged();
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`assignment-operation:${request.command.operationId}`},0))`,
		);
		const current = await mainAuthority(tx, context, scopeId, request);
		if (current.principalId !== review.principalId || current.subjectId !== review.subjectId)
			throw new AccessRecordUnavailable();
		const [prior] = await tx
			.select()
			.from(receipts)
			.where(eq(receipts.operationId, request.command.operationId));
		if (prior && prior.reviewId !== reviewId) throw new AccessChanged();
		if (prior) {
			if (
				prior.operationId !== request.command.operationId ||
				prior.proposalDigest !== review.proposalDigest ||
				prior.effectDigest !== review.effectDigest
			)
				throw new AccessChanged();
			await requireAccessAdmission(tx, current.admission);
			return prior.receipt;
		}
		const { evidence } = await currentReview(tx, review);
		// The executor may have a renewed credential, but its selected current sources
		// must still be the originally reviewed principal and authority subject.
		const executor = await capture(tx, context, scopeId, request);
		if (executor.sourceDigest !== evidence.sourceDigest) throw new AccessChanged();
		const approval = review.requiresApproval
			? await selectApproval(tx, review, request, evidence)
			: null;
		const recovery = await prepareRecovery(tx, review, evidence);
		const approvalAdmission = approval
			? sql<boolean>`exists(select 1 from public.access_assignment_approval where id=${approval.row.id}::uuid and revoked_at is null and valid_until>clock_timestamp()) and (${approval.current.admission})`
			: sql<boolean>`true`;
		const admission: SQL<boolean | null> =
			sql`(${evidence.admission}) and (${executor.admission}) and (${approvalAdmission}) and clock_timestamp()<${review.validUntil}::timestamptz`;
		await requireAccessAdmission(tx, admission);
		const receipt =
			request.kind === "role"
				? await applyAccessRoleCommand(tx, request.command, admission)
				: request.kind === "binding"
					? await applyAccessRoleBindingCommand(tx, request.command, admission)
					: await applyAccessAssignmentCeilingCommand(tx, request.command, admission);
		const recovered = await recovery.afterEffect();
		const policy = await readGroupImpactCurrentPolicy(tx, evidence.effects);
		if (policy.outcome === "deny" || policy.restrictions.some((row) => row.after))
			throw new AccessDenied();
		if (policy.outcome !== "allow") throw new AccessUnavailable();
		const result = { ...receipt };
		await tx.insert(receipts).values({
			reviewId,
			operationId: request.command.operationId,
			proposalDigest: review.proposalDigest,
			effectDigest: review.effectDigest,
			receipt: result,
			approvalIds: approval ? [approval.row.id] : [],
			recoveryPathIds: recovery.ids,
		});
		// No additional locking work after this clock/credential/recovery check.
		await requireAccessAdmission(
			tx,
			sql`(${admission}) and ${sql.join(
				recovered.map((condition) => sql`(${condition})`),
				sql` and `,
			)}
   and (${policy.validUntil === null ? sql`true` : sql`clock_timestamp()<${new Date(policy.validUntil)}::timestamptz`})`,
		);
		return result;
	});
}

/** Scope-bounded binding directory; list authority covers the whole directory. @internal */
export async function listManagedBindings(
	context: PrincipalRequestContext,
	scopeId: string,
	afterId?: string,
) {
	return runAccessTransaction(async (tx) => {
		const authority = await assignmentAuthority(
			tx,
			context,
			scopeId,
			"access.role-binding.manage",
			[],
			false,
		);
		const rows = await tx
			.select({
				bindingId: accessRoleBinding.id,
				roleId: accessRoleBinding.roleId,
				version: accessRoleBinding.version,
				termsRevision: accessRoleBinding.termsRevision,
				state: accessRoleBinding.state,
			})
			.from(accessRoleBinding)
			.where(
				and(
					eq(accessRoleBinding.targetScopeId, scopeId),
					afterId ? gt(accessRoleBinding.id, afterId) : undefined,
				),
			)
			.orderBy(accessRoleBinding.id)
			.limit(101);
		await requireAccessAdmission(tx, authority.admission);
		const items = rows.slice(0, 100).map((row) => {
			if (row.state === "draft" || row.termsRevision === null) throw new AccessUnavailable();
			return { ...row, state: row.state, termsRevision: row.termsRevision };
		});
		return { items, nextCursor: rows.length > 100 ? rows[99]!.bindingId : null };
	});
}
/** Historical terms preserve dependencies and frozen approvals without treating them as effective access. @internal */
export async function getManagedBinding(
	context: PrincipalRequestContext,
	scopeId: string,
	bindingId: string,
	revision: number | "current" = "current",
) {
	return runAccessTransaction(async (tx) => {
		const current = await readAccessRoleBindingSnapshot(tx, {
			targetScopeId: scopeId,
			bindingId,
			revision: "current",
		});
		if (!current) throw new AccessRecordUnavailable();
		const authority = await assignmentAuthority(
			tx,
			context,
			scopeId,
			"access.role-binding.manage",
			current.terms.targetPath,
			false,
		);
		const snapshot =
			revision === "current"
				? current
				: await readAccessRoleBindingSnapshot(tx, { targetScopeId: scopeId, bindingId, revision });
		if (!snapshot) throw new AccessRecordUnavailable();
		const old = await assignmentAuthority(
			tx,
			context,
			scopeId,
			"access.role-binding.manage",
			snapshot.terms.targetPath,
			false,
		);
		const [role] = await tx
			.select()
			.from(accessRole)
			.where(eq(accessRole.id, snapshot.roleId))
			.for("share");
		if (!role) throw new AccessUnavailable();
		const result = {
			bindingId,
			roleId: snapshot.roleId,
			roleScope: selectors.mint(
				role.scopeId,
				context.credentialProof(),
				(await assignmentClock(tx)).getTime(),
			),
			definitionRevision: role.activeRevision,
			roleState: snapshot.roleState,
			version: snapshot.version,
			state: snapshot.state,
			termsRevision: snapshot.termsRevision,
			recipient: await presentRecipient(tx, context, scopeId, snapshot.recipient),
			terms: await presentTerms(tx, context, snapshot.terms),
		};
		await requireAccessAdmission(tx, sql`(${authority.admission}) and (${old.admission})`);
		return result;
	});
}
/** Private ceiling directory never exposes the underlying manager's private operator or subject. @internal */
export async function listManagedCeilings(
	context: PrincipalRequestContext,
	scopeId: string,
	afterId?: string,
) {
	return runAccessTransaction(async (tx) => {
		const authority = await assignmentAuthority(
			tx,
			context,
			scopeId,
			"access.assignment-ceiling.manage",
			[],
			false,
		);
		const rows = await tx
			.select({
				ceilingId: accessAssignmentCeiling.id,
				roleId: accessAssignmentCeiling.roleId,
				version: accessAssignmentCeiling.version,
				state: accessAssignmentCeiling.state,
			})
			.from(accessAssignmentCeiling)
			.where(
				and(
					eq(accessAssignmentCeiling.scopeId, scopeId),
					afterId ? gt(accessAssignmentCeiling.id, afterId) : undefined,
				),
			)
			.orderBy(accessAssignmentCeiling.id)
			.limit(101);
		await requireAccessAdmission(tx, authority.admission);
		const items = rows.slice(0, 100).map((row) => {
			if (row.state === "draft") throw new AccessUnavailable();
			return { ...row, state: row.state };
		});
		return { items, nextCursor: rows.length > 100 ? rows[99]!.ceilingId : null };
	});
}
/** Read immutable ceiling terms and its live control head; revocation does not erase its approval. @internal */
export async function getManagedCeiling(
	context: PrincipalRequestContext,
	scopeId: string,
	ceilingId: string,
) {
	return runAccessTransaction(async (tx) => {
		const { head, permissions } = await readCeiling(tx, scopeId, ceilingId);
		const authority = await assignmentAuthority(
			tx,
			context,
			scopeId,
			"access.assignment-ceiling.manage",
			head.targetPath,
			false,
		);
		const [role] = await tx
			.select()
			.from(accessRole)
			.where(eq(accessRole.id, head.roleId))
			.for("share");
		if (!role) throw new AccessUnavailable();
		const result = {
			ceilingId,
			roleScope: selectors.mint(
				role.scopeId,
				context.credentialProof(),
				(await assignmentClock(tx)).getTime(),
			),
			definitionRevision: role.activeRevision,
			version: head.version,
			state: head.state,
			managerBindingId: head.managerBindingId,
			managerTermsRevision: head.managerTermsRevision,
			roleId: head.roleId,
			targetPath: head.targetPath,
			recipient: await presentRecipient(tx, context, scopeId, ceilingRecipient(head)),
			permissions,
			validFrom: head.validFrom.toISOString(),
			validUntil: head.validUntil?.toISOString() ?? null,
			maximumGrantDurationSeconds: head.maximumGrantDurationSeconds,
			grantNotAfter: head.grantNotAfter?.toISOString() ?? null,
		};
		await requireAccessAdmission(tx, authority.admission);
		return result;
	});
}
/** Bounded private command history omits all raw operator/subject attribution. @internal */
export async function listAssignmentHistory(
	context: PrincipalRequestContext,
	scopeId: string,
	kind: "binding" | "ceiling",
	identity: string,
	afterVersion = 0,
) {
	return runAccessTransaction(async (tx) => {
		// Directory-level permission is required for complete historical disclosure;
		// current-path-only managers cannot enumerate earlier broader target terms.
		const authority = await assignmentAuthority(
			tx,
			context,
			scopeId,
			kind === "binding" ? "access.role-binding.manage" : "access.assignment-ceiling.manage",
			[],
			false,
		);
		const parent =
			kind === "binding"
				? (
						await tx
							.select()
							.from(accessRoleBinding)
							.where(
								and(
									eq(accessRoleBinding.id, identity),
									eq(accessRoleBinding.targetScopeId, scopeId),
								),
							)
					)[0]
				: (
						await tx
							.select()
							.from(accessAssignmentCeiling)
							.where(
								and(
									eq(accessAssignmentCeiling.id, identity),
									eq(accessAssignmentCeiling.scopeId, scopeId),
								),
							)
					)[0];
		if (!parent) throw new AccessRecordUnavailable();
		const rows = (
			await tx.execute<{
				version: string;
				operation_id: string;
				operation: "create" | "amend" | "revoke";
				created_at: string;
			}>(
				kind === "binding"
					? sql`
   select version::text,operation_id,operation,created_at::text from public.access_role_binding_event where binding_id=${identity}::uuid and version>${afterVersion} order by version limit 101`
					: sql`
   select version::text,operation_id,operation,created_at::text from public.access_assignment_ceiling_event where ceiling_id=${identity}::uuid and version>${afterVersion} order by version limit 101`,
			)
		).rows;
		await requireAccessAdmission(tx, authority.admission);
		return {
			items: rows.slice(0, 100).map((row) => ({
				version: Number(row.version),
				operationId: row.operation_id,
				operation: row.operation,
				createdAt: new Date(row.created_at).toISOString(),
			})),
			nextCursor: rows.length > 100 ? Number(rows[99]!.version) : null,
		};
	});
}

async function retainedCeilingAdmission(
	tx: DatabaseTransaction,
	ceilingId: string,
	subjectId: string,
	evidence: Parameters<NonNullable<Parameters<typeof findRoleAssignmentCeiling>[2]>>[0],
	observe: (date: Date | null) => void,
): Promise<SQL<boolean | null>> {
	const ceiling = evidence.approvals.find((item) => item.approval.id === ceilingId);
	const manager =
		ceiling &&
		evidence.manager.bindings.find(
			(source) =>
				source.binding.id === ceiling.approval.managerBindingId &&
				source.terms.revision === ceiling.approval.managerTermsRevision &&
				source.active,
		);
	if (!ceiling || !manager) throw new AccessUnavailable();
	observe(ceiling.approval.validUntil);
	observe(manager.terms.validUntil);
	await tx
		.select()
		.from(accessRoleBinding)
		.where(eq(accessRoleBinding.id, manager.binding.id))
		.for("share");
	return sql`exists(select 1 from public.access_role_binding b join public.access_role r on r.id=b.role_id
  where b.id=${manager.binding.id}::uuid and b.version=${manager.binding.version} and b.terms_revision=${manager.terms.revision} and b.state='active'
  and r.version=${manager.roleVersion} and r.active_revision=${manager.roleRevision} and r.state='active'
  and public.access_role_binding_recipient_is_current(b.id,b.terms_revision) is true
  and public.access_subject_matches_recipient(${subjectId}::uuid,b.recipient_kind,b.recipient_subject_id,b.recipient_scope_id,b.recipient_group_id) is true)
  and exists(select 1 from public.access_assignment_ceiling where id=${ceilingId}::uuid and state='active' and sealed
   and valid_from<=clock_timestamp() and (valid_until is null or valid_until>clock_timestamp()))`;
}

/** Private approval status retains denial/unavailability separately and never counts a partial acknowledgement. @internal */
export async function listAssignmentApprovals(
	context: PrincipalRequestContext,
	scopeId: string,
	reviewId: string,
) {
	return runAccessTransaction(async (tx) => {
		const review = await loadReview(tx, scopeId, reviewId),
			{ request, evidence } = await currentReview(tx, review);
		const manager = await mainAuthority(tx, context, scopeId, request);
		if (manager.principalId !== review.principalId || manager.subjectId !== review.subjectId)
			throw new AccessRecordUnavailable();
		const rows = await tx
			.select()
			.from(approvals)
			.where(eq(approvals.reviewId, reviewId))
			.orderBy(approvals.id)
			.limit(65)
			.for("share");
		if (rows.length > 64) throw new AccessUnavailable();
		const items = [];
		for (const row of rows) {
			let validity: "valid" | "invalid" | "unavailable" = "invalid";
			if (
				!row.revokedAt &&
				row.validUntil > (await assignmentClock(tx)) &&
				row.proposalDigest === review.proposalDigest &&
				row.effectDigest === review.effectDigest
			) {
				try {
					const source = await reviewerEvidence(
						tx,
						recoveryPathContext(row),
						review,
						request,
						evidence,
					);
					if (
						source.actor.subjectId === row.subjectId &&
						source.sourceDigest === row.sourceDigest
					) {
						await requireAccessAdmission(tx, source.admission);
						validity = "valid";
					}
				} catch (error) {
					try {
						rethrowAccessFailure(error);
					} catch (failure) {
						if (failure instanceof AccessUnavailable || failure instanceof AccessRecordUnavailable)
							validity = "unavailable";
						else if (!(failure instanceof AccessDenied || failure instanceof AccessChanged))
							throw failure;
					}
				}
			}
			items.push({
				approvalId: row.id,
				validUntil: row.validUntil.toISOString(),
				revoked: row.revokedAt !== null,
				validity,
			});
		}
		const now = await assignmentClock(tx);
		for (const item of items) if (new Date(item.validUntil) <= now) item.validity = "invalid";
		await requireAccessAdmission(
			tx,
			sql`(${manager.admission}) and (${evidence.admission}) and clock_timestamp()<${review.validUntil}::timestamptz`,
		);
		return { reviewId, items };
	});
}
