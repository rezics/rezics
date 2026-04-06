export type InvitationEmailPayload = {
  id: string;
  email: string;
  role: string | string[];
  organization: {
    name: string;
  };
  inviter: {
    user: {
      name: string;
      email: string;
    };
  };
};

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

export type NotificationChannel = "email" | "telegram";

export type AuthNotificationServiceOptions = {
  telegram?: {
    enabled: boolean;
  };
};

export interface AuthNotificationService {
  sendInvitationEmail(data: InvitationEmailPayload): Promise<void>;
  sendPasswordResetEmail(data: PasswordResetEmailPayload): Promise<void>;
  sendVerificationEmail(data: VerificationEmailPayload): Promise<void>;
  sendChangeEmailConfirmation(
    data: ChangeEmailConfirmationPayload,
  ): Promise<void>;
}
