import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { runParticipationTransaction } from "../../participation/transaction";
import { eraseOwnAccount } from "../../participation/erasure";
import { recoverEntityController } from "../../participation/lifecycle";
import {
	IssueGrantInputSchema,
	createServicePrincipal,
	issueParticipationGrant,
	listParticipationGrants,
	revokeParticipationGrant,
	revokeServicePrincipal,
} from "../../participation/commands";
import {
	ParticipationAuthoritySchema,
	requireParticipation,
	ParticipationDenied,
} from "../../participation/policy";
import { CatalogReferenceSchema } from "../../catalog/contracts";
import { ParticipationCapabilityValues } from "../../database/schema/participation";

const GrantSelectionSchema = z.strictObject({
	id: z.uuid(),
	revision: z.number().int().positive(),
});
const RevisionSchema = z.strictObject({ expectedRevision: z.number().int().positive() });

/** @alpha Account and delegated participation, kept distinct from public catalog metadata. */
export default new Elysia({ prefix: "/participation", name: "participation-api" })
	.use(session)
	.get(
		"/self",
		{ access: "session-only" },
		({ entity, principal, actingEntityId, authorizationRevision }) => ({
			entity,
			principal,
			actingEntityId,
			authorizationRevision,
		}),
	)
	.get(
		"/grants",
		{ access: "session-only", query: z.strictObject({ afterId: z.uuid().optional() }) },
		({ user, query }) =>
			runParticipationTransaction((tx) => listParticipationGrants(tx, user.id, query.afterId)),
	)
	.post(
		"/acting",
		{
			access: "session-only",
			body: z.strictObject({
				actingEntityId: z.uuid(),
				grant: GrantSelectionSchema.optional(),
				capability: z.enum(ParticipationCapabilityValues),
				target: CatalogReferenceSchema,
			}),
		},
		({ principal, authorizationRevision, body }) =>
			runParticipationTransaction(async (tx) => {
				const authority = ParticipationAuthoritySchema.parse({
					principal,
					authorizationRevision,
					actingEntityId: body.actingEntityId,
					grant: body.grant,
				});
				await requireParticipation(tx, authority, body.capability, body.target);
				return authority;
			}),
	)
	.post(
		"/grants",
		{ access: "fresh-session-only", body: IssueGrantInputSchema },
		({ participation, body }) =>
			runParticipationTransaction((tx) => issueParticipationGrant(tx, participation, body)),
	)
	.post(
		"/grants/:id/revoke",
		{
			access: "fresh-session-only",
			params: z.strictObject({ id: z.uuid() }),
			body: RevisionSchema,
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				revokeParticipationGrant(tx, participation, params.id, body.expectedRevision),
			),
	)
	.post(
		"/service-principals",
		{
			access: "fresh-session-only",
			body: z.strictObject({ name: z.string().trim().min(1).max(120) }),
		},
		({ participation, body, set }) =>
			runParticipationTransaction(async (tx) => {
				if (participation.principal.kind !== "auth") throw new ParticipationDenied();
				set.headers["Cache-Control"] = "no-store";
				return createServicePrincipal(tx, participation, body.name);
			}),
	)
	.post(
		"/service-principals/:id/revoke",
		{
			access: "fresh-session-only",
			params: z.strictObject({ id: z.uuid() }),
			body: RevisionSchema,
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				revokeServicePrincipal(tx, participation, params.id, body.expectedRevision),
			),
	)
	.post("/account/erase", { access: "fresh-session-only" }, ({ participation }) =>
		runParticipationTransaction((tx) => eraseOwnAccount(tx, participation)),
	)
	.post(
		"/entities/:id/recover",
		{
			access: "fresh-session-only",
			params: z.strictObject({ id: z.uuid() }),
			body: z.strictObject({
				recipientAuthUserId: z.uuid(),
				expectedRevision: z.number().int().positive(),
				evidence: z.string().min(1).max(16384),
			}),
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				recoverEntityController(tx, participation, { entityId: params.id, ...body }),
			),
	);
