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
	mode: "workspace",
	source: "all",
	kind: "all",
	status: "draft",
	visibility: "any",
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

		expect(screen.getByRole("combobox", { name: "內容清單" })).toBeTruthy();
		expect(screen.getByRole("combobox", { name: "工作空間來源" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /更多篩選/ }));

		const dialog = screen.getByRole("dialog");
		expect(within(dialog).getByRole("combobox", { name: "內容狀態" })).toBeTruthy();
		expect(within(dialog).getByRole("combobox", { name: "可見性" })).toBeTruthy();

		fireEvent.click(within(dialog).getByRole("button", { name: "清除篩選" }));
		fireEvent.click(within(dialog).getByRole("button", { name: "套用篩選" }));
		expect(onChange).toHaveBeenCalledWith({
			status: "any",
			visibility: "any",
		});
	});

	it("shows contribution-specific controls without workspace-only filters", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<StudioSectionToolbar filters={{ ...filters, mode: "contributions" }} onChange={vi.fn()} />
			</TranslationProvider>,
		);

		expect(screen.getByRole("combobox", { name: "內容清單" })).toBeTruthy();
		expect(screen.getByRole("combobox", { name: "貢獻類型" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: /更多篩選/ })).toBeNull();
	});
});
