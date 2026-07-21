import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";

import english from "./languages/en/content-feed";
import traditionalChinese from "./languages/zh-Hant/content-feed";
import type { FeedFixtureLocalizedContent } from "./content-feed/localized-content";

export const FixtureContentLanguages = ContentLanguageValues;
export type FixtureContentLanguage = ContentLanguage;

export const FeedFixtureAssetIds = ["book-cover", "post-media"] as const;
export type FeedFixtureAssetId = (typeof FeedFixtureAssetIds)[number];

export interface FeedFixtureData {
	readonly referenceTime: string;
	readonly createdAt: string;
	readonly recommendationReason: "followed_publisher";
	readonly publisher: {
		readonly name: string;
		readonly initials: string;
		readonly href: string;
	};
	readonly realms: readonly [
		{
			readonly id: string;
			readonly name: string;
			readonly initials: string;
			readonly href: string;
		},
		...{
			readonly id: string;
			readonly name: string;
			readonly initials: string;
			readonly href: string;
		}[],
	];
	readonly post: {
		readonly title: string;
		readonly body: string;
		readonly mediaAlt: string;
		readonly mediaAsset: "post-media";
	};
	readonly collection: {
		readonly title: string;
		readonly body: string;
		readonly coverAlt: string;
		readonly coverAsset: "book-cover";
		readonly href: string;
	};
	readonly metrics: {
		readonly post: { readonly replies: number; readonly score: number };
		readonly review: { readonly replies: number; readonly score: number };
		readonly book: { readonly score: number };
		readonly collection: { readonly score: number };
	};
}

const ReferenceTime = "2026-07-21T14:00:00.000Z";
const CreatedAt = "2026-07-21T12:00:00.000Z";

function createFeedFixtureData(content: FeedFixtureLocalizedContent): FeedFixtureData {
	return {
		referenceTime: ReferenceTime,
		createdAt: CreatedAt,
		recommendationReason: "followed_publisher",
		publisher: {
			...content.publisher,
			href: "#fixture-publisher",
		},
		realms: [
			{
				id: "019bff67-b3df-7482-a0af-8e4c7ee00a22",
				...content.realm,
				href: "#fixture-realm",
			},
		],
		post: {
			...content.post,
			mediaAsset: "post-media",
		},
		collection: {
			...content.collection,
			coverAsset: "book-cover",
			href: "#fixture-related-work",
		},
		metrics: {
			post: { replies: 36, score: 2_100 },
			review: { replies: 18, score: 96 },
			book: { score: 42 },
			collection: { score: 128 },
		},
	};
}

const FeedFixtureDataByContentLanguage = {
	zh: createFeedFixtureData(traditionalChinese),
	en: createFeedFixtureData(english),
} satisfies Readonly<Record<FixtureContentLanguage, FeedFixtureData>>;

export function getFeedFixtureData(language: FixtureContentLanguage): FeedFixtureData {
	return FeedFixtureDataByContentLanguage[language];
}
