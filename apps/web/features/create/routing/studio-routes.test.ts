import { TopLevelSlugNamespaceUnitIds } from "@rezics/slug";
import { describe, expect, it } from "vitest";

import {
	studioContentHref,
	studioSectionCreateActions,
	studioSectionCreateHref,
	StudioTagPathCreateHref,
} from "../model/studio-section";
import { parseStudioSection, studioSectionHref } from "./studio-routes";

describe("Studio routes", () => {
	it("creates and parses typed section routes", () => {
		expect(studioSectionHref("realm")).toBe("/create/realm");
		expect(parseStudioSection("/create/review")).toBe("review");
		expect(parseStudioSection("/create/review/")).toBe("review");
		expect(parseStudioSection("/create/entity/search")).toBe("entity");
		expect(parseStudioSection("/create/tag/new")).toBe("tag");
		expect(parseStudioSection("/create/zone")).toBe("zone");
		expect(parseStudioSection("/create/wiki")).toBe("wiki");
		expect(parseStudioSection("/create")).toBeUndefined();
	});

	it("links every section to its released detail route", () => {
		expect(studioContentHref("book", { id: "unit-id" })).toBe("/units/book/unit-id");
		expect(studioContentHref("realm", { id: "unit-id", slugAddress: null })).toBe("/realm/unit-id");
		expect(
			studioContentHref("zone", {
				id: "unit-id",
				slugAddress: {
					slug: "artists",
					scopeUnitId: TopLevelSlugNamespaceUnitIds.zones,
					canonicalPath: ["zones", "artists"],
				},
			}),
		).toBe("/z/artists");
		expect(studioContentHref("review", { id: "unit-id" })).toBe("/posts/unit-id");
		expect(studioContentHref("wiki", { id: "unit-id" })).toBe("/posts/unit-id");
		expect(studioSectionCreateHref("book")).toBe("/create/book/new");
		expect(studioSectionCreateHref("wiki")).toBe("/create/wiki/new");
		expect(studioSectionCreateHref("tag")).toBe("/create/tag/new");
		expect(StudioTagPathCreateHref).toBe("/create/tag/path/new");
	});

	it("preserves legacy creation context on canonical Studio routes", () => {
		expect(
			studioSectionCreateHref("entity", {
				kind: "organization",
				ownershipMode: "community_owned",
				title: ["OpenAI", "Research"],
				unused: undefined,
			}),
		).toBe(
			"/create/entity/new?kind=organization&ownershipMode=community_owned&title=OpenAI&title=Research",
		);
	});

	it("describes the creation lifecycle at the point of action", () => {
		expect(studioSectionCreateActions("book")).toEqual([
			{ kind: "section", href: "/create/book/new", lifecycle: "configurable" },
		]);
		expect(studioSectionCreateActions("collection")[0]?.lifecycle).toBe("private_first");
		expect(studioSectionCreateActions("zone")[0]?.lifecycle).toBe("preview");
		expect(studioSectionCreateActions("tag")).toEqual([
			{ kind: "section", href: "/create/tag/new", lifecycle: "publish_now" },
			{ kind: "tag_path", href: "/create/tag/path/new", lifecycle: "immutable" },
		]);
	});
});
