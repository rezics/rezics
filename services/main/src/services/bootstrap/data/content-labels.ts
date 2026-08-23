import { OfficialProfileIds } from "./foundation";

export const ContentLabelRegistryMaximumSize = 16;

/** Fixed, strictly bounded whole-document/display label vocabulary. */
export const ContentLabelRegistryManifest = [
	{
		key: "contentSpoilerNone",
		id: "019b76da-a800-7370-8000-000000000001",
		slug: "content-spoiler-none",
		kind: "content_spoiler",
		spoilerLevel: 0,
		ownerProfileId: OfficialProfileIds.moderation,
		localizations: [
			{ language: "zh", title: "無內容劇透" },
			{ language: "en", title: "No content spoilers" },
		],
	},
	{
		key: "contentSpoilerMinor",
		id: "019b76da-a800-7370-8000-000000000002",
		slug: "content-spoiler-minor",
		kind: "content_spoiler",
		spoilerLevel: 1,
		ownerProfileId: OfficialProfileIds.moderation,
		localizations: [
			{ language: "zh", title: "輕微內容劇透" },
			{ language: "en", title: "Minor content spoilers" },
		],
	},
	{
		key: "contentSpoilerMajor",
		id: "019b76da-a800-7370-8000-000000000003",
		slug: "content-spoiler-major",
		kind: "content_spoiler",
		spoilerLevel: 2,
		ownerProfileId: OfficialProfileIds.moderation,
		localizations: [
			{ language: "zh", title: "重大內容劇透" },
			{ language: "en", title: "Major content spoilers" },
		],
	},
	{
		key: "nsfw",
		id: "019b76da-a800-7370-8000-000000000004",
		slug: "nsfw",
		kind: "nsfw",
		spoilerLevel: null,
		ownerProfileId: OfficialProfileIds.moderation,
		localizations: [
			{ language: "zh", title: "不宜公開展示" },
			{ language: "en", title: "NSFW" },
		],
	},
] as const;

export const ContentSpoilerLabelManifest = ContentLabelRegistryManifest.filter(
	(label) => label.kind === "content_spoiler",
);
export const ContentSpoilerLabelIds = ContentSpoilerLabelManifest.map((label) => label.id);
export const ContentLabelRegistryIds = ContentLabelRegistryManifest.map((label) => label.id);
export const NsfwContentLabelId = ContentLabelRegistryManifest[3].id;
