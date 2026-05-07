export { createAuthMailer, getDefaultSender } from "./mailer";
export { createAuthNotificationService } from "./service";
export * from "./templates";
export type {
  AuthNotificationService,
  AuthNotificationServiceOptions,
  ChangeEmailConfirmationPayload,
  NotificationChannel,
  PasswordResetEmailPayload,
  VerificationEmailPayload,
  VerificationOTPPayload,
} from "./types";
