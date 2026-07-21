import {
	createDockDocument,
	createZoneBoundaryDocument,
	createZoneThemeDocument,
} from "@rezics/block";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

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

export const OfficialRealmManifest = {
	id: "019b76da-a800-7300-8000-000000000001",
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
		boundaryDocument: createZoneBoundaryDocument(
			["units"],
			[{ field: "type", operator: "equals", value: "book" }],
			"b00757a70001",
		),
		themeDocument: createZoneThemeDocument({ accent: "#a16207" }, "b00757a70002"),
		mainDockDocument: createDockDocument([], "b00757a70003"),
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
		boundaryDocument: createZoneBoundaryDocument(
			["units"],
			[{ field: "type", operator: "equals", value: "media" }],
			"b00757a70004",
		),
		themeDocument: createZoneThemeDocument({ accent: "#db2777" }, "b00757a70005"),
		mainDockDocument: createDockDocument([], "b00757a70006"),
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
		boundaryDocument: createZoneBoundaryDocument(
			["units"],
			[{ field: "type", operator: "equals", value: "software" }],
			"b00757a70007",
		),
		themeDocument: createZoneThemeDocument({ accent: "#0d9488" }, "b00757a70008"),
		mainDockDocument: createDockDocument([], "b00757a70009"),
	},
	{
		id: "019b76da-a800-7400-8000-000000000004",
		slug: "realms",
		localizations: [
			{
				language: "zh",
				title: "領域庫",
				summary: "瀏覽整理共同興趣並參與討論的社群。",
			},
			{
				language: "en",
				title: "Realm Library",
				summary: "Browse communities that organize and discuss shared interests.",
			},
		],
		ownerProfileId: OfficialProfileIds.community,
		boundaryDocument: createZoneBoundaryDocument(["realms"], [], "b00757a7000a"),
		themeDocument: createZoneThemeDocument({ accent: "#2563eb" }, "b00757a7000b"),
		mainDockDocument: createDockDocument([], "b00757a7000c"),
	},
	{
		id: "019b76da-a800-7400-8000-000000000005",
		slug: "zones",
		localizations: [
			{
				language: "zh",
				title: "專區庫",
				summary: `瀏覽橫跨 ${RezicsBrandName} 內容的可自訂整理入口。`,
			},
			{
				language: "en",
				title: "Zone Library",
				summary: `Browse customizable portals curated across ${RezicsBrandName}.`,
			},
		],
		ownerProfileId: OfficialProfileIds.editorial,
		boundaryDocument: createZoneBoundaryDocument(
			["units"],
			[{ field: "type", operator: "equals", value: "zone" }],
			"b00757a7000d",
		),
		themeDocument: createZoneThemeDocument({ accent: "#7c3aed" }, "b00757a7000e"),
		mainDockDocument: createDockDocument([], "b00757a7000f"),
	},
	{
		id: "019b76da-a800-7400-8000-000000000006",
		slug: "popular",
		localizations: [
			{
				language: "zh",
				title: "熱門",
				summary: "探索熱門內容、對話與社群動態。",
			},
			{
				language: "en",
				title: "Popular",
				summary: "Explore trending Units, conversations, and community activity.",
			},
		],
		ownerProfileId: OfficialProfileIds.editorial,
		boundaryDocument: createZoneBoundaryDocument(
			[
				"units",
				"users",
				"entity",
				"tags",
				"posts",
				"realms",
				"collections",
				"reviews",
				"polls",
			],
			[],
			"b00757a70010",
		),
		themeDocument: createZoneThemeDocument({ accent: "#ea580c" }, "b00757a70011"),
		mainDockDocument: createDockDocument([], "b00757a70012"),
	},
] as const;

export const BootstrapUnitIds = [
	...SlugNamespaceManifest.map((namespace) => namespace.id),
	...OfficialProfileManifest.map((profile) => profile.profileId),
	OfficialRealmManifest.id,
	...OfficialZoneManifest.map((zone) => zone.id),
] as const;

export const BootstrapAuthUserIds = OfficialProfileManifest.map((profile) => profile.authUserId);
export const BootstrapAccountIds = OfficialProfileManifest.map((profile) => profile.accountId);

export const ReservedBootstrapUuidv7s = [
	...BootstrapUnitIds,
	...BootstrapAuthUserIds,
	...BootstrapAccountIds,
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
}
