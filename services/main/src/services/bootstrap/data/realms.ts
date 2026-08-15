import type { AvatarReference } from "@rezics/avatar";
import { OfficialRealmUnitIds } from "@rezics/slug";

import { OfficialProfileIds, RezicsBrandName } from "./foundation";

/**
 * Fixed image asset for the official REZICS Realm. The historical storage key
 * remains stable because released installations already store the object there.
 */
export const OfficialRealmAvatarAsset = {
	id: "019b76da-a800-7800-8000-000000000001",
	objectId: "019b76da-a800-7810-8000-000000000001",
	storageKey: "bootstrap/image-objects/official-zone-avatar/original",
	mediaType: "image/png",
	width: 800,
	height: 800,
} as const;

const OfficialRealmAvatar = {
	type: "image",
	image: { assetId: OfficialRealmAvatarAsset.id },
} as const satisfies AvatarReference;

export const OfficialRealmManifest = {
	id: OfficialRealmUnitIds.community,
	slug: "rezics",
	authenticatedContributions: true,
	localizations: [
		{
			language: "zh",
			title: RezicsBrandName,
			summary: `${RezicsBrandName} 官方社群領域。`,
			avatar: OfficialRealmAvatar,
		},
		{
			language: "en",
			title: RezicsBrandName,
			summary: `The official ${RezicsBrandName} community Realm.`,
			avatar: OfficialRealmAvatar,
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

export const RezicsRuleRealmManifest = {
	id: OfficialRealmUnitIds.rule,
	slug: "rule",
	authenticatedContributions: false,
	localizations: [
		{
			language: "zh",
			title: `${RezicsBrandName} Rule`,
			summary: `${RezicsBrandName} 的全域內容與治理規則來源。`,
		},
		{
			language: "en",
			title: `${RezicsBrandName} Rule`,
			summary: `The rule source for platform-wide content and governance decisions on ${RezicsBrandName}.`,
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
} as const;

export const BootstrapRealmManifest = [
	OfficialRealmManifest,
	RezicsScoreRealmManifest,
	RezicsRuleRealmManifest,
] as const;
