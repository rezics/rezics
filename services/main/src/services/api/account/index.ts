import Elysia from "elysia";
import { z } from "zod";
import principalSession from "../../auth/principal-session";
import { RequestedAuthoritySelectionSchema } from "../../authorization/authority-context";
import { getMainIdentityPreference, setMainIdentityPreference } from "../../authorization/main-identity";
import { CreateAccountIdentitySchema, createAccountIdentity } from "../../authorization/create-account-identity";

const version = z.number().int().nonnegative().safe();
const mainIdentity = z.strictObject({ version, entityId: z.uuid().nullable() });
const changeMainIdentity = z.strictObject({
	operationId: z.uuid().toLowerCase(), expectedVersion: version,
	selection: z.discriminatedUnion("mode", [z.strictObject({ mode: z.literal("none") }), RequestedAuthoritySelectionSchema.options[1]]),
});
const receipt = z.strictObject({ operationId: z.uuid(), version: z.number().int().positive().safe() });
const createdIdentity = z.strictObject({ operationId: z.uuid(), entityId: z.uuid(),
	representation: z.strictObject({ id: z.uuid(), revision: z.number().int().positive().safe() }),
	mainPreferenceVersion: z.number().int().positive().safe().nullable() });

/** Private account-owned settings are independent from the selected public identity. @alpha */
export default new Elysia({ prefix: "/account", name: "private-account-api" }).use(principalSession)
	.post("/identities", {
		principalAccess: { permission: "account:update", fresh: false, write: true }, body: CreateAccountIdentitySchema, response: createdIdentity,
		detail: { operationId: "createAccountIdentity", tags: ["Account"],
			description: "Create a new controlled Entity from explicitly supplied public names. The first identity also requires a main-choice precondition. Retrying an operation returns its original receipt without renewing control." },
	}, ({ principalContext, body }) => createAccountIdentity(principalContext, body))
	.get("/main-identity", {
		principalAccess: { permission: "account:read", fresh: false, write: false }, response: mainIdentity,
		detail: { operationId: "getMainIdentityPreference", tags: ["Account"],
			description: "Read the recorded private main Entity choice. This response does not authorize acting as that Entity." },
	}, ({ principalContext }) => getMainIdentityPreference(principalContext))
	.put("/main-identity", {
		principalAccess: { permission: "account:update", fresh: false, write: true }, body: changeMainIdentity, response: receipt,
		detail: { operationId: "setMainIdentityPreference", tags: ["Account"],
			description: "Select a currently controlled Entity or explicitly clear the main choice. Existing grants, consents and prepared requests retain their selected identity." },
	}, ({ principalContext, body }) => setMainIdentityPreference(principalContext, body));
