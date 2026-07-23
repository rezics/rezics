/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { FontAwesomeIconPicker } from "./font-awesome-icon-picker";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(["media"], ["zh-Hant"]);

function renderPicker(onSelect = vi.fn()) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return {
		onSelect,
		...render(
			<QueryClientProvider client={queryClient}>
				<TranslationProvider initial={translation.snapshot}>
					<FontAwesomeIconPicker onSelect={onSelect} />
				</TranslationProvider>
			</QueryClientProvider>,
		),
	};
}

beforeEach(() => {
	document.documentElement.dataset.fontAwesome = "configured";
	document.documentElement.dataset.fontAwesomeLicense = "free";
});

afterEach(() => {
	cleanup();
	delete document.documentElement.dataset.fontAwesome;
	delete document.documentElement.dataset.fontAwesomeLicense;
});

describe("FontAwesomeIconPicker", () => {
	it("shows selectable common icons before the user searches", () => {
		const { onSelect } = renderPicker();

		expect(screen.getByText("常用圖示")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "選擇圖示：user" }));

		expect(onSelect).toHaveBeenCalledWith({
			provider: "font-awesome",
			prefix: "fas",
			name: "user",
		});
	});

	it("shows common brand icons when the style changes", () => {
		renderPicker();

		fireEvent.change(screen.getByRole("combobox", { name: "圖示樣式" }), {
			target: { value: "fab" },
		});

		expect(screen.getByRole("button", { name: "選擇圖示：github" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "選擇圖示：user" })).toBeNull();
	});
});
