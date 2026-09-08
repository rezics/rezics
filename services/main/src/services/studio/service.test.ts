import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());
const getPublicCanonicalUnitSlugAddresses = vi.hoisted(() => vi.fn());
const presentations = vi.hoisted(() => vi.fn());

vi.mock("../database", async () => {
	const { sql } = await import("drizzle-orm");
	const query = { getSQL: () => sql`select 1`, as: () => query, where: () => query };
	return {
		database: {
			execute,
			transaction: async (work: (tx: { execute: typeof execute }) => unknown) => work({ execute }),
			select: () => ({ from: () => query }),
		},
	};
});
vi.mock("../units/presentation-reader", () => ({
	readUnitPresentationsInTransaction: presentations,
}));
vi.mock("../units/slug-address", () => ({ getPublicCanonicalUnitSlugAddresses }));

import { listStudioContent } from "./service";
import { Authorization } from "../authorization";
import type { ParticipationAuthority } from "../participation/policy";

const ProfileId = "019b76da-a800-7300-8000-000000000001";
const UnitId = "019b76da-a800-7300-8000-000000000002";
const AuthUserId = "019b76da-a800-7300-8000-000000000009";
const authority: ParticipationAuthority = {
	principal: { kind: "auth", authUserId: AuthUserId },
	actingEntityId: ProfileId,
	authorizationRevision: 1,
};
const authorization = new Authorization(ProfileId, AuthUserId, authority).unit;
const CoverId = "019b76da-a800-7300-8000-000000000005";
const RelevantAt = "2026-07-27T08:00:00.000Z";

function directCandidate(overrides: Record<string, unknown> = {}) {
	return {
		unitId: UnitId,
		sourceKind: "profile",
		sourceKey: "profile",
		relevantAt: RelevantAt,
		ownerSince: null,
		catalogCreatorSince: null,
		catalogGrantSince: null,
		hasCatalogCreatorAccess: false,
		hasCatalogGrantAccess: false,
		creatorAuthUserId: null,
		directGrantSince: "2026-07-01T08:00:00.000Z",
		realmGrantSince: null,
		lastVisitedAt: null,
		accepted: true,
		hasOwnerAccess: false,
		hasDirectAccess: true,
		hasRealmAccess: false,
		resourceOwner: "video",
		resourceShape: "video",
		language: "en",
		title: "Editable work",
		coverAssetId: CoverId,
		status: "published",
		visibility: "public",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-07-01T00:00:00.000Z",
		...overrides,
	};
}

describe("Studio workspace presentation", () => {
	beforeEach(() => {
		execute.mockReset();
		getPublicCanonicalUnitSlugAddresses.mockReset();
		getPublicCanonicalUnitSlugAddresses.mockResolvedValue(new Map());
		presentations.mockResolvedValue(
			new Map([[UnitId, { title: "Editable work", language: "en" }]]),
		);
		vi.spyOn(authorization, "readableUnitIdsInTransaction").mockImplementation(
			async (_tx, ids) => new Set(ids),
		);
	});

	it("returns only a currently actionable explicit editor assignment", async () => {
		execute.mockResolvedValueOnce({ rows: [directCandidate()] });

		const result = await listStudioContent({
			profileId: ProfileId,
			authUserId: AuthUserId,
			authority,
			authorization,
			query: { section: "video", source: "direct", limit: 1 },
			includeDevelopmentPreview: false,
		});

		expect(execute).toHaveBeenCalledOnce();
		expect(result.items).toHaveLength(1);
		expect(result.items[0]).toMatchObject({
			id: UnitId,
			resourceOwner: "video",
			accessSources: ["direct"],
			assignedAt: new Date("2026-07-01T08:00:00.000Z"),
			cover: {
				id: CoverId,
				url: `/image-assets/${CoverId}/presentations/cover/content`,
			},
		});
	});

	it("does not retain a blocked or expired candidate as workspace content", async () => {
		execute.mockResolvedValueOnce({ rows: [directCandidate({ accepted: false })] });

		const result = await listStudioContent({
			profileId: ProfileId,
			authUserId: AuthUserId,
			authority,
			authorization,
			query: { section: "video", source: "direct", limit: 1 },
			includeDevelopmentPreview: false,
		});

		expect(result.items).toEqual([]);
		expect(result.nextCursor).toBeNull();
	});

	it("rejects an invalid raw assignment timestamp at the database boundary", async () => {
		execute.mockResolvedValueOnce({
			rows: [directCandidate({ directGrantSince: "not-a-timestamp" })],
		});

		await expect(
			listStudioContent({
				profileId: ProfileId,
				authUserId: AuthUserId,
				authority,
				authorization,
				query: { section: "video", source: "direct", limit: 1 },
				includeDevelopmentPreview: false,
			}),
		).rejects.toThrow("Studio candidate.directGrantSince is not a valid date");
	});

	it("derives each section for an aggregate workspace page", async () => {
		presentations.mockResolvedValue(
			new Map([[UnitId, { title: "Editable wiki", language: "en" }]]),
		);
		execute.mockResolvedValueOnce({
			rows: [
				directCandidate({ resourceOwner: "post", resourceShape: "wiki", title: "Editable wiki" }),
			],
		});

		const result = await listStudioContent({
			profileId: ProfileId,
			authUserId: AuthUserId,
			authority,
			authorization,
			query: { source: "direct", limit: 1 },
			includeDevelopmentPreview: false,
		});

		expect(result.items[0]).toMatchObject({
			id: UnitId,
			section: "wiki",
			resourceOwner: "post",
			title: "Editable wiki",
		});
	});
});
