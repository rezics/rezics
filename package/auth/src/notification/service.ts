import {
  EmailChangeConfirm,
  Invitation,
  PasswordReset,
  render,
  VerificationCode,
} from "@rezics/email";
import { env } from "../env";
import { createAuthMailer } from "./mailer";
import {
  buildChangeEmailConfirmationEmail,
  buildInvitationEmail,
  buildPasswordResetEmail,
  buildVerificationEmail,
} from "./templates";
import type {
  AuthNotificationService,
  AuthNotificationServiceOptions,
  ChangeEmailConfirmationPayload,
  InvitationEmailPayload,
  PasswordResetEmailPayload,
  VerificationEmailPayload,
  VerificationOTPPayload,
} from "./types";

function formatFromAddress(name: string | undefined, email: string): string {
  if (!name?.trim()) {
    return email;
  }

  return `${name.trim()} <${email}>`;
}

function getSender(
  type: "invitation" | "password-reset" | "verification",
): string {
  const sender =
    type === "invitation"
      ? env.AUTH_INVITATION_FROM_EMAIL
      : type === "password-reset"
        ? (env.AUTH_PASSWORD_RESET_FROM_EMAIL ?? env.AUTH_INVITATION_FROM_EMAIL)
        : (env.AUTH_VERIFICATION_FROM_EMAIL ?? env.AUTH_INVITATION_FROM_EMAIL);

  return formatFromAddress(env.SMTP_USER_NAME, sender);
}

export function createAuthNotificationService(
  _options?: AuthNotificationServiceOptions,
): AuthNotificationService {
  const transport = createAuthMailer();

  async function sendEmail(
    type: "invitation" | "password-reset" | "verification",
    to: string,
    template: { subject: string; text: string; html?: string },
  ): Promise<void> {
    await transport.sendMail({
      from: getSender(type),
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  return {
    async sendInvitationEmail(data: InvitationEmailPayload): Promise<void> {
      const inviteBaseUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");
      const inviteLink = `${inviteBaseUrl}/accept-invitation/${data.id}`;
      const template = buildInvitationEmail(data, inviteLink);

      await sendEmail("invitation", data.email, template);
    },

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
