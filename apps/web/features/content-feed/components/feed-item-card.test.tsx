/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { render, screen, within } from "@testing-library/react";
import { create } from "native-i18n";
import { describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { FeedPostCard, type FeedPost } from "./feed-item-card";

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
	["actions", "engagement", "feed", "posts", "state", "ui", "units"],
	["zh-Hant"],
);

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
		title: "Glorious Exploits",
		summary: "A novel.",
		cover: null,
		score: null,
	},
} satisfies FeedPost;

describe("FeedPostCard", () => {
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
});
