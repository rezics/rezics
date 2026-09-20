import { http, HttpResponse } from "msw";
import { expect } from "storybook/test";
import type { GetApiAccountMePreferencesStatus200 } from "@rezics/openapi-tanstack-query";
import preview from "@/.storybook/preview";
import { PrivacySettingsPage } from "./privacy-settings-page";

const preferences = {
	interfaceLocale: "zh-Hant",
	chineseContentDisplay: "original",
	defaultLicenses: [],
	defaultRealmManageMode: false,
	defaultScoreRealmId: "00000000-0000-7000-8000-000000000001",
	scoreVisibility: "public",
	progressVisibility: "public",
	collectionConfig: null,
	personalizedFeed: true,
	customThemesEnabled: true,
	filterFeedByPreferredLanguages: false,
	alwaysShowSpoilers: false,
	alwaysShowNsfw: false,
	contentRatings: ["general"],
	preferredLanguages: ["ja"],
} satisfies GetApiAccountMePreferencesStatus200;

const meta = preview.meta({
	component: PrivacySettingsPage,
	tags: ["ai-generated"],
	beforeEach({ msw }) {
		msw.use(http.get("*/api/v1/account/me/preferences", () => HttpResponse.json(preferences)));
	},
});
export default meta;

export const DeniedKeepsChoice = meta.story({
	globals: { locale: "zh-Hant", viewport: { value: "mobile", isRotated: false } },
	beforeEach({ msw }) {
		msw.use(
			http.patch("*/api/v1/account/me/privacy", () =>
				HttpResponse.json(
					{
						error: { code: "AccessDenied", message: "Access denied for this operation" },
						requestId: "00000000-0000-7000-8000-000000000002",
					},
					{ status: 403 },
				),
			),
		);
	},
	play: async ({ canvas, userEvent }) => {
		const select = await canvas.findByRole("combobox", { name: "評分" });
		await userEvent.selectOptions(select, "private");
		await userEvent.click(canvas.getByRole("button", { name: "儲存" }));
		await expect(await canvas.findByRole("alert")).toHaveTextContent("你沒有執行此操作的權限。");
		await expect(select).toHaveValue("private");
		await expect(canvas.getByRole("button", { name: "儲存" })).toBeEnabled();
	},
});

export const UnavailableKeepsChoice = meta.story({
	globals: { locale: "en", theme: "dark" },
	beforeEach({ msw }) {
		msw.use(
			http.patch("*/api/v1/account/me/privacy", () =>
				HttpResponse.json(
					{
						error: {
							code: "AccessUnavailable",
							message: "Access could not be verified. Try again.",
						},
						requestId: "00000000-0000-7000-8000-000000000003",
					},
					{ status: 503 },
				),
			),
		);
	},
	play: async ({ canvas, userEvent }) => {
		const select = await canvas.findByRole("combobox", { name: "Scores" });
		await userEvent.selectOptions(select, "private");
		await userEvent.click(canvas.getByRole("button", { name: "Save" }));
		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"Your access could not be verified. Try again.",
		);
		await expect(select).toHaveValue("private");
		await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
	},
});
