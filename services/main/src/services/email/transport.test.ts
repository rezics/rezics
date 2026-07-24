import { describe, expect, test } from "vitest";

import { MailTransportError, type MailMessage, sendCloudflareMail } from "./transport";

const config = {
	accountId: "account-id",
	apiToken: "api-token",
	fromAddress: "no-reply@example.com",
	fromName: "Rezics",
} as const;

const message = {
	html: "<p>Hello</p>",
	subject: "Hello",
	text: "Hello",
	to: "reader@example.com",
} as const satisfies MailMessage;

function response(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		headers: { "Content-Type": "application/json" },
		status,
	});
}

describe("Cloudflare email transport", () => {
	test("sends rendered HTML and text with a named sender", async () => {
		const calls: Array<readonly [string, RequestInit]> = [];
		const request = async (url: string, init: RequestInit) => {
			calls.push([url, init]);
			return response(200, {
				errors: [],
				result: {
					delivered: [],
					message_id: "message-1",
					permanent_bounces: [],
					queued: [message.to],
				},
				success: true,
			});
		};

		await expect(sendCloudflareMail(config, message, request)).resolves.toEqual({
			providerMessageId: "message-1",
			status: "queued",
		});
		const init = calls[0]?.[1];
		expect(JSON.parse(String(init?.body))).toEqual({
			from: { address: config.fromAddress, name: config.fromName },
			...message,
		});
	});

	test("marks rate limiting as retryable", async () => {
		const promise = sendCloudflareMail(config, message, async () =>
			response(429, {
				errors: [{ code: 10004, message: "email.sending.error.throttled" }],
				result: null,
				success: false,
			}),
		);

		await expect(promise).rejects.toMatchObject({
			code: "CloudflareEmailRejected",
			retryable: true,
		});
	});

	test("marks permanent bounces as terminal", async () => {
		const promise = sendCloudflareMail(config, message, async () =>
			response(200, {
				errors: [],
				result: {
					delivered: [],
					message_id: "message-2",
					permanent_bounces: [message.to],
					queued: [],
				},
				success: true,
			}),
		);

		await expect(promise).rejects.toBeInstanceOf(MailTransportError);
		await expect(promise).rejects.toMatchObject({
			code: "CloudflareEmailPermanentBounce",
			retryable: false,
		});
	});

	test("rejects untrusted response shapes", async () => {
		const promise = sendCloudflareMail(config, message, async () =>
			response(200, { result: { queued: [message.to] }, success: true }),
		);

		await expect(promise).rejects.toMatchObject({
			code: "CloudflareEmailInvalidResponse",
			retryable: false,
		});
	});
});
