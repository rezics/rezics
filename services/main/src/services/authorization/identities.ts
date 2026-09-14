import type { AccessScopeTarget, AccessSubjectTarget } from "@rezics/access";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { accessScope, accessSubject } from "../database/schema/access-identity";
import { allocateImmutableReference } from "../units/immutable-reference";

const subjectTargetSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("principal"), id: z.uuid() }),
	z.strictObject({ kind: z.literal("entity"), id: z.uuid() }),
]);
const scopeTargetSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("platform") }),
	z.strictObject({ kind: z.literal("account"), id: z.uuid() }),
	z.strictObject({ kind: z.literal("resource"), referenceValueId: z.uuid() }),
]);

/**
 * Allocate a private subject inside an already authorized, bounded owner transaction.
 * @internal
 * @remarks The concrete FK proves identity, not eligibility, representation or
 * permission. Never expose this primitive as an existence or recipient-selection API.
 * Concurrent READ COMMITTED admission reuses the winner; stronger isolation errors
 * propagate for whole-command retry. Existing values are never rewritten.
 */
export async function allocateAccessSubject(
	tx: DatabaseTransaction,
	input: AccessSubjectTarget,
): Promise<string> {
	const target = subjectTargetSchema.parse(input);
	const column = target.kind === "principal" ? accessSubject.authUserId : accessSubject.entityId;
	return allocateImmutableReference(
		async () => {
			const [row] = await tx
				.select({ id: accessSubject.id })
				.from(accessSubject)
				.where(eq(column, target.id))
				.limit(1);
			return row?.id;
		},
		async () => {
			const [row] = await tx
				.insert(accessSubject)
				.values(target.kind === "principal" ? { authUserId: target.id } : { entityId: target.id })
				.onConflictDoNothing({ target: column, where: sql`${column} is not null` })
				.returning({ id: accessSubject.id });
			return row?.id;
		},
	);
}

/** Decode a private identity only; every consumer still enforces current eligibility and disclosure. @internal */
export async function resolveAccessSubject(
	tx: DatabaseTransaction,
	id: string,
): Promise<AccessSubjectTarget | null> {
	z.uuid().parse(id);
	const [row] = await tx.select().from(accessSubject).where(eq(accessSubject.id, id)).limit(1);
	if (!row) return null;
	return subjectTargetSchema.parse(
		row.authUserId !== null
			? { kind: "principal", id: row.authUserId }
			: { kind: "entity", id: row.entityId },
	);
}

/**
 * Allocate an authority root within an already authorized owner transaction.
 * @internal
 * @remarks All public roots, including Org/Entity and Realm, use the same canonical
 * Unit REF. Account and platform roots never fabricate public resource identities.
 * Callers separately validate structural capability, current policy and disclosure.
 */
export async function allocateAccessScope(
	tx: DatabaseTransaction,
	input: AccessScopeTarget,
): Promise<string> {
	const target = scopeTargetSchema.parse(input);
	const column =
		target.kind === "platform"
			? accessScope.platformRoot
			: target.kind === "account"
				? accessScope.authUserId
				: accessScope.unitRef;
	const value =
		target.kind === "platform"
			? "platform"
			: target.kind === "account"
				? target.id
				: target.referenceValueId;
	const values =
		target.kind === "platform"
			? { platformRoot: "platform" as const }
			: target.kind === "account"
				? { authUserId: target.id }
				: { unitRef: target.referenceValueId };
	return allocateImmutableReference(
		async () => {
			const [row] = await tx
				.select({ id: accessScope.id })
				.from(accessScope)
				.where(eq(column, value))
				.limit(1);
			return row?.id;
		},
		async () => {
			const [row] = await tx
				.insert(accessScope)
				.values(values)
				.onConflictDoNothing({ target: column, where: sql`${column} is not null` })
				.returning({ id: accessScope.id });
			return row?.id;
		},
	);
}

/** Resolve a private authority root; its existence is not a current authorization decision. @internal */
export async function resolveAccessScope(
	tx: DatabaseTransaction,
	id: string,
): Promise<AccessScopeTarget | null> {
	z.uuid().parse(id);
	const [row] = await tx.select().from(accessScope).where(eq(accessScope.id, id)).limit(1);
	if (!row) return null;
	return scopeTargetSchema.parse(
		row.platformRoot !== null
			? { kind: "platform" }
			: row.authUserId !== null
				? { kind: "account", id: row.authUserId }
				: { kind: "resource", referenceValueId: row.unitRef },
	);
}
