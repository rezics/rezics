/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import {
	StudioContentCard,
	studioContentActivity,
	studioContentShowsCover,
	type StudioContentItem,
} from "./studio-content-card";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(["create"], ["zh-Hant"]);
const item = {
	id: "019b76da-a800-7300-8000-000000000002",
	slugAddress: null,
	section: "book",
	language: "zh",
	title: "測試書籍",
	cover: {
		id: "019b76da-a800-7300-8000-000000000005",
		url: "/image-assets/019b76da-a800-7300-8000-000000000005/presentations/cover/content",
	},
	status: "published",
	visibility: "public",
	relations: ["created", "contributed"],
	workState: "actionable",
	permissions: ["unit.update"],
	accessSources: ["direct"],
	firstContributedAt: "2026-07-01T08:00:00.000Z",
	lastContributedAt: "2026-07-27T08:00:00.000Z",
	contributionCount: 3,
	assignedAt: null,
	lastVisitedAt: "2026-07-28T08:00:00.000Z",
	relevantAt: "2026-07-27T08:00:00.000Z",
	createdAt: "2026-01-01T08:00:00.000Z",
	updatedAt: "2026-07-26T08:00:00.000Z",
} satisfies StudioContentItem;

afterEach(cleanup);

describe("Studio content presentation", () => {
	it("selects the timestamp that explains each sort", () => {
		expect(studioContentActivity(item, "recent")).toEqual({
			kind: "visited",
			value: item.lastVisitedAt,
		});
		expect(studioContentActivity({ ...item, lastVisitedAt: null }, "recent")).toEqual({
			kind: "relevant",
			value: item.relevantAt,
		});
		expect(studioContentActivity(item, "updated")).toEqual({
			kind: "updated",
			value: item.updatedAt,
		});
		expect(studioContentActivity(item, "created")).toEqual({
			kind: "created",
			value: item.createdAt,
		});
		expect(studioContentActivity(item, "relevant")).toEqual({
			kind: "relevant",
			value: item.relevantAt,
		});
	});

	it("reserves a cover for cover-led sections and honors an actual cover elsewhere", () => {
		expect(studioContentShowsCover({ cover: null, section: "book" })).toBe(true);
		expect(studioContentShowsCover({ cover: null, section: "tag" })).toBe(false);
		expect(studioContentShowsCover({ cover: item.cover, section: "tag" })).toBe(true);
	});

	it("renders the resolved cover and management metadata without Feed reactions", () => {
		const onOpen = vi.fn();
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<StudioContentCard item={item} onOpen={onOpen} sort="updated" />
			</TranslationProvider>,
		);

		const cover = container.querySelector('[data-slot="cover"]');
		expect(cover?.querySelector(`img[src="${item.cover.url}"]`)).toBeTruthy();
		expect(screen.getByText("已發布")).toBeTruthy();
		expect(screen.getByText("公開")).toBeTruthy();
		expect(screen.getByText("貢獻 3 次")).toBeTruthy();
		expect(container.querySelector('[data-slot="feed-card-action-bar"]')).toBeNull();
		expect(container.querySelector('[data-slot="feed-engagement-bar"]')).toBeNull();

		const link = screen.getByRole("link", { name: "測試書籍" });
		expect(link.getAttribute("href")).toBe("/units/book/019b76da-a800-7300-8000-000000000002");
		link.addEventListener("click", (event) => event.preventDefault(), { once: true });
		fireEvent.click(link);
		expect(onOpen).toHaveBeenCalledOnce();
	});
});
