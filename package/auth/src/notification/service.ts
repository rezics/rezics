import {
  render,
  VerificationCode,
  PasswordReset,
  Invitation,
  EmailChangeConfirm,
} from "@rezics/email";
import { createAuthMailer, isMailerConfigured } from "./mailer";
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

type AuthEnv = {
  NODE_ENV?: "development" | "test" | "production";
  BETTER_AUTH_URL: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_USER_NAME?: string;
  AUTH_INVITATION_FROM_EMAIL?: string;
  AUTH_PASSWORD_RESET_FROM_EMAIL?: string;
  AUTH_VERIFICATION_FROM_EMAIL?: string;
};

function formatFromAddress(name: string | undefined, email: string): string {
  if (!name?.trim()) {
    return email;
  }

  return `${name.trim()} <${email}>`;
}

function getSender(
  config: AuthEnv,
  type: "invitation" | "password-reset" | "verification",
): string | null {
  const sender =
    type === "invitation"
      ? config.AUTH_INVITATION_FROM_EMAIL
      : type === "password-reset"
        ? (config.AUTH_PASSWORD_RESET_FROM_EMAIL ??
          config.AUTH_INVITATION_FROM_EMAIL)
        : (config.AUTH_VERIFICATION_FROM_EMAIL ??
          config.AUTH_INVITATION_FROM_EMAIL);

  if (!sender) {
    return null;
  }

  return formatFromAddress(config.SMTP_USER_NAME, sender);
}

async function logNotification(label: string, payload: unknown): Promise<void> {
  console.info(label, payload);
}

export function createAuthNotificationService(
  config: AuthEnv,
  _options?: AuthNotificationServiceOptions,
): AuthNotificationService {
  const transport = isMailerConfigured(config)
    ? createAuthMailer(config)
    : null;

  async function sendEmail(
    type: "invitation" | "password-reset" | "verification",
    to: string,
    template: { subject: string; text: string; html?: string },
    payload: unknown,
    warningMessage: string,
  ): Promise<void> {
    if (config.NODE_ENV !== "production") {
      await logNotification(`[auth] ${type} notification (dev mode)`, payload);
      return;
    }

    const from = getSender(config, type);

    if (!transport || !from) {
      console.warn(warningMessage);
      return;
    }

    await transport.sendMail({
      from,
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  return {
    async sendInvitationEmail(data: InvitationEmailPayload): Promise<void> {
      const inviteBaseUrl = config.BETTER_AUTH_URL.replace(/\/$/, "");
      const inviteLink = `${inviteBaseUrl}/accept-invitation/${data.id}`;
      const template = buildInvitationEmail(data, inviteLink);

      await sendEmail(
        "invitation",
        data.email,
        template,
        {
          invitationId: data.id,
          organizationName: data.organization.name,
          inviteeEmail: data.email,
          inviterName: data.inviter.user.name,
          inviteLink,
        },
        "[auth] Invitation email skipped: SMTP or sender email not configured.",
      );
    },

    async sendPasswordResetEmail(
      data: PasswordResetEmailPayload,
    ): Promise<void> {
      await sendEmail(
        "password-reset",
        data.user.email,
        buildPasswordResetEmail(data),
        {
          email: data.user.email,
          resetUrl: data.url,
          token: data.token,
        },
        "[auth] Password reset email skipped: SMTP or sender email not configured.",
      );
    },

    async sendVerificationEmail(data: VerificationEmailPayload): Promise<void> {
      await sendEmail(
        "verification",
        data.user.email,
        buildVerificationEmail(data),
        {
          email: data.user.email,
          verificationUrl: data.url,
          token: data.token,
        },
        "[auth] Verification email skipped: SMTP or sender email not configured.",
      );
    },

    async sendChangeEmailConfirmation(
      data: ChangeEmailConfirmationPayload,
    ): Promise<void> {
      await sendEmail(
        "verification",
        data.user.email,
        buildChangeEmailConfirmationEmail(data),
        {
          email: data.user.email,
          newEmail: data.newEmail,
          confirmationUrl: data.url,
          token: data.token,
        },
        "[auth] Email change confirmation skipped: SMTP or sender email not configured.",
      );
    },

    async sendVerificationOTP(data: VerificationOTPPayload): Promise<void> {
      const { html, text } = await render(VerificationCode, {
        code: data.otp,
      });

      await sendEmail(
        "verification",
        data.email,
        {
          subject: "Your verification code",
          html,
          text,
        },
        {
          email: data.email,
          type: data.type,
        },
        "[auth] Verification OTP email skipped: SMTP or sender email not configured.",
      );
    },
  };
}
