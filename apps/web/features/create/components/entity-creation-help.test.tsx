/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { EntityCreationHelp } from "./entity-creation-help";

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

const translation = await create(resources).getTranslation(["create"], ["zh-Hant"]);

afterEach(cleanup);

describe("EntityCreationHelp", () => {
	it("opens localized guidance and closes it with the visible action", async () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<EntityCreationHelp />
			</TranslationProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "開啟署名說明" }));

		expect(await screen.findByRole("dialog")).toBeTruthy();
		expect(
			screen.getByText(
				"署名需要關聯實體。如果搜尋不到實體，或想建立例如代表自己的作者身分，請先建立實體。",
			),
		).toBeTruthy();
		expect(screen.getByRole("link", { name: "建立實體" }).getAttribute("href")).toBe(
			"/create/entity",
		);

		fireEvent.click(screen.getByRole("button", { name: "關閉" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});
});
