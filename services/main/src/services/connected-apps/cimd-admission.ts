import { eq } from "drizzle-orm";
import { validateClientIdUrl } from "@better-auth/cimd";
import { AccessPermissionValues } from "@rezics/access";
import { APIError } from "better-auth/api";
import type { DatabaseTransaction } from "../database";
import { oauthClients } from "../database/schema/auth-oauth.generated";
import { oauthClientAuthority } from "../database/schema/oauth-client-authority";
import { connectedAppClient } from "../database/schema/connected-app-client";
import { readOAuthClientPolicy } from "../auth/oauth-client-policy";
import { isApiPermission } from "../auth/api-permissions";
import { allocateAccessScope } from "../authorization/identities";
import { readPlatformWorkload, WorkloadPrincipalDenied, WorkloadPrincipalUnavailable } from "../authorization/workload-principals";
import { AppDefinitionSchema, appCapabilityDigest, type AppCapability } from "./capabilities";
import { applyConnectedAppCommand, ConnectedAppDenied, readConnectedAppDefinition } from "./apps";
import { applyAppClientCommand, AppClientDenied, AppClientUnavailable, readAppClientTerms } from "./clients";
import { readAppClientAdmission } from "./client-admission";

function unsupportedMetadata(): never {
	throw new APIError("BAD_REQUEST", { error: "invalid_client_metadata", error_description: "Client metadata is outside the supported discovery profile" });
}

/**
 * Admit a securely resolved CIMD client to a distinct unreviewed, server-curated App.
 * @internal
 * @remarks Invoke only after the pinned resolver has validated and persisted its
 * metadata. This does not fetch URLs or infer publisher ownership from names,
 * email, software IDs or a supplied App ID. Its transaction is separate from
 * network discovery; the resolver wrapper must finish admission before returning
 * the client for protocol use. Existing disables/revocations are never renewed.
 */
export async function admitResolvedCimdClient(tx: DatabaseTransaction, clientId: string) {
	if (validateClientIdUrl(clientId) !== null || Buffer.byteLength(clientId, "utf8") > 2048) unsupportedMetadata();
	const curator = await readPlatformWorkload(tx, "cimd-registry").catch(error => {
		if (error instanceof WorkloadPrincipalDenied || error instanceof WorkloadPrincipalUnavailable)
			throw new APIError("SERVICE_UNAVAILABLE", { error: "temporarily_unavailable", error_description: "Client admission is temporarily unavailable" });
		throw error;
	});
	const [control] = await tx.select({ id: oauthClientAuthority.id }).from(oauthClientAuthority)
		.where(eq(oauthClientAuthority.clientId, clientId)).for("update");
	if (!control) throw new AppClientUnavailable();
	const protocol = await readOAuthClientPolicy(tx, { clientId });
	if (protocol.discoveryId !== "cimd" || protocol.appReference !== null || protocol.clientCredentialsScopes.length ||
		protocol.grantTypes.includes("client_credentials") || !["none", "private_key_jwt"].includes(protocol.authenticationMethod)) unsupportedMetadata();
	const [metadata] = await tx.select({ name: oauthClients.name, secret: oauthClients.clientSecret }).from(oauthClients).where(eq(oauthClients.id, control.id)).limit(1);
	if (!metadata || metadata.secret !== null) unsupportedMetadata();
	const [binding] = await tx.select().from(connectedAppClient).where(eq(connectedAppClient.clientId, control.id)).limit(1);
	if (binding && (binding.kind !== "user" || binding.workloadPrincipalId !== null)) unsupportedMetadata();
	if (binding && binding.state !== "active") throw new AppClientDenied();
	const scopeId = await allocateAccessScope(tx, { kind: "account", id: curator.principalId });
	const existingApp = binding ? await readConnectedAppDefinition(tx, { appId: binding.appId, revision: "declared" }) : null;
	if (binding && !existingApp) throw new AppClientUnavailable();
	if (existingApp && existingApp.head.scopeId !== scopeId) unsupportedMetadata();
	if (existingApp && (existingApp.head.state !== "active" || existingApp.head.trust === "blocked")) throw new ConnectedAppDenied();
	const capabilities: AppCapability[] = [
		...AccessPermissionValues,
		...protocol.allowedScopes.filter(isApiPermission).map(key => ({ family: "api" as const, key })),
	];
	const parsed = AppDefinitionSchema.safeParse({
		label: metadata.name ?? new URL(clientId).hostname,
		description: existingApp?.definition.description ?? null,
		capabilities, offlineAccess: protocol.allowedScopes.includes("offline_access"), entityDisclosure: true,
	});
	if (!parsed.success) unsupportedMetadata();
	const definition = parsed.data;
	const previous = existingApp?.definition;
	const appId = existingApp?.head.id ?? crypto.randomUUID();
	let appRevision = existingApp?.head.declaredRevision ?? null;
	if (!previous || previous.label !== definition.label || previous.description !== definition.description ||
		previous.offlineAccess !== definition.offlineAccess || previous.entityDisclosure !== definition.entityDisclosure ||
		appCapabilityDigest(previous.capabilities) !== appCapabilityDigest(definition.capabilities)) {
		const common = { appId, scopeId, operationId: crypto.randomUUID(), definition,
			operatorAuthUserId: curator.principalId, authoritySubjectId: curator.subjectId };
		const result = await applyConnectedAppCommand(tx, existingApp
			? { ...common, expectedVersion: existingApp.head.version, operation: "revise" }
			: { ...common, expectedVersion: 0, operation: "create" }, curator.admission);
		appRevision = result.declaredRevision;
	}
	if (appRevision === null) throw new AppClientUnavailable();
	const previousTerms = binding?.termsRevision ? await readAppClientTerms(tx, { clientId: control.id, revision: binding.termsRevision }) : null;
	if (binding && !previousTerms) throw new AppClientUnavailable();
	if (!previousTerms || previousTerms.protocolCredentialEpoch !== protocol.credentialEpoch ||
		previousTerms.offlineAccess !== definition.offlineAccess || previousTerms.entityDisclosure !== definition.entityDisclosure ||
		appCapabilityDigest(previousTerms.capabilities) !== appCapabilityDigest(definition.capabilities)) {
		const common = { clientId: control.id, appId, operationId: crypto.randomUUID(), operatorAuthUserId: curator.principalId,
			authoritySubjectId: curator.subjectId, terms: { appRevision, protocolCredentialEpoch: protocol.credentialEpoch,
				offlineAccess: definition.offlineAccess, entityDisclosure: definition.entityDisclosure, capabilities: definition.capabilities } };
		await applyAppClientCommand(tx, binding ? { ...common, operation: "revise", expectedVersion: binding.version }
			: { ...common, operation: "admit", expectedVersion: 0, usage: { kind: "user" } }, curator.admission);
	}
	return readAppClientAdmission(tx, { clientId });
}
