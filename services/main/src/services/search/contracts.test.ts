import { describe, expect, it } from "vitest";

import {
	extractCanonicalSearchText,
	parseCurrentSearchDocument,
	parseRevisionSearchDocument,
} from "./contracts";

const unitId = "019f7eed-5d42-7102-8387-cc1d13b176d2";
const revisionId = "019f7eed-5d42-7102-8387-cc1d13b176d3";

describe("versioned search projection contracts", () => {
	it("extracts only allow-listed Portable Text spans", () => {
		expect(
			extractCanonicalSearchText({
				_type: "portable-text",
				content: [
					{
						_type: "block",
						_key: "block-1",
						children: [
							{ _type: "span", _key: "span-1", text: "Multilingual", marks: [] },
							{ _type: "secret", _key: "inline", value: "not indexed" },
							{ _type: "span", _key: "span-2", text: " search", marks: [] },
						],
					},
					{ _type: "private-widget", _key: "custom", text: "not indexed" },
				],
			}),
		).toBe("Multilingual search");
	});

	it("validates a complete current document and rejects private extras", () => {
		const document = {
			id: unitId,
			projectionVersion: 2,
			revision: 4,
			category: "units",
			unitType: "book",
			subtype: "book",
			search: {
				primaryTitles: ["書"],
				titles: ["書", "Book"],
				aliases: ["Volume"],
				summaries: [],
				descriptions: [],
				publishedContent: [],
			},
			languages: ["zh", "en"],
			filters: {
				contentRating: "general",
				aiDisclosure: "none",
				license: null,
				tagIds: [],
				realmIds: [],
				publisherIds: [],
				subjectId: null,
				rootId: null,
				parentId: null,
				ownerId: null,
				joinPolicy: null,
				pollMode: null,
				resultsVisibility: null,
				closesAt: null,
				scopeOwnerIds: [],
			},
			access: {
				publicDiscoverable: true,
				authenticated: false,
				profileIds: [],
				realmIds: [],
			},
			catalog: { licensed: false, releaseAt: null },
			book: {
				isbn13: "9780000000000",
				publicationAt: null,
				pageCount: 320,
				format: "paperback",
			},
			media: null,
			software: null,
			variant: { role: "standalone", mainUnitId: null },
			ranking: {
				createdAt: 1,
				updatedAt: 2,
				publishedAt: 2,
				followerCount: 0,
				replyCount: 0,
				recommendationSnapshotId: null,
				recommendationBest: 0,
				engagement24h: 0,
			},
		};
		expect(parseCurrentSearchDocument(document)).toBe(document);
		expect(() =>
			parseCurrentSearchDocument({ ...document, email: "private@example.com" }),
		).toThrow();
	});

	it("requires hidden revision values to be removed from stored search fields", () => {
		const hidden = {
			id: revisionId,
			projectionVersion: 1,
			revision: 3,
			unitId,
			parentRevisionId: null,
			unitType: "book",
			search: { historicalTitles: [], editSummary: "", publicContent: [] },
			filters: { actorProfileId: null, minor: false, tags: ["content"], createdAt: 1 },
			visibility: { contentVisible: false, summaryVisible: false, actorVisible: false },
		};
		expect(parseRevisionSearchDocument(hidden)).toBe(hidden);
	});

	it("rejects unregistered publication License filters", () => {
		const document = {
			id: unitId,
			projectionVersion: 2,
			revision: 1,
			category: "units",
			unitType: "book",
			subtype: "book",
			search: {
				primaryTitles: [],
				titles: [],
				aliases: [],
				summaries: [],
				descriptions: [],
				publishedContent: [],
			},
			languages: [],
			filters: {
				contentRating: "general",
				aiDisclosure: "unknown",
				license: "unknown",
				tagIds: [],
				realmIds: [],
				publisherIds: [],
				subjectId: null,
				rootId: null,
				parentId: null,
				ownerId: null,
				joinPolicy: null,
				pollMode: null,
				resultsVisibility: null,
				closesAt: null,
				scopeOwnerIds: [],
			},
			access: {
				publicDiscoverable: true,
				authenticated: false,
				profileIds: [],
				realmIds: [],
			},
			catalog: { licensed: false, releaseAt: null },
			book: { isbn13: null, publicationAt: null, pageCount: null, format: null },
			media: null,
			software: null,
			variant: { role: "standalone", mainUnitId: null },
			ranking: {
				createdAt: 1,
				updatedAt: 1,
				publishedAt: null,
				followerCount: 0,
				replyCount: 0,
				recommendationSnapshotId: null,
				recommendationBest: 0,
				engagement24h: 0,
			},
		};
		expect(() => parseCurrentSearchDocument(document)).toThrow();
	});
});
