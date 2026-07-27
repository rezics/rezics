import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());
const select = vi.hoisted(() => vi.fn());
const getPublicCanonicalUnitSlugAddresses = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({
	database: { execute, select },
}));

vi.mock("../units/slug-address", () => ({
	getPublicCanonicalUnitSlugAddresses,
}));

import { listStudioContent } from "./service";

const ProfileId = "019b76da-a800-7300-8000-000000000001";
const UnitId = "019b76da-a800-7300-8000-000000000002";
const AuthorizationUnitId = "019b76da-a800-7300-8000-000000000003";
const RelevantAt = new Date("2026-07-27T08:00:00.000Z");

function resourceSelect() {
	return {
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn(async () => [
					{
						id: UnitId,
						language: "en",
						title: "Public work",
						status: "published",
						visibility: "public",
						createdAt: new Date("2026-01-01T00:00:00.000Z"),
						updatedAt: new Date("2026-07-01T00:00:00.000Z"),
					},
				]),
			})),
		})),
	};
}

function activitySelect(rows: readonly object[]) {
	return {
		from: vi.fn(() => ({
			where: vi.fn(async () => rows),
		})),
	};
}

function candidate() {
	return {
		id: UnitId,
		relevantAt: RelevantAt,
		lastVisitedAt: null,
		bucket: false,
		sortAt: RelevantAt,
	};
}

function deniedAuthorization() {
	return {
		canRead: vi.fn(async () => true),
		decide: vi.fn(async () => ({ allowed: false as const, reason: "ungranted" as const })),
		findAllowedScope: vi.fn(async () => undefined),
		matchesActiveBinding: vi.fn(async () => true),
	};
}

describe("Studio work presentation", () => {
	beforeEach(() => {
		execute.mockReset();
		select.mockReset();
		getPublicCanonicalUnitSlugAddresses.mockReset();
		getPublicCanonicalUnitSlugAddresses.mockResolvedValue(new Map());
	});

	it("keeps historical contributions readable after update access is revoked", async () => {
		execute.mockResolvedValueOnce({ rows: [candidate()] }).mockResolvedValueOnce({ rows: [] });
		select
			.mockImplementationOnce(() =>
				activitySelect([
					{
						resourceUnitId: UnitId,
						authorizationUnitId: AuthorizationUnitId,
						authorizationScope: null,
						relation: "contributed",
						firstAt: RelevantAt,
						lastAt: RelevantAt,
						activityCount: 3,
					},
				]),
			)
			.mockImplementationOnce(resourceSelect);

		const result = await listStudioContent({
			profileId: ProfileId,
			authorization: deniedAuthorization(),
			query: { section: "wiki", view: "contributed", sort: "recent", limit: 1 },
		});

		expect(result.items).toHaveLength(1);
		expect(result.items[0]).toMatchObject({
			id: UnitId,
			relations: ["contributed"],
			workState: "blocked",
			permissions: [],
			contributionCount: 3,
		});
	});

	it("keeps a direct management assignment visible when protections block its actions", async () => {
		execute.mockResolvedValueOnce({ rows: [candidate()] }).mockResolvedValueOnce({
			rows: [
				{
					id: "019b76da-a800-7300-8000-000000000004",
					resourceUnitId: UnitId,
					authorizationUnitId: UnitId,
					relation: "assigned",
					role: "editor",
					scope: [],
					createdAt: RelevantAt,
				},
			],
		});
		select
			.mockImplementationOnce(() => activitySelect([]))
			.mockImplementationOnce(resourceSelect);

		const result = await listStudioContent({
			profileId: ProfileId,
			authorization: deniedAuthorization(),
			query: { section: "book", view: "assigned", sort: "recent", limit: 1 },
		});

		expect(result.items).toHaveLength(1);
		expect(result.items[0]).toMatchObject({
			id: UnitId,
			relations: ["assigned"],
			roles: ["editor"],
			workState: "blocked",
			permissions: [],
		});
	});
});
