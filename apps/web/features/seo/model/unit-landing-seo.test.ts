import { create } from "native-i18n";
import { resources } from "@rezics/i18n/resources";
import type { GetPublicUnitSeoProjectionStatus200 } from "@rezics/openapi-tanstack-query";
import { describe, expect, it } from "vitest";

import { buildUnitLandingSeoDocument } from "./unit-landing-seo";

const UnitId = "00000000-0000-4000-8000-000000000001";
const ZoneId = "00000000-0000-4000-8000-000000000002";
const translation = await create(resources).getTranslation(["brand", "seo"], ["en"]);
type PresentedProjection = Extract<GetPublicUnitSeoProjectionStatus200, { presentation: object }>;
type PresentedProjectionOverrides = Partial<
	Omit<PresentedProjection, "indexing" | "presentation">
> & {
	readonly indexing?: PresentedProjection["indexing"];
	readonly presentation?: PresentedProjection["presentation"];
};

function projection(overrides: PresentedProjectionOverrides = {}): PresentedProjection {
	const defaultPresentation: PresentedProjection["presentation"] = {
		language: "en",
		title: "Types and Proofs",
		description: "A careful introduction.",
		image: { id: ZoneId, url: "https://assets.example/cover" },
		context: null,
	};
	const shared: Omit<PresentedProjection, "indexing"> = {
		id: overrides.id ?? UnitId,
		owner: overrides.owner ?? "publishing",
		shape: overrides.shape ?? "text_version",
		contentRating: overrides.contentRating ?? "general",
		publishedAt: overrides.publishedAt ?? "2026-08-01T00:00:00.000Z",
		updatedAt: overrides.updatedAt ?? "2026-08-02T00:00:00.000Z",
		presentation: overrides.presentation ?? defaultPresentation,
	};
	if (overrides.indexing?.state === "noindex") return { ...shared, indexing: overrides.indexing };
	return { ...shared, indexing: { state: "index" } };
}

function build(
	value: GetPublicUnitSeoProjectionStatus200 | null,
	expectedOwner: GetPublicUnitSeoProjectionStatus200["owner"] = "publishing",
) {
	return buildUnitLandingSeoDocument({
		unitId: UnitId,
		expectedOwner,
		canonicalPath: `/catalog/${expectedOwner}/${UnitId}`,
		projection: value,
		frontendOrigin: new URL("https://www.rezics.com"),
		t: translation.t,
	});
}

describe("Unit landing SEO metadata", () => {
	it.each(["general", "r15"] as const)("indexes a public %s Unit", (contentRating) => {
		const document = build(projection({ contentRating }));

		expect(document.metadata.title).toBe("Types and Proofs (Text version) | REZICS");
		expect(document.metadata.alternates).toEqual({
			canonical: `/catalog/publishing/${UnitId}`,
		});
		expect(document.metadata.robots).toEqual({ index: true, follow: true });
		expect(document.metadata.openGraph).toMatchObject({
			url: `/catalog/publishing/${UnitId}`,
			title: "Types and Proofs (Text version) | REZICS",
		});
		expect(document.structuredData).not.toBeNull();
	});

	it("keeps an explicit presentation language out of the canonical identity", () => {
		const document = buildUnitLandingSeoDocument({
			unitId: UnitId,
			expectedOwner: "publishing",
			canonicalPath: `/catalog/publishing/${UnitId}`,
			requestedLanguage: "ja",
			projection: projection({
				presentation: {
					language: "ja",
					title: "型と証明",
					description: null,
					image: null,
					context: null,
				},
			}),
			frontendOrigin: new URL("https://www.rezics.com"),
			t: translation.t,
		});

		expect(document.metadata.alternates).toEqual({
			canonical: `/catalog/publishing/${UnitId}`,
		});
		expect(document.metadata.title).toBe("型と証明 (Text version) | REZICS");
	});

	it.each(["r18", "r18g"] as const)("does not leak authored metadata for %s", (contentRating) => {
		const adult: GetPublicUnitSeoProjectionStatus200 = {
			id: UnitId,
			owner: "publishing",
			shape: "text_version",
			contentRating,
			publishedAt: "2026-08-01T00:00:00.000Z",
			updatedAt: "2026-08-02T00:00:00.000Z",
			indexing: { state: "noindex", reason: "adult" },
			presentation: null,
		};
		const document = build(adult);
		const serialized = JSON.stringify(document);

		expect(document.metadata.title).toBe("Restricted content | REZICS");
		expect(document.metadata.robots).toMatchObject({
			index: false,
			follow: false,
			noimageindex: true,
		});
		expect(document.structuredData).toBeNull();
		expect(serialized).not.toContain("Types and Proofs");
		expect(serialized).not.toContain("assets.example");
	});

	it("keeps an unlisted safe Unit canonicalized but out of the index", () => {
		const value = projection({ indexing: { state: "noindex", reason: "unlisted" } });
		const document = build(value);

		expect(document.metadata.title).toBe("Types and Proofs (Text version) | REZICS");
		expect(document.metadata.robots).toMatchObject({ index: false, noimageindex: true });
		expect(document.structuredData).toBeNull();
	});

	it("uses a localized factual description when authored prose is absent", () => {
		const value = projection({
			presentation: {
				language: "en",
				title: "Types and Proofs",
				description: null,
				image: null,
				context: null,
			},
		});

		expect(build(value).metadata.description).toBe(
			"View the Text version “Types and Proofs” on REZICS.",
		);
	});

	it("presents a native software release without asserting an application shape", () => {
		const document = build(projection({ owner: "software", shape: "release" }), "software");

		expect(document.metadata.title).toBe("Types and Proofs (Software release) | REZICS");
		expect(document.metadata.alternates).toEqual({
			canonical: `/catalog/software/${UnitId}`,
		});
		expect(document.structuredData).toMatchObject({
			"@graph": expect.arrayContaining([
				expect.objectContaining({ "@type": "CreativeWork", name: "Types and Proofs" }),
			]),
		});
	});

	it("refuses a projection whose immutable identity or owner does not match the route", () => {
		const document = build(projection(), "software");

		expect(document.metadata.title).toBe("Page information unavailable | REZICS");
		expect(document.metadata.robots).toMatchObject({ index: false });
		expect(document.structuredData).toBeNull();
	});

	it("adds the owning Zone to a Zone Page breadcrumb", () => {
		const value = projection({
			owner: "post",
			shape: "page",
			presentation: {
				language: "en",
				title: "Reading guide",
				description: null,
				image: null,
				context: { kind: "zone_page", zoneId: ZoneId, zoneTitle: "Books" },
			},
		});
		const document = buildUnitLandingSeoDocument({
			unitId: UnitId,
			expectedOwner: "post",
			expectedShape: "page",
			canonicalPath: "/z/books/guide",
			parentCanonicalPath: "/z/books",
			projection: value,
			frontendOrigin: new URL("https://www.rezics.com"),
			t: translation.t,
		});

		expect(document.metadata.title).toBe("Reading guide — Books | REZICS");
		expect(JSON.stringify(document.structuredData)).toContain("https://www.rezics.com/z/books");
	});
	it("omits an unknown source language from structured metadata", () => {
		const value = projection({
			presentation: {
				language: null,
				title: "Unspecified language",
				description: null,
				image: null,
				context: null,
			},
		});
		expect(JSON.stringify(build(value).structuredData)).not.toContain("inLanguage");
	});
	it("keeps character identities distinct from real people", () => {
		const value = projection({
			owner: "entity",
			shape: "character",
			presentation: {
				language: "en",
				title: "Fictional character",
				description: null,
				image: null,
				context: { kind: "entity", shape: "character" },
			},
		});
		expect(build(value, "entity").structuredData).toMatchObject({
			"@graph": expect.arrayContaining([expect.objectContaining({ "@type": "Thing" })]),
		});
	});
	it("checks the concrete page shape at a Zone Page route", () => {
		const document = buildUnitLandingSeoDocument({
			unitId: UnitId,
			expectedOwner: "post",
			expectedShape: "page",
			canonicalPath: "/z/example/home",
			projection: projection({ owner: "post", shape: "review" }),
			frontendOrigin: new URL("https://www.rezics.com"),
			t: translation.t,
		});
		expect(document.structuredData).toBeNull();
		expect(document.metadata.robots).toMatchObject({ index: false });
	});
	it("does not turn a publisher attribution label into a person author", () => {
		const document = build(
			projection({
				owner: "post",
				shape: "post",
				presentation: {
					language: "en",
					title: "Announcement",
					description: null,
					image: null,
					context: { kind: "post", attributionTitle: "Publishing organization" },
				},
			}),
			"post",
		);
		expect(JSON.stringify(document.structuredData)).not.toContain('"author"');
	});
});
