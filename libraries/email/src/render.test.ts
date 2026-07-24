import { describe, expect, test } from "vitest";

import { renderActionEmail, renderNotificationEmail } from "./render";

const frame = {
	automatedMessage: "This message was sent automatically.",
	brandName: "Rezics",
	copyright: "Copyright 2026 Rezics.",
} as const;

describe("email rendering", () => {
	test("renders action emails as compatible HTML and readable plain text", async () => {
		const rendered = await renderActionEmail({
			actionUrl: "https://example.com/verify?token=a%26b",
			copy: {
				actionLabel: "Verify email",
				body: "Confirm that this address belongs to you.",
				fallback: "If the button does not work, open this link:",
				heading: "Verify your email",
				ignoreNotice: "Ignore this message if you did not request it.",
				preview: "Verify your email address",
			},
			frame,
			locale: "en",
		});

		expect(rendered.html).toContain("<!DOCTYPE");
		expect(rendered.html).toContain("Verify your email");
		expect(rendered.html).toContain("https://example.com/verify?token=a%26b");
		expect(rendered.text).toContain("VERIFY YOUR EMAIL");
		expect(rendered.text).toContain("https://example.com/verify?token=a%26b");
	});

	test("renders notification content without adding an action", async () => {
		const rendered = await renderNotificationEmail({
			body: "Someone replied to your post.",
			frame,
			locale: "en",
			subject: "New reply",
		});

		expect(rendered.html).toContain("New reply");
		expect(rendered.text).toContain("Someone replied to your post.");
		expect(rendered.html).not.toContain("<a ");
	});
});
