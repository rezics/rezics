import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	CreateMembershipInvitationSchema,
	MembershipInvitationSchema,
	OrganizationMemberSchema,
} from "./membership-contracts";

const entityId = "019b76da-a800-7100-8000-000000000001";
const accountId = "019b76da-a800-7100-8000-000000000002";

describe("organization membership wire boundaries", () => {
	it("accepts only public recipient addressing and ISO expiry", () => {
		expect(
			CreateMembershipInvitationSchema.parse({
				recipientEntityId: entityId,
				expiresAt: "2030-01-01T00:00:00.000Z",
			}).recipientEntityId,
		).toBe(entityId);
		expect(
			CreateMembershipInvitationSchema.safeParse({
				recipientEntityId: entityId,
				recipientAuthUserId: accountId,
			}).success,
		).toBe(false);
		expect(
			CreateMembershipInvitationSchema.safeParse({
				recipientEntityId: entityId,
				expiresAt: new Date(),
			}).success,
		).toBe(false);
		expect(() => z.toJSONSchema(CreateMembershipInvitationSchema)).not.toThrow();
	});
	it("refuses private Auth keys in public membership responses", () => {
		const member = {
			organizationEntityId: entityId,
			organizationName: "Organization",
			memberEntityId: entityId,
			memberName: "Member",
			revision: 1,
			joinedAt: "2026-09-08T00:00:00.000Z",
			removedAt: null,
		};
		expect(OrganizationMemberSchema.safeParse(member).success).toBe(true);
		expect(
			OrganizationMemberSchema.safeParse({ ...member, memberAuthUserId: accountId }).success,
		).toBe(false);
		const invitation = {
			id: entityId,
			organizationEntityId: entityId,
			organizationName: "Organization",
			recipientEntityId: entityId,
			recipientName: "Member",
			state: "pending",
			revision: 1,
			expiresAt: "2026-09-09T00:00:00.000Z",
			createdAt: "2026-09-08T00:00:00.000Z",
			resolvedAt: null,
		};
		expect(MembershipInvitationSchema.safeParse(invitation).success).toBe(true);
		expect(
			MembershipInvitationSchema.safeParse({ ...invitation, invitedByAuthUserId: accountId })
				.success,
		).toBe(false);
		expect(() => z.toJSONSchema(MembershipInvitationSchema)).not.toThrow();
	});
});
