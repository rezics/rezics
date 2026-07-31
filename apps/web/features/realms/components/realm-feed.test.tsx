/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FeedUnit } from "@/features/content-feed/components/feed-item-card";
import type { ApiFeedListProps } from "@/features/content-feed/data/api-feed-list";
import { RealmFeed } from "./realm-feed";

const feedItem = {
	id: "019fa3ab-72a9-7792-b2e3-43aa8a9c755e",
	language: "zh",
	availableLanguages: ["zh"],
	itemType: "unit",
	unitKind: "book",
	postKind: null,
	attributions: [],
	realmId: "realm-1",
	realms: [],
	title: "測試內容",
	summary: null,
	cover: null,
	presentation: {
		kind: "rated-work",
		scores: { preferred: null, global: null },
	},
	collection: null,
	createdAt: "2026-07-31T12:00:00.000Z",
	updatedAt: "2026-07-31T12:00:00.000Z",
	reactions: { upvote: 0, downvote: 0 },
	viewerReaction: null,
	recommendationReason: null,
	tracking: null,
} satisfies FeedUnit;

vi.mock("nuqs", () => ({
	useQueryState: (key: string) => [key === "sort" ? "best" : [], vi.fn()],
}));

vi.mock("@/features/content-feed/data/api-feed-list", () => ({
	ApiFeedList: (props: ApiFeedListProps) => (
		<div
			data-content-filter={String(Boolean(props.onContentKindsChange))}
			data-language-filter={String(Boolean(props.onLanguagesChange))}
			data-pagination={props.pagination}
			data-realm-filter={String(Boolean(props.onRealmIdsChange))}
			data-realm-ids={props.realmIds?.join(",")}
			data-sort-filter={String(Boolean(props.onSortChange))}
			data-tag-filter={String(Boolean(props.onTagIdsChange))}
			data-testid="realm-feed"
		>
			{props.renderOverflowActions?.(feedItem)}
		</div>
	),
}));

vi.mock("./realm-feed-management-actions", () => ({
	RealmFeedManagementActions: ({
		onAddPolicyTag,
		onModerate,
	}: {
		readonly onAddPolicyTag: () => void;
		readonly onModerate: () => void;
	}) => (
		<>
			<button onClick={onAddPolicyTag} type="button">
				request policy Tag
			</button>
			<button onClick={onModerate} type="button">
				request moderation
			</button>
		</>
	),
}));

vi.mock("./realm-policy-tag-dialog", () => ({
	RealmPolicyTagDialog: ({
		onOpenChange,
		unitId,
	}: {
		readonly onOpenChange: (open: boolean) => void;
		readonly unitId: string;
	}) => (
		<section aria-label={`policy ${unitId}`} role="dialog">
			<button onClick={() => onOpenChange(false)} type="button">
				close policy
			</button>
		</section>
	),
}));

vi.mock("./realm-feed-moderation-sheet", () => ({
	RealmFeedModerationSheet: ({
		onOpenChange,
		target,
	}: {
		readonly onOpenChange: (open: boolean) => void;
		readonly target: { readonly id: string };
	}) => (
		<section aria-label={`moderation ${target.id}`} role="dialog">
			<button onClick={() => onOpenChange(false)} type="button">
				close moderation
			</button>
		</section>
	),
}));

afterEach(cleanup);

describe("RealmFeed", () => {
	it("fixes the Realm scope while exposing every other Feed control", () => {
		render(
			<RealmFeed
				canManagePins={false}
				canManageTags={false}
				canModerateUnits={false}
				realmId="realm-1"
			/>,
		);

		const feed = screen.getByTestId("realm-feed");
		expect(feed.getAttribute("data-realm-ids")).toBe("realm-1");
		expect(feed.getAttribute("data-realm-filter")).toBe("false");
		expect(feed.getAttribute("data-language-filter")).toBe("true");
		expect(feed.getAttribute("data-pagination")).toBe("infinite");
		expect(feed.getAttribute("data-tag-filter")).toBe("true");
		expect(feed.getAttribute("data-sort-filter")).toBe("true");
		expect(feed.getAttribute("data-content-filter")).toBe("true");
	});

	it("opens one stable management surface for the selected Feed item", () => {
		render(<RealmFeed canManagePins canManageTags canModerateUnits realmId="realm-1" />);

		fireEvent.click(screen.getByRole("button", { name: "request policy Tag" }));
		expect(screen.getByRole("dialog", { name: `policy ${feedItem.id}` })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "close policy" }));
		expect(screen.queryByRole("dialog")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "request moderation" }));
		expect(screen.getByRole("dialog", { name: `moderation ${feedItem.id}` })).toBeTruthy();
	});
});
