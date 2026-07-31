/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChineseContentDisplayProvider } from "@/features/content-language-display/chinese-content-display-context";
import { TranslationProvider } from "@/i18n/client";
import type { TagPresentation } from "../model/tag-presentation";
import { TagBadgeCard } from "./tag-badge-card";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@/features/auth/auth-portal", () => ({
	SignInButton: () => null,
}));

vi.mock("./tag-vote-controls", () => ({
	TagVoteControls: () => null,
}));

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

const translation = await create(resources).getTranslation(["tags"], ["zh-Hant"]);

const pinnedTag = {
	itemKey: "global:tag-1",
	identity: {
		tagId: "019f995d-731c-71dd-b8cd-2bc781fb07e7",
		language: "zh",
		title: "置頂標籤",
		summary: null,
		avatar: null,
	},
	context: { kind: "global", pinned: true },
	vote: {
		kind: "available",
		target: {
			kind: "global",
			type: "book",
			unitId: "019f995d-73ad-7692-88d4-39741cbe6c34",
			tagId: "019f995d-731c-71dd-b8cd-2bc781fb07e7",
		},
		score: 1,
		voteCount: 1,
		viewerVote: null,
		canVote: false,
	},
} satisfies TagPresentation;

const realmTag = {
	itemKey: "realm:019f995d-74b4-7b8a-93fe-5147949611df:019f995d-731c-71dd-b8cd-2bc781fb07e7",
	identity: pinnedTag.identity,
	context: {
		kind: "realm",
		realmId: "019f995d-74b4-7b8a-93fe-5147949611df",
		realmLanguage: "zh",
		realmTitle: "測試領域",
		contextPostId: "019f995d-747a-719e-b663-cbe3bed525a9",
	},
	vote: {
		...pinnedTag.vote,
		target: {
			kind: "realm",
			realmId: "019f995d-74b4-7b8a-93fe-5147949611df",
			unitId: "019f995d-73ad-7692-88d4-39741cbe6c34",
			tagId: "019f995d-731c-71dd-b8cd-2bc781fb07e7",
		},
	},
} satisfies TagPresentation;

afterEach(cleanup);

describe("TagBadgeCard", () => {
	it("uses the ordinary outline style and a linked card title for a pinned global Tag", async () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<TagBadgeCard
					fallbackLabel="未命名標籤"
					isPending={false}
					item={pinnedTag}
					onClearVote={vi.fn()}
					onToggleSelected={vi.fn()}
					onVote={vi.fn()}
					selected={false}
					selectionMode={false}
					type="book"
				/>
			</TranslationProvider>,
		);

		const trigger = screen.getByRole("link", {
			name: "開啟「置頂標籤」標籤卡片（全域情境）",
		});
		expect(trigger.closest('[data-slot="badge"]')?.getAttribute("data-variant")).toBe(
			"outline",
		);
		fireEvent.click(trigger);
		const titleLink = await screen.findByRole("link", { name: "置頂標籤" });
		expect(titleLink.classList.contains("hover:underline")).toBe(true);
		expect(titleLink.classList.contains("leading-normal")).toBe(true);
	});

	it("projects Chinese Tag content into the selected display script", async () => {
		render(
			<ChineseContentDisplayProvider value="hans">
				<TranslationProvider initial={translation.snapshot}>
					<TagBadgeCard
						fallbackLabel="未命名標籤"
						isPending={false}
						item={pinnedTag}
						onClearVote={vi.fn()}
						onToggleSelected={vi.fn()}
						onVote={vi.fn()}
						selected={false}
						selectionMode={false}
						type="book"
					/>
				</TranslationProvider>
			</ChineseContentDisplayProvider>,
		);

		expect(await screen.findByRole("link", { name: /置顶标签/ })).toBeTruthy();
	});

	it("uses the linked title as the Realm voting-context destination", async () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<TagBadgeCard
					fallbackLabel="未命名標籤"
					isPending={false}
					item={realmTag}
					onClearVote={vi.fn()}
					onToggleSelected={vi.fn()}
					onVote={vi.fn()}
					selected={false}
					selectionMode={false}
					type="book"
				/>
			</TranslationProvider>,
		);

		fireEvent.click(
			screen.getByRole("link", {
				name: "開啟「置頂標籤」標籤卡片（測試領域）",
			}),
		);

		const titleLink = await screen.findByRole("link", { name: "置頂標籤" });
		expect(titleLink.getAttribute("href")).toBe(
			"/posts/019f995d-747a-719e-b663-cbe3bed525a9?realmId=019f995d-74b4-7b8a-93fe-5147949611df",
		);
		expect(screen.queryByRole("link", { name: "查看投票情境" })).toBeNull();
	});
});
