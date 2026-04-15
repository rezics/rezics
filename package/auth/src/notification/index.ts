export { createAuthMailer, isMailerConfigured } from "./mailer";
export { createAuthNotificationService } from "./service";
export * from "./templates";
export type {
  AuthNotificationService,
  AuthNotificationServiceOptions,
  ChangeEmailConfirmationPayload,
  InvitationEmailPayload,
  NotificationChannel,
  PasswordResetEmailPayload,
  VerificationEmailPayload,
  VerificationOTPPayload,
} from "./types";
