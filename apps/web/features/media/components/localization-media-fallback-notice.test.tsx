/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { LocalizationMediaFallbackNotice } from "./localization-media-fallback-notice";

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

afterEach(cleanup);

const translation = await create(resources).getTranslation(["media"], ["zh-Hant"]);

describe("LocalizationMediaFallbackNotice", () => {
	it("opens the complete image and text fallback rules from one top-level link", async () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<LocalizationMediaFallbackNotice />
			</TranslationProvider>,
		);

		fireEvent.click(
			screen.getByRole("button", {
				name: "所有圖片資產都會獨立套用語言遞補規則。",
			}),
		);

		expect(await screen.findByRole("dialog")).toBeTruthy();
		expect(screen.getByText(/每位使用者的語言偏好/)).toBeTruthy();
		expect(screen.getByText(/標題、摘要與描述不會分別/)).toBeTruthy();
		expect(screen.getByText(/中文文字、中文橫幅與英文頭像/)).toBeTruthy();
	});
});
