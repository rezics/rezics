import { describe, expect, it, vi } from "vitest";
import { UnitReferenceSchema } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import { BootstrapPlatformAdministratorProfile } from "../bootstrap/data";
import { prepareFixtureIdentities, seedAuthority, seedFixtureIdentityId } from "./identity";

describe("native fixture identity planning", () => {
	it("allocates deterministic owner-specific references without database placeholders", () => {
		const tx = {} as DatabaseTransaction;
		const descriptor = {
			kind: "post" as const,
			seedKey: "example",
			ownerProfileId: "019b76da-a800-7200-8000-000000000004",
			status: "published" as const,
			visibility: "public" as const,
			moderationStatus: "approved" as const,
			publishedAt: new Date("2026-07-15Z"),
			createdAt: new Date("2026-07-15Z"),
			updatedAt: new Date("2026-07-15Z"),
		};
		const [first] = prepareFixtureIdentities(tx, [descriptor]);
		expect(first?.id).toBe(seedFixtureIdentityId("post", "example"));
		expect(UnitReferenceSchema.safeParse({ owner: "post", id: first?.id }).success).toBe(true);
		expect(first?.id).not.toBe(seedFixtureIdentityId("entity", "example"));
		expect(() => prepareFixtureIdentities(tx, [descriptor])).toThrow("Duplicate seed identity");
	});
	it("keeps public catalog authorship separate from the verified fixture operator", async () => {
		const limit = vi
			.fn()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					authUserId: BootstrapPlatformAdministratorProfile.authUserId,
					entityId: BootstrapPlatformAdministratorProfile.profileId,
					state: "active",
					revision: 3,
				},
			]);
		const tx = {
			select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
		} as unknown as DatabaseTransaction;
		const authority = await seedAuthority(tx, "019b76da-a800-7200-8000-000000000099");
		expect(authority).toEqual({
			principal: { kind: "auth", authUserId: BootstrapPlatformAdministratorProfile.authUserId },
			actingEntityId: BootstrapPlatformAdministratorProfile.profileId,
			authorizationRevision: 3,
		});
		expect(limit).toHaveBeenCalledTimes(2);
	});
});
