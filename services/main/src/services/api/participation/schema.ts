import { PortableTextDocument } from "@rezics/block";
import { t } from "elysia";
import { z } from "zod";
import { CatalogReferenceSchema } from "../../catalog/contracts";
import { ParticipationCapabilityValues } from "../../database/schema/participation";
import { IssueGrantInputSchema } from "../../participation/commands";
import { AvatarInput, Uuid } from "../schema";

const revision = z.number().int().positive().safe();
export const GrantSelectionSchema = z.strictObject({ id: z.uuid(), revision });
export const ExpectedRevisionSchema = z.strictObject({ expectedRevision: revision });
const proposal = z.strictObject({ sourceRecordId: z.uuid(), proposalId: z.uuid() });

/** JSON boundary: accounts are addressed by their public self Entity, and instants are ISO strings. */
export const IssueGrantBodySchema = z
	.strictObject({
		...IssueGrantInputSchema.shape,
		recipient: z.discriminatedUnion("kind", [
			z.strictObject({ kind: z.literal("account"), entityId: z.uuid() }),
			z.strictObject({ kind: z.literal("service"), servicePrincipalId: z.uuid() }),
		]),
		expiresAt: z.iso.datetime().optional(),
	})
	.refine((value) => (value.capability === "proposal.adopt") === (value.proposal !== undefined), {
		message: "Proposal adoption requires an exact approved proposal scope",
	});

export const ParticipationSelectionSchema = z.strictObject({
	actingEntityId: z.uuid(),
	authorizationRevision: revision,
	grant: GrantSelectionSchema.nullable(),
});
export const ParticipationSelfSchema = ParticipationSelectionSchema.extend({
	entity: z.strictObject({ id: z.uuid(), name: z.string().nullable() }),
});
export const ParticipationGrantSchema = z.strictObject({
	id: z.uuid(),
	revision,
	actingEntityId: z.uuid(),
	capability: z.enum(ParticipationCapabilityValues),
	target: CatalogReferenceSchema,
	proposal: proposal.nullable(),
	createdAt: z.iso.datetime(),
	expiresAt: z.iso.datetime().nullable(),
	revokedAt: z.iso.datetime().nullable(),
});
export const ParticipationGrantsSchema = z.strictObject({
	items: z.array(ParticipationGrantSchema),
	nextCursor: z.uuid().nullable(),
});
export const ManagedEntityGrantsSchema = z.strictObject({
	items: z.array(
		ParticipationGrantSchema.extend({
			recipient: z
				.discriminatedUnion("kind", [
					z.strictObject({ kind: z.literal("account"), entityId: z.uuid() }),
					z.strictObject({ kind: z.literal("service"), servicePrincipalId: z.uuid() }),
				])
				.nullable(),
			recipientName: z.string().nullable(),
		}),
	),
	nextCursor: z.uuid().nullable(),
});
export const ManagedOrganizationsSchema = z.strictObject({
	items: z.array(
		z.strictObject({
			entityId: z.uuid(),
			name: z.string().nullable(),
			grantId: z.uuid(),
			revision,
		}),
	),
	nextCursor: z.uuid().nullable(),
});
const NativeOrganizationControlSchema = z.strictObject({ scopeId: z.uuid(),representation: GrantSelectionSchema }).nullable();
export const CreatedOrganizationSchema = z.strictObject({
 native: NativeOrganizationControlSchema,
	entityId: z.uuid(),
	grants: z.array(
		GrantSelectionSchema.extend({ capability: z.enum(ParticipationCapabilityValues) }),
	),
});
export const PresentationMutationSchema = z.strictObject({
	entityId: z.uuid(),
	language: z.string(),
	revision,
});
export const PresentationHistorySchema = z.strictObject({
	items: z.array(z.strictObject({ revision, createdAt: z.iso.datetime() })),
	nextCursor: revision.nullable(),
});
export const PresentationRevisionSchema = t.Object(
	{
		entityId: Uuid,
		language: t.String({ minLength: 1, maxLength: 255 }),
		revision: t.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
		name: t.Nullable(
			t.Object({
				id: Uuid,
				revision: t.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
				value: t.String(),
			}),
		),
		avatar: t.Nullable(AvatarInput),
		bannerAssetId: t.Nullable(Uuid),
		summary: t.Nullable(t.String()),
		description: t.Nullable(PortableTextDocument),
	},
	{ additionalProperties: false },
);
export const CreatedServicePrincipalSchema = z.strictObject({
	id: z.uuid(),
	entityId: z.uuid(),
	revision,
	secret: z.string().regex(/^rz_service_[A-Za-z0-9_-]{43}$/u),
	controlGrant: GrantSelectionSchema,
});
export const ControlledServicePrincipalsSchema = z.strictObject({
	items: z.array(
		z.strictObject({
			id: z.uuid(),
			entityId: z.uuid(),
			name: z.string(),
			revision,
			createdAt: z.iso.datetime(),
			revokedAt: z.iso.datetime().nullable(),
			controlGrant: GrantSelectionSchema,
		}),
	),
	nextCursor: z.uuid().nullable(),
});
export const AccountErasureResponseSchema = z.strictObject({ state: z.literal("erasing") });
export const EntityRecoveryResponseSchema = z.strictObject({
	entityId: z.uuid(),
	revision,
	grant: GrantSelectionSchema,
});
