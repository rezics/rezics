import { describe, expect, it } from "vitest";

import { normalizePublishRealmIds } from "./publication";

describe("Post Realm publication", () => {
	it("normalizes publication Realms into one stable set", () => {
		expect(normalizePublishRealmIds(["realm-b", "realm-a", "realm-b"])).toEqual([
			"realm-a",
			"realm-b",
		]);
		expect(normalizePublishRealmIds([])).toEqual([]);
	});
});
