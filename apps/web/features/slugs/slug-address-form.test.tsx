/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { SlugAddressForm } from "./slug-address-form";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(
	["betterAuthErrorCodes", "errorCodes", "errors", "settings", "state", "ui"],
	["zh-Hant"],
);

function renderForm(properties: Partial<React.ComponentProps<typeof SlugAddressForm>> = {}) {
	const onSubmit = properties.onSubmit ?? vi.fn(async () => undefined);
	render(
		<TranslationProvider initial={translation.snapshot}>
			<SlugAddressForm
				error={null}
				isPending={false}
				mode="assign-once"
				onSubmit={onSubmit}
				{...properties}
			/>
		</TranslationProvider>,
	);
	return { onSubmit };
}

describe("Profile slug assignment form", () => {
	afterEach(cleanup);

	it("makes the assign-once state explicit after a slug exists", () => {
		renderForm({ initialSlug: "alice" });

		expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByText("這個個人網址已設定，目前無法變更。")).toBeTruthy();
	});

	it("rejects a reserved label before sending the mutation", () => {
		const { onSubmit } = renderForm();
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "admin" } });
		fireEvent.click(screen.getByRole("button", { name: "儲存" }));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole("alert").textContent).toBe("這個個人網址是平台保留名稱，無法使用。");
	});
});
