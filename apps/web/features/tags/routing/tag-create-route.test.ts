import { describe, expect, it } from "vitest";

import {
	loadTagCreateRoute,
	unitTagVoteCreateHref,
	unitTagVoteDuplicateSearchHref,
} from "./tag-create-route";

const UnitId = "00000000-0000-7000-8000-000000000001";
const RealmId = "00000000-0000-7000-8000-000000000002";

describe("Tag creation routes", () => {
	it("creates and validates a global Unit Tag-vote continuation", async () => {
		const href = unitTagVoteCreateHref("  science  ", {
			type: "book",
			unitId: UnitId,
			context: { kind: "global" },
		});
		const url = new URL(href, "https://rezics.example");

		expect(url.pathname).toBe("/create/tag/new");
		expect(url.searchParams.get("communityUnitSearch")).toBeNull();
		await expect(loadTagCreateRoute(Object.fromEntries(url.searchParams))).resolves.toEqual({
			status: "ready",
			initialTitle: "science",
			intent: {
				kind: "unit-tag-vote",
				type: "book",
				unitId: UnitId,
				context: { kind: "global" },
			},
		});
	});

	it("keeps a valid Realm address and rejects incomplete or invalid addresses", async () => {
		const href = unitTagVoteCreateHref("science", {
			type: "media",
			unitId: UnitId,
			context: { kind: "realm", realmId: RealmId },
		});
		const url = new URL(href, "https://rezics.example");

		await expect(
			loadTagCreateRoute(Object.fromEntries(url.searchParams)),
		).resolves.toMatchObject({
			status: "ready",
			intent: {
				kind: "unit-tag-vote",
				type: "media",
				unitId: UnitId,
				context: { kind: "realm", realmId: RealmId },
			},
		});
		await expect(
			loadTagCreateRoute({
				context: "realm",
				intent: "unit-tag-vote",
				unitId: UnitId,
				unitType: "media",
			}),
		).resolves.toEqual({ status: "invalid" });
		await expect(
			loadTagCreateRoute({
				context: "global",
				intent: "unit-tag-vote",
				unitId: "not-a-unit-id",
				unitType: "media",
			}),
		).resolves.toEqual({ status: "invalid" });
	});

	it("treats a route without a continuation as standalone creation", async () => {
		await expect(loadTagCreateRoute({ title: "science" })).resolves.toEqual({
			status: "ready",
			initialTitle: "science",
			intent: { kind: "standalone" },
		});
	});

	it("preserves the Unit and Realm while returning to duplicate search", () => {
		const href = unitTagVoteDuplicateSearchHref("  science  ", {
			type: "software",
			unitId: UnitId,
			context: { kind: "realm", realmId: RealmId },
		});
		const url = new URL(href, "https://rezics.example");

		expect(url.pathname).toBe("/create/tag/search");
		expect(url.searchParams.get("kind")).toBe("tag");
		expect(url.searchParams.get("q")).toBe("science");
		expect(url.searchParams.get("unitType")).toBe("software");
		expect(url.searchParams.get("unitId")).toBe(UnitId);
		expect(url.searchParams.get("context")).toBe("realm");
		expect(url.searchParams.get("realmId")).toBe(RealmId);
	});
});
