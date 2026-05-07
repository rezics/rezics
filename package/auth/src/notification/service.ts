import {
  formatSenderAddress,
  render,
  VerificationCode,
} from "@rezics/email";
import { env } from "../env";
import { createAuthMailer } from "./mailer";
import {
  buildChangeEmailConfirmationEmail,
  buildPasswordResetEmail,
  buildVerificationEmail,
} from "./templates";
import type {
  AuthNotificationService,
  AuthNotificationServiceOptions,
  ChangeEmailConfirmationPayload,
  PasswordResetEmailPayload,
  VerificationEmailPayload,
  VerificationOTPPayload,
} from "./types";

function getSender(type: "password-reset" | "verification"): string {
  const sender =
    type === "password-reset"
      ? env.AUTH_PASSWORD_RESET_FROM_EMAIL
      : env.AUTH_VERIFICATION_FROM_EMAIL;

  return formatSenderAddress({ email: sender, name: env.SMTP_USER_NAME });
}

export function createAuthNotificationService(
  _options?: AuthNotificationServiceOptions,
): AuthNotificationService {
  const transport = createAuthMailer();

  async function sendEmail(
    type: "password-reset" | "verification",
    to: string,
    template: { subject: string; text: string; html?: string },
  ): Promise<void> {
    await transport.sendOrThrow({
      from: getSender(type),
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  return {
    async sendPasswordResetEmail(
      data: PasswordResetEmailPayload,
    ): Promise<void> {
      await sendEmail(
        "password-reset",
        data.user.email,
        buildPasswordResetEmail(data),
      );
    },

    async sendVerificationEmail(data: VerificationEmailPayload): Promise<void> {
      await sendEmail(
        "verification",
        data.user.email,
        buildVerificationEmail(data),
      );
    },

    async sendChangeEmailConfirmation(
      data: ChangeEmailConfirmationPayload,
    ): Promise<void> {
      await sendEmail(
        "verification",
        data.user.email,
        buildChangeEmailConfirmationEmail(data),
      );
    },

    async sendVerificationOTP(data: VerificationOTPPayload): Promise<void> {
      const { html, text } = await render(VerificationCode, {
        code: data.otp,
      });

      await sendEmail("verification", data.email, {
        subject: "Your verification code",
        html,
        text,
      });
    },
  };
}
