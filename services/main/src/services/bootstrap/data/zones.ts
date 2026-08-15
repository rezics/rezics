import {
	createDockDocument,
	createPortableTextDocument,
	createUnitReferencedBlockDocument,
	createZoneThemeDocument,
} from "@rezics/block";
import {
	FontAwesomeProvider,
	type AvatarReference,
	type FontAwesomeIconReference,
} from "@rezics/avatar";
import { createFilterDocument, type UnitPredicate } from "@rezics/filter";
import { OfficialZoneUnitIds, ZoneHomePageSlug } from "@rezics/slug";

import { OfficialProfileIds, RezicsBrandName } from "./foundation";

function officialZoneIcon(name: string): AvatarReference {
	const icon = {
		provider: FontAwesomeProvider,
		prefix: "fas",
		name,
	} satisfies FontAwesomeIconReference;
	return { type: "icon", icon };
}

function createOfficialZoneContent(input: {
	readonly postId: string;
	readonly pageId: string;
	readonly pagesStructureId: string;
	readonly navigationId: string;
	readonly keys: readonly [string, string, string, string, string, string, string, string];
	readonly zh: { readonly title: string; readonly body: string };
	readonly en: { readonly title: string; readonly body: string };
}) {
	const [bodyKey, zhBlockKey, zhSpanKey, enBlockKey, enSpanKey, pageKey, menuKey, feedKey] =
		input.keys;
	const body = (language: "zh" | "en") => {
		const localized = input[language];
		const blockKey = language === "zh" ? zhBlockKey : enBlockKey;
		const spanKey = language === "zh" ? zhSpanKey : enSpanKey;
		return createPortableTextDocument(
			[
				{
					_type: "block",
					_key: blockKey,
					style: "normal",
					markDefs: [],
					children: [{ _type: "span", _key: spanKey, text: localized.body, marks: [] }],
				},
			],
			bodyKey,
		);
	};
	return {
		wikiPost: {
			id: input.postId,
			localizations: [
				{ language: "zh" as const, title: input.zh.title, body: body("zh") },
				{ language: "en" as const, title: input.en.title, body: body("en") },
			],
		},
		homePage: {
			id: input.pageId,
			structureId: input.pagesStructureId,
			slug: ZoneHomePageSlug,
			titleUnitId: input.postId,
			document: createUnitReferencedBlockDocument(
				[
					{
						_type: "feed",
						_key: feedKey,
						feature: { kind: "zone" },
						presentation: {
							pagination: "infinite",
							showResultCount: true,
						},
					},
				],
				pageKey,
			),
		},
		navigation: {
			id: input.navigationId,
			document: {
				_type: "navigation-document" as const,
				_key: `0${menuKey.slice(1)}`,
				items: [
					{
						_key: `1${menuKey.slice(1)}`,
						labelUnitId: input.postId,
						target: { kind: "unit" as const, unitId: input.pageId },
					},
				],
			},
		},
		mainDockDocument: createDockDocument(
			[
				{
					_type: "menu",
					_key: menuKey,
					navigationId: input.navigationId,
					orientation: "horizontal",
					appearance: "links",
				},
			],
			`2${menuKey.slice(1)}`,
		),
	};
}

const WorkZoneCategories = ["units", "posts", "reviews", "collections"] as const;

function createWorkZoneFilterDocument(kind: "book" | "media" | "software") {
	const where = {
		any: [
			{ kind: { in: [kind] } },
			{ post: { is: { subject: { is: { kind: { in: [kind] } } } } } },
			{ collection: { is: { items: { some: { kind: { in: [kind] } } } } } },
		],
	} satisfies UnitPredicate;
	return createFilterDocument({ categories: [...WorkZoneCategories], where });
}

export const OfficialZoneManifest = [
	{
		id: OfficialZoneUnitIds.book,
		slug: "book",
		localizations: [
			{
				language: "zh",
				title: "書籍",
				summary: `瀏覽書籍，探索 ${RezicsBrandName} 上的新讀物。`,
			},
			{
				language: "en",
				title: "Books",
				summary: `Browse books and discover new reading across ${RezicsBrandName}.`,
			},
		],
		ownerProfileId: OfficialProfileIds.editorial,
		filterDocument: createWorkZoneFilterDocument("book"),
		themeDocument: createZoneThemeDocument({ accent: "#a16207" }, "b00757a70002"),
		avatar: officialZoneIcon("book-open"),
		...createOfficialZoneContent({
			postId: "019b76da-a800-7500-8000-000000000001",
			pageId: "019b76da-a800-7600-8000-000000000001",
			pagesStructureId: "019b76da-a800-7650-8000-000000000001",
			navigationId: "019b76da-a800-7700-8000-000000000001",
			keys: [
				"b00757010001",
				"b00757010002",
				"b00757010003",
				"b00757010004",
				"b00757010005",
				"b00757010006",
				"b00757010008",
				"b0075701000a",
			],
			zh: { title: "書籍首頁", body: "探索書籍、版本與相關內容。" },
			en: {
				title: "Books Home",
				body: "Explore works, editions, and related content.",
			},
		}),
	},
	{
		id: OfficialZoneUnitIds.media,
		slug: "media",
		localizations: [
			{
				language: "zh",
				title: "媒體",
				summary: `瀏覽 ${RezicsBrandName} 上的電影、電視、動畫與其他媒體。`,
			},
			{
				language: "en",
				title: "Media",
				summary: `Browse films, television, animation, and other media across ${RezicsBrandName}.`,
			},
		],
		ownerProfileId: OfficialProfileIds.editorial,
		filterDocument: createWorkZoneFilterDocument("media"),
		themeDocument: createZoneThemeDocument({ accent: "#db2777" }, "b00757a70005"),
		avatar: officialZoneIcon("clapperboard"),
		...createOfficialZoneContent({
			postId: "019b76da-a800-7500-8000-000000000002",
			pageId: "019b76da-a800-7600-8000-000000000002",
			pagesStructureId: "019b76da-a800-7650-8000-000000000002",
			navigationId: "019b76da-a800-7700-8000-000000000002",
			keys: [
				"b00757020001",
				"b00757020002",
				"b00757020003",
				"b00757020004",
				"b00757020005",
				"b00757020006",
				"b00757020008",
				"b0075702000a",
			],
			zh: { title: "媒體首頁", body: "探索電影、電視、動畫與相關內容。" },
			en: {
				title: "Media Home",
				body: "Explore films, television, animation, and related content.",
			},
		}),
	},
	{
		id: OfficialZoneUnitIds.software,
		slug: "software",
		localizations: [
			{
				language: "zh",
				title: "軟體",
				summary: `瀏覽 ${RezicsBrandName} 上的應用程式、工具與遊戲。`,
			},
			{
				language: "en",
				title: "Software",
				summary: `Browse applications, tools, and games across ${RezicsBrandName}.`,
			},
		],
		ownerProfileId: OfficialProfileIds.editorial,
		filterDocument: createWorkZoneFilterDocument("software"),
		themeDocument: createZoneThemeDocument({ accent: "#0d9488" }, "b00757a70008"),
		avatar: officialZoneIcon("code"),
		...createOfficialZoneContent({
			postId: "019b76da-a800-7500-8000-000000000003",
			pageId: "019b76da-a800-7600-8000-000000000003",
			pagesStructureId: "019b76da-a800-7650-8000-000000000003",
			navigationId: "019b76da-a800-7700-8000-000000000003",
			keys: [
				"b00757030001",
				"b00757030002",
				"b00757030003",
				"b00757030004",
				"b00757030005",
				"b00757030006",
				"b00757030008",
				"b0075703000a",
			],
			zh: { title: "軟體首頁", body: "探索應用程式、工具、遊戲與相關內容。" },
			en: {
				title: "Software Home",
				body: "Explore applications, tools, games, and related content.",
			},
		}),
	},
	{
		id: OfficialZoneUnitIds.realm,
		slug: "realm",
		localizations: [
			{
				language: "zh",
				title: "領域",
				summary: `瀏覽與探索 ${RezicsBrandName} 上的領域。`,
			},
			{
				language: "en",
				title: "Realms",
				summary: `Browse and discover Realms across ${RezicsBrandName}.`,
			},
		],
		ownerProfileId: OfficialProfileIds.editorial,
		filterDocument: createFilterDocument({ categories: ["realms"] }),
		themeDocument: createZoneThemeDocument({ accent: "#7c3aed" }, "b00757a7000b"),
		avatar: officialZoneIcon("people-group"),
		...createOfficialZoneContent({
			postId: "019b76da-a800-7500-8000-000000000004",
			pageId: "019b76da-a800-7600-8000-000000000004",
			pagesStructureId: "019b76da-a800-7650-8000-000000000004",
			navigationId: "019b76da-a800-7700-8000-000000000004",
			keys: [
				"b00757040001",
				"b00757040002",
				"b00757040003",
				"b00757040004",
				"b00757040005",
				"b00757040006",
				"b00757040008",
				"b0075704000a",
			],
			zh: { title: "領域首頁", body: "探索社群、主題與相關內容。" },
			en: {
				title: "Realms Home",
				body: "Explore communities, topics, and related content.",
			},
		}),
	},
	{
		id: OfficialZoneUnitIds.zone,
		slug: "zone",
		localizations: [
			{
				language: "zh",
				title: "專區",
				summary: `瀏覽與探索 ${RezicsBrandName} 上的專區。`,
			},
			{
				language: "en",
				title: "Zones",
				summary: `Browse and discover Zones across ${RezicsBrandName}.`,
			},
		],
		ownerProfileId: OfficialProfileIds.editorial,
		filterDocument: createFilterDocument({
			categories: ["units"],
			where: { kind: { in: ["zone"] } },
		}),
		themeDocument: createZoneThemeDocument({ accent: "#2563eb" }, "b00757a7000e"),
		avatar: officialZoneIcon("compass"),
		...createOfficialZoneContent({
			postId: "019b76da-a800-7500-8000-000000000005",
			pageId: "019b76da-a800-7600-8000-000000000005",
			pagesStructureId: "019b76da-a800-7650-8000-000000000005",
			navigationId: "019b76da-a800-7700-8000-000000000005",
			keys: [
				"b00757050001",
				"b00757050002",
				"b00757050003",
				"b00757050004",
				"b00757050005",
				"b00757050006",
				"b00757050008",
				"b0075705000a",
			],
			zh: { title: "專區首頁", body: "探索各種策展與瀏覽體驗。" },
			en: {
				title: "Zones Home",
				body: "Explore curated browsing experiences across Zones.",
			},
		}),
	},
] as const;
