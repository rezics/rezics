import Elysia from "elysia";
import { z } from "zod";
import principalSession from "../../auth/principal-session";
import { env } from "../../config";
import { createScopeSelectors } from "../../authorization/scope-selectors";
import { AppCapabilitySchema, MaximumAppCapabilities } from "../../connected-apps/capabilities";
import { disconnectOwnConnection, getOwnConnectionConsent, listOwnConnectionConsents, listOwnConnections,
	listOwnConsentHistory, revokeOwnConnectionConsent } from "../../connected-apps/user-management";

const id = z.uuid().toLowerCase();
const version = z.number().int().positive().safe();
const page = z.strictObject({ afterId: id.optional() });
const connectionParams = z.strictObject({ connectionId: id });
const consentParams = connectionParams.extend({ consentId: id });
const mutation = z.strictObject({ operationId: id, expectedVersion: version });
const consentHead = z.strictObject({ id, version, state: z.enum(["active", "revoked"]), termsRevision: version });
const selectedResources = z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("all-scopes") }),
	z.strictObject({ kind: z.literal("selected"), values: z.array(z.strictObject({ scope: z.string(), path: z.array(z.string()).max(8) })).min(1).max(64) })]);
const consent = consentHead.extend({ terms: z.strictObject({ revision: version, clientTermsRevision: version,
	validFrom: z.iso.datetime(), validUntil: z.iso.datetime(), offlineAccess: z.boolean(), entityDisclosure: z.boolean(),
	capabilities: z.array(AppCapabilitySchema).max(MaximumAppCapabilities), resources: selectedResources,
	representations: z.array(z.strictObject({ id, revision: version })).max(8) }) });
const connection = z.strictObject({ id, version, state: z.enum(["active", "disconnected"]), clientId: z.string(),
	subject: z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("direct") }), z.strictObject({ kind: z.literal("entity"), entityId: id })]) });
const selectors = createScopeSelectors(env.BETTER_AUTH_SECRET);
const read = { permission: "account:read", fresh: false, write: false } as const;
const withdraw = { permission: "account:update", fresh: false, write: true } as const;

/** Private user connection inspection and withdrawal, independent from App management. @alpha */
export default new Elysia({ prefix: "/connections", name: "private-connections-api" }).use(principalSession)
	.get("", {
		principalAccess: read, query: page, response: z.strictObject({ items: z.array(connection).max(50), nextAfterId: id.nullable() }),
		detail: { operationId: "listOwnAppConnections", tags: ["Account"], description: "List your fixed client connections, including disconnected connections. The selected subject does not follow your current default identity." },
	}, ({ principalContext, query }) => listOwnConnections(principalContext, query.afterId))
	.post("/:connectionId/disconnect", {
		principalAccess: withdraw, params: connectionParams, body: mutation,
		response: z.strictObject({ connectionId: id, operationId: id, version, state: z.enum(["active", "disconnected"]) }),
		detail: { operationId: "disconnectOwnAppConnection", tags: ["Account"], description: "End future use of this connection and its consents. Existing content keeps its attribution. Retrying the same operation returns the original receipt." },
	}, ({ principalContext, params, body }) => disconnectOwnConnection(principalContext, params.connectionId, body))
	.get("/:connectionId/consents", {
		principalAccess: read, params: connectionParams, query: page,
		response: z.strictObject({ items: z.array(consentHead).max(50), nextAfterId: id.nullable() }),
		detail: { operationId: "listOwnAppConsents", tags: ["Account"], description: "List active and revoked approvals for your connection." },
	}, ({ principalContext, params, query }) => listOwnConnectionConsents(principalContext, params.connectionId, query.afterId))
	.get("/:connectionId/consents/:consentId", {
		principalAccess: read, params: consentParams, query: z.strictObject({ revision: z.coerce.number().int().positive().safe().optional() }), response: consent,
		detail: { operationId: "getOwnAppConsent", tags: ["Account"], description: "Read a captured approval revision. Resource locators are bound to your current credential and expire after 15 minutes; they grant no resource access." },
	}, async ({ principalContext, params, query }) => {
		const value = await getOwnConnectionConsent(principalContext, params.connectionId, params.consentId, query.revision);
		const now = Date.now();
		return { ...value, terms: { ...value.terms, resources: value.terms.resources.kind === "all-scopes" ? value.terms.resources
			: { kind: "selected" as const, values: value.terms.resources.values.map(resource => ({ path: resource.path,
				scope: selectors.mint(resource.scopeId, principalContext.credentialProof(), now) })) } } };
	})
	.get("/:connectionId/consents/:consentId/history", {
		principalAccess: read, params: consentParams, query: z.strictObject({ afterVersion: z.coerce.number().int().nonnegative().safe().optional() }),
		response: z.strictObject({ items: z.array(z.strictObject({ operationId: id, version, operation: z.enum(["grant", "revise", "revoke"]),
			state: z.enum(["active", "revoked"]), createdAt: z.iso.datetime() })).max(50), nextAfterVersion: version.nullable() }),
		detail: { operationId: "listOwnAppConsentHistory", tags: ["Account"], description: "Read the approval's change receipts in version order." },
	}, ({ principalContext, params, query }) => listOwnConsentHistory(principalContext, params.connectionId, params.consentId, query.afterVersion))
	.post("/:connectionId/consents/:consentId/revoke", {
		principalAccess: withdraw, params: consentParams, body: mutation,
		response: z.strictObject({ consentId: id, operationId: id, version, state: z.enum(["active", "revoked"]), termsRevision: version }),
		detail: { operationId: "revokeOwnAppConsent", tags: ["Account"], description: "Withdraw this approval, including when the client is disabled or you no longer control the selected identity or resources." },
	}, ({ principalContext, params, body }) => revokeOwnConnectionConsent(principalContext, params.connectionId, params.consentId, body));
