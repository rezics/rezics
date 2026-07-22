import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";

import english from "./languages/en/content-feed";
import traditionalChinese from "./languages/zh-Hant/content-feed";
import type { FeedFixtureLocalizedContent } from "./content-feed/localized-content";

export const FixtureContentLanguages = ContentLanguageValues;
export type FixtureContentLanguage = ContentLanguage;

export const FeedFixtureAssetIds = ["book-cover", "post-media"] as const;
export type FeedFixtureAssetId = (typeof FeedFixtureAssetIds)[number];

interface FeedFixtureContext {
	readonly id: string;
	readonly name: string;
	readonly initials: string;
	readonly href: string;
	readonly slug: string;
	readonly summary: string;
}

export interface FeedFixtureData {
	readonly referenceTime: string;
	readonly createdAt: string;
	readonly recommendationReason: "followed_publisher";
	readonly publishers: readonly [FeedFixtureContext, FeedFixtureContext, ...FeedFixtureContext[]];
	readonly realms: readonly [FeedFixtureContext, FeedFixtureContext, ...FeedFixtureContext[]];
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
		readonly score: {
			readonly totalScore: number;
			readonly totalCount: number;
		};
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
		publishers: [
			createFixtureContext("publisher", content.publishers[0], 0),
			createFixtureContext("publisher", content.publishers[1], 1),
			...content.publishers
				.slice(2)
				.map((publisher, index) => createFixtureContext("publisher", publisher, index + 2)),
		],
		realms: [
			createFixtureContext("realm", content.realms[0], 0),
			createFixtureContext("realm", content.realms[1], 1),
			...content.realms
				.slice(2)
				.map((realm, index) => createFixtureContext("realm", realm, index + 2)),
		],
		post: {
			...content.post,
			mediaAsset: "post-media",
		},
		collection: {
			...content.collection,
			coverAsset: "book-cover",
			href: "#fixture-related-work",
			score: { totalScore: 184, totalCount: 40 },
		},
		metrics: {
			post: { replies: 36, score: 2_100 },
			review: { replies: 18, score: 96 },
			book: { score: 42 },
			collection: { score: 128 },
		},
	};
}

function createFixtureContext(
	kind: "publisher" | "realm",
	content: FeedFixtureLocalizedContent["publishers"][number],
	index: number,
): FeedFixtureContext {
	return {
		id: `fixture-${kind}-${index + 1}`,
		...content,
		href: `#fixture-${kind}-${index + 1}`,
		slug: `fixture-${kind}-${index + 1}`,
	};
}

const FeedFixtureDataByContentLanguage = {
	zh: createFeedFixtureData(traditionalChinese),
	en: createFeedFixtureData(english),
} satisfies Readonly<Record<FixtureContentLanguage, FeedFixtureData>>;

export function getFeedFixtureData(language: FixtureContentLanguage): FeedFixtureData {
	return FeedFixtureDataByContentLanguage[language];
}
