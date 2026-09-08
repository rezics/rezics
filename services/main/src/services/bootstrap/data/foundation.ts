import { PlatformCapabilityValues } from "@rezics/access";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import { TopLevelSlugNamespaceIds } from "../../units/slug-system";

export { TopLevelSlugNamespaceIds };

export const BootstrapEpochIso = "2026-01-01T00:00:00.000Z";
export const BootstrapEpochUnixMilliseconds = 1_767_225_600_000;
export const RezicsBrandName = verbatimTerms.rezics.value;

export const SlugNamespaceManifest = [
	...(["users", "realms", "tags", "zones", "entities"] as const).map((slug) => ({
		id: TopLevelSlugNamespaceIds[slug],
		slug,
	})),
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

export const BootstrapPlatformAdministratorProfile = {
	key: "platformAdministrator",
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
	BootstrapPlatformAdministratorProfile,
] as const;
/** Human bootstrap login. Official organizations receive explicit grants from this operator. */
export const BootstrapAccountManifest = [BootstrapPlatformAdministratorProfile] as const;
export const BootstrapProfileIdValues: readonly string[] = BootstrapProfileManifest.map(
	(profile) => profile.profileId,
);

export const BootstrapPlatformAccessManifest = [
	{
		authUserId: BootstrapPlatformAdministratorProfile.authUserId,
		grantedByAuthUserId: BootstrapPlatformAdministratorProfile.authUserId,
		capabilities: BootstrapPlatformAdministratorProfile.capabilities,
	},
] as const;
