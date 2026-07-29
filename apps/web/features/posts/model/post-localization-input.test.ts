import { describe, expect, it } from "vitest";

import {
	nullablePostLocalizationText,
	optionalPostLocalizationText,
} from "./post-localization-input";

describe("Post localization form input", () => {
	it("trims authored metadata", () => {
		const form = new FormData();
		form.set("title", "  A title  ");
		expect(optionalPostLocalizationText(form, "title")).toBe("A title");
	});

	it("omits blank metadata during creation", () => {
		const form = new FormData();
		form.set("summary", "   ");
		expect(optionalPostLocalizationText(form, "title")).toBeUndefined();
		expect(optionalPostLocalizationText(form, "summary")).toBeUndefined();
	});

	it("uses null to clear blank metadata during replacement", () => {
		const form = new FormData();
		form.set("title", "");
		expect(nullablePostLocalizationText(form, "title")).toBeNull();
		expect(nullablePostLocalizationText(form, "summary")).toBeNull();
	});
});
