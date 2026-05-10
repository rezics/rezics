import nodemailer, { type Transporter } from "nodemailer";
import type SMTPPool from "nodemailer/lib/smtp-pool";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export type SmtpTransportOptions = SMTPTransport.Options & {
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
};

export interface SmtpTransportConfig {
  host: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
  rejectUnauthorized?: boolean;
}

export interface EmailSenderIdentity {
  email: string;
  name?: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string | EmailSenderIdentity;
}

export interface EmailDeliveryFailure {
  code: "EMAIL_DELIVERY_FAILED";
  message: string;
  cause: unknown;
}

export type EmailDeliveryResult =
  | { ok: true }
  | { ok: false; error: EmailDeliveryFailure };

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
  sendOrThrow(message: EmailMessage): Promise<void>;
  verify(): Promise<boolean>;
}

export interface CreateEmailSenderOptions {
  transport: SmtpTransportConfig;
  defaultFrom: EmailSenderIdentity;
  transporter?: Transporter;
}

export function formatSenderAddress(sender: EmailSenderIdentity): string {
  const email = sender.email.trim();
  const name = sender.name?.trim();
  return name ? `${name} <${email}>` : email;
}

function normalizeFromAddress(
  from: EmailMessage["from"],
  defaultFrom: EmailSenderIdentity,
): string {
  if (!from) return formatSenderAddress(defaultFrom);
  return typeof from === "string" ? from : formatSenderAddress(from);
}

export function buildSmtpTransportOptions(
  config: SmtpTransportConfig,
): SmtpTransportOptions {
  return {
    host: config.host,
    port: config.port ?? 587,
    secure: config.secure ?? false,
    auth: config.auth,
    pool: config.pool ?? true,
    maxConnections: config.maxConnections ?? 5,
    maxMessages: config.maxMessages ?? 100,
    tls:
      config.rejectUnauthorized === undefined
        ? undefined
        : { rejectUnauthorized: config.rejectUnauthorized },
  };
}

function createTransporter(config: SmtpTransportConfig): Transporter {
  const options = buildSmtpTransportOptions(config);
  return options.pool
    ? nodemailer.createTransport(options as SMTPPool.Options)
    : nodemailer.createTransport(options as SMTPTransport.Options);
}

function toDeliveryFailure(error: unknown): EmailDeliveryFailure {
  return {
    code: "EMAIL_DELIVERY_FAILED",
    message:
      error instanceof Error ? error.message : "Email delivery failed",
    cause: error,
  };
}

export function createEmailSender(
  options: CreateEmailSenderOptions,
): EmailSender {
  const transporter = options.transporter ?? createTransporter(options.transport);
  const send: EmailSender["send"] = async (message) => {
    try {
      await transporter.sendMail({
        from: normalizeFromAddress(message.from, options.defaultFrom),
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toDeliveryFailure(error) };
    }
  };

  return {
    send,

    async sendOrThrow(message) {
      const result = await send(message);
      if (!result.ok) {
        throw result.error;
      }
    },

    async verify() {
      return transporter.verify();
    },
  };
}
