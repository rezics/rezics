/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { StudioSectionToolbar, type StudioFilterState } from "./studio-section-toolbar";

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

const translation = await create(resources).getTranslation(["create"], ["zh-Hant"]);
const filters = {
	view: "all",
	permission: "unit.update",
	workState: "any",
	status: "draft",
	visibility: "any",
	sort: "recent",
} satisfies StudioFilterState;

afterEach(cleanup);

describe("StudioSectionToolbar", () => {
	it("keeps primary controls visible and applies cleared advanced filters together", () => {
		const onChange = vi.fn();
		render(
			<TranslationProvider initial={translation.snapshot}>
				<StudioSectionToolbar filters={filters} onChange={onChange} />
			</TranslationProvider>,
		);

		expect(screen.getByRole("combobox", { name: "工作關係" })).toBeTruthy();
		expect(screen.getByRole("combobox", { name: "排序方式" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /更多篩選/ }));

		const dialog = screen.getByRole("dialog");
		expect(within(dialog).getByRole("combobox", { name: "目前權限" })).toBeTruthy();
		expect(within(dialog).getByRole("combobox", { name: "工作狀態" })).toBeTruthy();
		expect(within(dialog).getByRole("combobox", { name: "內容狀態" })).toBeTruthy();
		expect(within(dialog).getByRole("combobox", { name: "可見性" })).toBeTruthy();

		fireEvent.click(within(dialog).getByRole("button", { name: "清除篩選" }));
		fireEvent.click(within(dialog).getByRole("button", { name: "套用篩選" }));
		expect(onChange).toHaveBeenCalledWith({
			permission: "any",
			status: "any",
			visibility: "any",
			workState: "any",
		});
	});
});
