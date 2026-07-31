/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { WorkOwnershipField } from "./work-ownership-field";

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

describe("WorkOwnershipField", () => {
	it("presents owned and public work as ownership choices", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<WorkOwnershipField onChange={vi.fn()} value="profile_owned" />
			</TranslationProvider>,
		);

		expect(screen.getByRole("option", { name: "自有作品" })).toBeTruthy();
		expect(screen.getByRole("option", { name: "公共作品" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "什麼是公共作品？" })).toBeNull();
	});

	it("opens the public work explanation from an explicit button", async () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<WorkOwnershipField onChange={vi.fn()} value="community_owned" />
			</TranslationProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "什麼是公共作品？" }));

		expect(
			await screen.findByText("公共作品由社群擁有並共同維護。", { exact: false }),
		).toBeTruthy();
		expect(
			screen.getByText(
				"公共作品通常用來收錄你不持有著作權的既有作品，建立可搜尋的索引資料。",
			),
		).toBeTruthy();
	});

	it("emits only a proven ownership mode", () => {
		const onChange = vi.fn();
		render(
			<TranslationProvider initial={translation.snapshot}>
				<WorkOwnershipField onChange={onChange} value="profile_owned" />
			</TranslationProvider>,
		);

		fireEvent.change(screen.getByRole("combobox"), {
			target: { value: "community_owned" },
		});
		expect(onChange).toHaveBeenCalledWith("community_owned");
	});
});
