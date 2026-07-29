import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";

import german from "./languages/de/content-feed";
import english from "./languages/en/content-feed";
import spanish from "./languages/es/content-feed";
import french from "./languages/fr/content-feed";
import japanese from "./languages/ja/content-feed";
import korean from "./languages/ko/content-feed";
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

type FeedFixtureAttributionContext = FeedFixtureContext & {
	readonly kind: "profile" | "entity";
	readonly role: string;
};

type FeedFixtureRealmContext = FeedFixtureContext & { readonly kind: "realm" };

export interface FeedFixtureData {
	readonly referenceTime: string;
	readonly createdAt: string;
	readonly recommendationReason: "followed_unit";
	readonly attributions: readonly [
		FeedFixtureAttributionContext,
		FeedFixtureAttributionContext,
		...FeedFixtureAttributionContext[],
	];
	readonly realms: readonly [
		FeedFixtureRealmContext,
		FeedFixtureRealmContext,
		...FeedFixtureRealmContext[],
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
		readonly score: {
			readonly realmLabel: string;
			readonly realmId: string;
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
		recommendationReason: "followed_unit",
		attributions: [
			createAttributionContext(content.attributions[0], 0),
			createAttributionContext(content.attributions[1], 1),
			...content.attributions
				.slice(2)
				.map((attribution, index) => createAttributionContext(attribution, index + 2)),
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
			score: {
				realmLabel: content.realms[0].name,
				realmId: "fixture-realm-1",
				totalScore: 184,
				totalCount: 40,
			},
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
	kind: "realm",
	content: FeedFixtureLocalizedContent["realms"][number],
	index: number,
): FeedFixtureRealmContext {
	return {
		id: `fixture-${kind}-${index + 1}`,
		...content,
		kind,
		href: `#fixture-${kind}-${index + 1}`,
		slug: `fixture-${kind}-${index + 1}`,
	};
}

function createAttributionContext(
	content: FeedFixtureLocalizedContent["attributions"][number],
	index: number,
): FeedFixtureAttributionContext {
	const kind = index === 0 ? "profile" : "entity";
	return {
		id: `fixture-attribution-${index + 1}`,
		...content,
		kind,
		role: index === 0 ? "publisher" : index === 1 ? "author" : "editor",
		href: `#fixture-attribution-${index + 1}`,
		slug: `fixture-attribution-${index + 1}`,
	};
}

const FeedFixtureDataByContentLanguage = {
	zh: createFeedFixtureData(traditionalChinese),
	en: createFeedFixtureData(english),
	ja: createFeedFixtureData(japanese),
	ko: createFeedFixtureData(korean),
	de: createFeedFixtureData(german),
	fr: createFeedFixtureData(french),
	es: createFeedFixtureData(spanish),
} satisfies Readonly<Record<FixtureContentLanguage, FeedFixtureData>>;

export function getFeedFixtureData(language: FixtureContentLanguage): FeedFixtureData {
	return FeedFixtureDataByContentLanguage[language];
}
