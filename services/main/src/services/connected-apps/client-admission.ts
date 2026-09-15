import { eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { users } from "../database/schema/auth";
import { entityIdentity } from "../database/schema/catalog-identity";
import { entityParticipation } from "../database/schema/participation";
import { accessSubject } from "../database/schema/access-identity";
import { connectedApp } from "../database/schema/connected-app";
import { connectedAppClient } from "../database/schema/connected-app-client";
import { workloadPrincipal } from "../database/schema/workload-principal";
import { connectedInstallation } from "../database/schema/connected-installation";
import { resolveAccessScope } from "../authorization/identities";
import { resolveReferenceValue } from "../units/reference-value";
import { readAccessSubjectEligibility } from "../authorization/subject-eligibility";
import { readOAuthClientPolicy } from "../auth/oauth-client-policy";
import { AppClientDenied, AppClientUnavailable, readAppClientTerms } from "./clients";
import { readInstallationApproval } from "./installations";

async function subjectAdmission(tx: DatabaseTransaction, principalId: string) {
	const [subject] = await tx.select({ id: accessSubject.id }).from(accessSubject).where(eq(accessSubject.authUserId, principalId)).limit(1);
	if (!subject) throw new AppClientUnavailable();
	const [eligible] = await readAccessSubjectEligibility(tx, { subjectIds: [subject.id], action: "read" });
	if (eligible?.outcome === "deny") throw new AppClientDenied();
	if (eligible?.outcome !== "allow") throw new AppClientUnavailable();
	return sql<boolean>`public.access_subject_is_eligible(${subject.id}::uuid,'read') is true`;
}

async function appOwnerAdmission(tx: DatabaseTransaction, scopeId: string): Promise<SQL<boolean | null>> {
	const scope = await resolveAccessScope(tx, scopeId);
	if (!scope || scope.kind === "platform") throw new AppClientUnavailable();
	if (scope.kind === "account") {
		const [owner] = await tx.select({ kind: users.principalKind, erasedAt: users.erasedAt }).from(users).where(eq(users.id, scope.id)).for("share");
		if (!owner || owner.erasedAt !== null) throw new AppClientDenied();
		if (owner.kind === "service") {
			const [workload] = await tx.select({ purpose: workloadPrincipal.purpose }).from(workloadPrincipal).where(eq(workloadPrincipal.authUserId, scope.id)).limit(1);
			if (workload?.purpose !== "system") throw new AppClientUnavailable();
			return subjectAdmission(tx, scope.id);
		}
		return sql<boolean>`public.access_principal_account_is_eligible(${scope.id}::uuid,'read') is true`;
	}
	const reference = await resolveReferenceValue(tx, scope.referenceValueId);
	if (reference?.owner !== "entity") throw new AppClientUnavailable();
	const [owner] = await tx.select({ deletedAt: entityIdentity.deletedAt }).from(entityIdentity).where(eq(entityIdentity.id, reference.id)).for("share");
	const [participation] = await tx.select({ state: entityParticipation.state }).from(entityParticipation).where(eq(entityParticipation.entityId, reference.id)).limit(1);
	if (!owner || owner.deletedAt !== null || participation?.state !== "active") throw new AppClientDenied();
	return sql<boolean>`exists(select 1 from public.entity_identity e join public.entity_participation p on p.entity_id=e.id
		where e.id=${reference.id}::uuid and e.deleted_at is null and p.state='active')`;
}

/**
 * Read current App/client admission with optional exact credential-context preconditions.
 * @internal
 * @remarks Protocol authentication, user consent, current resource bindings and
 * attribution, credential expiry/quota and operation-specific authority remain mandatory. This
 * reader never chooses a workload from request data: it follows the immutable binding.
 * Retain the transaction and use its predicate at later protected effects.
 */
export async function readAppClientAdmission(tx: DatabaseTransaction, input: {
	clientId: string; protocolCredentialEpoch?: number; clientCredentialEpoch?: number;
	clientTermsRevision?: number; appAuthorityEpoch?: number; workloadCredentialEpoch?: number;
	installationId?: string; installationCredentialEpoch?: number; installationApprovalRevision?: number;
}) {
	const revision = z.number().int().nonnegative().safe();
	const request = z.strictObject({ clientId: z.string().min(1).refine(value => Buffer.byteLength(value, "utf8") <= 2048),
		protocolCredentialEpoch: revision.optional(), clientCredentialEpoch: revision.optional(), clientTermsRevision: revision.min(1).optional(),
		appAuthorityEpoch: revision.optional(), workloadCredentialEpoch: revision.optional(), installationId: z.uuid().toLowerCase().optional(),
		installationCredentialEpoch: revision.optional(), installationApprovalRevision: revision.min(1).optional() }).parse(input);
	const protocol = await readOAuthClientPolicy(tx, { clientId: request.clientId, credentialEpoch: request.protocolCredentialEpoch });
	const [head] = await tx.select().from(connectedAppClient).where(eq(connectedAppClient.clientId, protocol.id)).limit(1);
	if (!head || head.state !== "active" || head.termsRevision === null ||
		(request.clientCredentialEpoch !== undefined && request.clientCredentialEpoch !== head.credentialEpoch) ||
		(request.clientTermsRevision !== undefined && request.clientTermsRevision !== head.termsRevision)) throw new AppClientDenied();
	const terms = await readAppClientTerms(tx, { clientId: head.clientId, revision: head.termsRevision });
	if (!terms || terms.appId !== head.appId) throw new AppClientUnavailable();
	if (terms.protocolCredentialEpoch !== protocol.credentialEpoch) throw new AppClientDenied();
	const [app] = await tx.select().from(connectedApp).where(eq(connectedApp.id, head.appId)).for("share");
	if (!app || app.state !== "active" || app.trust === "blocked" ||
		(request.appAuthorityEpoch !== undefined && request.appAuthorityEpoch !== app.authorityEpoch)) throw new AppClientDenied();
	const owner = await appOwnerAdmission(tx, app.scopeId);
	let workload: typeof workloadPrincipal.$inferSelect | null = null;
	let installation: typeof connectedInstallation.$inferSelect | null = null;
	let installationApproval: Awaited<ReturnType<typeof readInstallationApproval>> = null;
	let workloadAdmission = sql<boolean>`true`;
	if (head.kind === "installation") {
		if (!head.workloadPrincipalId) throw new AppClientUnavailable();
		const [account] = await tx.select({ id: users.id }).from(users).where(eq(users.id, head.workloadPrincipalId)).for("share");
		if (!account) throw new AppClientDenied();
		const [value] = await tx.select().from(workloadPrincipal).where(eq(workloadPrincipal.authUserId, head.workloadPrincipalId)).limit(1);
		if (!value || value.purpose !== "installation" || value.state !== "active" ||
			(request.workloadCredentialEpoch !== undefined && request.workloadCredentialEpoch !== value.credentialEpoch)) throw new AppClientDenied();
		workload = value;
		const [instance] = await tx.select().from(connectedInstallation).where(eq(connectedInstallation.workloadPrincipalId, value.authUserId)).limit(1);
		if (!instance || instance.appId !== app.id || instance.ownerScopeId !== value.ownerScopeId || instance.state !== "active" || instance.approvedRevision === null ||
			(request.installationId !== undefined && request.installationId !== instance.id) ||
			(request.installationCredentialEpoch !== undefined && request.installationCredentialEpoch !== instance.credentialEpoch) ||
			(request.installationApprovalRevision !== undefined && request.installationApprovalRevision !== instance.approvedRevision)) throw new AppClientDenied();
		installation = instance;
		installationApproval = await readInstallationApproval(tx, { installationId: instance.id, revision: instance.approvedRevision });
		if (!installationApproval || installationApproval.appId !== app.id) throw new AppClientUnavailable();
		const eligible = await subjectAdmission(tx, value.authUserId);
		workloadAdmission = sql<boolean>`(${eligible}) and exists(select 1 from public.workload_principal
			where auth_user_id=${value.authUserId}::uuid and version=${value.version} and credential_epoch=${value.credentialEpoch} and state='active' and purpose='installation')
			and exists(select 1 from public.connected_installation where id=${instance.id}::uuid and version=${instance.version}
			 and approved_revision=${instance.approvedRevision} and credential_epoch=${instance.credentialEpoch} and state='active')
			and public.connected_installation_is_eligible(${instance.id}::uuid) is true`;
	} else if (request.workloadCredentialEpoch !== undefined || request.installationId !== undefined || request.installationCredentialEpoch !== undefined || request.installationApprovalRevision !== undefined) throw new AppClientDenied();
	const admission = sql<boolean>`(${protocol.admission}) and (${owner}) and (${workloadAdmission})
		and exists(select 1 from public.connected_app_client where client_id=${head.clientId}::uuid and app_id=${head.appId}::uuid
		 and version=${head.version} and terms_revision=${terms.revision} and credential_epoch=${head.credentialEpoch} and state='active')
		and public.connected_app_client_terms_match_protocol(${head.clientId}::uuid,${terms.revision}::bigint) is true
		and exists(select 1 from public.connected_app where id=${app.id}::uuid and authority_epoch=${app.authorityEpoch} and state='active' and trust<>'blocked')`;
	const admitted = (await tx.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted;
	if (admitted === false) throw new AppClientDenied();
	if (admitted !== true) throw new AppClientUnavailable();
	return { protocol, client: head, app, terms, workload, installation, installationApproval, admission };
}
