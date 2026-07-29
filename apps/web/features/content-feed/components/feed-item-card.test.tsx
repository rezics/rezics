/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen, within } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import {
	collectionPlacementForFeedItem,
	FeedPostCard,
	type FeedPost,
	FeedUnitCard,
	type FeedUnit,
} from "./feed-item-card";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@rezics/openapi-tanstack-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@rezics/openapi-tanstack-query")>()),
	usePutApiRecommendationsExclusionsByUnitId: () => ({
		isPending: false,
		mutate: vi.fn(),
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({}),
}));

vi.mock("@/features/recommendations/tracking", () => ({
	useRecommendationTracking: () => ({
		elementRef: { current: null },
		trackOpen: vi.fn(),
	}),
}));

vi.mock("./feed-card-actions", () => ({
	FeedEngagementBar: () => null,
	FeedOverflowMenu: () => null,
}));

vi.stubGlobal("matchMedia", (query: string) => ({
	matches: false,
	media: query,
	onchange: null,
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	addListener: vi.fn(),
	removeListener: vi.fn(),
	dispatchEvent: vi.fn(),
}));

const translation = await create(resources).getTranslation(
	["actions", "engagement", "feed", "posts", "realms", "state", "ui", "units"],
	["zh-Hant"],
);

afterEach(cleanup);

describe("Feed item Collection placement", () => {
	it("places Reviews below their reviewed subject and keeps other content direct", () => {
		expect(collectionPlacementForFeedItem({ itemType: "post", postKind: "review" })).toBe(
			"review-with-subject",
		);
		expect(collectionPlacementForFeedItem({ itemType: "post", postKind: "excerpt" })).toBe(
			"direct",
		);
		expect(collectionPlacementForFeedItem({ itemType: "unit", postKind: null })).toBe("direct");
	});
});

const excerpt = {
	id: "019f9872-bd49-7bb4-a6b7-ec621fca2032",
	language: "en",
	itemType: "post",
	unitKind: "post",
	postKind: "excerpt",
	attributions: [],
	realmId: null,
	realms: [],
	title: "A striking passage",
	createdAt: "2026-07-25T04:00:00.000Z",
	updatedAt: "2026-07-25T04:00:00.000Z",
	reactions: { upvote: 0, downvote: 0 },
	viewerReaction: null,
	recommendationReason: null,
	tracking: {
		requestId: "019f9872-bd49-7bb4-a6b7-ec621fca2033",
		surface: "home_feed",
		position: 0,
		policyVersion: "test",
		signature: "0000000000000000000000000000000000000000000",
	},
	summary: null,
	cover: null,
	subjectId: "019f9872-bd49-7bb4-a6b7-ec621fca2034",
	rootPostId: null,
	parentPostId: null,
	body: {
		_type: "portable-text",
		_key: "000000000001",
		content: [
			{
				_type: "block",
				_key: "excerpt-block",
				children: [
					{
						_type: "span",
						_key: "excerpt-span",
						text: "We are all stories in the end.",
						marks: [],
					},
				],
				markDefs: [],
				style: "normal",
			},
		],
	},
	replyCount: 0,
	latestRevisionId: null,
	replyContext: null,
	subject: {
		id: "019f9872-bd49-7bb4-a6b7-ec621fca2034",
		type: "book",
		language: "en",
		title: "Glorious Exploits",
		summary: "A novel.",
		cover: null,
		scores: { preferred: null, global: null },
	},
} satisfies FeedPost;

const review = {
	...excerpt,
	id: "019f9872-bd49-7bb4-a6b7-ec621fca2035",
	postKind: "review",
	title: "A scored review",
	body: null,
	subject: {
		...excerpt.subject,
		scores: {
			preferred: {
				contextUnitId: "019f9872-bd49-7bb4-a6b7-ec621fca2036",
				contextTitle: "我的讀書會",
				totalScore: 18,
				totalCount: 2,
			},
			global: {
				contextUnitId: "019b76da-a800-7300-8000-000000000002",
				contextTitle: "全域評分",
				totalScore: 86,
				totalCount: 10,
			},
		},
	},
	scores: [
		{
			scoreId: "019f9872-bd49-7bb4-a6b7-ec621fca2037",
			contextUnitId: "019f9872-bd49-7bb4-a6b7-ec621fca2038",
			value: 7,
		},
	],
} satisfies FeedPost;

describe("FeedPostCard", () => {
	it("derives a localized title for a titleless Review", () => {
		const titlelessReview = {
			...review,
			title: null,
			attributions: [
				{
					id: "publisher-attribution",
					role: "publisher",
					position: "a0",
					creditedUnit: {
						id: "publisher",
						kind: "profile",
						language: "zh",
						slugAddress: null,
						title: "海豚號編輯部",
						summary: null,
						avatar: null,
					},
				},
			],
		} satisfies FeedPost;

		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedPostCard post={titlelessReview} />
			</TranslationProvider>,
		);

		expect(
			screen.getByRole("heading", {
				level: 2,
				name: "海豚號編輯部對《Glorious Exploits》的評論",
			}),
		).toBeTruthy();
	});

	it("uses an authored summary instead of the body for the feed preview", () => {
		const summarizedPost = {
			...excerpt,
			postKind: "post",
			title: null,
			summary: "手寫摘要",
		} satisfies FeedPost;

		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedPostCard post={summarizedPost} />
			</TranslationProvider>,
		);

		expect(screen.getByText("手寫摘要")).toBeTruthy();
		expect(screen.queryByText("We are all stories in the end.")).toBeNull();
	});

	it("renders an Excerpt source as an internal Unit link without a duplicate target card", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedPostCard post={excerpt} />
			</TranslationProvider>,
		);

		expect(screen.getByText("We are all stories in the end.")).toBeTruthy();
		const source = screen.getByLabelText("摘錄來源");
		expect(source.textContent).toBe("― Glorious Exploits");
		expect(
			within(source).getByRole("link", { name: "Glorious Exploits" }).getAttribute("href"),
		).toBe(`/units/book/${excerpt.subject.id}`);
		expect(container.querySelector('[data-slot="feed-card-target"]')).toBeNull();
	});

	it("renders the Post-attached Score in the subject card before aggregates", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedPostCard post={review} />
			</TranslationProvider>,
		);

		expect(screen.getAllByText("7／10")).toHaveLength(1);
		expect(screen.queryByText("我的讀書會")).toBeNull();
		expect(screen.queryByText("9.0／10 · 2 人評分")).toBeNull();
	});

	it("removes the redundant subject card in its Unit context and keeps the attached Score", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedPostCard
					displayContext={{ kind: "unit", unitId: review.subject.id }}
					post={review}
				/>
			</TranslationProvider>,
		);

		expect(container.querySelector('[data-slot="feed-card-target"]')).toBeNull();
		expect(screen.getAllByText("7／10")).toHaveLength(1);
		expect(screen.queryByText("我的讀書會")).toBeNull();
	});

	it("falls back to the subject global aggregate without an attached Score", () => {
		const reviewWithoutAttachedScore = {
			...review,
			scores: [],
			subject: {
				...review.subject,
				scores: {
					preferred: null,
					global: review.subject.scores.global,
				},
			},
		} satisfies FeedPost;

		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedPostCard post={reviewWithoutAttachedScore} />
			</TranslationProvider>,
		);

		expect(screen.getByText("全域評分")).toBeTruthy();
		expect(screen.getByText("8.6／10 · 10 人評分")).toBeTruthy();
	});
});

type FeedUnitCommon = Pick<
	FeedUnit,
	| "attributions"
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

const unitCommon = {
	language: "zh",
	itemType: "unit",
	postKind: null,
	attributions: [],
	realmId: null,
	realms: [],
	createdAt: "2026-07-25T04:00:00.000Z",
	updatedAt: "2026-07-25T04:00:00.000Z",
	reactions: { upvote: 0, downvote: 0 },
	viewerReaction: null,
	recommendationReason: null,
	tracking: null,
	collection: null,
} satisfies FeedUnitCommon;

describe("FeedUnitCard", () => {
	it("keeps the fixed Cover slot and falls back to the global score per work", () => {
		const media = {
			...unitCommon,
			id: "019f9872-bd49-7bb4-a6b7-ec621fca2040",
			unitKind: "media",
			title: "無封面媒體",
			summary: "測試摘要",
			cover: null,
			presentation: {
				kind: "rated-work",
				scores: {
					preferred: null,
					global: {
						contextUnitId: "019b76da-a800-7300-8000-000000000002",
						contextTitle: "全域評分",
						totalScore: 86,
						totalCount: 10,
					},
				},
			},
		} satisfies FeedUnit;

		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedUnitCard canExclude={false} unit={media} />
			</TranslationProvider>,
		);

		expect(container.querySelector('[data-slot="cover"]')).toBeTruthy();
		expect(screen.getByText("全域評分")).toBeTruthy();
		expect(screen.getByText("8.6／10 · 10 人評分")).toBeTruthy();
	});

	it("uses the preferred score when both score candidates exist", () => {
		const book = {
			...unitCommon,
			id: "019f9872-bd49-7bb4-a6b7-ec621fca2041",
			unitKind: "book",
			title: "偏好語境書籍",
			summary: null,
			cover: null,
			presentation: {
				kind: "rated-work",
				scores: {
					preferred: {
						contextUnitId: "019f9872-bd49-7bb4-a6b7-ec621fca2042",
						contextTitle: "我的讀書會",
						totalScore: 18,
						totalCount: 2,
					},
					global: {
						contextUnitId: "019b76da-a800-7300-8000-000000000002",
						contextTitle: "全域評分",
						totalScore: 86,
						totalCount: 10,
					},
				},
			},
		} satisfies FeedUnit;

		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedUnitCard canExclude={false} unit={book} />
			</TranslationProvider>,
		);

		expect(screen.getByText("我的讀書會")).toBeTruthy();
		expect(screen.getByText("9.0／10 · 2 人評分")).toBeTruthy();
		expect(screen.queryByText("全域評分")).toBeNull();
	});

	it("renders Realm identity through its avatar without showing its banner", () => {
		const realm = {
			...unitCommon,
			id: "019f9872-bd49-7bb4-a6b7-ec621fca2043",
			unitKind: "realm",
			title: "群體智慧",
			summary: null,
			cover: null,
			presentation: {
				kind: "identity",
				avatar: { type: "emoji", emoji: "🧠" },
				realmTagContext: null,
				banner: {
					id: "019f9872-bd49-7bb4-a6b7-ec621fca2044",
					url: "/banner.jpg",
				},
				memberCount: 128,
			},
		} satisfies FeedUnit;

		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedUnitCard canExclude={false} unit={realm} />
			</TranslationProvider>,
		);

		expect(container.querySelector('[data-slot="avatar-emoji"]')?.textContent).toBe("🧠");
		expect(container.querySelector('[data-slot="cover"]')).toBeNull();
		expect(container.querySelector('[data-slot="banner"]')).toBeNull();
		expect(container.querySelector("time")).toBeNull();
		expect(screen.queryByText("未知署名")).toBeNull();
		expect(screen.getByText("128 位成員")).toBeTruthy();
	});

	it("renders a Realm-aware Tag through its avatar and Context Wiki presentation", () => {
		const realmId = "019f9872-bd49-7bb4-a6b7-ec621fca2045";
		const contextPostId = "019f9872-bd49-7bb4-a6b7-ec621fca2046";
		const tag = {
			...unitCommon,
			id: "019f9872-bd49-7bb4-a6b7-ec621fca2047",
			unitKind: "tag",
			title: "值得重讀",
			summary: "全站標籤摘要",
			cover: null,
			presentation: {
				kind: "identity",
				avatar: { type: "emoji", emoji: "🔖" },
				banner: null,
				memberCount: null,
				realmTagContext: {
					realmId,
					contextPostId,
					language: "zh",
					summary: "本領域對這個標籤的正式解釋",
				},
			},
		} satisfies FeedUnit;

		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedUnitCard canExclude={false} unit={tag} />
			</TranslationProvider>,
		);

		expect(container.querySelector('[data-slot="avatar-emoji"]')?.textContent).toBe("🔖");
		expect(screen.getByText("本領域對這個標籤的正式解釋")).toBeTruthy();
		expect(screen.queryByText("全站標籤摘要")).toBeNull();
		expect(
			screen
				.getAllByRole("link")
				.some(
					(link) =>
						link.getAttribute("href") === `/posts/${contextPostId}?realmId=${realmId}`,
				),
		).toBe(true);
	});
});
