/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { FeedCardHeader, FeedCardTarget } from "./feed-card";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);
vi.stubGlobal(
	"IntersectionObserver",
	class IntersectionObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);
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
	["engagement", "feed", "posts", "units"],
	["zh-Hant"],
);

afterEach(cleanup);

const attributions = [
	{
		id: "attribution-1",
		kind: "profile",
		role: "publisher",
		name: "第一發布者",
		initials: "一",
		href: "/profiles/attribution-1",
		slug: "attribution-1",
		summary: "第一位發布者的簡介。",
	},
	{
		id: "attribution-2",
		kind: "entity",
		role: "author",
		name: "共同作者",
		initials: "二",
		href: "/entities/attribution-2",
		slug: "attribution-2",
		summary: "共同作者的簡介。",
	},
] as const;

const realms = [
	{
		id: "realm-1",
		name: "第一領域",
		initials: "甲",
		href: "/realms/realm-1",
		slug: "realm-1",
		summary: "第一個領域的簡介。",
	},
	{
		id: "realm-2",
		name: "第二領域",
		initials: "乙",
		href: "/realms/realm-2",
		slug: "realm-2",
		summary: "第二個領域的簡介。",
	},
] as const;

describe("FeedCardHeader", () => {
	it("shows the first attribution and Realm with counts, then opens each complete list", async () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedCardHeader attributions={attributions} realms={realms} timestamp="2 小時前" />
			</TranslationProvider>,
		);

		expect(screen.getByText("在")).toBeTruthy();
		expect(screen.getAllByText("+1")).toHaveLength(2);

		fireEvent.click(
			screen.getByRole("button", {
				name: "第一發布者 及其他 1 位；顯示署名清單",
			}),
		);
		const attributionList = await screen.findByRole("list", { name: "2 位署名創作者" });
		expect(attributionList.querySelectorAll('a[href^="/profiles/"]')).toHaveLength(1);
		expect(attributionList.querySelectorAll('a[href^="/entities/"]')).toHaveLength(1);

		fireEvent.click(
			screen.getByRole("button", {
				name: "第一領域 及其他 1 個領域；顯示領域清單",
			}),
		);
		const realmList = await screen.findByRole("list", { name: "2 個領域" });
		expect(realmList.querySelectorAll('a[href^="/realms/"]')).toHaveLength(2);
	});

	it("keeps a single context as a direct navigation link", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedCardHeader
					attributions={[attributions[0]]}
					realms={[realms[0]]}
					timestamp="2 小時前"
				/>
			</TranslationProvider>,
		);

		expect(screen.getByRole("link", { name: /第一發布者/ }).getAttribute("href")).toBe(
			"/profiles/attribution-1",
		);
		expect(screen.getByRole("link", { name: /第一領域/ }).getAttribute("href")).toBe(
			"/realms/realm-1",
		);
	});
});

describe("FeedCardTarget", () => {
	it("uses the shared ratio-safe Cover and renders optional summary and score", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedCardTarget
					description="一行作品摘要"
					href="/units/book/book-1"
					imageAlt="書籍封面"
					imageUrl="/cover.jpg"
					label="討論關聯作品"
					rating={{
						kind: "aggregate",
						score: {
							contextLabel: "讀書會",
							contextUnitId: "realm-1",
							totalScore: 184,
							totalCount: 40,
						},
					}}
					title="測試書籍"
				/>
			</TranslationProvider>,
		);

		expect(container.querySelector('[data-slot="cover"]')).toBeTruthy();
		expect(container.querySelector('[data-slot="item-media"]')).toBeNull();
		expect(screen.getByText("一行作品摘要")).toBeTruthy();
		const scoreSummary = screen.getByText("4.6／10 · 40 人評分");
		const contextLabel = screen.getByText("讀書會", { exact: true });
		const scoreRow = scoreSummary.closest("p");
		const scoreIcon = scoreRow?.querySelector("svg");
		expect(contextLabel.compareDocumentPosition(scoreIcon ?? scoreSummary)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
		expect(scoreIcon?.compareDocumentPosition(scoreSummary)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
	});

	it("keeps the Cover and rating rows when a rated work has neither", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedCardTarget
					href="/units/media/media-1"
					label="討論關聯作品"
					rating={{ kind: "aggregate", score: null }}
					title="尚無素材的作品"
				/>
			</TranslationProvider>,
		);

		expect(container.querySelector('[data-slot="cover"]')).toBeTruthy();
		expect(container.querySelector('[data-slot="feed-card-rating"]')).toBeTruthy();
		expect(screen.getByText("尚無評分")).toBeTruthy();
	});
});
