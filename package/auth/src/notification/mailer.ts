import {
  createEmailSender,
  formatSenderAddress,
  type EmailSender,
} from "@rezics/email";
import { env } from "../env";

export function getDefaultSender(): string {
  return formatSenderAddress({
    email: env.AUTH_VERIFICATION_FROM_EMAIL,
    name: env.SMTP_USER_NAME,
  });
}

export function createAuthMailer(defaultFromEmail?: string): EmailSender {
  const port = Number(env.SMTP_PORT);
  const secure = env.SMTP_SECURE.toLowerCase() !== "false";

  return createEmailSender({
    defaultFrom: {
      email: defaultFromEmail ?? env.AUTH_VERIFICATION_FROM_EMAIL,
      name: env.SMTP_USER_NAME,
    },
    transport: {
      host: env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
      rejectUnauthorized: true,
    },
  });
}

export function getAuthSmtpConfig() {
  const port = Number(env.SMTP_PORT);
  const secure = env.SMTP_SECURE.toLowerCase() !== "false";

  return {
    host: env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    rejectUnauthorized: true,
  };
}
