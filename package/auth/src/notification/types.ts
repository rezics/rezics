export type PasswordResetEmailPayload = {
  user: {
    email: string;
    name: string;
  };
  url: string;
  token: string;
};

export type VerificationEmailPayload = {
  user: {
    email: string;
    name: string;
  };
  url: string;
  token: string;
};

export type ChangeEmailConfirmationPayload = {
  user: {
    email: string;
    name: string;
  };
  newEmail: string;
  url: string;
  token: string;
};

export type VerificationOTPPayload = {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
};

export type NotificationChannel = "email" | "telegram";

export type AuthNotificationServiceOptions = {
  telegram?: {
    enabled: boolean;
  };
};

export interface AuthNotificationService {
  sendPasswordResetEmail(data: PasswordResetEmailPayload): Promise<void>;
  sendVerificationEmail(data: VerificationEmailPayload): Promise<void>;
  sendVerificationOTP(data: VerificationOTPPayload): Promise<void>;
  sendChangeEmailConfirmation(
    data: ChangeEmailConfirmationPayload,
  ): Promise<void>;
}
