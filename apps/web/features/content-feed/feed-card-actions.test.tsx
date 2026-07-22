/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { FeedShareSurfaceView, FeedVoteControl } from "./feed-card-actions";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n<typeof resources>();
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

const translation = await create(resources).getTranslation(["engagement", "feed"], ["zh-Hant"]);

describe("FeedVoteControl", () => {
	it("exposes mutually exclusive pressed states and toggles a selected reaction", () => {
		const onReactionChange = vi.fn();
		const { rerender } = render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedVoteControl onReactionChange={onReactionChange} reaction={null} score="227" />
			</TranslationProvider>,
		);

		const voteGroup = screen.getByRole("group", { name: "內容評價" });
		const upvote = screen.getByRole("button", { name: "贊成" });
		const downvote = screen.getByRole("button", { name: "不贊成" });
		expect(voteGroup.classList.contains("bg-secondary")).toBe(true);
		expect(voteGroup.classList.contains("rounded-lg")).toBe(true);
		expect(upvote.getAttribute("aria-pressed")).toBe("false");
		expect(downvote.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(upvote);
		expect(onReactionChange).toHaveBeenLastCalledWith("upvote");

		rerender(
			<TranslationProvider initial={translation.snapshot}>
				<FeedVoteControl
					onReactionChange={onReactionChange}
					reaction="upvote"
					score="228"
				/>
			</TranslationProvider>,
		);
		const selectedUpvote = screen.getByRole("button", { name: "贊成" });
		expect(selectedUpvote.classList.contains("text-primary")).toBe(true);
		expect(screen.getByText("228").classList.contains("text-primary")).toBe(true);
		fireEvent.click(selectedUpvote);
		expect(onReactionChange).toHaveBeenLastCalledWith(null);

		rerender(
			<TranslationProvider initial={translation.snapshot}>
				<FeedVoteControl
					onReactionChange={onReactionChange}
					reaction="downvote"
					score="226"
				/>
			</TranslationProvider>,
		);
		const selectedDownvote = screen.getByRole("button", { name: "不贊成" });
		expect(selectedDownvote.classList.contains("text-info")).toBe(true);
		expect(screen.getByText("226").classList.contains("text-info")).toBe(true);
	});

	it("opens the share surface and confirms a copied link", async () => {
		const onCopyLink = vi.fn(() => Promise.resolve());
		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedShareSurfaceView
					nativeShareAvailable={false}
					onCopyLink={onCopyLink}
					onNativeShare={() => Promise.resolve(false)}
				/>
			</TranslationProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "分享內容" }));
		fireEvent.click(await screen.findByRole("button", { name: "複製連結" }));

		expect(onCopyLink).toHaveBeenCalledOnce();
		expect(await screen.findByRole("button", { name: "已複製連結" })).toBeTruthy();
	});
});
