"use client";

import type { ReactNode } from "react";

import { FeedListItems } from "./feed-list";
import { FeedPostCard, type FeedPost, FeedUnitCard, type FeedUnit } from "./feed-item-card";
import { useTranslation } from "@/i18n/client";

const attribution = {
	id: "019f9d16-1000-7000-8000-000000000001",
	role: "publisher",
	position: "a0",
	creditedUnit: {
		id: "019f9d16-1000-7000-8000-000000000002",
		kind: "profile",
		language: "zh",
		slugAddress: null,
		title: "海豚號編輯部",
		summary: "策劃作品、評論與知識脈絡。",
		avatar: { type: "emoji", emoji: "🐬" },
	},
} satisfies FeedUnit["attributions"][number];

const realmContext = {
	id: "019f9d16-1000-7000-8000-000000000003",
	language: "zh",
	slugAddress: null,
	title: "科幻研究",
	summary: "細讀不同媒介與傳統中的科幻作品。",
	avatar: { type: "emoji", emoji: "🪐" },
} satisfies FeedUnit["realms"][number];

type FeedUnitCommon = Pick<
	FeedUnit,
	| "attributions"
	| "availableLanguages"
	| "collection"
	| "createdAt"
	| "itemType"
	| "language"
	| "postKind"
	| "reactions"
	| "realmId"
	| "realms"
	| "recommendationReason"
	| "tracking"
	| "updatedAt"
	| "viewerReaction"
>;

const common = {
	language: "zh",
	availableLanguages: ["zh"],
	itemType: "unit",
	postKind: null,
	attributions: [attribution],
	realmId: realmContext.id,
	realms: [realmContext],
	createdAt: "2026-07-21T12:00:00.000Z",
	updatedAt: "2026-07-21T12:00:00.000Z",
	reactions: { upvote: 128, downvote: 3 },
	viewerReaction: null,
	recommendationReason: null,
	tracking: null,
	collection: null,
} satisfies FeedUnitCommon;

const preferredAggregate = {
	realmId: realmContext.id,
	realmTitle: realmContext.title,
	totalScore: 184,
	totalCount: 20,
} as const;
const globalAggregate = {
	realmId: "019b76da-a800-7300-8000-000000000002",
	realmTitle: "REZICS 評分",
	totalScore: 846,
	totalCount: 100,
} as const;

const book = {
	...common,
	id: "019f9d16-1000-7000-8000-000000000010",
	unitKind: "book",
	title: "科學與魔法的交會點",
	summary: "從不同角色與世界觀切入，重新閱讀科學和魔法共同塑造的社會。",
	cover: {
		id: "019f9d16-1000-7000-8000-000000000011",
		url: "/fixtures/content-feed/book-cover.svg",
	},
	presentation: {
		kind: "rated-work",
		scores: { preferred: preferredAggregate, global: globalAggregate },
	},
} satisfies FeedUnit;

const mediaWithGlobalFallback = {
	...common,
	id: "019f9d16-1000-7000-8000-000000000020",
	unitKind: "media",
	title: "沒有封面、預設語境也沒有評分的媒體作品",
	summary: "這個情境驗證固定媒體槽，以及逐作品回退到全域評分。",
	cover: null,
	presentation: {
		kind: "rated-work",
		scores: { preferred: null, global: globalAggregate },
	},
} satisfies FeedUnit;

const unratedSoftware = {
	...common,
	id: "019f9d16-1000-7000-8000-000000000030",
	unitKind: "software",
	title: "尚無任何評分的軟體",
	summary: "偏好與全域語境都沒有 aggregate 時，仍保留評分列。",
	cover: null,
	presentation: {
		kind: "rated-work",
		scores: { preferred: null, global: null },
	},
} satisfies FeedUnit;

const realm = {
	...common,
	id: "019f9d16-1000-7000-8000-000000000040",
	unitKind: "realm",
	title: "群體智慧",
	summary: "探索群體如何共同形成知識、判斷與行動。",
	cover: null,
	presentation: {
		kind: "identity",
		avatar: { type: "emoji", emoji: "🧠" },
		realmTagContext: null,
		banner: {
			id: "019f9d16-1000-7000-8000-000000000041",
			url: "/fixtures/content-feed/post-media.svg",
		},
		memberCount: 128,
	},
} satisfies FeedUnit;

const zoneWithoutAvatar = {
	...common,
	id: "019f9d16-1000-7000-8000-000000000050",
	unitKind: "zone",
	title: "開放研究專區",
	summary: "沒有 avatar 時使用穩定的文字 fallback；標準 Feed 不渲染 banner。",
	cover: null,
	presentation: {
		kind: "identity",
		avatar: null,
		realmTagContext: null,
		banner: null,
		memberCount: null,
	},
} satisfies FeedUnit;

const contextualReview = {
	id: "019f9d16-1000-7000-8000-000000000060",
	language: "zh",
	availableLanguages: ["zh"],
	itemType: "post",
	unitKind: "post",
	postKind: "review",
	attributions: [attribution],
	realmId: realmContext.id,
	realms: [realmContext],
	title: "重新理解兩種知識傳統的交會",
	summary: "這個情境驗證 Unit 頁面只保留文章評分，不重複渲染作品子卡片。",
	cover: null,
	subjectId: book.id,
	rootPostId: null,
	parentPostId: null,
	body: null,
	contentSpoiler: { level: 0, concealed: false },
	contentNsfw: { labelled: false, concealed: false },
	replyCount: 3,
	latestRevisionId: null,
	replyContext: null,
	subject: {
		id: book.id,
		type: book.unitKind,
		language: book.language,
		title: book.title,
		summary: book.summary,
		cover: book.cover,
		scores: book.presentation.scores,
	},
	scores: [
		{
			scoreId: "019f9d16-1000-7000-8000-000000000061",
			realmId: realmContext.id,
			realmTitle: realmContext.title,
			value: 9,
		},
	],
	createdAt: "2026-07-21T12:30:00.000Z",
	updatedAt: "2026-07-21T12:30:00.000Z",
	reactions: { upvote: 42, downvote: 1 },
	viewerReaction: "upvote",
	recommendationReason: null,
	tracking: null,
} satisfies FeedPost;

function ProductionUnitCards() {
	const { t } = useTranslation(["feed"]);
	return (
		<FeedListItems aria-label={t.feed.title}>
			<FeedUnitCard canExclude={false} unit={book} />
			<FeedUnitCard canExclude={false} unit={mediaWithGlobalFallback} />
			<FeedUnitCard canExclude={false} unit={unratedSoftware} />
			<FeedUnitCard canExclude={false} unit={realm} />
			<FeedUnitCard canExclude={false} unit={zoneWithoutAvatar} />
		</FeedListItems>
	);
}

const fixtures = {
	"Production units · rating fallback and identity media": <ProductionUnitCards />,
	"Work · preferred score": <FeedUnitCard canExclude={false} unit={book} />,
	"Work · global fallback without cover": (
		<FeedUnitCard canExclude={false} unit={mediaWithGlobalFallback} />
	),
	"Work · unrated without cover": <FeedUnitCard canExclude={false} unit={unratedSoftware} />,
	"Identity · Realm avatar": <FeedUnitCard canExclude={false} unit={realm} />,
	"Identity · Zone fallback": <FeedUnitCard canExclude={false} unit={zoneWithoutAvatar} />,
	"Post · Unit context hides repeated subject": (
		<FeedPostCard
			canExclude={false}
			displayContext={{ kind: "unit", unitId: book.id }}
			post={contextualReview}
		/>
	),
} satisfies Record<string, ReactNode>;

export default fixtures;
