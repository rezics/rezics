/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { CurrentUnitContentLicenseSlug } from "@rezics/license";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { UnitContentLicenseField } from "./unit-content-license-field";

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

const translation = await create(resources).getTranslation(["licenses", "units"], ["zh-Hant"]);

afterEach(cleanup);

describe("UnitContentLicenseField", () => {
	it("leaves a selected grant uncommitted when confirmation is canceled", async () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<UnitContentLicenseField defaultSlug={null} />
			</TranslationProvider>,
		);
		const select = container.querySelector<HTMLSelectElement>('select[name="contentLicense"]');
		expect(select).not.toBeNull();

		fireEvent.change(select!, { target: { value: CurrentUnitContentLicenseSlug } });

		expect(await screen.findByRole("alertdialog")).toBeTruthy();
		expect(
			screen.getByText("授權後不可撤銷，並持續適用於這項內容的後續貢獻及所有權移轉。"),
		).toBeTruthy();
		expect(select).toHaveProperty("value", "none");

		fireEvent.click(screen.getByRole("button", { name: "取消" }));
		expect(select).toHaveProperty("value", "none");
	});

	it("commits a selected grant after confirmation", async () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<UnitContentLicenseField defaultSlug={null} />
			</TranslationProvider>,
		);
		const select = container.querySelector<HTMLSelectElement>('select[name="contentLicense"]');
		fireEvent.change(select!, { target: { value: CurrentUnitContentLicenseSlug } });
		await screen.findByRole("alertdialog");
		fireEvent.click(screen.getByRole("button", { name: "確認授權" }));
		await waitFor(() => expect(select).toHaveProperty("value", CurrentUnitContentLicenseSlug));
	});

	it("keeps an existing irrevocable grant selected and disabled", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<UnitContentLicenseField defaultSlug={CurrentUnitContentLicenseSlug} />
			</TranslationProvider>,
		);
		const select = container.querySelector<HTMLSelectElement>('select[name="contentLicense"]');

		expect(select).toHaveProperty("value", CurrentUnitContentLicenseSlug);
		expect(select).toHaveProperty("disabled", true);
	});
});
