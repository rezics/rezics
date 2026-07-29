import { describe, expect, it } from "vitest";

import type { PostRealmContext } from "./post-realm-context";
import { selectPostRealmContext } from "./post-realm-context";

function realm(id: string): PostRealmContext {
	return {
		id,
		language: "en",
		slugAddress: null,
		title: id,
		summary: null,
		avatar: null,
	};
}

describe("post Realm context selection", () => {
	it("uses the requested mounted Realm when available", () => {
		const realms = [realm("first"), realm("requested")];

		expect(selectPostRealmContext(realms, "requested")?.id).toBe("requested");
	});

	it("does not infer a Realm without an explicit valid request", () => {
		const realms = [realm("first"), realm("second")];

		expect(selectPostRealmContext(realms)).toBeUndefined();
		expect(selectPostRealmContext(realms, "missing")).toBeUndefined();
	});

	it("keeps the empty state explicit", () => {
		expect(selectPostRealmContext([])).toBeUndefined();
	});
});
