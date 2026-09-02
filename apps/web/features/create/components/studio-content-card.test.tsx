/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import {
	StudioContentCard,
	studioContentShowsCover,
	type StudioContentItem,
} from "./studio-content-card";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(["create", "tags"], ["zh-Hant"]);
const resource = {
	id: "019b76da-a800-7300-8000-000000000002",
	section: "book",
	resourceKind: "book",
	presentation: {
		kind: "localized_unit",
		slugAddress: null,
		language: "zh",
		title: "測試書籍",
		cover: {
			id: "019b76da-a800-7300-8000-000000000005",
			url: "/image-assets/019b76da-a800-7300-8000-000000000005/presentations/cover/content",
		},
		status: "published",
		visibility: "public",
	},
	createdResourceAt: "2026-01-01T08:00:00.000Z",
	firstContributedAt: "2026-07-01T08:00:00.000Z",
	lastContributedAt: "2026-07-27T08:00:00.000Z",
	contributionCount: 3,
	lastParticipatedAt: "2026-07-27T08:00:00.000Z",
	createdAt: "2026-01-01T08:00:00.000Z",
	updatedAt: "2026-07-26T08:00:00.000Z",
} as const;
const item = {
	kind: "contribution",
	resource,
} satisfies StudioContentItem;
const pathItem = {
	kind: "contribution",
	resource: {
		id: "019b76da-a800-7300-8000-000000000010",
		section: "tag",
		resourceKind: "tag_path",
		presentation: {
			kind: "tag_path",
			members: [
				{
					ordinal: 0,
					nodeId: "019b76da-a800-7300-8000-000000000011",
					nodeKind: "concept",
					incomingRelation: null,
					language: "zh",
					title: "小說",
					summary: null,
					avatar: null,
				},
				{
					ordinal: 1,
					nodeId: "019b76da-a800-7300-8000-000000000012",
					nodeKind: "concept",
					incomingRelation: {
						relationId: "019b76da-a800-7300-8000-000000000013",
						relationKind: "generic",
					},
					language: "zh",
					title: "奇幻小說",
					summary: null,
					avatar: null,
				},
			],
		},
		createdResourceAt: "2026-08-01T08:00:00.000Z",
		firstContributedAt: null,
		lastContributedAt: null,
		contributionCount: 0,
		lastParticipatedAt: "2026-08-01T08:00:00.000Z",
		createdAt: "2026-08-01T08:00:00.000Z",
		updatedAt: "2026-08-01T08:00:00.000Z",
	},
} satisfies StudioContentItem;

afterEach(cleanup);

describe("Studio content presentation", () => {
	it("reserves a cover for cover-led sections and honors an actual cover elsewhere", () => {
		expect(studioContentShowsCover({ cover: null, section: "book" })).toBe(true);
		expect(studioContentShowsCover({ cover: null, section: "tag" })).toBe(false);
		expect(studioContentShowsCover({ cover: resource.presentation.cover, section: "tag" })).toBe(
			true,
		);
	});

	it("renders the resolved cover and management metadata without Feed reactions", () => {
		const onOpen = vi.fn();
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<StudioContentCard item={item} onOpen={onOpen} />
			</TranslationProvider>,
		);

		const cover = container.querySelector('[data-slot="cover"]');
		expect(cover?.querySelector(`img[src="${resource.presentation.cover.url}"]`)).toBeTruthy();
		expect(screen.getByText("參與編輯")).toBeTruthy();
		expect(screen.getByText("已發布")).toBeTruthy();
		expect(screen.getByText("公開")).toBeTruthy();
		expect(screen.getByText("建立者")).toBeTruthy();
		expect(screen.getByText("貢獻者")).toBeTruthy();
		expect(screen.getByText("貢獻 3 次")).toBeTruthy();
		expect(container.querySelector('[data-slot="feed-card-action-bar"]')).toBeNull();
		expect(container.querySelector('[data-slot="feed-engagement-bar"]')).toBeNull();

		const link = screen.getByRole("link", { name: "測試書籍" });
		expect(link.getAttribute("href")).toBe("/units/book/019b76da-a800-7300-8000-000000000002");
		link.addEventListener("click", (event) => event.preventDefault(), { once: true });
		fireEvent.click(link);
		expect(onOpen).toHaveBeenCalledOnce();
	});

	it("renders an immutable Tag Path without pretending it has localized Unit metadata", () => {
		const onOpen = vi.fn();
		render(
			<TranslationProvider initial={translation.snapshot}>
				<StudioContentCard item={pathItem} onOpen={onOpen} />
			</TranslationProvider>,
		);

		expect(screen.getByText("小說")).toBeTruthy();
		expect(screen.getByText("奇幻小說")).toBeTruthy();
		expect(screen.getByText("不可變")).toBeTruthy();
		expect(screen.queryByText("已發布")).toBeNull();
		const link = screen.getByRole("link", { name: "查看標籤路徑" });
		expect(link.getAttribute("href")).toBe("/tag-paths/019b76da-a800-7300-8000-000000000010");
		link.addEventListener("click", (event) => event.preventDefault(), { once: true });
		fireEvent.click(link);
		expect(onOpen).toHaveBeenCalledOnce();
	});
});
