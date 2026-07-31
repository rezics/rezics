/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { CreditAttributionRequestConfirmationDialog } from "./credit-attribution-request-confirmation-dialog";

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

function renderDialog({
	pending = false,
	onCancel = vi.fn(),
	onConfirm = vi.fn(),
}: {
	readonly pending?: boolean;
	readonly onCancel?: () => void;
	readonly onConfirm?: () => void;
} = {}) {
	render(
		<TranslationProvider initial={translation.snapshot}>
			<CreditAttributionRequestConfirmationDialog
				onCancel={onCancel}
				onConfirm={onConfirm}
				open
				pending={pending}
			/>
		</TranslationProvider>,
	);
	return { onCancel, onConfirm };
}

afterEach(cleanup);

describe("CreditAttributionRequestConfirmationDialog", () => {
	it("cancels without confirming", () => {
		const { onCancel, onConfirm } = renderDialog();

		fireEvent.click(screen.getByRole("button", { name: "取消" }));

		expect(onCancel).toHaveBeenCalledOnce();
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it("confirms the invitation flow", () => {
		const { onCancel, onConfirm } = renderDialog();

		fireEvent.click(screen.getByRole("button", { name: "建立並送出邀請" }));

		expect(onConfirm).toHaveBeenCalledOnce();
		expect(onCancel).not.toHaveBeenCalled();
	});

	it("disables both decisions while submitting", () => {
		renderDialog({ pending: true });

		expect(screen.getByRole("button", { name: "取消" })).toHaveProperty("disabled", true);
		expect(screen.getByRole("button", { name: "建立並送出邀請" })).toHaveProperty(
			"disabled",
			true,
		);
	});
});
