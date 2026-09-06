import { beforeEach, describe, expect, it, vi } from "vitest";

const { claim, renew, accept, fail, render, send } = vi.hoisted(() => ({
	claim: vi.fn(),
	renew: vi.fn(),
	accept: vi.fn(),
	fail: vi.fn(),
	render: vi.fn(),
	send: vi.fn(),
}));
vi.mock("./outbox", async (original) => ({
	...(await original<typeof import("./outbox")>()),
	claimEmailBatch: claim,
	renewEmailLease: renew,
	markEmailAccepted: accept,
	markEmailFailed: fail,
}));
vi.mock("./content", async (original) => ({
	...(await original<typeof import("./content")>()),
	renderClaimedEmail: render,
}));
vi.mock("./transport", async (original) => ({
	...(await original<typeof import("./transport")>()),
	sendMail: send,
}));

import { dispatchEmailBatch } from "./dispatcher";
import { EmailLeaseLost } from "./outbox";
import { MailTransportError } from "./transport";

beforeEach(() => {
	vi.resetAllMocks();
	claim.mockResolvedValue([{ id: "email", attemptCount: 1, kind: "verify_email" }]);
	render.mockResolvedValue({ to: "reader@example.com", subject: "Verify", html: "", text: "" });
	renew.mockResolvedValue(undefined);
	send.mockResolvedValue({ providerMessageId: "provider-id", status: "queued" });
	accept.mockResolvedValue(undefined);
	fail.mockResolvedValue("retry_scheduled");
});

describe("email dispatch ownership", () => {
	it("does not send or finalize after losing the lease while rendering", async () => {
		renew.mockRejectedValue(new EmailLeaseLost("email"));
		expect(await dispatchEmailBatch()).toBe(1);
		expect(send).not.toHaveBeenCalled();
		expect(accept).not.toHaveBeenCalled();
		expect(fail).not.toHaveBeenCalled();
	});

	it("does not rewrite provider acceptance as failure when database acknowledgement fails", async () => {
		accept.mockRejectedValue(new Error("database acknowledgement unavailable"));
		expect(await dispatchEmailBatch()).toBe(1);
		expect(send).toHaveBeenCalledOnce();
		expect(fail).not.toHaveBeenCalled();
	});

	it("records a retryable transport failure only through the fenced claim", async () => {
		send.mockRejectedValue(
			new MailTransportError({ code: "Unavailable", message: "Unavailable", retryable: true }),
		);
		await dispatchEmailBatch();
		expect(fail).toHaveBeenCalledWith(
			expect.objectContaining({ attemptCount: 1 }),
			expect.objectContaining({ retryable: true }),
		);
		expect(accept).not.toHaveBeenCalled();
	});

	it("acknowledges an accepted message after renewing ownership", async () => {
		await dispatchEmailBatch();
		expect(renew.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]!);
		expect(accept).toHaveBeenCalledWith(
			expect.objectContaining({ attemptCount: 1 }),
			{ providerMessageId: "provider-id", status: "queued" },
			expect.any(Date),
		);
		expect(fail).not.toHaveBeenCalled();
	});
});
