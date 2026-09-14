import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { AccessPermissionValues, accessPermissionKey } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import {
	accessRepresentation, accessRepresentationEntity, accessRepresentationEvent,
	accessRepresentationRevision, accessRepresentationPermission,
} from "../database/schema/access-representation";
import { accessGroupTree } from "../database/schema/access-group";
import { AccessPermissionSchema, decodeAccessPermissionSnapshot } from "./permission";
import { allocateAccessSubject } from "./identities";

const versionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const recipientSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("subject"), subjectId: z.uuid() }),
	z.strictObject({ kind: z.literal("group"), scopeId: z.uuid(), groupId: z.uuid() }),
	z.strictObject({ kind: z.literal("all-members"), scopeId: z.uuid() }),
]);
const termsSchema = z.strictObject({
	targetPath: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8),
	validFrom: z.date(), validUntil: z.date().nullable(),
	canRedelegate: z.boolean(), requireFreshSession: z.boolean(),
	permissions: z.array(AccessPermissionSchema).max(AccessPermissionValues.length),
	recipientEligibility: z.strictObject({
		membershipId: z.uuid(), generation: versionSchema.min(1),
		selection: z.strictObject({ groupId: z.uuid(), version: versionSchema.min(1) }).nullable(),
	}).nullable(),
}).refine(terms => terms.validUntil === null || terms.validUntil > terms.validFrom,
	"Representation validity must be a nonempty half-open interval");
const base = {
	entityId: z.uuid(), grantId: z.uuid(), expectedVersion: versionSchema,
	operationId: z.uuid(), operatorAuthUserId: z.uuid(), authoritySubjectId: z.uuid(),
};
const schema = z.discriminatedUnion("operation", [
	z.strictObject({ ...base, operation: z.literal("create"), targetScopeId: z.uuid(),
		recipient: recipientSchema,
		parent: z.strictObject({ id: z.uuid(), revision: versionSchema.min(1), subjectId: z.uuid(),
			membership: z.strictObject({ id: z.uuid(), generation: versionSchema.min(1),
				selection: z.strictObject({ groupId: z.uuid(), version: versionSchema.min(1) }).nullable(),
			}).nullable(),
		}).nullable(), terms: termsSchema }),
	z.strictObject({ ...base, operation: z.literal("narrow"), terms: termsSchema }),
	z.strictObject({ ...base, operation: z.literal("revoke") }),
]);
/** Private representation control with literal approved permissions and explicit institutional/dependent lineage. @internal */
export type AccessRepresentationCommand = z.infer<typeof schema>;
/** Original immutable command outcome, independent from subsequent liveness. @internal */
export interface AccessRepresentationReceipt {
	grantId: string; operationId: string; version: number; termsRevision: number; state: "active" | "revoked";
}
/** Representation identity, terms, parent or expected control state conflicts with this command. @internal */
export class AccessRepresentationConflict extends Error {
	constructor() { super("Representation command conflicts with current state or its receipt"); }
}
/** Current management/assignment authority denied the command. @internal */
export class AccessRepresentationAdmissionDenied extends Error {
	constructor() { super("Current representation management and assignment admission are required"); }
}
/** Required owner state or current admission could not be established. @internal */
export class AccessRepresentationUnavailable extends Error {
	constructor() { super("Representation state or authority is unavailable"); }
}
function requireAdmission(admitted: boolean | null | undefined) {
	if (admitted === false) throw new AccessRepresentationAdmissionDenied();
	if (admitted !== true) throw new AccessRepresentationUnavailable();
}
function receipt(event: typeof accessRepresentationEvent.$inferSelect): AccessRepresentationReceipt {
	const termsRevision = event.operation === "revoke" ? event.retainedTermsRevision : event.version;
	if (termsRevision === null) throw new AccessRepresentationUnavailable();
	return { grantId: event.grantId, operationId: event.operationId, version: event.version,
		termsRevision, state: event.operation === "revoke" ? "revoked" : "active" };
}

/**
 * Create, narrow or terminally revoke a representation under an Entity control fence.
 * @internal
 * @remarks The owner supplies current, side-effect-free SQL for actor eligibility,
 * represented control, action-specific management, delegate eligibility, assignment
 * ceilings, conditions, dependent issuer provenance and recovery continuity. It
 * discovers/promotes the full authority fence closure before calling. Parent limits
 * and exact liveness are additional native requirements, not proof the operator may
 * delegate that parent. A root institutional grant has no issuer-liveness dependency.
 * Permissions are literal approved references; this writer never expands them.
 */
export async function applyAccessRepresentationCommand(
	tx: DatabaseTransaction, input: AccessRepresentationCommand, admission: SQL<boolean | null>,
): Promise<AccessRepresentationReceipt> {
	const command = schema.parse(input);
	if (command.operation !== "revoke") {
		const keys = new Set(command.terms.permissions.map(accessPermissionKey));
		command.terms.permissions = AccessPermissionValues.filter(permission => keys.has(accessPermissionKey(permission)))
			.map(permission => ({ ...permission })).sort((a, b) => accessPermissionKey(a) < accessPermissionKey(b) ? -1 : 1);
	}
	const requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async work => {
		const authorize = async () => requireAdmission((await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted);
		await authorize();
		if (command.operation === "create") {
			await allocateAccessSubject(work, { kind: "entity", id: command.entityId });
			await work.insert(accessRepresentationEntity).values({ entityId: command.entityId }).onConflictDoNothing();
		}
		const [fence] = await work.select().from(accessRepresentationEntity)
			.where(eq(accessRepresentationEntity.entityId, command.entityId)).for("update");
		if (!fence) throw new AccessRepresentationUnavailable();
		await authorize();
		const [existing] = await work.select().from(accessRepresentation)
			.where(and(eq(accessRepresentation.id, command.grantId), eq(accessRepresentation.entityId, command.entityId))).limit(1);
		if (!existing && command.operation !== "create") throw new AccessRepresentationConflict();
		const parent = existing
			? existing.parentGrantId ? { id: existing.parentGrantId, revision: existing.parentRevision } : null
			: command.operation === "create" ? command.parent : null;
		if (command.operation !== "revoke" && parent) {
			if (parent.revision === null || parent.id === command.grantId) throw new AccessRepresentationConflict();
			const [parentHead] = await work.select().from(accessRepresentation).where(eq(accessRepresentation.id, parent.id)).limit(1);
			const targetScopeId = existing?.targetScopeId ?? (command.operation === "create" ? command.targetScopeId : null);
			if (parentHead?.entityId !== command.entityId || parentHead.targetScopeId !== targetScopeId) throw new AccessRepresentationConflict();
			await work.execute(sql`select public.lock_access_representation_lineage(${parent.id}::uuid,${parent.revision}::bigint)`);
			await authorize();
		}
		const parentMembership = existing?.parentMembershipId && existing.parentMembershipGeneration !== null
			? { id: existing.parentMembershipId, generation: existing.parentMembershipGeneration,
				selection: existing.parentSelectionGroupId ? { groupId: existing.parentSelectionGroupId } : null }
			: command.operation === "create" ? command.parent?.membership : null;
		if (command.operation !== "revoke" && parentMembership) {
			const dependency = parentMembership;
			await work.execute(sql`select public.lock_access_role_binding_eligibility(${dependency.id}::uuid,
				${dependency.generation}::bigint,${dependency.selection?.groupId ?? null}::uuid)`);
			await authorize();
		}
		if (command.operation !== "revoke" && command.terms.recipientEligibility) {
			const dependency = command.terms.recipientEligibility;
			await work.execute(sql`select public.lock_access_role_binding_eligibility(${dependency.membershipId}::uuid,
				${dependency.generation}::bigint,${dependency.selection?.groupId ?? null}::uuid)`);
			await authorize();
		}
		const groupScope = existing?.recipientKind === "group" ? existing.recipientScopeId
			: command.operation === "create" && command.recipient.kind === "group" ? command.recipient.scopeId : null;
		if (groupScope) {
			const [tree] = await work.select({ id: accessGroupTree.scopeId }).from(accessGroupTree)
				.where(eq(accessGroupTree.scopeId, groupScope)).for("share");
			if (!tree) throw new AccessRepresentationUnavailable();
			await authorize();
		}
		if (command.operation === "create") await work.insert(accessRepresentation).values({
			id: command.grantId, entityId: command.entityId, targetScopeId: command.targetScopeId,
			parentGrantId: command.parent?.id ?? null, parentRevision: command.parent?.revision ?? null,
			parentSubjectId: command.parent?.subjectId ?? null,
			parentMembershipId: command.parent?.membership?.id ?? null,
			parentMembershipGeneration: command.parent?.membership?.generation ?? null,
			parentSelectionGroupId: command.parent?.membership?.selection?.groupId ?? null,
			parentSelectionVersion: command.parent?.membership?.selection?.version ?? null,
			recipientKind: command.recipient.kind,
			recipientSubjectId: command.recipient.kind === "subject" ? command.recipient.subjectId : null,
			recipientGroupId: command.recipient.kind === "group" ? command.recipient.groupId : null,
			recipientScopeId: command.recipient.kind === "subject" ? null : command.recipient.scopeId,
		}).onConflictDoNothing({ target: accessRepresentation.id });
		const [head] = await work.select().from(accessRepresentation)
			.where(and(eq(accessRepresentation.id, command.grantId), eq(accessRepresentation.entityId, command.entityId))).for("update");
		if (!head) throw new AccessRepresentationConflict();
		await authorize();
		if (command.operation === "create" && (head.targetScopeId !== command.targetScopeId ||
			head.parentGrantId !== (command.parent?.id ?? null) || head.parentRevision !== (command.parent?.revision ?? null) ||
			head.parentSubjectId !== (command.parent?.subjectId ?? null) ||
			head.parentMembershipId !== (command.parent?.membership?.id ?? null) ||
			head.parentMembershipGeneration !== (command.parent?.membership?.generation ?? null) ||
			head.parentSelectionGroupId !== (command.parent?.membership?.selection?.groupId ?? null) ||
			head.parentSelectionVersion !== (command.parent?.membership?.selection?.version ?? null) ||
			head.recipientKind !== command.recipient.kind ||
			head.recipientSubjectId !== (command.recipient.kind === "subject" ? command.recipient.subjectId : null) ||
			head.recipientGroupId !== (command.recipient.kind === "group" ? command.recipient.groupId : null) ||
			head.recipientScopeId !== (command.recipient.kind === "subject" ? null : command.recipient.scopeId)))
			throw new AccessRepresentationConflict();
		const [prior] = await work.select().from(accessRepresentationEvent)
			.where(and(eq(accessRepresentationEvent.grantId, head.id), eq(accessRepresentationEvent.operationId, command.operationId))).limit(1);
		if (prior) {
			if (prior.requestDigest !== requestDigest || prior.operatorAuthUserId !== command.operatorAuthUserId || prior.authoritySubjectId !== command.authoritySubjectId)
				throw new AccessRepresentationConflict();
			return receipt(prior);
		}
		if (head.version !== command.expectedVersion || head.state === "revoked" || (command.operation === "create") !== (head.version === 0))
			throw new AccessRepresentationConflict();
		const version = head.version + 1;
		const [event] = await work.insert(accessRepresentationEvent).values({ grantId: head.id, version,
			operationId: command.operationId, requestDigest, operation: command.operation,
			retainedTermsRevision: command.operation === "revoke" ? head.termsRevision : null,
			operatorAuthUserId: command.operatorAuthUserId, authoritySubjectId: command.authoritySubjectId }).returning();
		if (!event) throw new AccessRepresentationUnavailable();
		if (command.operation !== "revoke") {
			const terms = command.terms;
			await work.insert(accessRepresentationRevision).values({ grantId: head.id, revision: version,
				targetPath: terms.targetPath, validFrom: terms.validFrom, validUntil: terms.validUntil,
				canRedelegate: terms.canRedelegate, requireFreshSession: terms.requireFreshSession,
				membershipId: terms.recipientEligibility?.membershipId ?? null,
				membershipGeneration: terms.recipientEligibility?.generation ?? null,
				selectionGroupId: terms.recipientEligibility?.selection?.groupId ?? null,
				selectionVersion: terms.recipientEligibility?.selection?.version ?? null,
				permissionCount: terms.permissions.length,
				permissionDigest: createHash("sha256").update(terms.permissions.map(accessPermissionKey).join("\n")).digest("hex") });
			if (terms.permissions.length) await work.insert(accessRepresentationPermission).values(terms.permissions.map(permission => ({
				grantId: head.id, revision: version, family: permission.family, permission: permission.key,
			})));
			await work.update(accessRepresentationRevision).set({ sealed: true })
				.where(and(eq(accessRepresentationRevision.grantId, head.id), eq(accessRepresentationRevision.revision, version)));
		}
		const resultReceipt = receipt(event);
		const result = await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
			with admission as materialized(select (${admission}) as admitted),changed as (
				update public.access_representation set version=${version},terms_revision=${resultReceipt.termsRevision},state=${resultReceipt.state}
				where id=${head.id}::uuid and version=${head.version} and (select admitted from admission) is true returning id
			) select(select admitted from admission) as admitted,(select id from changed) as changed`);
		requireAdmission(result.rows[0]?.admitted);
		if (!result.rows[0]?.changed) throw new AccessRepresentationConflict();
		return resultReceipt;
	});
}

/**
 * Read one exact private management snapshot without interpreting it as current representation.
 * @internal
 * @remarks Current selection retains the Entity fence; historical selection preserves
 * its exact terms. The caller independently authorizes private management disclosure.
 */
export async function readAccessRepresentationSnapshot(
	tx: DatabaseTransaction, input: { entityId: string; grantId: string; revision: number | "current" },
) {
	z.uuid().parse(input.entityId); z.uuid().parse(input.grantId);
	if (input.revision !== "current") versionSchema.min(1).parse(input.revision);
	if (input.revision === "current") {
		const [fence] = await tx.select({ id: accessRepresentationEntity.entityId }).from(accessRepresentationEntity)
			.where(eq(accessRepresentationEntity.entityId, input.entityId)).for("share");
		if (!fence) throw new AccessRepresentationUnavailable();
	}
	const [head] = await tx.select().from(accessRepresentation)
		.where(and(eq(accessRepresentation.id, input.grantId), eq(accessRepresentation.entityId, input.entityId))).limit(1);
	if (!head) return null;
	const [event] = await tx.select().from(accessRepresentationEvent)
		.where(and(eq(accessRepresentationEvent.grantId, head.id), eq(accessRepresentationEvent.version, input.revision === "current" ? head.version : input.revision))).limit(1);
	if (!event) return null;
	const result = receipt(event);
	const [terms] = await tx.select().from(accessRepresentationRevision)
		.where(and(eq(accessRepresentationRevision.grantId, head.id), eq(accessRepresentationRevision.revision, result.termsRevision), eq(accessRepresentationRevision.sealed, true))).limit(1);
	if (!terms) throw new AccessRepresentationUnavailable();
	const rows = await tx.select().from(accessRepresentationPermission)
		.where(and(eq(accessRepresentationPermission.grantId, head.id), eq(accessRepresentationPermission.revision, terms.revision)))
		.orderBy(accessRepresentationPermission.family, accessRepresentationPermission.permission).limit(AccessPermissionValues.length + 1);
	const permissions = decodeAccessPermissionSnapshot(rows, terms.permissionCount, terms.permissionDigest);
	return { ...head, version: result.version, state: result.state, termsRevision: result.termsRevision, terms, permissions };
}
