import type { ComponentType } from "react";
import {
  EmailChangeConfirm,
  type EmailChangeConfirmProps,
} from "./templates/EmailChangeConfirm";
import { Invitation, type InvitationProps } from "./templates/Invitation";
import {
  PasswordReset,
  type PasswordResetProps,
} from "./templates/PasswordReset";
import {
  VerificationCode,
  type VerificationCodeProps,
} from "./templates/VerificationCode";

export interface TemplateRegistryEntry {
  name: string;
  description: string;
  component: ComponentType<any>;
  propSchema: Record<
    string,
    { type: string; required: boolean; description: string }
  >;
}

export const templateRegistry: TemplateRegistryEntry[] = [
  {
    name: "verification-code",
    description: "6-digit email verification code",
    component: VerificationCode as ComponentType<any>,
    propSchema: {
      code: {
        type: "string",
        required: true,
        description: "6-digit verification code",
      },
      userName: {
        type: "string",
        required: false,
        description: 'Recipient name (fallback: "there")',
      },
    },
  },
  {
    name: "password-reset",
    description: "Password reset link email",
    component: PasswordReset as ComponentType<any>,
    propSchema: {
      url: {
        type: "string",
        required: true,
        description: "Password reset URL",
      },
      userName: {
        type: "string",
        required: false,
        description: 'Recipient name (fallback: "there")',
      },
    },
  },
  {
    name: "invitation",
    description: "Organization invitation email",
    component: Invitation as ComponentType<any>,
    propSchema: {
      inviterName: {
        type: "string",
        required: true,
        description: "Name of the person sending the invitation",
      },
      orgName: {
        type: "string",
        required: true,
        description: "Organization name",
      },
      url: {
        type: "string",
        required: true,
        description: "Accept invitation URL",
      },
    },
  },
  {
    name: "email-change-confirm",
    description: "Email address change confirmation",
    component: EmailChangeConfirm as ComponentType<any>,
    propSchema: {
      url: { type: "string", required: true, description: "Confirmation URL" },
      userName: {
        type: "string",
        required: false,
        description: 'Recipient name (fallback: "there")',
      },
      newEmail: {
        type: "string",
        required: true,
        description: "New email address",
      },
    },
  },
];
