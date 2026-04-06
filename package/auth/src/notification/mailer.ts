import nodemailer, { type Transporter } from "nodemailer";

type MailerConfig = {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
};

function parseSecure(value: string | undefined): boolean {
  if (value === undefined) {
    return true;
  }

  return value.toLowerCase() !== "false";
}

export function isMailerConfigured(config: MailerConfig): boolean {
  return Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASSWORD);
}

export function createAuthMailer(config: MailerConfig): Transporter {
  const port = Number(config.SMTP_PORT ?? "465");
  const secure = parseSecure(config.SMTP_SECURE);

  return nodemailer.createTransport({
    host: config.SMTP_HOST as string,
    port,
    secure,
    auth: {
      user: config.SMTP_USER as string,
      pass: config.SMTP_PASSWORD as string,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    tls: {
      rejectUnauthorized: true,
    },
  });
}
