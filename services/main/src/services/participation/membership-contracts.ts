import { z } from "zod";
import { HTTPError } from "elysia";
import { OrganizationMembershipInvitationStateValues } from "@rezics/schema/postgres/access/organization-membership";
export class OrganizationMembershipConflict extends HTTPError.id(
	"OrganizationMembershipConflict",
	409,
) {}
export class OrganizationMembershipNotFound extends HTTPError.id(
	"OrganizationMembershipNotFound",
	404,
) {}
export class OrganizationMembershipCapacityExceeded extends HTTPError.id(
	"OrganizationMembershipCapacityExceeded",
	409,
) {}
const id = z.uuid().toLowerCase();
const version = z
	.number()
	.int()
	.nonnegative()
	.max(Number.MAX_SAFE_INTEGER - 1);
export const MembershipExpectedRevisionSchema = z.strictObject({
	expectedRevision: version.min(1),
	operationId: id,
});
export const MembershipPageQuerySchema = z.strictObject({
	afterId: z.string().min(1).max(512).optional(),
});
export const MembershipRecipientSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("entity"), entityId: id }),
	z.strictObject({ kind: z.literal("principal"), selector: z.string().min(1).max(512) }),
]);
export const CreateMembershipInvitationSchema = z.strictObject({
	recipient: MembershipRecipientSchema,
	operationId: id,
	expiresAt: z.iso.datetime().optional(),
});
export const AcceptMembershipInvitationSchema = MembershipExpectedRevisionSchema.extend({
	expectedMembershipVersion: version,
	consent: z.literal(true),
});
export const MembershipDepartureSchema = z.strictObject({
	expectedMembershipVersion: version.min(1),
	operationId: id,
});
export const RemoveMembershipSchema = MembershipDepartureSchema.extend({
	recipient: MembershipRecipientSchema,
});
export const MembershipReceiptSchema = z.strictObject({
	invitationId: id.optional(),
	revision: version.min(1).optional(),
	state: z.enum(OrganizationMembershipInvitationStateValues).optional(),
	membershipId: id.optional(),
	version: version.optional(),
	activeGeneration: version.nullable().optional(),
	lastGeneration: version.optional(),
});
export const MembershipInvitationSchema = z.strictObject({
	id,
	organizationEntityId: id,
	organizationName: z.string().nullable(),
	recipientName: z.string().nullable(),
	kind: z.enum(["entity", "principal"]),
	entityId: id.nullable(),
	state: z.enum(OrganizationMembershipInvitationStateValues),
	revision: version.min(1),
	availability: z.enum(["allow", "deny", "unavailable"]),
	membershipVersion: version,
	expiresAt: z.iso.datetime(),
	createdAt: z.iso.datetime(),
	resolvedAt: z.iso.datetime().nullable(),
});
export const MembershipInvitationPageSchema = z.strictObject({
	items: z.array(MembershipInvitationSchema).max(50),
	nextCursor: z.string().max(512).nullable(),
});
export const OrganizationMemberSchema = z.strictObject({
	membershipId: id,
	organizationEntityId: id,
	organizationName: z.string().nullable(),
	memberName: z.string().nullable(),
	recipient: MembershipRecipientSchema,
	version,
	activeGeneration: version.nullable(),
	lastGeneration: version,
	availability: z.enum(["allow", "deny", "unavailable"]),
});
export const OrganizationMemberPageSchema = z.strictObject({
	items: z.array(OrganizationMemberSchema).max(50),
	nextCursor: z.string().max(512).nullable(),
});
export const MembershipContactSchema = z.strictObject({
	id,
	version: version.min(1),
	contact: z.string(),
	expiresAt: z.iso.datetime(),
});
export const MembershipHistoryQuerySchema = z.strictObject({
	recipient: MembershipRecipientSchema,
	afterVersion: version.optional(),
});
export const MembershipHistorySchema = z.strictObject({
	items: z
		.array(
			z.strictObject({
				version,
				operation: z.enum(["admit", "leave", "remove"]),
				lastGeneration: version,
				activeGeneration: version.nullable(),
				createdAt: z.iso.datetime(),
			}),
		)
		.max(50),
	nextCursor: version.nullable(),
});
