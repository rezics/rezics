import { describe, expect, it } from "vitest";

import { studioContentHref, studioSectionCreateHref } from "../model/studio-section";
import { parseStudioSection, studioSectionHref } from "./studio-routes";

describe("Studio routes", () => {
	it("creates and parses typed section routes", () => {
		expect(studioSectionHref("realm")).toBe("/create/realm");
		expect(parseStudioSection("/create/review")).toBe("review");
		expect(parseStudioSection("/create/review/")).toBe("review");
		expect(parseStudioSection("/create/zone")).toBe("zone");
		expect(parseStudioSection("/create/wiki")).toBe("wiki");
		expect(parseStudioSection("/create")).toBeUndefined();
	});

	it("links every section to its released detail route", () => {
		expect(studioContentHref("book", "unit-id")).toBe("/units/book/unit-id");
		expect(studioContentHref("realm", "unit-id")).toBe("/realm/unit-id");
		expect(studioContentHref("zone", "unit-id")).toBe("/zone/unit-id");
		expect(studioContentHref("review", "unit-id")).toBe("/reviews/unit-id");
		expect(studioContentHref("wiki", "unit-id")).toBe("/posts/unit-id");
		expect(studioSectionCreateHref("book")).toBe("/units/book/new");
		expect(studioSectionCreateHref("wiki")).toBeUndefined();
	});
});
