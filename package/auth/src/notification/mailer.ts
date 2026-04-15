import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";

export function getDefaultSender(): string {
  const email = env.AUTH_VERIFICATION_FROM_EMAIL;
  const name = env.SMTP_USER_NAME;
  return name?.trim() ? `${name.trim()} <${email}>` : email;
}

export function createAuthMailer(): Transporter {
  const port = Number(env.SMTP_PORT);
  const secure = env.SMTP_SECURE.toLowerCase() !== "false";

  return nodemailer.createTransport({
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
    tls: {
      rejectUnauthorized: true,
    },
  });
}
