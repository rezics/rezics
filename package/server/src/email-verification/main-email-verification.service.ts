import {
  createEmailSender,
  render,
  VerificationCode,
  type EmailDeliveryResult,
} from "@rezics/email";
import { env } from "@/env";

export const USER_EMAIL_CONTRACT_NAME = "user.email" as const;

export type MainEmailVerificationDeliveryResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | {
            code: "MAIN_EMAIL_SMTP_NOT_CONFIGURED";
            message: string;
          }
        | {
            code: "MAIN_EMAIL_DELIVERY_FAILED";
            message: string;
            cause: unknown;
          };
    };

function createMainEmailSender() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    return null;
  }

  return createEmailSender({
    defaultFrom: {
      email: env.MAIN_EMAIL_FROM_EMAIL,
      name: env.MAIN_EMAIL_FROM_NAME,
    },
    transport: {
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure: env.SMTP_SECURE.toLowerCase() !== "false",
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      rejectUnauthorized: true,
    },
  });
}

function mapDeliveryResult(
  result: EmailDeliveryResult,
): MainEmailVerificationDeliveryResult {
  if (result.ok) return result;

  return {
    ok: false,
    error: {
      code: "MAIN_EMAIL_DELIVERY_FAILED",
      message: result.error.message,
      cause: result.error.cause,
    },
  };
}

export async function sendMainEmailVerificationContractEmail(input: {
  to: string;
  code: string;
}): Promise<MainEmailVerificationDeliveryResult> {
  const sender = createMainEmailSender();
  if (!sender) {
    return {
      ok: false,
      error: {
        code: "MAIN_EMAIL_SMTP_NOT_CONFIGURED",
        message: "Main email SMTP delivery is not configured",
      },
    };
  }

  const { html, text } = await render(VerificationCode, {
    code: input.code,
  });

  return mapDeliveryResult(
    await sender.send({
      to: input.to,
      subject: "Verify your Rezics email",
      html,
      text,
    }),
  );
}
