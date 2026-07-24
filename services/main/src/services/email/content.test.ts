import { describe, expect, test } from "vitest";

import { renderClaimedEmail } from "./content";
import type { ClaimedEmail } from "./outbox";

const claimedAuthenticationEmail = {
	acceptedAt: null,
	actionUrl: "https://example.com/api/auth/verify-email?token=example",
	attemptCount: 1,
	availableAt: new Date("2026-07-24T00:00:00.000Z"),
	createdAt: new Date("2026-07-24T00:00:00.000Z"),
	failedAt: null,
	id: "019b0000-0000-7000-8000-000000000001",
	kind: "verify_email",
	lastError: null,
	leaseExpiresAt: new Date("2026-07-24T00:01:00.000Z"),
	locale: "zh-hant",
	notificationId: null,
	providerMessageId: null,
	providerStatus: null,
	recipientEmail: "reader@example.com",
	status: "processing",
	updatedAt: new Date("2026-07-24T00:00:00.000Z"),
} as const satisfies ClaimedEmail;

describe("email content", () => {
	test("renders a localized authentication intent into a complete provider message", async () => {
		const message = await renderClaimedEmail(claimedAuthenticationEmail);

		expect(message.to).toBe("reader@example.com");
		expect(message.subject).toBe("驗證你的 REZICS 電子郵件");
		expect(message.html).toContain("驗證電子郵件");
		expect(message.text).toContain(claimedAuthenticationEmail.actionUrl);
	});
});
