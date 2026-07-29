/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { ProgressImportDialog } from "./progress-import-dialog";

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: (props: ComponentProps<"a">) => <a {...props} />,
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(
	["actions", "betterAuthErrorCodes", "engagement", "errorCodes", "errors", "state", "ui"],
	["zh-Hant"],
);

afterEach(cleanup);

describe("ProgressImportDialog", () => {
	it("points batch imports to API token settings without accepting a file", async () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<ProgressImportDialog variant="outline" />
			</TranslationProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "匯入歷史" }));

		expect(await screen.findByRole("dialog")).toBeTruthy();
		expect(
			screen.getByText(
				"如果您需要批次匯入，可以前往 API 權杖頁面建立權杖；必要時，也可以尋求 AI 協助。",
			),
		).toBeTruthy();
		expect(screen.getByRole("link", { name: "前往 API 權杖頁面" }).getAttribute("href")).toBe(
			"/settings/tokens",
		);
		expect(screen.queryByLabelText("匯入檔案")).toBeNull();
	});
});
