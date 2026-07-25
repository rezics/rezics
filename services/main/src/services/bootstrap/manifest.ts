import {
	createDockDocument,
	createPortableTextDocument,
	createUnitReferencedBlockDocument,
	createZoneBoundaryDocument,
	createZoneThemeDocument,
	assertDockDocument,
	assertNavigationDocument,
	assertUnitReferencedBlockDocument,
	assertWikiPostPortableTextDocument,
	ZonePageBlockHostPolicy,
} from "@rezics/block";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import type { UnitFilter } from "@rezics/filter";
import { OfficialRealmUnitIds, ZoneHomePageSlug } from "@rezics/slug";

import { PlatformCapabilityValues } from "../database/schema/contract-values";
import { TopLevelSlugNamespaceUnitIds } from "../units/slug-system";

export { TopLevelSlugNamespaceUnitIds };

export const BootstrapEpochIso = "2026-01-01T00:00:00.000Z";
export const BootstrapEpochUnixMilliseconds = 1_767_225_600_000;
const RezicsBrandName = verbatimTerms.rezics.value;

export const SlugNamespaceManifest = [
	...Object.entries(TopLevelSlugNamespaceUnitIds).map(([slug, id]) => ({ id, slug })),
] as const;

export const OfficialProfileManifest = [
	{
		key: "community",
		authUserId: "019b76da-a800-7100-8000-000000000001",
		accountId: "019b76da-a800-7110-8000-000000000001",
		profileId: "019b76da-a800-7200-8000-000000000001",
		slug: "rezics-community",
		name: `${RezicsBrandName} Community`,
		localizations: [
			{ language: "zh", title: `${RezicsBrandName} 社群` },
			{ language: "en", title: `${RezicsBrandName} Community` },
		],
		email: "community@rezics.com",
	},
	{
		key: "editorial",
		authUserId: "019b76da-a800-7100-8000-000000000002",
		accountId: "019b76da-a800-7110-8000-000000000002",
		profileId: "019b76da-a800-7200-8000-000000000002",
		slug: "rezics-editorial",
		name: `${RezicsBrandName} Editorial`,
		localizations: [
			{ language: "zh", title: `${RezicsBrandName} 編輯部` },
			{ language: "en", title: `${RezicsBrandName} Editorial` },
		],
		email: "editorial@rezics.com",
	},
	{
		key: "moderation",
		authUserId: "019b76da-a800-7100-8000-000000000003",
		accountId: "019b76da-a800-7110-8000-000000000003",
		profileId: "019b76da-a800-7200-8000-000000000003",
		slug: "rezics-moderation",
		name: `${RezicsBrandName} Moderation`,
		localizations: [
			{ language: "zh", title: `${RezicsBrandName} 管理團隊` },
			{ language: "en", title: `${RezicsBrandName} Moderation` },
		],
		email: "moderation@rezics.com",
	},
] as const;

export type OfficialProfileKey = (typeof OfficialProfileManifest)[number]["key"];

export const OfficialProfileIds = {
	community: OfficialProfileManifest[0].profileId,
	editorial: OfficialProfileManifest[1].profileId,
	moderation: OfficialProfileManifest[2].profileId,
} as const satisfies Record<OfficialProfileKey, string>;
export const OfficialProfileIdValues: readonly string[] = OfficialProfileManifest.map(
	(profile) => profile.profileId,
);

export const BootstrapSuperAdminProfile = {
	key: "superAdmin",
	authUserId: "019b76da-a800-7100-8000-000000000004",
	accountId: "019b76da-a800-7110-8000-000000000004",
	profileId: "019b76da-a800-7200-8000-000000000004",
	slug: "rezics-admin",
	name: `${RezicsBrandName} Administrator`,
	localizations: [
		{ language: "zh", title: `${RezicsBrandName} 系統管理員` },
		{ language: "en", title: `${RezicsBrandName} Administrator` },
	],
	email: "admin@rezics.com",
	capabilities: PlatformCapabilityValues,
} as const;

export const BootstrapProfileManifest = [
	...OfficialProfileManifest,
	BootstrapSuperAdminProfile,
] as const;
export const BootstrapProfileIdValues: readonly string[] = BootstrapProfileManifest.map(
	(profile) => profile.profileId,
);

export const OfficialRealmManifest = {
	id: OfficialRealmUnitIds.community,
	slug: "rezics",
	localizations: [
		{
			language: "zh",
			title: RezicsBrandName,
			summary: `${RezicsBrandName} 官方社群領域。`,
		},
		{
			language: "en",
			title: RezicsBrandName,
			summary: `The official ${RezicsBrandName} community Realm.`,
		},
	],
	ownerProfileId: OfficialProfileIds.community,
	members: [
		{ profileId: OfficialProfileIds.community, role: "owner" as const },
		{ profileId: OfficialProfileIds.editorial, role: "admin" as const },
		{ profileId: OfficialProfileIds.moderation, role: "moderator" as const },
	],
} as const;

export const RezicsScoreRealmManifest = {
	id: OfficialRealmUnitIds.score,
	slug: "score",
	localizations: [
		{
			language: "zh",
			title: `${RezicsBrandName} 評分`,
			summary: `${RezicsBrandName} 評分產品的標準評分領域。`,
		},
		{
			language: "en",
			title: `${RezicsBrandName} Score`,
			summary: `The standard rating Realm for the ${RezicsBrandName} Score product.`,
		},
	],
	ownerProfileId: OfficialProfileIds.community,
	members: [
		{ profileId: OfficialProfileIds.community, role: "owner" as const },
		{ profileId: OfficialProfileIds.editorial, role: "admin" as const },
		{ profileId: OfficialProfileIds.moderation, role: "moderator" as const },
	],
} as const;

export const BootstrapRealmManifest = [OfficialRealmManifest, RezicsScoreRealmManifest] as const;

export const OfficialZoneAvatarAsset = {
	id: "019b76da-a800-7800-8000-000000000001",
	objectId: "019b76da-a800-7810-8000-000000000001",
	storageKey: "bootstrap/image-objects/official-zone-avatar/original",
} as const;

function createOfficialZoneContent(input: {
	readonly postId: string;
	readonly pageId: string;
	readonly pagesStructureId: string;
	readonly navigationId: string;
	readonly keys: readonly [
		string,
		string,
		string,
		string,
		string,
		string,
		string,
		string,
		string,
	];
	readonly zh: { readonly title: string; readonly body: string };
	readonly en: { readonly title: string; readonly body: string };
}) {
	const [
		bodyKey,
		zhBlockKey,
		zhSpanKey,
		enBlockKey,
		enSpanKey,
		pageKey,
		fullViewKey,
		menuKey,
		feedKey,
	] = input.keys;
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
					{ _type: "post-full-view", _key: fullViewKey, postId: input.postId },
					{
						_type: "feed",
						_key: feedKey,
						feature: { kind: "zone" },
						presentation: {
							pagination: "load-more",
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

const CatalogZoneCategories = ["units", "posts", "reviews", "collections"] as const;

function createCatalogZoneBoundaryDocument(kind: "book" | "media" | "software", key: string) {
	const filter = {
		any: [
			{ kind: { in: [kind] } },
			{ post: { is: { subject: { is: { kind: { in: [kind] } } } } } },
			{ collection: { is: { items: { some: { kind: { in: [kind] } } } } } },
		],
	} satisfies UnitFilter;
	return createZoneBoundaryDocument([...CatalogZoneCategories], filter, key);
}

export const OfficialZoneManifest = [
	{
		id: "019b76da-a800-7400-8000-000000000001",
		slug: "book",
		localizations: [
			{
				language: "zh",
				title: "書庫",
				summary: `瀏覽書籍，探索 ${RezicsBrandName} 上的新讀物。`,
			},
			{
				language: "en",
				title: "Book Library",
				summary: `Browse books and discover new reading across ${RezicsBrandName}.`,
			},
		],
		ownerProfileId: OfficialProfileIds.editorial,
		searchTemplate: "book",
		boundaryDocument: createCatalogZoneBoundaryDocument("book", "b00757a70001"),
		themeDocument: createZoneThemeDocument({ accent: "#a16207" }, "b00757a70002"),
		avatarAssetId: OfficialZoneAvatarAsset.id,
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
				"b00757010007",
				"b00757010008",
				"b0075701000a",
			],
			zh: { title: "書庫首頁", body: "從書庫探索作品、版本與相關內容。" },
			en: {
				title: "Book Library Home",
				body: "Explore works, editions, and related content.",
			},
		}),
	},
	{
		id: "019b76da-a800-7400-8000-000000000002",
		slug: "media",
		localizations: [
			{
				language: "zh",
				title: "媒體庫",
				summary: `瀏覽 ${RezicsBrandName} 上的電影、電視、動畫與其他媒體。`,
			},
			{
				language: "en",
				title: "Media Library",
				summary: `Browse films, television, animation, and other media across ${RezicsBrandName}.`,
			},
		],
		ownerProfileId: OfficialProfileIds.editorial,
		searchTemplate: "media",
		boundaryDocument: createCatalogZoneBoundaryDocument("media", "b00757a70004"),
		themeDocument: createZoneThemeDocument({ accent: "#db2777" }, "b00757a70005"),
		avatarAssetId: OfficialZoneAvatarAsset.id,
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
				"b00757020007",
				"b00757020008",
				"b0075702000a",
			],
			zh: { title: "媒體庫首頁", body: "從媒體庫探索電影、電視、動畫與相關內容。" },
			en: {
				title: "Media Library Home",
				body: "Explore films, television, animation, and related content.",
			},
		}),
	},
	{
		id: "019b76da-a800-7400-8000-000000000003",
		slug: "software",
		localizations: [
			{
				language: "zh",
				title: "軟體庫",
				summary: `瀏覽 ${RezicsBrandName} 上的應用程式、工具與遊戲。`,
			},
			{
				language: "en",
				title: "Software Library",
				summary: `Browse applications, tools, and games across ${RezicsBrandName}.`,
			},
		],
		ownerProfileId: OfficialProfileIds.editorial,
		searchTemplate: "software",
		boundaryDocument: createCatalogZoneBoundaryDocument("software", "b00757a70007"),
		themeDocument: createZoneThemeDocument({ accent: "#0d9488" }, "b00757a70008"),
		avatarAssetId: OfficialZoneAvatarAsset.id,
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
				"b00757030007",
				"b00757030008",
				"b0075703000a",
			],
			zh: { title: "軟體庫首頁", body: "從軟體庫探索應用程式、工具、遊戲與相關內容。" },
			en: {
				title: "Software Library Home",
				body: "Explore applications, tools, games, and related content.",
			},
		}),
	},
	{
		id: "019b76da-a800-7400-8000-000000000004",
		slug: "realm",
		localizations: [
			{
				language: "zh",
				title: "領域庫",
				summary: `瀏覽與探索 ${RezicsBrandName} 上的領域。`,
			},
			{
				language: "en",
				title: "Realm Library",
				summary: `Browse and discover Realms across ${RezicsBrandName}.`,
			},
		],
		ownerProfileId: OfficialProfileIds.editorial,
		searchTemplate: "realm",
		boundaryDocument: createZoneBoundaryDocument(["realms"], undefined, "b00757a7000a"),
		themeDocument: createZoneThemeDocument({ accent: "#7c3aed" }, "b00757a7000b"),
		avatarAssetId: OfficialZoneAvatarAsset.id,
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
				"b00757040007",
				"b00757040008",
				"b0075704000a",
			],
			zh: { title: "領域庫首頁", body: "從領域庫探索社群、主題與相關內容。" },
			en: {
				title: "Realm Library Home",
				body: "Explore communities, topics, and related content.",
			},
		}),
	},
	{
		id: "019b76da-a800-7400-8000-000000000005",
		slug: "zone",
		localizations: [
			{
				language: "zh",
				title: "專區庫",
				summary: `瀏覽與探索 ${RezicsBrandName} 上的專區。`,
			},
			{
				language: "en",
				title: "Zone Library",
				summary: `Browse and discover Zones across ${RezicsBrandName}.`,
			},
		],
		ownerProfileId: OfficialProfileIds.editorial,
		searchTemplate: "zone",
		boundaryDocument: createZoneBoundaryDocument(
			["units"],
			{ kind: { in: ["zone"] } },
			"b00757a7000d",
		),
		themeDocument: createZoneThemeDocument({ accent: "#2563eb" }, "b00757a7000e"),
		avatarAssetId: OfficialZoneAvatarAsset.id,
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
				"b00757050007",
				"b00757050008",
				"b0075705000a",
			],
			zh: { title: "專區庫首頁", body: "從專區庫探索各種策展與瀏覽體驗。" },
			en: {
				title: "Zone Library Home",
				body: "Explore curated browsing experiences across Zones.",
			},
		}),
	},
] as const;

export const BootstrapUnitIds = [
	...SlugNamespaceManifest.map((namespace) => namespace.id),
	...BootstrapProfileManifest.map((profile) => profile.profileId),
	...BootstrapRealmManifest.map((realm) => realm.id),
	...OfficialZoneManifest.map((zone) => zone.id),
	...OfficialZoneManifest.map((zone) => zone.wikiPost.id),
	...OfficialZoneManifest.map((zone) => zone.homePage.id),
] as const;

export const BootstrapAuthUserIds = BootstrapProfileManifest.map((profile) => profile.authUserId);
export const BootstrapAccountIds = BootstrapProfileManifest.map((profile) => profile.accountId);

export const ReservedBootstrapUuidv7s = [
	...BootstrapUnitIds,
	...BootstrapAuthUserIds,
	...BootstrapAccountIds,
	...OfficialZoneManifest.map((zone) => zone.homePage.structureId),
	...OfficialZoneManifest.map((zone) => zone.navigation.id),
	OfficialZoneAvatarAsset.id,
	OfficialZoneAvatarAsset.objectId,
] as const;

const UuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function uuidv7UnixMilliseconds(value: string): number {
	if (!UuidV7Pattern.test(value)) throw new Error(`Invalid reserved UUIDv7: ${value}`);
	return Number.parseInt(value.slice(0, 8) + value.slice(9, 13), 16);
}

export function assertBootstrapManifest(): void {
	const uniqueIds = new Set(ReservedBootstrapUuidv7s);
	if (uniqueIds.size !== ReservedBootstrapUuidv7s.length)
		throw new Error("Bootstrap manifest contains duplicate UUIDs");
	for (const id of ReservedBootstrapUuidv7s) {
		if (uuidv7UnixMilliseconds(id) !== BootstrapEpochUnixMilliseconds)
			throw new Error(`Bootstrap UUID does not use ${BootstrapEpochIso}: ${id}`);
	}
	for (const zone of OfficialZoneManifest) {
		assertDockDocument(zone.mainDockDocument);
		assertNavigationDocument(zone.navigation.document);
		assertUnitReferencedBlockDocument(zone.homePage.document, ZonePageBlockHostPolicy);
		for (const localization of zone.wikiPost.localizations)
			assertWikiPostPortableTextDocument(localization.body);
	}
}
