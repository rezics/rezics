import { env } from "../env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<{ ok: true } | { ok: false; error: unknown }>;
}

/**
 * Lazy-loaded SMTP transport. We avoid importing nodemailer at module load
 * so that test/dev environments without SMTP configured don't pay the cost.
 */
let smtpTransporter: unknown = null;

async function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  if (!env.SMTP_HOST) return null;
  const nodemailer = await import("nodemailer").catch(() => null);
  if (!nodemailer) {
    console.warn(
      "[notify/email] nodemailer not installed; falling back to stub transport",
    );
    return null;
  }
  smtpTransporter = nodemailer.default.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
    secure: env.SMTP_SECURE === "true",
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
  });
  return smtpTransporter;
}

export const emailTransport: EmailTransport = {
  async send(message) {
    const transporter = await getSmtpTransporter();
    if (!transporter) {
      console.log(
        `[notify/email:stub] to=${message.to} subject=${JSON.stringify(message.subject)}`,
      );
      return { ok: true };
    }
    try {
      // @ts-expect-error nodemailer is dynamically imported and untyped here
      await transporter.sendMail({
        from: env.SMTP_FROM ?? "no-reply@rezics.com",
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { ok: true };
    } catch (error) {
      console.error("[notify/email] sendMail failed:", error);
      return { ok: false, error };
    }
  },
};
