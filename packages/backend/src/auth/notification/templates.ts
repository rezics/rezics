import type {
  ChangeEmailConfirmationPayload,
  PasswordResetEmailPayload,
  VerificationEmailPayload,
} from "./types";

type EmailTemplate = {
  subject: string;
  text: string;
  html?: string;
};

export function buildPasswordResetEmail(
  data: PasswordResetEmailPayload,
): EmailTemplate {
  const name = data.user.name || "there";

  return {
    subject: "Reset your password",
    text: [
      `Hello ${name},`,
      "",
      "We received a request to reset your password.",
      `Reset link: ${data.url}`,
      "",
      "If you did not request this change, you can ignore this email.",
    ].join("\n"),
    html: [
      `<p>Hello ${name},</p>`,
      "<p>We received a request to reset your password.</p>",
      `<p><a href="${data.url}">Reset your password</a></p>`,
      "<p>If you did not request this change, you can ignore this email.</p>",
    ].join(""),
  };
}

export function buildVerificationEmail(
  data: VerificationEmailPayload,
): EmailTemplate {
  const name = data.user.name || "there";

  return {
    subject: "Verify your email",
    text: [
      `Hello ${name},`,
      "",
      "Please verify your email address to complete your account setup.",
      `Verification link: ${data.url}`,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: [
      `<p>Hello ${name},</p>`,
      "<p>Please verify your email address to complete your account setup.</p>",
      `<p><a href="${data.url}">Verify your email</a></p>`,
      "<p>If you did not request this, you can ignore this email.</p>",
    ].join(""),
  };
}

export function buildChangeEmailConfirmationEmail(
  data: ChangeEmailConfirmationPayload,
): EmailTemplate {
  const name = data.user.name || "there";

  return {
    subject: "Confirm your email change",
    text: [
      `Hello ${name},`,
      "",
      `A request was made to change your account email to ${data.newEmail}.`,
      `Confirm this change: ${data.url}`,
      "",
      "If you did not request this change, you can ignore this email.",
    ].join("\n"),
    html: [
      `<p>Hello ${name},</p>`,
      `<p>A request was made to change your account email to ${data.newEmail}.</p>`,
      `<p><a href="${data.url}">Confirm this change</a></p>`,
      "<p>If you did not request this change, you can ignore this email.</p>",
    ].join(""),
  };
}
