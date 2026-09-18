import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { accessPermissionCeilingCovers, scopeCovers, type AccessPermission, type RequestedAuthoritySelection } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { users } from "@rezics/schema/postgres/identity/auth";
import { accessSubject } from "@rezics/schema/postgres/access/access-identity";
import { connectedUserConnection, connectedUserConsent } from "@rezics/schema/postgres/integrations/connected-user-authorization";
import { resolveAccessSubject } from "../authorization/identities";
import { readAccessSubjectEligibility } from "../authorization/subject-eligibility";
import { AuthorityOperationSchema } from "../authorization/authority-context";
import { evaluateCurrentRepresentationAuthority } from "../authorization/representation-authority";
import { ApiPermissionValues, type ApiPermission } from "@rezics/schema/contracts/native/api-permissions";
import { readAppClientAdmission } from "./client-admission";
import type { AppCapability } from "./capabilities";
import { readUserConsentTerms, UserAuthorizationDenied, UserAuthorizationUnavailable } from "./user-authorizations";

/**
 * Capture live consent, fixed subject and client limits without consulting defaults.
 * @internal
 * @remarks This does not authenticate a token or prove representation for an
 * operation. Only the actual private credential owner is compared with principalId;
 * an external pairwise subject must never be used as that database identifier.
 */
export async function readUserConsentAdmission(tx: DatabaseTransaction, input: {
	consentId: string; clientId: string; principalId: string; termsRevision?: number;
	protocolCredentialEpoch?: number; clientCredentialEpoch?: number; clientTermsRevision?: number; appAuthorityEpoch?: number;
}) {
	const version = z.number().int().nonnegative().safe();
	const request = z.strictObject({ consentId: z.uuid().toLowerCase(), clientId: z.string().min(1), principalId: z.uuid().toLowerCase(),
		termsRevision: version.min(1).optional(), protocolCredentialEpoch: version.optional(), clientCredentialEpoch: version.optional(),
		clientTermsRevision: version.min(1).optional(), appAuthorityEpoch: version.optional() }).parse(input);
	const client = await readAppClientAdmission(tx, { clientId: request.clientId, protocolCredentialEpoch: request.protocolCredentialEpoch,
		clientCredentialEpoch: request.clientCredentialEpoch, clientTermsRevision: request.clientTermsRevision, appAuthorityEpoch: request.appAuthorityEpoch });
	if (client.client.kind !== "user") throw new UserAuthorizationDenied();
	const [owner] = await tx.select({ kind: users.principalKind, erasedAt: users.erasedAt }).from(users).where(eq(users.id, request.principalId)).for("share");
	if (!owner || owner.kind !== "human" || owner.erasedAt !== null) throw new UserAuthorizationDenied();
	const [consent] = await tx.select().from(connectedUserConsent).where(eq(connectedUserConsent.id, request.consentId)).limit(1);
	if (!consent || consent.clientId !== client.protocol.id || consent.state !== "active" || consent.termsRevision === null ||
		(request.termsRevision !== undefined && request.termsRevision !== consent.termsRevision)) throw new UserAuthorizationDenied();
	const [connection] = await tx.select().from(connectedUserConnection).where(eq(connectedUserConnection.id, consent.connectionId)).limit(1);
	if (!connection || connection.authUserId !== request.principalId || connection.clientId !== consent.clientId || connection.state !== "active") throw new UserAuthorizationDenied();
	const terms = await readUserConsentTerms(tx, { consentId: consent.id, revision: consent.termsRevision });
	if (!terms || terms.clientId !== client.protocol.id) throw new UserAuthorizationUnavailable();
	const subject = await resolveAccessSubject(tx, connection.subjectId);
	const [principal] = await tx.select({ id: accessSubject.id }).from(accessSubject).where(eq(accessSubject.authUserId, request.principalId)).limit(1);
	if (!subject || !principal) throw new UserAuthorizationUnavailable();
	if (subject.kind === "principal" && (subject.id !== request.principalId || terms.representations.length || terms.entityDisclosure)) throw new UserAuthorizationUnavailable();
	if (subject.kind === "entity" && !terms.representations.length) throw new UserAuthorizationUnavailable();
	const selection: RequestedAuthoritySelection = subject.kind === "principal" ? { mode: "direct" }
		: { mode: "represented", entityId: subject.id, representations: terms.representations };
	const eligibility = await readAccessSubjectEligibility(tx, { subjectIds: [...new Set([principal.id, connection.subjectId])], action: "read" });
	if (eligibility.some(value => value.outcome === "deny")) throw new UserAuthorizationDenied();
	if (eligibility.some(value => value.outcome !== "allow")) throw new UserAuthorizationUnavailable();
	const time = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]?.now;
	const now = new Date(time ?? "invalid").getTime();
	if (![now, terms.validFrom.getTime(), terms.validUntil.getTime()].every(Number.isFinite)) throw new UserAuthorizationUnavailable();
	if (terms.validFrom.getTime() > now || terms.validUntil.getTime() <= now) throw new UserAuthorizationDenied();
	const admission = sql<boolean>`(${client.admission}) and exists(select 1 from public.connected_user_connection
		where id=${connection.id}::uuid and auth_user_id=${request.principalId}::uuid and version=${connection.version} and state='active')
		and exists(select 1 from public.connected_user_consent where id=${consent.id}::uuid and version=${consent.version} and terms_revision=${terms.revision} and state='active')
		and public.access_subject_is_eligible(${principal.id}::uuid,'read') is true
		and public.access_subject_is_eligible(${connection.subjectId}::uuid,'read') is true
		and clock_timestamp()>=${terms.validFrom}::timestamptz and clock_timestamp()<${terms.validUntil}::timestamptz`;
	const current = (await tx.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted;
	if (current === false) throw new UserAuthorizationDenied();
	if (current !== true) throw new UserAuthorizationUnavailable();
	return { principalId: request.principalId, principalSubjectId: principal.id, subjectId: connection.subjectId, subject, selection,
		connection, consent, terms, client, admission };
}

function domainCapabilities(values: readonly AppCapability[]): AccessPermission[] {
	return values.filter((value): value is AccessPermission => value.family !== "api");
}

/**
 * Apply consent/client resource and action ceilings while retaining one selected authority subject.
 * @internal
 * @remarks The owner separately proves that this subject currently has the actual
 * resource permissions and passes all restrictions. Principal rights are not
 * imported into represented mode. OAuth credentials never satisfy fresh-session
 * representation requirements merely because their grant once used a session.
 */
export async function readUserConsentOperationAuthority(tx: DatabaseTransaction,
	admitted: Awaited<ReturnType<typeof readUserConsentAdmission>>,
	input: { operation: z.infer<typeof AuthorityOperationSchema>; apiPermission: ApiPermission; action: "read" | "write" | "contribute" },
) {
	const request = z.strictObject({ operation: AuthorityOperationSchema, apiPermission: z.enum(ApiPermissionValues), action: z.enum(["read", "write", "contribute"]) }).parse(input);
	for (const ceiling of [admitted.terms.capabilities, admitted.client.terms.capabilities]) {
		if (!ceiling.some(value => value.family === "api" && value.key === request.apiPermission) ||
			!accessPermissionCeilingCovers([request.operation.permission], domainCapabilities(ceiling))) throw new UserAuthorizationDenied();
	}
	if (admitted.terms.resourceSelection === "selected" && !admitted.terms.resources.some(value => value.scopeId === request.operation.scopeId && scopeCovers(value.path, request.operation.path)))
		throw new UserAuthorizationDenied();
	const facts = await readAccessSubjectEligibility(tx, { subjectIds: [...new Set([admitted.principalSubjectId, admitted.subjectId])], action: request.action });
	if (facts.some(value => value.outcome === "deny")) throw new UserAuthorizationDenied();
	if (facts.some(value => value.outcome !== "allow")) throw new UserAuthorizationUnavailable();
	const represented = admitted.selection.mode === "represented" ? await evaluateCurrentRepresentationAuthority(tx, {
		principalId: admitted.principalId, selection: admitted.selection, operation: request.operation,
		action: request.action, freshSession: false, freshSessionValidUntil: null,
	}) : null;
	if (represented?.outcome === "deny") throw new UserAuthorizationDenied();
	if (represented?.outcome === "unavailable") throw new UserAuthorizationUnavailable();
	const deadlines = [admitted.terms.validUntil.getTime(), represented?.validUntil, ...facts.map(value => value.validUntil)].filter((value): value is number => typeof value === "number");
	const validUntil = Math.min(...deadlines);
	const representation = admitted.selection.mode === "represented" && represented?.outcome === "allow"
		? sql<boolean>`public.access_representation_path_is_current(
			array[${sql.join(represented.path.map(value => sql`${value.id}::uuid`), sql`, `)}],
			array[${sql.join(represented.path.map(value => sql`${value.revision}::bigint`), sql`, `)}],
			${admitted.principalSubjectId}::uuid,${admitted.selection.entityId}::uuid,${request.action}) is true` : sql<boolean>`true`;
	const admission = sql<boolean>`(${admitted.admission}) and (${representation}) and clock_timestamp()<${new Date(validUntil)}::timestamptz
		and public.access_subject_is_eligible(${admitted.principalSubjectId}::uuid,${request.action}) is true
		and public.access_subject_is_eligible(${admitted.subjectId}::uuid,${request.action}) is true`;
	const result = (await tx.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`)).rows[0]?.admitted;
	if (result === false) throw new UserAuthorizationDenied();
	if (result !== true) throw new UserAuthorizationUnavailable();
	return { subject: admitted.subject, subjectId: admitted.subjectId, selection: admitted.selection, validUntil, admission };
}
