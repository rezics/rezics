import { describe, expect, it } from "vitest";

import type { PostRealmContext } from "./post-realm-context";
import { selectPostRealmContext } from "./post-realm-context";

function realm(id: string): PostRealmContext {
	return {
		id,
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

	it("falls back to the first mounted Realm", () => {
		const realms = [realm("first"), realm("second")];

		expect(selectPostRealmContext(realms)?.id).toBe("first");
		expect(selectPostRealmContext(realms, "missing")?.id).toBe("first");
	});

	it("keeps the empty state explicit", () => {
		expect(selectPostRealmContext([])).toBeUndefined();
	});
});
