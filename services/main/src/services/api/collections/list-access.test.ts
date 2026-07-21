import { describe, expect, it } from "vitest";

import { canListAllOwnedCollections } from "./list-access";

describe("canListAllOwnedCollections", () => {
	it("allows an authenticated owner to list unpublished collections", () => {
		expect(canListAllOwnedCollections({ ownerId: "profile-a", viewerId: "profile-a" })).toBe(
			true,
		);
	});

	it("keeps anonymous and other-owner queries on the public listing boundary", () => {
		expect(canListAllOwnedCollections({ ownerId: "profile-a", viewerId: undefined })).toBe(
			false,
		);
		expect(canListAllOwnedCollections({ ownerId: "profile-a", viewerId: "profile-b" })).toBe(
			false,
		);
		expect(canListAllOwnedCollections({ ownerId: undefined, viewerId: "profile-a" })).toBe(
			false,
		);
	});
});
