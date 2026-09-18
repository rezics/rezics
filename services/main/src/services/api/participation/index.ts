import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { runParticipationTransaction } from "../../participation/transaction";
import { eraseOwnAccount } from "../../participation/erasure";
import { recoverEntityController } from "../../participation/lifecycle";
import {
	createServicePrincipal,
	issueParticipationGrant,
	listParticipationGrants,
	listManagedEntityGrants,
	listControlledServicePrincipals,
	revokeParticipationGrant,
	revokeServicePrincipal,
} from "../../participation/commands";
import {
	ParticipationAuthoritySchema,
	requireParticipation,
	ParticipationDenied,
} from "../../participation/policy";
import { CatalogReferenceSchema } from "@rezics/schema/contracts/native/catalog";
import { ParticipationCapabilityValues } from "@rezics/schema/postgres/access/participation";
import {
	CreateManagedOrganizationSchema,
	createManagedOrganization,
	listManagedOrganizations,
	ManagedOrganizationCapabilityValues,
} from "../../participation/organizations";
import {
	listEntityPresentationHistory,
	restoreEntityPresentation,
	updateEntityPresentation,
} from "../../participation/presentation";
import { UpdateEntityPresentationBody } from "../users/schema";

import {
	GrantSelectionSchema,
	ExpectedRevisionSchema,
	IssueGrantBodySchema,
	ParticipationSelectionSchema,
	ParticipationSelfSchema,
	ParticipationGrantsSchema,
	ManagedEntityGrantsSchema,
	ManagedOrganizationsSchema,
	CreatedOrganizationSchema,
	PresentationMutationSchema,
	PresentationHistorySchema,
	PresentationRevisionSchema,
	CreatedServicePrincipalSchema,
	ControlledServicePrincipalsSchema,
	AccountErasureResponseSchema,
	EntityRecoveryResponseSchema,
} from "./schema";
import {
	accountRecipientForEntity,
	presentParticipationGrant,
	presentEntityPresentationRevision,
} from "./present";
import organizationMembershipApi from "./membership";

/** @alpha Account and delegated participation, kept distinct from public catalog metadata. */
export default new Elysia({ prefix: "/participation", name: "participation-api" })
	.use(session)
	.use(organizationMembershipApi)
	.get(
		"/organizations",
		{
			detail: { operationId: "listManagedOrganizations", tags: ["Participation"] },
			response: ManagedOrganizationsSchema,
			access: "session-only",
			query: z.strictObject({
				afterId: z.uuid().optional(),
				capability: z.enum(ManagedOrganizationCapabilityValues).optional(),
			}),
		},
		({ user, query }) =>
			runParticipationTransaction((tx) =>
				listManagedOrganizations(tx, user.id, query.afterId, query.capability),
			),
	)
	.post(
		"/organizations",
		{
			detail: { operationId: "createManagedOrganization", tags: ["Participation"] },
			response: CreatedOrganizationSchema,
			access: "fresh-session-only",
			body: CreateManagedOrganizationSchema,
		},
		({ participation, body }) =>
			runParticipationTransaction((tx) => createManagedOrganization(tx, participation, body)),
	)
	.patch(
		"/presentation",
		{
			detail: { operationId: "updateActingEntityPresentation", tags: ["Participation"] },
			response: PresentationMutationSchema,
			access: "session-only",
			body: UpdateEntityPresentationBody,
		},
		({ participation, body }) =>
			runParticipationTransaction((tx) => updateEntityPresentation(tx, participation, body)),
	)
	.get(
		"/presentation/:language/history",
		{
			detail: { operationId: "listActingEntityPresentationHistory", tags: ["Participation"] },
			response: PresentationHistorySchema,
			access: "session-only",
			params: z.strictObject({ language: z.string().min(1).max(255) }),
			query: z.strictObject({
				beforeRevision: z.coerce.number().int().positive().safe().optional(),
			}),
		},
		({ participation, params, query }) =>
			runParticipationTransaction(async (tx) => {
				const page = await listEntityPresentationHistory(
					tx,
					participation,
					params.language,
					query.beforeRevision,
				);
				return {
					items: page.items.map((item) => ({
						revision: item.revision,
						createdAt: item.createdAt.toISOString(),
					})),
					nextCursor: page.nextCursor,
				};
			}),
	)
	.get(
		"/presentation/:language/history/:revision",
		{
			detail: { operationId: "getActingEntityPresentationRevision", tags: ["Participation"] },
			response: PresentationRevisionSchema,
			access: "session-only",
			params: z.strictObject({
				language: z.string().min(1).max(255),
				revision: z.coerce.number().int().positive().safe(),
			}),
		},
		({ participation, params }) =>
			runParticipationTransaction((tx) =>
				presentEntityPresentationRevision(tx, participation, params.language, params.revision),
			),
	)
	.post(
		"/presentation/:language/restore",
		{
			detail: { operationId: "restoreActingEntityPresentation", tags: ["Participation"] },
			response: PresentationMutationSchema,
			access: "session-only",
			params: z.strictObject({ language: z.string().min(1).max(255) }),
			body: z.strictObject({
				revision: z.number().int().positive().safe(),
				expectedRevision: z.number().int().positive().safe(),
			}),
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				restoreEntityPresentation(tx, participation, { ...body, language: params.language }),
			),
	)
	.get(
		"/self",
		{
			detail: { operationId: "getCurrentParticipation", tags: ["Participation"] },
			response: ParticipationSelfSchema,
			access: "session-only",
		},
		({ entity, actingEntityId, authorizationRevision, participation }) => ({
			entity: { id: entity.id, name: entity.name },
			grant: participation.grant ?? null,
			actingEntityId,
			authorizationRevision,
		}),
	)
	.get(
		"/grants",
		{
			detail: { operationId: "listParticipationGrants", tags: ["Participation"] },
			response: ParticipationGrantsSchema,
			access: "session-only",
			query: z.strictObject({ afterId: z.uuid().optional() }),
		},
		({ user, query }) =>
			runParticipationTransaction(async (tx) => {
				const rows = await listParticipationGrants(tx, user.id, query.afterId);
				const items = rows.slice(0, 100).map(presentParticipationGrant);
				return { items, nextCursor: rows.length > 100 ? (items.at(-1)?.id ?? null) : null };
			}),
	)
	.get(
		"/entities/:id/grants",
		{
			detail: { operationId: "listManagedEntityGrants", tags: ["Participation"] },
			access: "session-only",
			params: z.strictObject({ id: z.uuid() }),
			query: z.strictObject({ afterId: z.uuid().optional() }),
			response: ManagedEntityGrantsSchema,
		},
		({ participation, params, query }) =>
			runParticipationTransaction(async (tx) => {
				const rows = await listManagedEntityGrants(tx, participation, params.id, query.afterId);
				const items = rows.slice(0, 100).map((row) => ({
					...presentParticipationGrant(row.grant),
					recipientName: row.recipientName,
					recipient: row.grant.servicePrincipalId
						? { kind: "service" as const, servicePrincipalId: row.grant.servicePrincipalId }
						: row.accountEntityId
							? { kind: "account" as const, entityId: row.accountEntityId }
							: null,
				}));
				return { items, nextCursor: rows.length > 100 ? (items.at(-1)?.id ?? null) : null };
			}),
	)
	.post(
		"/acting",
		{
			detail: { operationId: "selectParticipation", tags: ["Participation"] },
			response: ParticipationSelectionSchema,
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
				return {
					actingEntityId: authority.actingEntityId,
					authorizationRevision: authority.authorizationRevision,
					grant: authority.grant ?? null,
				};
			}),
	)
	.post(
		"/grants",
		{
			detail: { operationId: "issueParticipationGrant", tags: ["Participation"] },
			response: GrantSelectionSchema,
			access: "fresh-session-only",
			body: IssueGrantBodySchema,
		},
		({ participation, body }) =>
			runParticipationTransaction(async (tx) => {
				const recipient =
					body.recipient.kind === "account"
						? await accountRecipientForEntity(tx, body.recipient.entityId)
						: body.recipient;
				return issueParticipationGrant(tx, participation, { ...body, recipient });
			}),
	)
	.post(
		"/grants/:id/revoke",
		{
			detail: { operationId: "revokeParticipationGrant", tags: ["Participation"] },
			response: GrantSelectionSchema,
			access: "fresh-session-only",
			params: z.strictObject({ id: z.uuid() }),
			body: ExpectedRevisionSchema,
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				revokeParticipationGrant(tx, participation, params.id, body.expectedRevision),
			),
	)
	.get(
		"/service-principals",
		{
			detail: { operationId: "listControlledServicePrincipals", tags: ["Participation"] },
			access: "session-only",
			query: z.strictObject({ afterGrantId: z.uuid().optional() }),
			response: ControlledServicePrincipalsSchema,
		},
		({ user, query }) =>
			runParticipationTransaction(async (tx) => {
				const rows = await listControlledServicePrincipals(tx, user.id, query.afterGrantId);
				const page = rows.slice(0, 100);
				return {
					items: page.map((row) => ({
						id: row.id,
						entityId: row.entityId,
						name: row.name,
						revision: row.revision,
						createdAt: row.createdAt.toISOString(),
						revokedAt: row.revokedAt?.toISOString() ?? null,
						controlGrant: { id: row.grantId, revision: row.grantRevision },
					})),
					nextCursor: rows.length > 100 ? (page.at(-1)?.grantId ?? null) : null,
				};
			}),
	)

	.post(
		"/service-principals",
		{
			detail: { operationId: "createServicePrincipal", tags: ["Participation"] },
			response: CreatedServicePrincipalSchema,
			access: "fresh-session-only",
			body: z.strictObject({ name: z.string().trim().min(1).max(120) }),
		},
		({ participation, body, set }) =>
			runParticipationTransaction(async (tx) => {
				if (participation.principal.kind !== "auth") throw new ParticipationDenied();
				set.headers["Cache-Control"] = "no-store";
				const created = await createServicePrincipal(tx, participation, body.name);
				return {
					id: created.id,
					entityId: created.entityId,
					revision: created.revision,
					secret: created.secret,
					controlGrant: created.controlGrant,
				};
			}),
	)
	.post(
		"/service-principals/:id/revoke",
		{
			detail: { operationId: "revokeServicePrincipal", tags: ["Participation"] },
			response: GrantSelectionSchema,
			access: "fresh-session-only",
			params: z.strictObject({ id: z.uuid() }),
			body: ExpectedRevisionSchema,
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				revokeServicePrincipal(tx, participation, params.id, body.expectedRevision),
			),
	)
	.post(
		"/account/erase",
		{
			detail: { operationId: "eraseOwnAccount", tags: ["Participation"] },
			response: AccountErasureResponseSchema,
			access: "fresh-session-only",
		},
		({ participation }) => runParticipationTransaction((tx) => eraseOwnAccount(tx, participation)),
	)
	.post(
		"/entities/:id/recover",
		{
			detail: { operationId: "recoverEntityController", tags: ["Participation"] },
			response: EntityRecoveryResponseSchema,
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
