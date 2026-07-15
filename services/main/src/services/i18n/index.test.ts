import Elysia from "elysia";
import { describe, expect, it } from "vitest";

import i18n, { getRequestTranslation, getTranslation } from ".";

describe("backend internationalization", () => {
	it("provides request translations through an Elysia context", async () => {
		const app = new Elysia().use(i18n).get("/", async ({ i18n }) => {
			const { data, locale } = await i18n.getRequestTranslation();
			return { locale, subject: data.emails.verifyEmail("https://example.com").subject };
		});
		const response = await app.handle(
			new Request("http://localhost/", { headers: { "Accept-Language": "en-US" } }),
		);

		expect(response.headers.get("Content-Language")).toBe("en-US");
		expect(await response.json()).toEqual({
			locale: "en-US",
			subject: "Verify your REZICS email address",
		});
	});

	it("lets an Elysia route use explicit language preferences", async () => {
		const app = new Elysia().use(i18n).get("/", async ({ i18n }) => {
			const { data } = await i18n.getTranslation(["zh-CN"]);
			return data.notifications.follow;
		});
		const response = await app.handle(
			new Request("http://localhost/", { headers: { "Accept-Language": "en-US" } }),
		);

		expect(response.headers.get("Content-Language")).toBe("zh-CN");
		expect(await response.json()).toEqual({
			title: "REZICS 有新的关注",
			body: "有人开始关注你。",
		});
	});

	it("matches request language preferences for authentication email copy", async () => {
		const { data, locale } = await getRequestTranslation(
			new Headers({ "Accept-Language": "en-US, zh-CN;q=0.8" }),
		);

		expect(locale).toBe("en-US");
		expect(data.emails.resetPassword("https://example.com/reset")).toEqual({
			subject: "Reset your REZICS password",
			text: "Open this link within one hour to reset your password: https://example.com/reset",
		});
	});

	it("matches stored preferences for notification copy", async () => {
		const { data, locale } = await getTranslation(["en-US", "zh-CN"]);

		expect(locale).toBe("en-US");
		expect(data.notifications.direct_message).toEqual({
			title: "New message on REZICS",
			body: "You received a new direct message.",
		});
	});

	it("uses the shared fallback for unsupported stored preferences", async () => {
		const { data, locale } = await getTranslation(["ja-JP"]);

		expect(locale).toBe("zh-CN");
		expect(data.notifications.follow).toEqual({
			title: "REZICS 有新的关注",
			body: "有人开始关注你。",
		});
	});
});
