import { createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";

import { authSearchParamsParsers, searchParamsParsers, SearchScopes } from "./search-params";

describe("URL state parsers", () => {
	it("parses search state through its declared vocabulary", () => {
		expect(searchParamsParsers.q.parseServerSide(undefined)).toBe("");
		expect(searchParamsParsers.scope.parseServerSide("posts,units")).toEqual(["posts", "units"]);
		expect(searchParamsParsers.scope.parseServerSide(undefined)).toEqual(SearchScopes);
		expect(searchParamsParsers.language.parseServerSide("zh")).toBe("zh");
		expect(searchParamsParsers.language.parseServerSide("zh-Hant")).toBeNull();
		expect(searchParamsParsers.language.parseServerSide("invalid")).toBeNull();
	});

	it("omits default values when serializing links", () => {
		const serializeSearch = createSerializer(searchParamsParsers);
		expect(serializeSearch({ q: "", scope: [...SearchScopes], language: null })).toBe("");
		expect(serializeSearch({ q: "portable text" })).toBe("?q=portable+text");
	});

	it("keeps authentication portal state explicit and rejects unknown modes", () => {
		const serializeAuth = createSerializer(authSearchParamsParsers);
		expect(authSearchParamsParsers.auth.parseServerSide("register")).toBe("register");
		expect(authSearchParamsParsers.auth.parseServerSide("unknown")).toBeNull();
		expect(serializeAuth({ auth: "login", next: "/create" })).toBe("?auth=login&next=/create");
	});
});
