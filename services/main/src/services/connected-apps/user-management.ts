import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { PrincipalRequestContext } from "../auth/principal-session";
import type { DatabaseTransaction } from "../database";
import { accessSubject } from "../database/schema/access-identity";
import { oauthClientAuthority } from "../database/schema/oauth-client-authority";
import { connectedUserConnection, connectedUserConsent, connectedUserConsentEvent } from "../database/schema/connected-user-authorization";
import { readPrivateAccountAuthority } from "../authorization/private-account-authority";
import { requireAccessAdmission, runAccessTransaction } from "../authorization/transaction";
import { AccessRecordUnavailable } from "../authorization/http-errors";
import { applyUserConnectionCommand, applyUserConsentCommand, readUserConsentTerms, UserAuthorizationUnavailable } from "./user-authorizations";

const id = z.uuid().toLowerCase();
const mutation = z.strictObject({ operationId: id, expectedVersion: z.number().int().positive().safe() });
const pageSize = 50;

async function ownedConnection(tx: DatabaseTransaction, principalId: string, connectionId: string) {
	const [connection] = await tx.select().from(connectedUserConnection).where(and(
		eq(connectedUserConnection.authUserId, principalId), eq(connectedUserConnection.id, id.parse(connectionId)))).limit(1);
	if (!connection) throw new AccessRecordUnavailable();
	if (connection.state === "draft") throw new UserAuthorizationUnavailable();
	return connection;
}
function presentConsent(value: typeof connectedUserConsent.$inferSelect) {
	if ((value.state !== "active" && value.state !== "revoked") || value.termsRevision === null) throw new UserAuthorizationUnavailable();
	return { id: value.id, version: value.version, state: value.state, termsRevision: value.termsRevision };
}

/** List the account's fixed connections, including disabled clients and disconnected records. @internal */
export async function listOwnConnections(context: PrincipalRequestContext, afterId?: string) {
	return runAccessTransaction(async tx => {
		const owner = await readPrivateAccountAuthority(tx, context, false);
		const rows = await tx.select({ connection: connectedUserConnection, clientId: oauthClientAuthority.clientId,
			principalId: accessSubject.authUserId, entityId: accessSubject.entityId }).from(connectedUserConnection)
			.innerJoin(oauthClientAuthority, eq(oauthClientAuthority.id, connectedUserConnection.clientId))
			.innerJoin(accessSubject, eq(accessSubject.id, connectedUserConnection.subjectId))
			.where(and(eq(connectedUserConnection.authUserId, owner.principalId), afterId ? gt(connectedUserConnection.id, id.parse(afterId)) : undefined))
			.orderBy(connectedUserConnection.id).limit(pageSize + 1);
		const items = rows.slice(0, pageSize).map(row => {
			if (row.connection.state === "draft" || (row.principalId !== null && row.principalId !== owner.principalId) ||
				(row.principalId === null && row.entityId === null)) throw new UserAuthorizationUnavailable();
			return { id: row.connection.id, version: row.connection.version, state: row.connection.state, clientId: row.clientId,
				subject: row.entityId === null ? { kind: "direct" as const } : { kind: "entity" as const, entityId: row.entityId } };
		});
		await requireAccessAdmission(tx, owner.admission);
		return { items, nextAfterId: rows.length > pageSize ? items.at(-1)!.id : null };
	});
}

/** Disconnect is owner-controlled even when its selected Entity or client is no longer eligible. @internal */
export async function disconnectOwnConnection(context: PrincipalRequestContext, connectionId: string, input: z.infer<typeof mutation>) {
	const command = mutation.parse(input);
	return runAccessTransaction(async tx => {
		const owner = await readPrivateAccountAuthority(tx, context, true);
		const connection = await ownedConnection(tx, owner.principalId, connectionId);
		return applyUserConnectionCommand(tx, { ...command, operation: "disconnect", connectionId: connection.id, authUserId: owner.principalId }, owner.admission);
	});
}

/** Page consent heads without loading capability/resource snapshots for each item. @internal */
export async function listOwnConnectionConsents(context: PrincipalRequestContext, connectionId: string, afterId?: string) {
	return runAccessTransaction(async tx => {
		const owner = await readPrivateAccountAuthority(tx, context, false);
		const connection = await ownedConnection(tx, owner.principalId, connectionId);
		const rows = await tx.select().from(connectedUserConsent).where(and(eq(connectedUserConsent.connectionId, connection.id),
			afterId ? gt(connectedUserConsent.id, id.parse(afterId)) : undefined)).orderBy(connectedUserConsent.id).limit(pageSize + 1);
		const items = rows.slice(0, pageSize).map(presentConsent);
		await requireAccessAdmission(tx, owner.admission);
		return { items, nextAfterId: rows.length > pageSize ? items.at(-1)!.id : null };
	});
}

/** Read one approved snapshot; private resource roots are returned only to the server's selector encoder. @internal */
export async function getOwnConnectionConsent(context: PrincipalRequestContext, connectionId: string, consentId: string, revision?: number) {
	return runAccessTransaction(async tx => {
		const owner = await readPrivateAccountAuthority(tx, context, false);
		const connection = await ownedConnection(tx, owner.principalId, connectionId);
		const [consent] = await tx.select().from(connectedUserConsent).where(and(eq(connectedUserConsent.connectionId, connection.id), eq(connectedUserConsent.id, id.parse(consentId)))).limit(1);
		if (!consent) throw new AccessRecordUnavailable();
		const head = presentConsent(consent);
		const terms = await readUserConsentTerms(tx, { consentId: head.id, revision: revision === undefined ? head.termsRevision : z.number().int().positive().safe().parse(revision) });
		if (!terms) throw new AccessRecordUnavailable();
		await requireAccessAdmission(tx, owner.admission);
		return { ...head, terms: { revision: terms.revision, clientTermsRevision: terms.clientTermsRevision,
			validFrom: terms.validFrom.toISOString(), validUntil: terms.validUntil.toISOString(),
			offlineAccess: terms.offlineAccess, entityDisclosure: terms.entityDisclosure, capabilities: terms.capabilities,
			resources: terms.resourceSelection === "all-scopes" ? { kind: "all-scopes" as const }
				: { kind: "selected" as const, values: terms.resources }, representations: terms.representations } };
	});
}

/** Consent withdrawal does not require continued authority over the previously selected resources. @internal */
export async function revokeOwnConnectionConsent(context: PrincipalRequestContext, connectionId: string, consentId: string, input: z.infer<typeof mutation>) {
	const command = mutation.parse(input);
	return runAccessTransaction(async tx => {
		const owner = await readPrivateAccountAuthority(tx, context, true);
		const connection = await ownedConnection(tx, owner.principalId, connectionId);
		const [consent] = await tx.select({ id: connectedUserConsent.id }).from(connectedUserConsent)
			.where(and(eq(connectedUserConsent.connectionId, connection.id), eq(connectedUserConsent.id, id.parse(consentId)))).limit(1);
		if (!consent) throw new AccessRecordUnavailable();
		return applyUserConsentCommand(tx, { ...command, operation: "revoke", connectionId: connection.id, consentId: consent.id,
			authUserId: owner.principalId }, owner.admission);
	});
}

/** Inspect a bounded immutable receipt history without disclosing private principal identifiers. @internal */
export async function listOwnConsentHistory(context: PrincipalRequestContext, connectionId: string, consentId: string, afterVersion?: number) {
	return runAccessTransaction(async tx => {
		const owner = await readPrivateAccountAuthority(tx, context, false);
		const connection = await ownedConnection(tx, owner.principalId, connectionId);
		const [consent] = await tx.select({ id: connectedUserConsent.id }).from(connectedUserConsent)
			.where(and(eq(connectedUserConsent.connectionId, connection.id), eq(connectedUserConsent.id, id.parse(consentId)))).limit(1);
		if (!consent) throw new AccessRecordUnavailable();
		const rows = await tx.select({ operationId: connectedUserConsentEvent.operationId, version: connectedUserConsentEvent.version,
			operation: connectedUserConsentEvent.operation, state: connectedUserConsentEvent.stateAfter, createdAt: connectedUserConsentEvent.createdAt })
			.from(connectedUserConsentEvent).where(and(eq(connectedUserConsentEvent.consentId, consent.id),
				afterVersion === undefined ? undefined : gt(connectedUserConsentEvent.version, z.number().int().nonnegative().safe().parse(afterVersion))))
			.orderBy(connectedUserConsentEvent.version).limit(pageSize + 1);
		const items = rows.slice(0, pageSize).map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
		await requireAccessAdmission(tx, owner.admission);
		return { items, nextAfterVersion: rows.length > pageSize ? items.at(-1)!.version : null };
	});
}
