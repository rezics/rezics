import Elysia from "elysia";
import { describe, expect, it } from "vitest";

import i18n, { getRequestTranslation, getTranslation } from ".";

describe("backend internationalization", () => {
	it("provides request translations through an Elysia context", async () => {
		const app = new Elysia().use(i18n).get("/", async ({ i18n }) => {
			const { t, locale } = await i18n.getRequestTranslation("emails");
			return { locale, subject: t.verifyEmail.subject };
		});
		const response = await app.handle(
			new Request("http://localhost/", { headers: { "Accept-Language": "en-US" } }),
		);

		expect(response.headers.get("Content-Language")).toBe("en");
		expect(await response.json()).toEqual({
			locale: "en",
			subject: "Verify your REZICS email address",
		});
	});

	it("lets an Elysia route use explicit language preferences", async () => {
		const app = new Elysia().use(i18n).get("/", async ({ i18n }) => {
			const { t } = await i18n.getTranslation("notifications", ["zh-Hant"]);
			return t.new_follower;
		});
		const response = await app.handle(
			new Request("http://localhost/", { headers: { "Accept-Language": "en-US" } }),
		);

		expect(response.headers.get("Content-Language")).toBe("zh-Hant");
		expect(await response.json()).toEqual({
			title: "REZICS 有新的追蹤",
			body: "有人開始追蹤你。",
		});
	});

	it("matches request language preferences for authentication email copy", async () => {
		const { t, locale } = await getRequestTranslation(
			"emails",
			new Headers({ "Accept-Language": "en-US, zh-CN;q=0.8" }),
		);

		expect(locale).toBe("en");
		expect(t.resetPassword.subject).toBe("Reset your REZICS password");
		expect(t.resetPassword.text({ url: "https://example.com/reset" })).toBe(
			"Open this link within one hour to reset your password: https://example.com/reset",
		);
	});

	it("matches stored preferences for notification copy", async () => {
		const { t, locale } = await getTranslation("notifications", ["en-US", "zh-Hant"]);

		expect(locale).toBe("en");
		expect(t.direct_message).toEqual({
			title: "New message on REZICS",
			body: "You received a new direct message.",
		});
	});

	it("uses the shared fallback for unsupported stored preferences", async () => {
		const { t, locale } = await getTranslation("notifications", ["ja-JP"]);

		expect(locale).toBe("zh-Hant");
		expect(t.new_follower).toEqual({
			title: "REZICS 有新的追蹤",
			body: "有人開始追蹤你。",
		});
	});
});
