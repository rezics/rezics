/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeedFilterSelector } from "./feed-filter-selector";

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);

const options = [
	{ value: "zh-Hant", label: "繁體中文" },
	{ value: "en", label: "英文" },
] as const;

afterEach(cleanup);

describe("FeedFilterSelector", () => {
	it("leaves every option unchecked when no filter is explicit", async () => {
		render(
			<FeedFilterSelector
				ariaLabel="語言篩選"
				clearLabel="全部清除"
				groupLabel="語言"
				onValueChange={vi.fn()}
				options={options}
				selectedCountLabel={(count) => `已選擇 ${count} 項`}
				unfilteredLabel="所有語言"
				value={[]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "語言篩選" }));

		const checkboxes = await screen.findAllByRole("menuitemcheckbox");
		expect(checkboxes).toHaveLength(options.length);
		expect(
			checkboxes.every((checkbox) => checkbox.getAttribute("aria-checked") === "false"),
		).toBe(true);
	});

	it("checks only values present in the explicit selection", async () => {
		render(
			<FeedFilterSelector
				ariaLabel="語言篩選"
				clearLabel="全部清除"
				groupLabel="語言"
				onValueChange={vi.fn()}
				options={options}
				selectedCountLabel={(count) => `已選擇 ${count} 項`}
				unfilteredLabel="所有語言"
				value={["en"]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "語言篩選" }));

		expect(
			(await screen.findByRole("menuitemcheckbox", { name: "英文" })).getAttribute(
				"aria-checked",
			),
		).toBe("true");
		expect(
			screen.getByRole("menuitemcheckbox", { name: "繁體中文" }).getAttribute("aria-checked"),
		).toBe("false");
	});
});
