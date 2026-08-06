import { describe, expect, test, vi } from "vitest";

import { onRequest } from "../functions/_middleware";

function context(
	path: string,
	init?: RequestInit,
): {
	request: Request;
	next: ReturnType<typeof vi.fn<() => Promise<Response>>>;
} {
	return {
		request: new Request(`https://about.rezics.com${path}`, init),
		next: vi.fn(async () => new Response("next")),
	};
}

describe("Cloudflare language redirects", () => {
	test("negotiates an unlocalized public entry", async () => {
		const requestContext = context("/products?from=test", {
			headers: { "Accept-Language": "de-DE,de;q=0.9,en;q=0.7" },
		});

		const response = await onRequest(requestContext);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"https://about.rezics.com/de/products/?from=test",
		);
		expect(response.headers.get("vary")).toBe("Accept-Language");
		expect(requestContext.next).not.toHaveBeenCalled();
	});

	test("maps regional Chinese preferences to the supported script locale", async () => {
		const requestContext = context("/uses", {
			headers: { "Accept-Language": "zh-TW,zh;q=0.9" },
		});

		const response = await onRequest(requestContext);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://about.rezics.com/zh-hant/uses/");
	});

	test("falls back to the only supported contact locale", async () => {
		const requestContext = context("/contact-us", {
			headers: { "Accept-Language": "de" },
		});

		const response = await onRequest(requestContext);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://about.rezics.com/en/contact-us/");
	});

	test("passes canonical pages through", async () => {
		const requestContext = context("/en/products/unit/");

		const response = await onRequest(requestContext);

		expect(await response.text()).toBe("next");
		expect(requestContext.next).toHaveBeenCalledOnce();
	});

	test("does not redirect state-changing requests", async () => {
		const requestContext = context("/products", { method: "POST" });

		await onRequest(requestContext);

		expect(requestContext.next).toHaveBeenCalledOnce();
	});

	test.each(["/product", "/en/products/catalog/", "/products/not-registered"])(
		"does not restore unsupported or pre-v1 path %s",
		async (path) => {
			const requestContext = context(path);

			await onRequest(requestContext);

			expect(requestContext.next).toHaveBeenCalledOnce();
		},
	);
});
