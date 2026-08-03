import { describe, expect, it } from "vitest";

import { fontAwesomeWorkerVariables } from "./vite-worker-environment";

describe("fontAwesomeWorkerVariables", () => {
	it("selectively copies configured Font Awesome variables", () => {
		expect(
			fontAwesomeWorkerVariables({
				FONT_AWESOME_KIT_CSS_URL: " https://cdn.example.com/font-awesome.css ",
				FONT_AWESOME_KIT_LICENSE: " pro ",
				UNRELATED_SECRET: "must-not-cross-the-worker-boundary",
			}),
		).toEqual({
			FONT_AWESOME_KIT_CSS_URL: "https://cdn.example.com/font-awesome.css",
			FONT_AWESOME_KIT_LICENSE: "pro",
		});
	});

	it("omits missing and empty variables", () => {
		expect(
			fontAwesomeWorkerVariables({
				FONT_AWESOME_KIT_CSS_URL: "  ",
			}),
		).toEqual({});
	});
});
