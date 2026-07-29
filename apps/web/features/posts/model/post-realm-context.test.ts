import { describe, expect, it } from "vitest";

import type { PostRealmContext } from "./post-realm-context";
import { resolvePostRealmContext } from "./post-realm-context";

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

		expect(resolvePostRealmContext(realms, "requested")).toEqual({
			kind: "realm",
			realm: realms[1],
		});
	});

	it("uses the explicit global context without a Realm request", () => {
		const realms = [realm("first"), realm("second")];

		expect(resolvePostRealmContext(realms)).toEqual({ kind: "global" });
	});

	it("falls back to the global context for an unavailable Realm request", () => {
		expect(resolvePostRealmContext([realm("available")], "missing")).toEqual({
			kind: "global",
		});
		expect(resolvePostRealmContext([], "missing")).toEqual({ kind: "global" });
	});
});
