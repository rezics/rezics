import { AsyncLocalStorage } from "node:async_hooks";
import { createCimdClientDiscovery } from "@better-auth/cimd";
import type { ClientDiscovery } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import type { SQL } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { admitResolvedCimdClient } from "../connected-apps/cimd-admission";
import { readAppClientAdmission } from "../connected-apps/client-admission";
import { requireAccessAdmission, runAccessTransaction } from "../authorization/transaction";
import { AccessChanged, AccessDenied, AccessUnavailable } from "../authorization/http-errors";
import { rethrowOAuthClientProfileError, OAuthClientPolicyDenied, OAuthClientPolicyUnavailable } from "./oauth-client-policy";
import { AppClientDenied, AppClientUnavailable } from "../connected-apps/clients";
import { ConnectedAppDenied } from "../connected-apps/apps";
import { AccessSubjectPolicyUnavailable } from "../authorization/subject-eligibility";
import { AppCapabilitySnapshotUnavailable } from "../connected-apps/capabilities";
import { admitCimdFleetFetch } from "./cimd-fetch-budget";
import { createCimdResourceFetch, type CimdTransportOptions } from "./cimd-transport";

const frozenLookups = new AsyncLocalStorage<{ tx: DatabaseTransaction; admissions: ReadonlyMap<string, SQL<boolean | null>> }>();
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
	return new Promise((resolve, reject) => {
		const abort = () => reject(signal.reason);
		signal.addEventListener("abort", abort, { once: true });
		work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
		if (signal.aborted) abort();
	});
}
function fetchUnavailable() {
	return new APIError("TOO_MANY_REQUESTS", { error: "temporarily_unavailable", error_description: "Client discovery fetch capacity is unavailable" }, { "Retry-After": "1" });
}

/**
 * Hold native client fences while protocol code uses already admitted metadata.
 * @internal
 * @remarks New authorization/issuance callers prepare discovery before entering
 * this transaction. Resource-token validation may use current native admission
 * directly. This prevents network metadata refresh and its process cache from
 * becoming part of a transaction that could later roll back. It authenticates
 * no credential and supplies no consent, installation or resource permission.
 */
export async function withFrozenCimdClients<T>(tx: DatabaseTransaction, clientIds: readonly string[], work: () => Promise<T>): Promise<T> {
	if (clientIds.length > 4) throw new AccessUnavailable();
	const selected = [...new Set(clientIds)].sort();
	const admissions = new Map<string, SQL<boolean | null>>();
	for (const clientId of selected) admissions.set(clientId, (await readAppClientAdmission(tx, { clientId })).admission);
	return frozenLookups.run({ tx, admissions }, work);
}

/**
 * Compose secure CIMD discovery with mandatory native App/client admission.
 * @internal
 * @remarks One qualified transport is shared by metadata and JWKS. Options can
 * narrow its limits or supply an isolated resolver/trust root; neither admission
 * nor the network policy can be replaced with an arbitrary fetch implementation.
 * Best-effort plugin notifications are deliberately not used as authority. No
 * factory default can silently omit fleet admission or replace the transport.
 */
export function createAdmittedCimdDiscovery(options: CimdTransportOptions = {}): ClientDiscovery {
	const secureFetch = createCimdResourceFetch(options);
	const maximum = options.maximumConcurrentRequests ?? 16;
	let activeAdmissions = 0;
	const discovery = createCimdClientDiscovery({
		metadataProfile: "mcp-2026-07-28",
		fetchClientMetadataResource: async (resource, requestOptions) => {
			if (activeAdmissions >= maximum) throw fetchUnavailable();
			activeAdmissions++;
			const controller = new AbortController();
			const inherited = requestOptions?.signal ?? (resource instanceof Request ? resource.signal : undefined);
			const abort = () => controller.abort(inherited?.reason);
			inherited?.addEventListener("abort", abort, { once: true });
			if (inherited?.aborted) abort();
			const timer = setTimeout(() => controller.abort(fetchUnavailable()), options.timeoutMs ?? 5_000);
			let budget: Promise<void> | undefined;
			try {
				const url = new URL(typeof resource === "string" ? resource : resource instanceof URL ? resource.href : resource.url);
				if (controller.signal.aborted) throw controller.signal.reason;
				budget = admitCimdFleetFetch(url);
				await abortable(budget, controller.signal);
				return await secureFetch(resource, { ...requestOptions, signal: controller.signal });
			} finally {
				clearTimeout(timer);
				inherited?.removeEventListener("abort", abort);
				// A timed-out pool acquisition remains bounded until it actually settles.
				if (budget) void budget.then(() => { activeAdmissions--; }, () => { activeAdmissions--; });
				else activeAdmissions--;
			}
		},
	});
	return {
		...discovery,
		async resolve(context, clientId, existing) {
			try {
				const frozen = frozenLookups.getStore();
				if (frozen) {
					const admission = frozen.admissions.get(clientId);
					if (!admission || !existing || existing.clientId !== clientId || existing.clientDiscoveryId !== discovery.id)
						throw new APIError("BAD_REQUEST", { error: "invalid_client", error_description: "Client is not admitted for this request" });
					await requireAccessAdmission(frozen.tx, admission);
					return existing;
				}
				const resolved = await discovery.resolve(context, clientId, existing);
				if (!resolved) return null;
				await runAccessTransaction(tx => admitResolvedCimdClient(tx, clientId));
				return resolved;
			} catch (error) {
				if (error instanceof AccessDenied || error instanceof AppClientDenied || error instanceof OAuthClientPolicyDenied || error instanceof ConnectedAppDenied)
					throw new APIError("BAD_REQUEST", { error: "invalid_client", error_description: "Client is not currently admitted" });
				if (error instanceof AccessUnavailable || error instanceof AccessChanged || error instanceof AppClientUnavailable ||
					error instanceof OAuthClientPolicyUnavailable || error instanceof AccessSubjectPolicyUnavailable || error instanceof AppCapabilitySnapshotUnavailable)
					throw new APIError("SERVICE_UNAVAILABLE", { error: "temporarily_unavailable", error_description: "Client admission is temporarily unavailable" });
				rethrowOAuthClientProfileError(error);
			}
		},
	};
}
