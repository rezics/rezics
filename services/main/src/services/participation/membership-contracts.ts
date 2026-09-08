import { z } from "zod";
import { HTTPError } from "elysia";
import { OrganizationMembershipInvitationStateValues } from "../database/schema/organization-membership";

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

export const MembershipExpectedRevisionSchema = z.strictObject({
	expectedRevision: z
		.number()
		.int()
		.positive()
		.max(Number.MAX_SAFE_INTEGER - 1),
});
export const MembershipPageQuerySchema = z.strictObject({ afterId: z.uuid().optional() });
export const CreateMembershipInvitationSchema = z.strictObject({
	recipientEntityId: z.uuid(),
	expiresAt: z.iso.datetime().optional(),
});
export const MembershipInvitationSchema = z.strictObject({
	id: z.uuid(),
	organizationEntityId: z.uuid(),
	organizationName: z.string().nullable(),
	recipientEntityId: z.uuid(),
	recipientName: z.string().nullable(),
	state: z.enum(OrganizationMembershipInvitationStateValues),
	revision: z.number().int().positive().safe(),
	expiresAt: z.iso.datetime(),
	createdAt: z.iso.datetime(),
	resolvedAt: z.iso.datetime().nullable(),
});
export const MembershipInvitationPageSchema = z.strictObject({
	items: z.array(MembershipInvitationSchema).max(100),
	nextCursor: z.uuid().nullable(),
});
export const OrganizationMemberSchema = z.strictObject({
	organizationEntityId: z.uuid(),
	organizationName: z.string().nullable(),
	memberEntityId: z.uuid(),
	memberName: z.string().nullable(),
	revision: z.number().int().positive().safe(),
	joinedAt: z.iso.datetime(),
	removedAt: z.iso.datetime().nullable(),
});
export const OrganizationMemberPageSchema = z.strictObject({
	items: z.array(OrganizationMemberSchema).max(100),
	nextCursor: z.uuid().nullable(),
});
