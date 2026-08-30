import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";

import {
	PublicSlugAddressResponse,
	ResolveScopedSlugAddressQuery,
	ScopedSlugAddressParams,
} from "./schema";

const ScopeUnitId = "019b76da-a800-7000-8000-000000000001";

describe("public scoped slug API contract", () => {
	it("requires an explicit direct scope and validated label", () => {
		expect(Check(ScopedSlugAddressParams, { scopeUnitId: ScopeUnitId, slug: "alice" })).toBe(true);
		expect(Check(ScopedSlugAddressParams, { slug: "alice" })).toBe(false);
		expect(Check(ScopedSlugAddressParams, { scopeUnitId: ScopeUnitId, slug: "Alice" })).toBe(false);
	});

	it("accepts only a known expected Unit kind", () => {
		expect(Check(ResolveScopedSlugAddressQuery, { kind: "profile" })).toBe(true);
		expect(Check(ResolveScopedSlugAddressQuery, { kind: "unknown" })).toBe(false);
	});

	it("projects slug, scope, and canonical path atomically", () => {
		expect(
			Check(PublicSlugAddressResponse, {
				slug: "alice",
				scopeUnitId: ScopeUnitId,
				canonicalPath: ["users", "alice"],
			}),
		).toBe(true);
		expect(
			Check(PublicSlugAddressResponse, {
				slug: "alice",
				scopeUnitId: ScopeUnitId,
			}),
		).toBe(false);
	});
});
