import { database, type DatabaseTransaction } from "../database";
import { CredentialAuthorityDenied, CredentialAuthorityUnavailable } from "../auth/credential-authority";
import { AccessDenied, AccessUnavailable, AccessChanged, AccessInputInvalid } from "./http-errors";
import { ManagementAuthorityDenied, ManagementAuthorityUnavailable } from "./management-authority";
import { AccessRoleConflict, AccessRoleAdmissionDenied, AccessRoleAdmissionUnavailable } from "./roles";
import { AccessRoleBindingConflict, AccessRoleBindingAdmissionDenied, AccessRoleBindingUnavailable } from "./role-bindings";
import { AccessGroupConflict, AccessGroupAdmissionDenied, AccessGroupAdmissionUnavailable } from "./groups";
import { AccessMembershipConflict, AccessMembershipAdmissionDenied, AccessMembershipAdmissionUnavailable } from "./memberships";
import { AccessGroupMembershipConflict, AccessGroupMembershipAdmissionDenied, AccessGroupMembershipUnavailable, AccessGroupMembershipBudgetExceeded } from "./group-memberships";
import { AccessRepresentationConflict, AccessRepresentationAdmissionDenied, AccessRepresentationUnavailable } from "./representations";
import { AccessAssignmentCeilingConflict, AccessAssignmentCeilingDenied, AccessAssignmentCeilingUnavailable } from "./assignment-ceilings";
import { IdentityPreferenceConflict, IdentityPreferenceDenied, IdentityPreferenceUnavailable } from "./identity-preferences";
import { AccessPermissionSnapshotUnavailable } from "./permission";
import { AccessSubjectPolicyUnavailable } from "./subject-eligibility";
import { AccessRepresentationBudgetExceeded } from "./representation-reader";
import { AccessRoleBindingBudgetExceeded, AccessRoleBindingDiscoveryChanged } from "./role-binding-permissions";
import { PrivateRecipientSelectorInvalid } from "./recipient-selectors";
import { ConnectedAppConflict, ConnectedAppDenied, ConnectedAppUnavailable } from "../connected-apps/apps";
import { AppCapabilitySnapshotUnavailable } from "../connected-apps/capabilities";
import { sql, type SQL } from "drizzle-orm";

/** Recheck retained owner admission after read waits without collapsing unavailable into denied. @internal */
export async function requireAccessAdmission(tx: DatabaseTransaction, admission: SQL<boolean | null>): Promise<void> {
	const result = (await tx.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted;
	if (result === false) throw new AccessDenied();
	if (result !== true) throw new AccessUnavailable();
}

const denied = [ConnectedAppDenied, CredentialAuthorityDenied, ManagementAuthorityDenied, AccessRoleAdmissionDenied,
	AccessRoleBindingAdmissionDenied, AccessGroupAdmissionDenied, AccessMembershipAdmissionDenied,
	AccessGroupMembershipAdmissionDenied, AccessRepresentationAdmissionDenied, AccessAssignmentCeilingDenied, IdentityPreferenceDenied];
const changed = [ConnectedAppConflict, AccessRoleConflict, AccessRoleBindingConflict, AccessGroupConflict, AccessMembershipConflict,
	AccessGroupMembershipConflict, AccessRepresentationConflict, AccessAssignmentCeilingConflict, IdentityPreferenceConflict];
const unavailable = [ConnectedAppUnavailable, AppCapabilitySnapshotUnavailable, CredentialAuthorityUnavailable, ManagementAuthorityUnavailable, AccessRoleAdmissionUnavailable,
	AccessRoleBindingUnavailable, AccessGroupAdmissionUnavailable, AccessMembershipAdmissionUnavailable, AccessGroupMembershipUnavailable,
	AccessGroupMembershipBudgetExceeded, AccessRepresentationUnavailable, AccessAssignmentCeilingUnavailable, IdentityPreferenceUnavailable,
	AccessPermissionSnapshotUnavailable, AccessSubjectPolicyUnavailable, AccessRepresentationBudgetExceeded, AccessRoleBindingBudgetExceeded];
function retryable(error: unknown): boolean {
	let cause = error;
	for (let depth = 0; depth < 8 && cause && typeof cause === "object"; depth++) {
		if ("code" in cause && (cause.code === "40001" || cause.code === "40P01")) return true;
		cause = "cause" in cause ? cause.cause : null;
	}
	return error instanceof AccessRoleBindingDiscoveryChanged;
}
/**
 * Retry only aborted/discovery-invalidated whole transactions, then present private-safe outcomes.
 * @internal
 * @remarks Expected-version conflicts are not retried with new preconditions.
 * Unknown SQL/integrity/programming failures remain visible to the common error
 * boundary; they are never relabeled as an ordinary denial to pass acceptance.
 */
export async function runAccessTransaction<Result>(work: (tx: DatabaseTransaction) => Promise<Result>): Promise<Result> {
	for (let attempt = 0; attempt < 3; attempt++) {
		try { return await database.transaction(work); }
		catch (error) {
			if (retryable(error)) { if (attempt < 2) continue; throw new AccessUnavailable(); }
			if (denied.some(type => error instanceof type)) throw new AccessDenied();
			if (changed.some(type => error instanceof type)) throw new AccessChanged();
			if (unavailable.some(type => error instanceof type)) throw new AccessUnavailable();
			if (error instanceof PrivateRecipientSelectorInvalid) throw new AccessInputInvalid();
			throw error;
		}
	}
	throw new AccessUnavailable();
}
