import Elysia from "elysia";
import { z } from "zod";
import principalSession from "../../auth/principal-session";
import { env } from "../../config";
import { createScopeSelectors } from "../../authorization/scope-selectors";
import { AppDefinitionSchema } from "../../connected-apps/capabilities";
import { getManagedConnectedApp, listManagedConnectedAppHistory, listManagedConnectedApps, manageConnectedApp, setConnectedAppTrust } from "../../connected-apps/management";

const id = z.uuid().toLowerCase();
const positiveVersion = z.number().int().positive().safe();
const state = z.enum(["active", "disabled", "retired"]), trust = z.enum(["unreviewed", "trusted", "blocked"]);
const scopeParams = z.strictObject({ scope: z.string().startsWith("rzs1.").max(512) });
const appParams = scopeParams.extend({ appId: id });
const command = z.strictObject({ operationId: id, expectedVersion: positiveVersion });
const receipt = z.strictObject({ appId: id, operationId: id, version: positiveVersion, declaredRevision: positiveVersion, state, trust });
const app = z.strictObject({ id, version: positiveVersion, declaredRevision: positiveVersion, state, trust,
	definition: AppDefinitionSchema.extend({ revision: positiveVersion }) });
const apps = z.strictObject({ items: z.array(z.strictObject({ id, version: positiveVersion, declaredRevision: positiveVersion, state, trust, label: z.string() })).max(100), nextCursor: id.nullable() });
const history = z.strictObject({ items: z.array(z.strictObject({ operationId: id, version: positiveVersion, declaredRevision: positiveVersion,
	operation: z.enum(["create", "revise", "disable", "enable", "retire", "set-trust"]), state, trust, createdAt: z.iso.datetime() })).max(100), nextCursor: positiveVersion.nullable() });
const selectors = createScopeSelectors(env.BETTER_AUTH_SECRET);
const read = { permission: "app:read", fresh: false, write: false } as const;
const manage = { permission: "app:manage", fresh: false, write: true } as const;
const fresh = { permission: null, fresh: true, write: true } as const;

/** App publisher controls and separate platform trust review; no endpoint grants installation authority. @alpha */
export default new Elysia({ prefix: "/apps", name: "connected-app-management-api" }).use(principalSession)
	.get("/scopes/:scope", {
		principalAccess: read, params: scopeParams, query: z.strictObject({ afterId: id.optional() }), response: apps,
		detail: { operationId: "listConnectedApps", tags: ["Apps"] },
	}, ({ principalContext, params, query }) => listManagedConnectedApps(principalContext,
		selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), query.afterId))
	.get("/scopes/:scope/:appId", {
		principalAccess: read, params: appParams, query: z.strictObject({ revision: z.coerce.number().int().positive().safe().optional() }), response: app,
		detail: { operationId: "getConnectedApp", tags: ["Apps"] },
	}, ({ principalContext, params, query }) => getManagedConnectedApp(principalContext,
		selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), params.appId, query.revision))
	.get("/scopes/:scope/:appId/history", {
		principalAccess: read, params: appParams, query: z.strictObject({ afterVersion: z.coerce.number().int().nonnegative().safe().optional() }), response: history,
		detail: { operationId: "listConnectedAppHistory", tags: ["Apps"] },
	}, ({ principalContext, params, query }) => listManagedConnectedAppHistory(principalContext,
		selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), params.appId, query.afterVersion))
	.put("/scopes/:scope/:appId", {
		principalAccess: manage, params: appParams, body: z.strictObject({ operationId: id, expectedVersion: z.literal(0), definition: AppDefinitionSchema }), response: receipt,
		detail: { operationId: "createConnectedApp", tags: ["Apps"], description: "Register an unreviewed App declaration. Registration grants no user consent, installation permission or machine authority." },
	}, ({ principalContext, params, body }) => manageConnectedApp(principalContext, { ...body, appId: params.appId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), operation: "create" }))
	.post("/scopes/:scope/:appId/declarations", {
		principalAccess: manage, params: appParams, body: command.extend({ definition: AppDefinitionSchema }), response: receipt,
		detail: { operationId: "reviseConnectedApp", tags: ["Apps"], description: "Publish a new declaration; existing consent and installation approvals keep their selected revision." },
	}, ({ principalContext, params, body }) => manageConnectedApp(principalContext, { ...body, appId: params.appId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), operation: "revise" }))
	.post("/scopes/:scope/:appId/disable", {
		principalAccess: manage, params: appParams, body: command, response: receipt,
		detail: { operationId: "disableConnectedApp", tags: ["Apps"] },
	}, ({ principalContext, params, body }) => manageConnectedApp(principalContext, { ...body, appId: params.appId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), operation: "disable" }))
	.post("/scopes/:scope/:appId/enable", {
		principalAccess: manage, params: appParams, body: command, response: receipt,
		detail: { operationId: "enableConnectedApp", tags: ["Apps"], description: "Enable an App without reviving credentials invalidated by an earlier disablement or block." },
	}, ({ principalContext, params, body }) => manageConnectedApp(principalContext, { ...body, appId: params.appId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), operation: "enable" }))
	.post("/scopes/:scope/:appId/retire", {
		principalAccess: fresh, params: appParams, body: command, response: receipt,
		detail: { operationId: "retireConnectedApp", tags: ["Apps"], description: "Permanently retire the App. Its history and legitimately created content remain." },
	}, ({ principalContext, params, body }) => manageConnectedApp(principalContext, { ...body, appId: params.appId,
		scopeId: selectors.resolve(params.scope, principalContext.credentialProof(), Date.now()), operation: "retire" }))
	.put("/:appId/trust", {
		principalAccess: fresh, params: z.strictObject({ appId: id }), body: command.extend({ trust }), response: receipt,
		detail: { operationId: "setConnectedAppTrust", tags: ["Apps"], description: "Apply a platform trust decision. Publisher control alone cannot change trust." },
	}, ({ principalContext, params, body }) => setConnectedAppTrust(principalContext, { ...body, appId: params.appId }));
