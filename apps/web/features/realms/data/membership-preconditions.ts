import type { GetRealmMembershipStatus200 } from "@rezics/openapi-tanstack-query";
/** One operation retains its identity, consent and optimistic head preconditions across submission. */
export function realmMembershipPreconditions(
	status: GetRealmMembershipStatus200,
	operationId = crypto.randomUUID(),
) {
	return {
		operationId,
		expectedControlRevision: status.controlRevision,
		expectedRevision: status.receipt?.revision ?? 0,
		expectedMembershipVersion: status.receipt?.version ?? 0,
		expectedEnforcementRevision: status.receipt?.enforcementRevision ?? 0,
	};
}
