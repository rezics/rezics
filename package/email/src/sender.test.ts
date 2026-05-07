import { describe, expect, test } from "bun:test";
import { createEmailSender, formatSenderAddress } from "./sender";

function createTransporter(sendMail: (message: unknown) => Promise<void>) {
  return {
    sendMail,
    verify: async () => true,
  } as never;
}

describe("email sender", () => {
  test("formats sender addresses with optional display name", () => {
    expect(
      formatSenderAddress({
        email: "noreply@rezics.com",
        name: "Rezics",
      }),
    ).toBe("Rezics <noreply@rezics.com>");
    expect(formatSenderAddress({ email: "noreply@rezics.com" })).toBe(
      "noreply@rezics.com",
    );
  });

  test("passes explicit SMTP config and sender through to nodemailer", async () => {
    const sent: unknown[] = [];
    const sender = createEmailSender({
      transport: {
        host: "smtp.example.com",
        port: 465,
        secure: true,
        auth: { user: "smtp-user", pass: "smtp-password" },
      },
      defaultFrom: {
        email: "noreply@rezics.com",
        name: "Rezics",
      },
      transporter: createTransporter(async (message) => {
        sent.push(message);
      }),
    });

    const result = await sender.send({
      to: "reader@example.com",
      subject: "Verify email",
      text: "123456",
    });

    expect(result).toEqual({ ok: true });
    expect(sent).toEqual([
      {
        from: "Rezics <noreply@rezics.com>",
        to: "reader@example.com",
        subject: "Verify email",
        text: "123456",
        html: undefined,
      },
    ]);
  });

  test("propagates delivery failures as typed errors", async () => {
    const cause = new Error("smtp unavailable");
    const sender = createEmailSender({
      transport: { host: "smtp.example.com" },
      defaultFrom: { email: "noreply@rezics.com" },
      transporter: createTransporter(async () => {
        throw cause;
      }),
    });

    const result = await sender.send({
      to: "reader@example.com",
      subject: "Verify email",
      text: "123456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMAIL_DELIVERY_FAILED");
      expect(result.error.message).toBe("smtp unavailable");
      expect(result.error.cause).toBe(cause);
    }
  });
});
