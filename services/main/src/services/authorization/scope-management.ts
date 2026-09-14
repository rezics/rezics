import type { AccessManagementPermissionValues } from "@rezics/access";
import type { UnitReference } from "@rezics/reference";
import { eq, sql } from "drizzle-orm";
import type { PrincipalRequestContext } from "../auth/principal-session";
import { unitOwnerTable } from "../database/schema/unit-reference-columns";
import { allocateReferenceValue } from "../units/reference-value";
import { allocateAccessScope } from "./identities";
import { readManagementAuthority } from "./management-authority";
import { scopeLifecycleAdmission } from "./scope-policy";
import { runAccessTransaction } from "./transaction";
import { AccessDenied, AccessRecordUnavailable } from "./http-errors";

/** Resolve a disclosed management root; failed admission rolls back provisional mappings. @internal */
export async function resolveManagedScope(context: PrincipalRequestContext, input: {
	target: { kind: "self-account" } | { kind: "platform" } | { kind: "resource"; reference: UnitReference };
	permission: (typeof AccessManagementPermissionValues)[number]; path: string[];
}) {
	return runAccessTransaction(async tx => {
		let scopeId: string;
		if (input.target.kind === "resource") {
			const reference = input.target.reference;
			const table = unitOwnerTable(reference.owner);
			const [row] = await tx.select({ id: table.id }).from(table).where(eq(table.id, reference.id)).for("share");
			if (!row) throw new AccessRecordUnavailable();
			scopeId = await allocateAccessScope(tx, { kind: "resource", referenceValueId: await allocateReferenceValue(tx, reference) });
		} else scopeId = await allocateAccessScope(tx, input.target.kind === "self-account"
			? { kind: "account", id: context.principalId } : { kind: "platform" });
		const lifecycle = await scopeLifecycleAdmission(tx, scopeId, false);
		await readManagementAuthority(tx, { proof: context.credentialProof(), selection: context.selection, scopeId,
			permission: input.permission, path: input.path, apiPermission: "access:read", requireFreshSession: false, mutation: false }, lifecycle);
		const [clock] = (await tx.execute<{ now: string }>(sql`select floor(extract(epoch from clock_timestamp())*1000)::text as now`)).rows;
		if (!clock) throw new Error("Database clock is unavailable");
		return { scopeId, now: Number(clock.now) };
	}).catch(error => {
		// Resolution must not distinguish an undisclosed root from a missing one.
		if (error instanceof AccessDenied) throw new AccessRecordUnavailable();
		throw error;
	});
}
