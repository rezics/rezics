import { createPortableTextDocument, createUnitReferencedBlockDocument } from "@rezics/block";
import { describe, expect, it } from "vitest";

import { ContentStructureInvalid } from "../content-structure/errors";
import { readZonePageLocalization } from "./pages";

const FeedDocument = createUnitReferencedBlockDocument(
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

describe("readZonePageLocalization", () => {
	it("returns a complete unit-referenced document", () => {
		expect(
			readZonePageLocalization({
				language: "zh",
				position: "a0",
				title: "首页",
				content: FeedDocument,
				contentStatus: "published",
			}),
		).toEqual({
			language: "zh",
			title: "首页",
			document: FeedDocument,
			contentStatus: "published",
		});
	});

	it("skips an incomplete extra-language row", () => {
		expect(
			readZonePageLocalization({
				language: "ja",
				position: "a1",
				title: "ホーム",
				content: null,
				contentStatus: null,
			}),
		).toBeNull();
	});

	it("rejects Portable Text stored as a Zone Page document", () => {
		expect(() =>
			readZonePageLocalization({
				language: "zh",
				position: "a0",
				title: "首页",
				content: createPortableTextDocument([]),
				contentStatus: "published",
			}),
		).toThrow(ContentStructureInvalid);
	});
});
