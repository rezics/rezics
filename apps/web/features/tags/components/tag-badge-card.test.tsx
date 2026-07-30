/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
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

afterEach(cleanup);

describe("TagBadgeCard", () => {
	it("uses the ordinary outline style for a pinned global Tag", () => {
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

		const trigger = screen.getByRole("link", { name: /置頂標籤/ });
		expect(trigger.closest('[data-slot="badge"]')?.getAttribute("data-variant")).toBe(
			"outline",
		);
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
});
