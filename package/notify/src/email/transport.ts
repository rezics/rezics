import { createEmailSender } from "@rezics/email";
import { env } from "../env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailTransport {
  send(
    message: EmailMessage,
  ): Promise<{ ok: true } | { ok: false; error: unknown }>;
}

let smtpSender: ReturnType<typeof createEmailSender> | null = null;

function getSmtpSender() {
  if (smtpSender) return smtpSender;
  if (!env.SMTP_HOST) return null;

  // Pool/maxConnections/maxMessages come from @rezics/email defaults.
  // Pool/maxConnections/maxMessages 取自 @rezics/email 的默认值。
  smtpSender = createEmailSender({
    defaultFrom: {
      email: env.SMTP_FROM ?? "no-reply@rezics.com",
    },
    transport: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
      secure: env.SMTP_SECURE === "true",
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
    },
  });
  return smtpSender;
}

export const emailTransport: EmailTransport = {
  async send(message) {
    const sender = getSmtpSender();
    if (!sender) {
      console.log(
        `[notify/email:stub] to=${message.to} subject=${JSON.stringify(message.subject)}`,
      );
      return { ok: true };
    }

    const result = await sender.send(message);
    if (!result.ok) {
      console.error("[notify/email] sendMail failed:", result.error.cause);
      return { ok: false, error: result.error.cause };
    }
    return { ok: true };
  },
};
