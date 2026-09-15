import { and, eq, isNull, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../../database";
import { users } from "../../database/schema/auth";
import { workloadPrincipal } from "../../database/schema/workload-principal";
import { allocateAccessScope, allocateAccessSubject } from "../../authorization/identities";
import { applyWorkloadPrincipalCommand, PlatformWorkloadDefinitions } from "../../authorization/workload-principals";

/**
 * Provision stable private system actors inside the privileged installation transaction.
 * @internal
 * @remarks The installer owns target protection and provisioning authority. This
 * is not an HTTP admission path. Existing suspension/revocation is retained;
 * rerunning installation never renews a system actor or creates login credentials.
 */
export async function ensurePlatformWorkloads(tx: DatabaseTransaction, operatorAuthUserId: string) {
	const [operator] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, operatorAuthUserId),
		eq(users.principalKind, "human"), isNull(users.erasedAt))).for("share");
	if (!operator) throw new Error("Platform workload provisioning requires an available installation operator");
	const scopeId = await allocateAccessScope(tx, { kind: "platform" });
	const authoritySubjectId = await allocateAccessSubject(tx, { kind: "principal", id: operatorAuthUserId });
	const admission = sql<boolean>`exists(select 1 from public.users where id=${operatorAuthUserId}::uuid and principal_kind='human' and erased_at is null)`;
	for (const [key, label] of Object.entries(PlatformWorkloadDefinitions)) {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`platform-workload:${key}`}::text,0))`);
		const [existing] = await tx.select().from(workloadPrincipal).where(eq(workloadPrincipal.systemKey, key)).limit(1);
		if (existing) {
			if (existing.purpose !== "system" || existing.ownerScopeId !== scopeId || existing.version < 1)
				throw new Error("Platform workload identity does not match its provisioned duty");
			await allocateAccessSubject(tx, { kind: "principal", id: existing.authUserId });
			continue;
		}
		const principalId = crypto.randomUUID();
		await tx.insert(users).values({ id: principalId, principalKind: "service", name: "", email: `system-${key}-${principalId}@principal.invalid`, emailVerified: false });
		await applyWorkloadPrincipalCommand(tx, { principalId, ownerScopeId: scopeId, operation: "create", expectedVersion: 0,
			operationId: crypto.randomUUID(), operatorAuthUserId, authoritySubjectId, label, purpose: { kind: "system", key } }, admission);
	}
}
