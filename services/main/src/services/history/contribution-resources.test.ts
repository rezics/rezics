import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());
const getPublicCanonicalUnitSlugAddresses = vi.hoisted(() => vi.fn());
const listPathMembers = vi.hoisted(() => vi.fn());

vi.mock("../database", async () => {
	const { sql } = await import("drizzle-orm");
	const query = { getSQL: () => sql`select 1` };
	return {
		database: {
			execute,
			select: () => ({ from: () => ({ where: () => query }) }),
		},
	};
});
vi.mock("../units/slug-address", () => ({ getPublicCanonicalUnitSlugAddresses }));
vi.mock("../tag-paths/service", () => ({ listPathMembers }));

import { listCurrentProfileContributionResources } from "./contribution-resources";

const ProfileId = "019b76da-a800-7300-8000-000000000001";
const ResourceUnitId = "019b76da-a800-7300-8000-000000000002";

function contributionCandidate(overrides: Record<string, unknown> = {}) {
	return {
		resourceUnitId: ResourceUnitId,
		sortAt: "2026-07-27T08:00:00.000Z",
		accepted: true,
		resourceKind: "post",
		language: "en",
		title: "Public contribution",
		coverAssetId: null,
		status: "published",
		visibility: "public",
		createdResourceAt: null,
		firstContributedAt: "2026-07-01T08:00:00.000Z",
		lastContributedAt: "2026-07-27T08:00:00.000Z",
		contributionCount: 3,
		lastParticipatedAt: "2026-07-27T08:00:00.000Z",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-07-27T08:00:00.000Z",
		...overrides,
	};
}

describe("public contribution resources", () => {
	beforeEach(() => {
		execute.mockReset();
		getPublicCanonicalUnitSlugAddresses.mockReset();
		getPublicCanonicalUnitSlugAddresses.mockResolvedValue(new Map());
		listPathMembers.mockReset();
		listPathMembers.mockResolvedValue(new Map());
	});

	it("presents a public resource independently from current editor access", async () => {
		execute.mockResolvedValueOnce({ rows: [contributionCandidate()] });

		const result = await listCurrentProfileContributionResources({
			profileId: ProfileId,
			query: { section: "wiki", kind: "contributed", limit: 1 },
		});

		expect(result.items[0]).toMatchObject({
			id: ResourceUnitId,
			resourceKind: "post",
			presentation: {
				kind: "localized_unit",
				title: "Public contribution",
			},
			contributionCount: 3,
			firstContributedAt: new Date("2026-07-01T08:00:00.000Z"),
			lastContributedAt: new Date("2026-07-27T08:00:00.000Z"),
		});
	});

	it("filters a resource that is no longer public at query time", async () => {
		execute.mockResolvedValueOnce({ rows: [contributionCandidate({ accepted: false })] });

		const result = await listCurrentProfileContributionResources({
			profileId: ProfileId,
			query: { section: "wiki", limit: 1 },
		});

		expect(result.items).toEqual([]);
	});

	it("presents an immutable Tag Path with one bounded member hydration", async () => {
		const member = {
			ordinal: 0,
			nodeId: "019b76da-a800-7300-8000-000000000003",
			nodeKind: "concept",
			incomingRelation: null,
			language: "en",
			title: "Fiction",
			summary: null,
			avatar: null,
		} as const;
		execute.mockResolvedValueOnce({
			rows: [
				contributionCandidate({
					resourceKind: "tag_path",
					language: null,
					title: null,
					coverAssetId: null,
				}),
			],
		});
		listPathMembers.mockResolvedValueOnce(new Map([[ResourceUnitId, [member, member]]]));

		const result = await listCurrentProfileContributionResources({
			profileId: ProfileId,
			query: { section: "tag", kind: "created", limit: 30 },
		});

		expect(listPathMembers).toHaveBeenCalledWith([ResourceUnitId], undefined);
		expect(result.items[0]).toMatchObject({
			id: ResourceUnitId,
			section: "tag",
			resourceKind: "tag_path",
			presentation: { kind: "tag_path", members: [member, member] },
		});
		expect(getPublicCanonicalUnitSlugAddresses).toHaveBeenCalledWith([]);
	});
});
