import {
	createBlockDocument,
	createZoneBoundaryDocument,
	createZoneThemeDocument,
} from "@rezics/block";

import { TopLevelSlugNamespaceUnitIds } from "../units/slug-system";

export { TopLevelSlugNamespaceUnitIds };

export const BootstrapEpochIso = "2026-01-01T00:00:00.000Z";
export const BootstrapEpochUnixMilliseconds = 1_767_225_600_000;

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
		name: "Rezics Community",
		email: "community@rezics.com",
	},
	{
		key: "editorial",
		authUserId: "019b76da-a800-7100-8000-000000000002",
		accountId: "019b76da-a800-7110-8000-000000000002",
		profileId: "019b76da-a800-7200-8000-000000000002",
		slug: "rezics-editorial",
		name: "Rezics Editorial",
		email: "editorial@rezics.com",
	},
	{
		key: "moderation",
		authUserId: "019b76da-a800-7100-8000-000000000003",
		accountId: "019b76da-a800-7110-8000-000000000003",
		profileId: "019b76da-a800-7200-8000-000000000003",
		slug: "rezics-moderation",
		name: "Rezics Moderation",
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
	title: "Rezics",
	summary: "The official Rezics community realm.",
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
		slug: "discover",
		title: "Discover",
		summary: "Works and conversations selected by Rezics Editorial.",
		ownerProfileId: OfficialProfileIds.editorial,
		boundaryDocument: createZoneBoundaryDocument(["units", "posts"], [], "b00757a70001"),
		themeDocument: createZoneThemeDocument({ accent: "#f97360" }, "b00757a70002"),
		dockDocument: createBlockDocument([], "b00757a70003"),
	},
	{
		id: "019b76da-a800-7400-8000-000000000002",
		slug: "communities",
		title: "Communities",
		summary: "Active Realms and the discussions growing around them.",
		ownerProfileId: OfficialProfileIds.community,
		boundaryDocument: createZoneBoundaryDocument(["realms", "posts"], [], "b00757a70004"),
		themeDocument: createZoneThemeDocument({ accent: "#3b82f6" }, "b00757a70005"),
		dockDocument: createBlockDocument([], "b00757a70006"),
	},
	{
		id: "019b76da-a800-7400-8000-000000000003",
		slug: "collections",
		title: "Collections",
		summary: "Curated shelves, reviews, and paths through the catalog.",
		ownerProfileId: OfficialProfileIds.editorial,
		boundaryDocument: createZoneBoundaryDocument(
			["collections", "reviews"],
			[],
			"b00757a70007",
		),
		themeDocument: createZoneThemeDocument({ accent: "#8b5cf6" }, "b00757a70008"),
		dockDocument: createBlockDocument([], "b00757a70009"),
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
