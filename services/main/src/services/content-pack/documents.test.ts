import { createPortableTextDocument, createUnitReferencedBlockDocument } from "@rezics/block";
import { describe, expect, it } from "vitest";

import { assertPackObjectDocuments } from "./documents";
import { ContentPackInvalid } from "./errors";
import type { PackObject } from "./contracts";

const ZonePageFeed = createUnitReferencedBlockDocument(
	[
		{
			_type: "feed",
			_key: "a40000000002",
			feature: { kind: "zone" },
			presentation: { pagination: "infinite", showResultCount: true },
		},
	],
	"a40000000001",
);

function zonePage(overrides: Partial<PackObject> = {}): PackObject {
	return {
		sourceKey: "pack:zone-page:home",
		unit: {
			kind: "zone_page",
			status: "published",
			visibility: "public",
			contentRating: "general",
			aiDisclosure: "none",
			license: "cc-by-4.0",
			moderationStatus: "approved",
			postTargetingLocked: false,
		},
		import: { ownershipMode: "profile_owned", actorKind: "import" },
		zonePage: { zoneSourceKey: "pack:zone:home" },
		post: { kind: "page", subjectSourceKey: "pack:zone:home" },
		localizations: [
			{
				language: "zh",
				title: "首页",
				content: ZonePageFeed,
				contentStatus: "published",
			},
		],
		...overrides,
	};
}

describe("assertPackObjectDocuments", () => {
	it("accepts a zone page whose content is a unit-referenced feed", () => {
		expect(() => assertPackObjectDocuments(zonePage())).not.toThrow();
	});

	it("rejects a zone page whose content is Portable Text", () => {
		expect(() =>
			assertPackObjectDocuments(
				zonePage({
					localizations: [
						{
							language: "zh",
							title: "首页",
							content: createPortableTextDocument([]),
							contentStatus: "published",
						},
					],
				}),
			),
		).toThrow(ContentPackInvalid);
	});

	it("rejects an incomplete zone page localization", () => {
		expect(() =>
			assertPackObjectDocuments(
				zonePage({
					localizations: [{ language: "ja", title: "ホーム" }],
				}),
			),
		).toThrow(/incomplete/);
	});
});
