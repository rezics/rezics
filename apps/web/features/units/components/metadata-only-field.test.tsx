/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { MetadataOnlyField } from "./metadata-only-field";

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

const translation = await create(resources).getTranslation(["units"], ["zh-Hant"]);

afterEach(cleanup);

describe("MetadataOnlyField", () => {
	it("changes directly when creation confirmation is not requested", async () => {
		const onChange = vi.fn();
		render(
			<TranslationProvider initial={translation.snapshot}>
				<MetadataOnlyField onChange={onChange} type="book" value />
			</TranslationProvider>,
		);

		screen.getByText("僅收錄資料").click();

		await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("requires an informational decision before a public work provides full content", async () => {
		const onChange = vi.fn();
		render(
			<TranslationProvider initial={translation.snapshot}>
				<MetadataOnlyField confirmFullContent onChange={onChange} type="media" value />
			</TranslationProvider>,
		);

		screen.getByText("僅收錄資料").click();

		expect(onChange).not.toHaveBeenCalled();
		expect(await screen.findByRole("alertdialog")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "提供完整內容" }));
		expect(onChange).toHaveBeenCalledWith(false);
	});

	it("is read-only without the supplemental capability", () => {
		const onChange = vi.fn();
		render(
			<TranslationProvider initial={translation.snapshot}>
				<MetadataOnlyField disabled onChange={onChange} type="software" value />
			</TranslationProvider>,
		);

		screen.getByText("僅收錄資料").click();

		expect(onChange).not.toHaveBeenCalled();
	});
});
