import { describe, expect, it } from "vitest";

import { normalizeExternalWebUrl } from "./external-web-url";

describe("normalizeExternalWebUrl", () => {
	it("canonicalizes HTTP URL syntax before deriving its identity", () => {
		expect(
			normalizeExternalWebUrl(
				"HTTPS://EXAMPLE.TEST:443/products/../book?edition=2&language=en#summary",
			),
		).toEqual({
			url: "https://example.test/book?edition=2&language=en#summary",
			normalizedUrl: "https://example.test/book?edition=2&language=en",
		});
	});

	it("sorts query parameters only in the identity form", () => {
		expect(normalizeExternalWebUrl("https://example.test/book?z=last&a=first")).toEqual({
			url: "https://example.test/book?z=last&a=first",
			normalizedUrl: "https://example.test/book?a=first&z=last",
		});
	});

	it("rejects non-Web protocols outside the API schema boundary", () => {
		expect(() => normalizeExternalWebUrl("ftp://example.test/book")).toThrow(
			"External web URL must use HTTP or HTTPS",
		);
	});
});
