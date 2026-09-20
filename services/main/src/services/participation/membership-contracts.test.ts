import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	AcceptMembershipInvitationSchema,
	CreateMembershipInvitationSchema,
	MembershipInvitationSchema,
	OrganizationMemberSchema,
} from "./membership-contracts";

const entityId = "019b76da-a800-7100-8000-000000000001";
const accountId = "019b76da-a800-7100-8000-000000000002";

describe("organization membership wire boundaries", () => {
	it("accepts typed public recipients or private scoped selectors, never account IDs", () => {
		const request = {
			recipient: { kind: "entity", entityId },
			operationId: accountId,
			expiresAt: "2030-01-01T00:00:00.000Z",
		};
		expect(CreateMembershipInvitationSchema.parse(request).recipient).toEqual(request.recipient);
		expect(
			CreateMembershipInvitationSchema.safeParse({
				...request,
				recipient: { kind: "principal", selector: "scoped-private-recipient" },
			}).success,
		).toBe(true);
		expect(
			CreateMembershipInvitationSchema.safeParse({
				...request,
				recipient: { kind: "principal", authUserId: accountId },
			}).success,
		).toBe(false);
		expect(
			CreateMembershipInvitationSchema.safeParse({ ...request, recipientAuthUserId: accountId })
				.success,
		).toBe(false);
		expect(
			CreateMembershipInvitationSchema.safeParse({ ...request, expiresAt: new Date() }).success,
		).toBe(false);
		expect(() => z.toJSONSchema(CreateMembershipInvitationSchema)).not.toThrow();
	});
	it("requires recipient consent and current generation preconditions", () => {
		const request = {
			operationId: accountId,
			expectedRevision: 1,
			expectedMembershipVersion: 0,
			consent: true,
		};
		expect(AcceptMembershipInvitationSchema.safeParse(request).success).toBe(true);
		expect(AcceptMembershipInvitationSchema.safeParse({ ...request, consent: false }).success).toBe(
			false,
		);
		expect(
			AcceptMembershipInvitationSchema.safeParse({
				...request,
				expectedMembershipVersion: undefined,
			}).success,
		).toBe(false);
	});
	it("refuses private account keys in member and invitation responses", () => {
		const member = {
			membershipId: accountId,
			organizationEntityId: entityId,
			organizationName: "Organization",
			memberName: null,
			recipient: { kind: "entity", entityId },
			version: 1,
			activeGeneration: 1,
			lastGeneration: 1,
			availability: "allow",
		};
		expect(OrganizationMemberSchema.safeParse(member).success).toBe(true);
		expect(
			OrganizationMemberSchema.safeParse({ ...member, memberAuthUserId: accountId }).success,
		).toBe(false);
		const invitation = {
			id: entityId,
			organizationEntityId: entityId,
			organizationName: "Organization",
			entityId,
			kind: "entity",
			recipientName: null,
			state: "pending",
			revision: 1,
			membershipVersion: 0,
			availability: "unavailable",
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
