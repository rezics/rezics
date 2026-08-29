import { describe, expect, it } from "vitest";

import {
	migrateBlockDocument,
	migrateLegacyZoneFilterDocument,
	migrateSharedSearchQueryDocument,
	migrateUnitLocalizationRevisionPayload,
	migrateUnitMainRevisionPayload,
} from "./filter-document-cutover";

const WorkCategories = ["units", "posts", "reviews", "collections"] as const;
const BookBoundary = {
	_type: "zone-boundary",
	_key: "b00757a70001",
	categories: [...WorkCategories],
	filter: {
		any: [
			{ kind: { in: ["book"] } },
			{ post: { is: { subject: { is: { kind: { in: ["book"] } } } } } },
			{ collection: { is: { items: { some: { kind: { in: ["book"] } } } } } },
		],
	},
} as const;

function legacyBookSearchDocument() {
	return {
		version: 1,
		template: { id: "book", version: 1 },
		categories: [...WorkCategories],
		controls: [
			{
				key: "language",
				field: "language",
				enabled: true,
				disclosure: "visible",
			},
			{
				key: "book-word-count",
				field: "book-word-count",
				enabled: true,
				disclosure: "visible",
			},
		],
	};
}

describe("FilterDocument production cutover", () => {
	it("keeps the Zone boundary and removes generated template capability configuration", () => {
		expect(
			migrateLegacyZoneFilterDocument({
				boundaryDocument: BookBoundary,
				searchDocument: legacyBookSearchDocument(),
				searchEnabled: true,
			}),
		).toEqual({
			categories: [...WorkCategories],
			where: BookBoundary.filter,
		});
	});

	it("retains explicit administrator control changes but drops no-op limits", () => {
		const document = legacyBookSearchDocument();
		document.controls = [
			...document.controls,
			{
				key: "tag",
				field: "tag",
				enabled: false,
				disclosure: "visible",
			},
		];
		expect(
			migrateLegacyZoneFilterDocument({
				boundaryDocument: BookBoundary,
				searchDocument: document,
				searchEnabled: true,
			}),
		).toEqual({
			categories: [...WorkCategories],
			where: BookBoundary.filter,
			controls: [{ key: "tag", enabled: false }],
		});
	});

	it("turns shared template identity into a plain effective FilterDocument snapshot", () => {
		expect(
			migrateSharedSearchQueryDocument({
				version: 1,
				template: "zone",
				state: {},
				selections: [],
			}),
		).toEqual({
			filterDocument: {
				categories: ["units"],
				where: { kind: { in: ["zone"] } },
			},
			state: {},
			selections: [],
		});
	});

	it("preserves template selection when the old Zone boundary was wider", () => {
		expect(
			migrateLegacyZoneFilterDocument({
				boundaryDocument: {
					_type: "zone-boundary",
					_key: "b00757a70003",
					categories: ["units", "realms"],
				},
				searchDocument: {
					version: 1,
					template: { id: "zone", version: 1 },
					categories: ["units"],
					controls: [],
				},
				searchEnabled: true,
			}),
		).toEqual({
			categories: ["units"],
			where: { kind: { in: ["zone"] } },
		});
	});

	it("removes nested Block template sources without traversing authored text", () => {
		const document = {
			_type: "block-document",
			_key: "111111111111",
			blocks: [
				{
					_type: "group",
					_key: "222222222222",
					layout: "stack",
					blocks: [
						{
							_type: "feed",
							_key: "333333333333",
							feature: { kind: "template", template: "book" },
							presentation: { pagination: "load-more", showResultCount: true },
						},
					],
				},
			],
		};
		const migrated = migrateBlockDocument(document);
		expect(migrated.changed).toBe(true);
		expect(migrated.value).toEqual({
			...document,
			blocks: [
				{
					...document.blocks[0],
					blocks: [
						{
							...document.blocks[0]!.blocks[0],
							feature: {
								kind: "inline",
								filterDocument: { categories: [...WorkCategories] },
							},
						},
					],
				},
			],
		});
	});

	it("rewrites Zone main and localization history payloads", () => {
		const main = migrateUnitMainRevisionPayload({
			version: 1,
			kind: "zone",
			unit: {},
			extension: { boundaryDocument: BookBoundary, appearanceDocument: { accent: "#a16207" } },
		});
		expect(main.changed).toBe(true);
		expect(main.value).toEqual({
			version: 1,
			kind: "zone",
			unit: {},
			extension: {
				filterDocument: { categories: [...WorkCategories], where: BookBoundary.filter },
				appearanceDocument: { accent: "#a16207" },
			},
		});

		const localization = migrateUnitLocalizationRevisionPayload({
			version: 1,
			localization: {
				language: "en",
				content: {
					_type: "block-document",
					_key: "111111111111",
					blocks: [
						{
							_type: "feed",
							_key: "222222222222",
							feature: { kind: "template", template: "global" },
							presentation: { pagination: "infinite", showResultCount: false },
						},
					],
				},
			},
		});
		expect(localization.changed).toBe(true);
		expect(localization.value).toMatchObject({
			localization: { content: { blocks: [{ feature: { kind: "global" } }] } },
		});
	});
});
