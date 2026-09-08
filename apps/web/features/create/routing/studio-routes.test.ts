import { TopLevelSlugNamespaceIds } from "@rezics/slug";
import { describe, expect, it } from "vitest";

import {
	studioContentHref,
	studioSectionCreateActions,
	studioSectionCreateHref,
	StudioSectionGroups,
	StudioSectionIds,
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
		expect(studioContentHref("publishing", { id: "unit-id" })).toBe("/catalog/publishing/unit-id");
		expect(studioContentHref("realm", { id: "unit-id", slugAddress: null })).toBe("/realm/unit-id");
		expect(
			studioContentHref("zone", {
				id: "unit-id",
				slugAddress: {
					slug: "artists",
					scopeUnitId: null,
					scopeNamespaceId: TopLevelSlugNamespaceIds.zones,
					canonicalPath: ["zones", "artists"],
				},
			}),
		).toBe("/z/artists");
		expect(studioContentHref("post", { id: "unit-id" })).toBe("/posts/unit-id");
		expect(studioContentHref("post", { id: "unit-id" })).toBe("/posts/unit-id");
		expect(studioSectionCreateHref("publishing")).toBe("/create/publishing/new");
		expect(studioSectionCreateHref("wiki")).toBe("/create/wiki/new");
		expect(studioSectionCreateHref("tag")).toBe("/create/tag/new");
		expect(StudioTagPathCreateHref).toBe("/create/tag/path/new");
	});

	it("preserves explicit native creation context on canonical Studio routes", () => {
		expect(
			studioSectionCreateHref("entity", {
				kind: "entity",
				shape: "organization",
				title: ["OpenAI", "Research"],
				unused: undefined,
			}),
		).toBe("/create/entity/new?kind=entity&shape=organization&title=OpenAI&title=Research");
	});

	it("describes the creation lifecycle at the point of action", () => {
		expect(studioSectionCreateActions("publishing")).toEqual([
			{ kind: "section", href: "/create/publishing/new", lifecycle: "private_first" },
		]);
		expect(studioSectionCreateActions("collection")[0]?.lifecycle).toBe("private_first");
		expect(studioSectionCreateActions("zone")[0]?.lifecycle).toBe("preview");
		expect(studioSectionCreateActions("tag")).toEqual([
			{ kind: "section", href: "/create/tag/new", lifecycle: "publish_now" },
			{ kind: "tag_path", href: "/create/tag/path/new", lifecycle: "immutable" },
		]);
	});

	it("groups every Studio section exactly once on the overview", () => {
		const grouped = StudioSectionGroups.flatMap((group) => group.sectionIds);
		expect(grouped).toHaveLength(StudioSectionIds.length);
		expect(new Set(grouped)).toEqual(new Set(StudioSectionIds));
		expect(StudioSectionGroups.map((group) => group.id)).toEqual([
			"catalog",
			"content",
			"organization",
			"vocabulary",
		]);
	});
});
