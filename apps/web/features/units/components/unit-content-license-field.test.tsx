/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { CurrentUnitContentLicenseSlug } from "@rezics/license";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import {
	PublicWorkContentLicenseField,
	UnitContentLicenseField,
} from "./unit-content-license-field";

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

function contentLicenseSelect(container: HTMLElement): HTMLSelectElement {
	const select = container.querySelector<HTMLSelectElement>('select[name="contentLicense"]');
	if (!select) throw new Error("Expected a content license select");
	return select;
}

function renderedForm(container: HTMLElement): HTMLFormElement {
	const form = container.querySelector("form");
	if (!form) throw new Error("Expected a form");
	return form;
}

function contentLicenseConfirmation(container: HTMLElement): HTMLInputElement {
	const checkbox = container.querySelector<HTMLInputElement>(
		'input[name="contentLicenseConfirmation"]',
	);
	if (!checkbox) throw new Error("Expected a content license confirmation checkbox");
	return checkbox;
}

describe("UnitContentLicenseField", () => {
	it("defaults a new work to the current content license", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<UnitContentLicenseField context="create" />
			</TranslationProvider>,
		);
		const select = contentLicenseSelect(container);

		expect(select).toHaveProperty("value", CurrentUnitContentLicenseSlug);
		const confirmation = contentLicenseConfirmation(container);
		expect(confirmation).toHaveProperty("required", true);
		expect(confirmation).toHaveProperty("checked", false);
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("carries the new-work default through the form boundary", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<form>
					<UnitContentLicenseField context="create" />
				</form>
			</TranslationProvider>,
		);
		const form = renderedForm(container);

		expect(new FormData(form).get("contentLicense")).toBe(CurrentUnitContentLicenseSlug);
	});

	it("makes a public work license impossible to submit", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<form>
					<PublicWorkContentLicenseField />
				</form>
			</TranslationProvider>,
		);
		const form = renderedForm(container);

		expect(
			screen.getByText("公共作品不會向 REZICS 授予內容授權，應只用來收錄作品的索引資料。"),
		).toBeTruthy();
		expect(new FormData(form).has("contentLicense")).toBe(false);
	});

	it("keeps the default grant when switching to none is canceled", async () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<UnitContentLicenseField context="create" />
			</TranslationProvider>,
		);
		const select = contentLicenseSelect(container);

		fireEvent.change(select, { target: { value: "none" } });

		expect(await screen.findByRole("alertdialog")).toBeTruthy();
		expect(screen.getByText(/如果你要在 REZICS 發佈或託管作品內容/)).toBeTruthy();
		expect(select).toHaveProperty("value", CurrentUnitContentLicenseSlug);

		fireEvent.click(screen.getByRole("button", { name: "保留授權" }));
		expect(select).toHaveProperty("value", CurrentUnitContentLicenseSlug);
	});

	it("commits none after the warning is confirmed", async () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<UnitContentLicenseField context="create" />
			</TranslationProvider>,
		);
		const select = contentLicenseSelect(container);
		fireEvent.change(select, { target: { value: "none" } });
		await screen.findByRole("alertdialog");
		fireEvent.click(screen.getByRole("button", { name: "改為無授權" }));
		await waitFor(() => expect(select).toHaveProperty("value", "none"));
		expect(container.querySelector('input[name="contentLicenseConfirmation"]')).toBeNull();
	});

	it("still requires confirmation before granting an unlicensed existing work", async () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<UnitContentLicenseField context="edit" grantedSlug={null} />
			</TranslationProvider>,
		);
		const select = contentLicenseSelect(container);
		expect(select).toHaveProperty("value", "none");

		fireEvent.change(select, { target: { value: CurrentUnitContentLicenseSlug } });
		expect(await screen.findByRole("alertdialog")).toBeTruthy();
		expect(select).toHaveProperty("value", "none");

		fireEvent.click(screen.getByRole("button", { name: "確認授權" }));
		await waitFor(() => expect(select).toHaveProperty("value", CurrentUnitContentLicenseSlug));
		const confirmation = contentLicenseConfirmation(container);
		expect(confirmation).toHaveProperty("required", true);
		expect(confirmation).toHaveProperty("checked", false);
	});

	it("requires fresh confirmation after switching away from and back to a license", async () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<UnitContentLicenseField context="create" />
			</TranslationProvider>,
		);
		const select = contentLicenseSelect(container);
		const confirmation = contentLicenseConfirmation(container);

		fireEvent.click(confirmation);
		expect(confirmation).toHaveProperty("checked", true);
		fireEvent.change(select, { target: { value: "none" } });
		await screen.findByRole("alertdialog");
		fireEvent.click(screen.getByRole("button", { name: "改為無授權" }));
		await waitFor(() => expect(select).toHaveProperty("value", "none"));

		fireEvent.change(select, { target: { value: CurrentUnitContentLicenseSlug } });
		await waitFor(() => expect(contentLicenseConfirmation(container)).toBeTruthy());
		const restoredConfirmation = contentLicenseConfirmation(container);
		expect(restoredConfirmation).toHaveProperty("checked", false);
	});

	it("keeps an existing irrevocable grant selected and disabled", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<UnitContentLicenseField
					context="edit"
					grantedSlug={CurrentUnitContentLicenseSlug}
				/>
			</TranslationProvider>,
		);
		const select = contentLicenseSelect(container);

		expect(select).toHaveProperty("value", CurrentUnitContentLicenseSlug);
		expect(select).toHaveProperty("disabled", true);
	});
});
