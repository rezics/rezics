/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { SearchResultCard } from "./search-result-card";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation("ui", ["zh-Hant"]);

afterEach(cleanup);

describe("SearchResultCard", () => {
	it("renders a linked result with the shared Feed Card surface and search context", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<SearchResultCard
					categoryLabel="使用者"
					result={{
						avatar: { type: "emoji", emoji: "🦈" },
						href: "/profiles/search-result",
						summary: "搜尋結果摘要",
						title: "搜尋結果標題",
					}}
				/>
			</TranslationProvider>,
		);

		expect(screen.getByRole("article", { name: "搜尋結果標題" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "搜尋結果標題" }).getAttribute("href")).toBe(
			"/profiles/search-result",
		);
		expect(screen.getByText("使用者")).toBeTruthy();
		expect(screen.getByText("搜尋結果摘要")).toBeTruthy();
		expect(container.querySelector('[data-slot="feed-card"]')).toBeTruthy();
		expect(container.querySelector('[data-slot="avatar-emoji"]')).toBeTruthy();
	});

	it("keeps an unavailable target readable and uses the localized title fallback", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<SearchResultCard categoryLabel="作品" result={{ title: null }} />
			</TranslationProvider>,
		);

		expect(screen.getByRole("article", { name: "未命名條目" })).toBeTruthy();
		expect(screen.queryByRole("link")).toBeNull();
	});
});
