/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { FeedContentSelector } from "./feed-content-selector";

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

const translation = await create(resources).getTranslation(["feed"], ["zh-Hant"]);

afterEach(cleanup);

describe("FeedContentSelector", () => {
	it("leaves every content type unchecked when the feed is unfiltered", async () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedContentSelector onValueChange={vi.fn()} value={[]} />
			</TranslationProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "內容篩選" }));

		const checkboxes = await screen.findAllByRole("menuitemcheckbox");
		expect(checkboxes.length).toBeGreaterThan(0);
		expect(
			checkboxes.every((checkbox) => checkbox.getAttribute("aria-checked") === "false"),
		).toBe(true);
	});

	it("offers only clear-all as the special content action", async () => {
		const onValueChange = vi.fn();
		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedContentSelector
					onValueChange={onValueChange}
					value={["unit:book", "post:review"]}
				/>
			</TranslationProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "內容篩選" }));

		expect(screen.queryByRole("menuitem", { name: "全部" })).toBeNull();
		expect(screen.queryByRole("menuitemcheckbox", { name: "回覆" })).toBeNull();
		const clearAll = await screen.findByRole("menuitem", { name: "全部清除" });
		expect(clearAll.hasAttribute("data-disabled")).toBe(false);
	});

	it("shows only the content kinds allowed by its host", async () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedContentSelector
					onValueChange={vi.fn()}
					options={["unit:book", "unit:collection", "post:review"]}
					value={[]}
				/>
			</TranslationProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "內容篩選" }));

		expect(await screen.findAllByRole("menuitemcheckbox")).toHaveLength(3);
		expect(screen.queryByRole("menuitemcheckbox", { name: "媒體" })).toBeNull();
	});
});
