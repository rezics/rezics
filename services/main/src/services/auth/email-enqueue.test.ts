import { getTestInstance } from "better-auth/test";
import { describe, expect, it, vi } from "vitest";

const { enqueue } = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock("../email/outbox", () => ({ enqueueAuthenticationEmail: enqueue }));

import { auth } from "./index";
import { durableAuthenticationCallbacks } from "./durable-callbacks";

describe("authentication email acknowledgement", () => {
	it.each(["reset_password", "verify_email"] as const)(
		"awaits the %s durable enqueue",
		async (kind) => {
			const committed = Promise.withResolvers<string>();
			enqueue.mockReturnValueOnce(committed.promise);
			const user = {
				id: "test-user",
				email: "reader@example.com",
				emailVerified: false,
				name: "Reader",
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			const callback =
				kind === "reset_password"
					? auth.options.emailAndPassword.sendResetPassword
					: auth.options.emailVerification.sendVerificationEmail;
			let acknowledged = false;
			const pending = callback(
				{ user, url: "https://example.com/verify", token: "test" },
				undefined,
			).then(() => {
				acknowledged = true;
			});
			await vi.waitFor(() =>
				expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ kind })),
			);
			expect(acknowledged).toBe(false);
			committed.resolve("outbox-id");
			await pending;
			expect(acknowledged).toBe(true);
		},
	);

	it("returns a retryable HTTP failure even when Better Auth uses its background helper", async () => {
		const fixture = await getTestInstance({
			emailAndPassword: {
				enabled: true,
				sendResetPassword: auth.options.emailAndPassword.sendResetPassword,
			},
			plugins: [durableAuthenticationCallbacks],
		});
		enqueue.mockRejectedValueOnce(new Error("private database diagnostic"));
		const failed = await fixture.auth.api.requestPasswordReset({
			body: { email: fixture.testUser.email },
			asResponse: true,
		});
		expect(failed.status).toBe(503);
		expect(await failed.json()).toMatchObject({ code: "EMAIL_ENQUEUE_UNAVAILABLE" });
		enqueue.mockResolvedValueOnce("retry-outbox-id");
		const retry = await fixture.auth.api.requestPasswordReset({
			body: { email: fixture.testUser.email },
			asResponse: true,
		});
		expect(retry.status).toBe(200);
	});
});
