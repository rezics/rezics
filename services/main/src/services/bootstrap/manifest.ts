import { PlatformCapabilityValues } from "@rezics/access";
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
import {
	FontAwesomeProvider,
	type AvatarReference,
	type FontAwesomeIconReference,
} from "@rezics/avatar";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import type { UnitPredicate } from "@rezics/filter";
import { OfficialRealmUnitIds, OfficialZoneUnitIds, ZoneHomePageSlug } from "@rezics/slug";

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
		favoritesCollectionId: "019b76da-a800-7250-8000-000000000001",
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
		favoritesCollectionId: "019b76da-a800-7250-8000-000000000002",
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
		favoritesCollectionId: "019b76da-a800-7250-8000-000000000003",
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

export const BootstrapPlatformAdministratorProfile = {
	key: "platformAdministrator",
	authUserId: "019b76da-a800-7100-8000-000000000004",
	accountId: "019b76da-a800-7110-8000-000000000004",
	profileId: "019b76da-a800-7200-8000-000000000004",
	favoritesCollectionId: "019b76da-a800-7250-8000-000000000004",
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
	BootstrapPlatformAdministratorProfile,
] as const;
export const BootstrapProfileIdValues: readonly string[] = BootstrapProfileManifest.map(
	(profile) => profile.profileId,
);

export const BootstrapPlatformAccessManifest = [
	{
		profileId: BootstrapPlatformAdministratorProfile.profileId,
		grantedByProfileId: BootstrapPlatformAdministratorProfile.profileId,
		capabilities: BootstrapPlatformAdministratorProfile.capabilities,
	},
	{
		profileId: OfficialProfileIds.moderation,
		grantedByProfileId: BootstrapPlatformAdministratorProfile.profileId,
		capabilities: ["platform.moderate"],
	},
] as const;

export const OfficialRealmManifest = {
	id: OfficialRealmUnitIds.community,
	slug: "rezics",
	authenticatedContributions: true,
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
		OfficialProfileIds.community,
		OfficialProfileIds.editorial,
		OfficialProfileIds.moderation,
	],
	access: [
		{
			profileId: OfficialProfileIds.editorial,
			permissions: [
				"unit.read",
				"unit.update",
				"unit.status.update",
				"unit.access.manage",
				"realm.contribute",
				"realm.settings.update",
				"realm.members.read",
				"realm.members.manage",
				"realm.rules.update",
				"realm.pins.manage",
				"realm.tags.manage",
				"realm.units.moderate",
			],
		},
		{
			profileId: OfficialProfileIds.moderation,
			permissions: [
				"unit.read",
				"realm.contribute",
				"realm.members.read",
				"realm.members.manage",
				"realm.pins.manage",
				"realm.units.moderate",
			],
		},
	] as const,
} as const;

export const RezicsScoreRealmManifest = {
	id: OfficialRealmUnitIds.score,
	slug: "score",
	authenticatedContributions: true,
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
		OfficialProfileIds.community,
		OfficialProfileIds.editorial,
		OfficialProfileIds.moderation,
	],
	access: [
		{
			profileId: OfficialProfileIds.editorial,
			permissions: [
				"unit.read",
				"unit.update",
				"unit.status.update",
				"unit.access.manage",
				"realm.contribute",
				"realm.settings.update",
				"realm.members.read",
				"realm.members.manage",
				"realm.rules.update",
				"realm.pins.manage",
				"realm.tags.manage",
				"realm.units.moderate",
			],
		},
		{
			profileId: OfficialProfileIds.moderation,
			permissions: [
				"unit.read",
				"realm.contribute",
				"realm.members.read",
				"realm.members.manage",
				"realm.pins.manage",
				"realm.units.moderate",
			],
		},
	] as const,
} as const;

function bootstrapRuleContent(
	text: string,
	keys: readonly [documentKey: string, blockKey: string, spanKey: string],
) {
	const [documentKey, blockKey, spanKey] = keys;
	return createPortableTextDocument(
		[
			{
				_type: "block",
				_key: blockKey,
				style: "normal",
				markDefs: [],
				children: [{ _type: "span", _key: spanKey, text, marks: [] }],
			},
		],
		documentKey,
	);
}

export const RezicsRuleRealmManifest = {
	id: OfficialRealmUnitIds.rule,
	slug: "rule",
	authenticatedContributions: false,
	localizations: [
		{
			language: "zh",
			title: `${RezicsBrandName} Rule`,
			summary: `${RezicsBrandName} 的全域內容檢舉規則來源。`,
		},
		{
			language: "en",
			title: `${RezicsBrandName} Rule`,
			summary: `The rule source for platform-wide content reports on ${RezicsBrandName}.`,
		},
	],
	ownerProfileId: OfficialProfileIds.community,
	members: [
		OfficialProfileIds.community,
		OfficialProfileIds.editorial,
		OfficialProfileIds.moderation,
	],
	access: [
		{
			profileId: OfficialProfileIds.editorial,
			permissions: [
				"unit.read",
				"unit.update",
				"unit.status.update",
				"unit.access.manage",
				"realm.settings.update",
				"realm.members.read",
				"realm.members.manage",
				"realm.rules.update",
			],
		},
		{
			profileId: OfficialProfileIds.moderation,
			permissions: ["unit.read", "realm.members.read"],
		},
	] as const,
	rules: {
		revisionId: "019b76da-a800-7350-8000-000000000001",
		version: 1,
		acknowledgementMode: "explicit",
		requireOnJoin: false,
		requireOnPost: false,
		items: [
			{
				id: "019b76da-a800-7360-8000-000000000001",
				localizations: [
					{
						language: "zh",
						title: "垃圾內容與操縱行為",
						content: bootstrapRuleContent(
							"請檢舉大量重複、誤導、未經請求的宣傳，或企圖操縱互動與排序的內容。",
							["b00759010001", "b00759010002", "b00759010003"],
						),
					},
					{
						language: "en",
						title: "Spam and manipulation",
						content: bootstrapRuleContent(
							"Report repetitive, deceptive, unsolicited promotional content or attempts to manipulate engagement and ranking.",
							["b00759010004", "b00759010005", "b00759010006"],
						),
					},
				],
			},
			{
				id: "019b76da-a800-7360-8000-000000000002",
				localizations: [
					{
						language: "zh",
						title: "騷擾與仇恨行為",
						content: bootstrapRuleContent(
							"請檢舉針對個人或群體的威脅、持續騷擾、羞辱或仇恨內容。",
							["b00759020001", "b00759020002", "b00759020003"],
						),
					},
					{
						language: "en",
						title: "Harassment and hateful conduct",
						content: bootstrapRuleContent(
							"Report threats, sustained harassment, humiliation, or hateful content targeting a person or group.",
							["b00759020004", "b00759020005", "b00759020006"],
						),
					},
				],
			},
			{
				id: "019b76da-a800-7360-8000-000000000003",
				localizations: [
					{
						language: "zh",
						title: "危險或違法內容",
						content: bootstrapRuleContent(
							"請檢舉鼓勵嚴重傷害、剝削、違法交易，或可能立即危及他人的內容。",
							["b00759030001", "b00759030002", "b00759030003"],
						),
					},
					{
						language: "en",
						title: "Dangerous or unlawful content",
						content: bootstrapRuleContent(
							"Report content that encourages serious harm, exploitation, unlawful trade, or an immediate danger to others.",
							["b00759030004", "b00759030005", "b00759030006"],
						),
					},
				],
			},
			{
				id: "019b76da-a800-7360-8000-000000000004",
				localizations: [
					{
						language: "zh",
						title: "其他平台規則違規",
						content: bootstrapRuleContent(
							"若內容違反其他全域規則，請選擇此項並在補充說明中指出具體問題。",
							["b00759040001", "b00759040002", "b00759040003"],
						),
					},
					{
						language: "en",
						title: "Other platform-rule violation",
						content: bootstrapRuleContent(
							"Choose this rule for another platform-wide violation and identify the specific issue in the additional details.",
							["b00759040004", "b00759040005", "b00759040006"],
						),
					},
				],
			},
			{
				id: "019b76da-a800-7360-8000-000000000005",
				localizations: [
					{
						language: "zh",
						title: "智慧財產權侵害",
						content: bootstrapRuleContent(
							"請檢舉疑似在未獲授權或欠缺其他合法依據的情況下，重製、散布或使用受著作權、商標或其他智慧財產權保護的內容。請在補充說明中列出原作或權利來源，以及疑似侵權的理由。",
							["b00759050001", "b00759050002", "b00759050003"],
						),
					},
					{
						language: "en",
						title: "Intellectual property infringement",
						content: bootstrapRuleContent(
							"Report content that may reproduce, distribute, or use copyright-, trademark-, or other intellectual-property-protected material without authorization or another lawful basis. In the additional details, identify the original work or rights source and explain the suspected infringement.",
							["b00759050004", "b00759050005", "b00759050006"],
						),
					},
				],
			},
		],
	},
} as const;

export const BootstrapRealmManifest = [
	OfficialRealmManifest,
	RezicsScoreRealmManifest,
	RezicsRuleRealmManifest,
] as const;

export const OfficialZoneAvatarAsset = {
	id: "019b76da-a800-7800-8000-000000000001",
	objectId: "019b76da-a800-7810-8000-000000000001",
	storageKey: "bootstrap/image-objects/official-zone-avatar/original",
} as const;

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
	} satisfies UnitPredicate;
	return createZoneBoundaryDocument([...CatalogZoneCategories], filter, key);
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
		searchTemplate: "book",
		boundaryDocument: createCatalogZoneBoundaryDocument("book", "b00757a70001"),
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
		searchTemplate: "media",
		boundaryDocument: createCatalogZoneBoundaryDocument("media", "b00757a70004"),
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
		searchTemplate: "software",
		boundaryDocument: createCatalogZoneBoundaryDocument("software", "b00757a70007"),
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
		searchTemplate: "realm",
		boundaryDocument: createZoneBoundaryDocument(["realms"], undefined, "b00757a7000a"),
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
		searchTemplate: "zone",
		boundaryDocument: createZoneBoundaryDocument(
			["units"],
			{ kind: { in: ["zone"] } },
			"b00757a7000d",
		),
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

export const BootstrapUnitIds = [
	...SlugNamespaceManifest.map((namespace) => namespace.id),
	...BootstrapProfileManifest.map((profile) => profile.profileId),
	...BootstrapProfileManifest.map((profile) => profile.favoritesCollectionId),
	...BootstrapRealmManifest.map((realm) => realm.id),
	...RezicsRuleRealmManifest.rules.items.map((rule) => rule.id),
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
	RezicsRuleRealmManifest.rules.revisionId,
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
